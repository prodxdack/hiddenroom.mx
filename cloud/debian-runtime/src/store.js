"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");
const stamp = () => new Date().toISOString();
const json = (value, fallback = {}) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const SCHEMA = `
CREATE TABLE IF NOT EXISTS identities (
  auth_subject TEXT PRIMARY KEY,
  business_user_id TEXT NOT NULL UNIQUE,
  root_slug TEXT NOT NULL,
  roles_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  auth_subject TEXT NOT NULL REFERENCES identities(auth_subject) ON DELETE CASCADE,
  business_user_id TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  roles_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('backup_upload', 'restore')),
  business_user_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  path TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TEXT NOT NULL,
  lease_until TEXT,
  worker_id TEXT,
  idempotency_key TEXT NOT NULL,
  progress_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (business_user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS jobs_claim_idx ON jobs(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS jobs_owner_idx ON jobs(business_user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  business_user_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  root_slug TEXT NOT NULL,
  stage_name TEXT NOT NULL UNIQUE,
  "offset" INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('uploading','queued','completed','failed')),
  idempotency_key TEXT NOT NULL,
  job_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (business_user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS transfers_owner_idx ON transfers(business_user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS tombstones (
  business_user_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('file', 'folder')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (business_user_id, relative_path)
);
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS metrics_created_idx ON metrics(created_at DESC);
CREATE TABLE IF NOT EXISTS cloud_trash (
  id TEXT PRIMARY KEY,
  deleted_by TEXT NOT NULL,
  business_user_id TEXT NOT NULL,
  original_path TEXT NOT NULL,
  name TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('file','folder')),
  stored_name TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL DEFAULT 0,
  modified_at TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  tombstone_user_id TEXT,
  tombstone_path TEXT
);
CREATE INDEX IF NOT EXISTS cloud_trash_deleted_idx ON cloud_trash(deleted_at DESC);
CREATE TABLE IF NOT EXISTS backup_folders (
  business_user_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  cloud_name TEXT NOT NULL,
  local_path TEXT NOT NULL,
  host_name TEXT NOT NULL,
  marker_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (business_user_id, folder_id)
);
CREATE INDEX IF NOT EXISTS backup_folders_owner_idx ON backup_folders(business_user_id, updated_at DESC);
`;
class CloudStore {
  constructor(filePath) {
    if (!filePath) throw new Error("CLOUD_SQLITE_PATH is required.");
    this.filePath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    this.db = new Database(this.filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.db.pragma("synchronous = FULL");
    this.db.exec(SCHEMA);
  }
  close() {
    this.db.close();
  }
  syncIdentity(i) {
    const t = stamp();
    this.db
      .prepare(
        `INSERT INTO identities VALUES(@authSubject,@businessUserId,@rootSlug,@roles,@permissions,@stamp,@stamp)
      ON CONFLICT(auth_subject) DO UPDATE SET business_user_id=excluded.business_user_id,root_slug=excluded.root_slug,
      roles_json=excluded.roles_json,permissions_json=excluded.permissions_json,verified_at=excluded.verified_at,updated_at=excluded.updated_at`,
      )
      .run({
        ...i,
        roles: JSON.stringify(i.roles),
        permissions: JSON.stringify(i.permissions),
        stamp: t,
      });
  }
  issueSession(i, ttlMs) {
    this.syncIdentity(i);
    const token = crypto.randomBytes(32).toString("base64url");
    const t = stamp();
    this.db
      .prepare(
        `INSERT INTO sessions(token_hash,auth_subject,business_user_id,permissions_json,roles_json,expires_at,created_at) VALUES(?,?,?,?,?,?,?)`,
      )
      .run(
        hashToken(token),
        i.authSubject,
        i.businessUserId,
        JSON.stringify(i.permissions),
        JSON.stringify(i.roles),
        new Date(Date.now() + ttlMs).toISOString(),
        t,
      );
    return { token, expiresAt: new Date(Date.now() + ttlMs).toISOString() };
  }
  authenticate(token) {
    if (!token || token.length > 256) return null;
    const r = this.db
      .prepare(
        `SELECT s.auth_subject,s.business_user_id,s.expires_at,i.root_slug,i.roles_json,i.permissions_json FROM sessions s JOIN identities i USING(auth_subject) WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?`,
      )
      .get(hashToken(token), stamp());
    return r
      ? {
          authSubject: r.auth_subject,
          businessUserId: r.business_user_id,
          rootSlug: r.root_slug,
          permissions: json(r.permissions_json, []),
          roles: json(r.roles_json, []),
        }
      : null;
  }
  enqueue({
    action,
    businessUserId,
    createdBy,
    path: relativePath,
    payload,
    idempotencyKey,
    maxAttempts = 5,
  }) {
    const prior = this.db
      .prepare(
        "SELECT * FROM jobs WHERE business_user_id=? AND idempotency_key=?",
      )
      .get(businessUserId, idempotencyKey);
    if (prior) {
      const p = json(prior.payload_json);
      if (
        p.sha256 !== payload.sha256 ||
        Number(p.size) !== Number(payload.size) ||
        prior.path !== relativePath
      ) {
        const e = new Error(
          "La clave de idempotencia ya se usÃ³ con contenido distinto.",
        );
        e.statusCode = 409;
        throw e;
      }
      return { job: this._job(prior), created: false };
    }
    const t = stamp(),
      id = crypto.randomUUID();
    try {
      this.db
        .prepare(
          `INSERT INTO jobs(id,action,business_user_id,created_by,path,payload_json,status,available_at,idempotency_key,max_attempts,created_at,updated_at) VALUES(?,?,?,?,?,?,'pending',?,?,?,?,?)`,
        )
        .run(
          id,
          action,
          businessUserId,
          createdBy,
          relativePath,
          JSON.stringify(payload),
          t,
          idempotencyKey,
          maxAttempts,
          t,
          t,
        );
    } catch (e) {
      if (!String(e.message).includes("UNIQUE")) throw e;
      const raced = this.db
        .prepare(
          "SELECT * FROM jobs WHERE business_user_id=? AND idempotency_key=?",
        )
        .get(businessUserId, idempotencyKey);
      if (!raced) throw e;
      return { job: this._job(raced), created: false };
    }
    return { job: this.getJob(id), created: true };
  }
  claim(workerId, leaseMs) {
    const claim = this.db.transaction(() => {
      const t = stamp();
      this.db
        .prepare(
          `UPDATE jobs SET status='failed',error='Se agotaron los intentos tras perder la concesiÃ³n del worker.',completed_at=?,updated_at=?,lease_until=NULL,worker_id=NULL WHERE status='processing' AND attempts>=max_attempts AND (lease_until IS NULL OR lease_until<=?)`,
        )
        .run(t, t, t);
      const row = this.db
        .prepare(
          `SELECT id FROM jobs WHERE attempts<max_attempts AND available_at<=? AND (status='pending' OR (status='processing' AND (lease_until IS NULL OR lease_until<=?))) ORDER BY created_at LIMIT 1`,
        )
        .get(t, t);
      if (!row) return null;
      const until = new Date(Date.now() + leaseMs).toISOString();
      const result = this.db
        .prepare(
          `UPDATE jobs SET status='processing',attempts=attempts+1,worker_id=?,lease_until=?,updated_at=? WHERE id=? AND (status='pending' OR lease_until IS NULL OR lease_until<=?)`,
        )
        .run(workerId, until, t, row.id, t);
      if (!result.changes) return null;
      const job = this.getJob(row.id);
      job.payload = json(
        this.db.prepare("SELECT payload_json FROM jobs WHERE id=?").get(row.id)
          .payload_json,
      );
      return job;
    });
    return claim.immediate();
  }
  heartbeat(id, worker, leaseMs, progress) {
    const t = stamp();
    return (
      this.db
        .prepare(
          `UPDATE jobs SET lease_until=?,progress_json=?,updated_at=? WHERE id=? AND status='processing' AND worker_id=?`,
        )
        .run(
          new Date(Date.now() + leaseMs).toISOString(),
          JSON.stringify(progress || {}),
          t,
          id,
          worker,
        ).changes > 0
    );
  }
  complete(id, worker, result) {
    const t = stamp();
    return (
      this.db
        .prepare(
          `UPDATE jobs SET status='completed',result_json=?,progress_json='{"percent":100}',error=NULL,lease_until=NULL,worker_id=NULL,updated_at=?,completed_at=? WHERE id=? AND status='processing' AND worker_id=?`,
        )
        .run(JSON.stringify(result || {}), t, t, id, worker).changes > 0
    );
  }
  fail(id, worker, error, retryable = true) {
    const j = this.db
      .prepare(
        "SELECT attempts,max_attempts FROM jobs WHERE id=? AND worker_id=?",
      )
      .get(id, worker);
    if (!j) return false;
    const retry = retryable && j.attempts < j.max_attempts,
      t = stamp(),
      next = retry
        ? new Date(
            Date.now() + Math.min(900000, 1000 * 2 ** (j.attempts - 1)),
          ).toISOString()
        : t;
    this.db
      .prepare(
        "UPDATE jobs SET status=?,available_at=?,lease_until=NULL,worker_id=NULL,error=?,updated_at=?,completed_at=? WHERE id=? AND worker_id=?",
      )
      .run(
        retry ? "pending" : "failed",
        next,
        String(error).slice(0, 2000),
        t,
        retry ? null : t,
        id,
        worker,
      );
    return retry;
  }
  createTransfer(input) {
    const prior = this.db.prepare(
      "SELECT * FROM transfers WHERE business_user_id=? AND idempotency_key=?",
    ).get(input.businessUserId, input.idempotencyKey);
    if (prior) {
      if (prior.path !== input.path || prior.size !== input.size || prior.sha256 !== input.sha256) {
        const error = new Error("La clave de idempotencia ya se usÃ³ con otro archivo.");
        error.statusCode = 409;
        throw error;
      }
      return { transfer: prior, created: false };
    }
    const t = stamp();
    const row = {
      id: crypto.randomUUID(),
      businessUserId: input.businessUserId,
      createdBy: input.createdBy,
      path: input.path,
      size: input.size,
      sha256: input.sha256,
      rootSlug: input.rootSlug,
      stageName: crypto.randomUUID() + ".upload",
      idempotencyKey: input.idempotencyKey,
      createdAt: t,
    };
    this.db.prepare("INSERT INTO transfers(id,business_user_id,created_by,path,size,sha256,root_slug,stage_name,status,idempotency_key,created_at,updated_at) VALUES(@id,@businessUserId,@createdBy,@path,@size,@sha256,@rootSlug,@stageName,'uploading',@idempotencyKey,@createdAt,@createdAt)").run(row);
    return { transfer: this.getTransfer(row.id, row.businessUserId), created: true };
  }
  getTransfer(id, user) {
    return this.db.prepare("SELECT * FROM transfers WHERE id=? AND business_user_id=?").get(id, user);
  }
  setTransferOffset(id, user, offset) {
    return this.db.prepare("UPDATE transfers SET \"offset\"=?,updated_at=? WHERE id=? AND business_user_id=? AND status='uploading'")
      .run(offset, stamp(), id, user).changes > 0;
  }
  queueTransfer(id, user, jobId) {
    return this.db.prepare("UPDATE transfers SET status='queued',job_id=?,updated_at=? WHERE id=? AND business_user_id=? AND status='uploading'")
      .run(jobId, stamp(), id, user).changes > 0;
  }
  setTransferStatus(id, status) {
    this.db.prepare("UPDATE transfers SET status=?,updated_at=? WHERE id=?").run(status, stamp(), id);
  }
  getJob(id, user) {
    const r = user
      ? this.db
          .prepare("SELECT * FROM jobs WHERE id=? AND business_user_id=?")
          .get(id, user)
      : this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
    return r && this._job(r);
  }
  listJobs(user, limit = 50) {
    return this.db
      .prepare(
        "SELECT * FROM jobs WHERE business_user_id=? ORDER BY created_at DESC LIMIT ?",
      )
      .all(user, limit)
      .map((r) => this._job(r));
  }
  upsertBackupFolder({ businessUserId, folderId, folderName, cloudName, localPath, hostName, markerVersion = 1 }) {
    const now = stamp();
    const row = { businessUserId, folderId, folderName, cloudName, localPath, hostName, markerVersion: Number.isInteger(markerVersion) ? markerVersion : 1, now };
    this.db.prepare("INSERT INTO backup_folders(business_user_id,folder_id,folder_name,cloud_name,local_path,host_name,marker_version,created_at,updated_at) VALUES(@businessUserId,@folderId,@folderName,@cloudName,@localPath,@hostName,@markerVersion,@now,@now) ON CONFLICT(business_user_id,folder_id) DO UPDATE SET folder_name=excluded.folder_name,cloud_name=excluded.cloud_name,local_path=excluded.local_path,host_name=excluded.host_name,marker_version=excluded.marker_version,updated_at=excluded.updated_at").run(row);
    return this.db.prepare("SELECT * FROM backup_folders WHERE business_user_id=? AND folder_id=?").get(businessUserId, folderId);
  }
  listBackupFolders(businessUserId) {
    return this.db.prepare("SELECT * FROM backup_folders WHERE business_user_id=? ORDER BY folder_name COLLATE NOCASE, cloud_name COLLATE NOCASE").all(businessUserId);
  }
  _job(r) {
    return {
      id: r.id,
      action: r.action,
      business_user_id: r.business_user_id,
      path: r.path,
      status: r.status,
      attempts: r.attempts,
      progress: json(r.progress_json),
      result: json(r.result_json, null),
      error: r.error,
      created_at: r.created_at,
      updated_at: r.updated_at,
      completed_at: r.completed_at,
    };
  }
  blocked(user, p) {
    const rows = this.db
      .prepare(
        "SELECT relative_path,item_type FROM tombstones WHERE business_user_id=?",
      )
      .all(user);
    return rows.some(
      (r) =>
        r.relative_path === "." ||
        r.relative_path === p ||
        (r.item_type === "folder" && p.startsWith(r.relative_path + "/")),
    );
  }
  addTombstone({ businessUserId, relativePath, itemType, createdBy }) {
    this.db
      .prepare(
        `INSERT INTO tombstones VALUES(?,?,?,?,?) ON CONFLICT(business_user_id,relative_path) DO UPDATE SET item_type=excluded.item_type,created_by=excluded.created_by,created_at=excluded.created_at`,
      )
      .run(businessUserId, relativePath, itemType, createdBy, stamp());
  }
  removeTombstone(user, p) {
    return (
      this.db
        .prepare(
          "DELETE FROM tombstones WHERE business_user_id=? AND relative_path=?",
        )
        .run(user, p).changes > 0
    );
  }
  referencedStages() {
    const jobs = this.db.prepare(
      "SELECT payload_json FROM jobs WHERE status IN ('pending','processing')",
    ).all().map((r) => json(r.payload_json).stage_name).filter(Boolean);
    const transfers = this.db.prepare(
      "SELECT stage_name FROM transfers WHERE status IN ('uploading','queued')",
    ).all().map((r) => r.stage_name);
    return new Set([...jobs, ...transfers]);
  }  revokeSession(token, businessUserId) {
    return this.db.prepare("UPDATE sessions SET revoked_at=? WHERE token_hash=? AND business_user_id=? AND revoked_at IS NULL")
      .run(stamp(), hashToken(token), businessUserId).changes > 0;
  }
  addTrashEntry(entry) {
    this.db.prepare(`INSERT INTO cloud_trash(id,deleted_by,business_user_id,original_path,name,item_type,stored_name,size,modified_at,deleted_at,tombstone_user_id,tombstone_path)
      VALUES(@id,@deletedBy,@businessUserId,@originalPath,@name,@itemType,@storedName,@size,@modifiedAt,@deletedAt,@tombstoneUserId,@tombstonePath)`).run(entry);
  }
  listTrash() {
    return this.db.prepare("SELECT * FROM cloud_trash ORDER BY deleted_at DESC").all();
  }
  getTrash(id) {
    return this.db.prepare("SELECT * FROM cloud_trash WHERE id=?").get(id);
  }
  removeTrash(id) {
    return this.db.prepare("DELETE FROM cloud_trash WHERE id=?").run(id).changes > 0;
  }
  appendMetric(payload, retain = 1000) {
    this.db
      .prepare("INSERT INTO metrics(created_at,payload_json) VALUES(?,?)")
      .run(stamp(), JSON.stringify(payload));
    this.db
      .prepare(
        "DELETE FROM metrics WHERE id NOT IN (SELECT id FROM metrics ORDER BY id DESC LIMIT ?)",
      )
      .run(retain);
  }
  async backupTo(destination) {
    const p = path.resolve(destination);
    fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
    await this.db.backup(p);
    return p;
  }
}
module.exports = { CloudStore, hashToken };

