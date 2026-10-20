"use strict";
const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { CloudStore } = require("./store");

const env = process.env;
const DB_PATH =
  env.CLOUD_SQLITE_PATH || path.join(__dirname, "..", "data", "cloud.sqlite");
const ROOT = path.resolve(
  env.CLOUD_HIDDENROOM_ROOT ||
    env.CLOUD_ROOT ||
    path.join(__dirname, "..", "..", "..", "..", "hiddenroom-data"),
);
const STAGE = path.resolve(
  env.CLOUD_LOCAL_STAGING_ROOT || path.join(path.dirname(DB_PATH), "staging"),
);
const HOST = env.CLOUD_LOCAL_API_HOST || "127.0.0.1";
const PORT = Number(env.CLOUD_LOCAL_API_PORT || 8090);
const MAX_BYTES = Number(
  env.CLOUD_LOCAL_MAX_UPLOAD_BYTES || 50 * 1024 * 1024 * 1024,
);
const SESSION_TTL_MS = Number(
  env.CLOUD_LOCAL_SESSION_TTL_MS || 8 * 60 * 60 * 1000,
);
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = env.SUPABASE_URL;
const store = new CloudStore(DB_PATH);
const rate = new Map();

function reply(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(status === 204 ? "" : JSON.stringify(data));
}
function fail(res, status, message, headers = {}) {
  return reply(res, status, { success: false, error: message }, headers);
}
function bearer(req) {
  const m = String(req.headers.authorization || "").match(/^Bearer\s+(\S+)$/i);
  return m?.[1] || "";
}
function allowRate(key, limit = 60, period = 60000) {
  const t = Date.now(),
    old = rate.get(key);
  if (!old || t - old.start >= period) {
    rate.set(key, { start: t, count: 1 });
    return true;
  }
  old.count++;
  if (old.count > limit) return false;
  if (rate.size > 5000)
    for (const [k, v] of rate) if (t - v.start > period * 2) rate.delete(k);
  return true;
}
function safeRelative(raw) {
  const value = String(raw || "")
    .replace(/\\/g, "/")
    .trim();
  const parts = value.split("/");
  if (
    !value ||
    value.startsWith("/") ||
    parts.some(
      (x) => !x || x === "." || x === ".." || /[\u0000-\u001f\u007f]/.test(x),
    )
  ) {
    const e = new Error("Ruta relativa invÃ¡lida.");
    e.statusCode = 400;
    throw e;
  }
  return parts.join("/");
}
function slug(value, fallback) {
  const result = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[-._]{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return result || fallback;
}
function requestAddress(req) {
  const forwarded = String(req.headers["cf-connecting-ip"] || "").trim();
  return /^[0-9a-f:.]{2,45}$/i.test(forwarded)
    ? forwarded
    : req.socket.remoteAddress || "unknown";
}
function authenticate(req, res, limit = 120) {
  const token = bearer(req),
    identity = store.authenticate(token);
  if (!identity) {
    fail(res, 401, "SesiÃ³n de Cloud invÃ¡lida o vencida.");
    return null;
  }
  if (!allowRate("u:" + identity.businessUserId, limit)) {
    fail(res, 429, "Demasiadas solicitudes. Intenta de nuevo en un minuto.");
    return null;
  }
  req.cloudToken = token;
  return identity;
}
async function exchangeSupabaseSession(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY)
      return fail(
        res,
        503,
        "El intercambio de sesiÃ³n requiere Supabase disponible.",
      );
    const incoming = bearer(req);
    if (!incoming) return fail(res, 401, "Falta la sesiÃ³n de Hidden Room.");
    if (!allowRate("exchange:" + requestAddress(req), 8))
      return fail(res, 429, "LÃ­mite de inicio de sesiÃ³n excedido.");
    const base = SUPABASE_URL.replace(/\/+$/, "");
    const headers = {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + incoming,
    };
    const auth = await fetch(base + "/auth/v1/user", {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!auth.ok)
      return fail(res, 401, "La sesiÃ³n de Hidden Room no es vÃ¡lida.");
    const user = await auth.json();
    const profileUrl = new URL(base + "/rest/v1/users");
    profileUrl.searchParams.set(
      "select",
      "id,user_id,username,display_name,email,roles",
    );
    profileUrl.searchParams.set("id", "eq." + user.id);
    profileUrl.searchParams.set("limit", "1");
    const privilegedHeaders = {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
    };
    const profileResponse = await fetch(profileUrl, {
      headers: privilegedHeaders,
      signal: AbortSignal.timeout(8000),
    });
    if (!profileResponse.ok)
      return fail(res, 503, "No se pudo consultar el perfil para abrir Cloud.");
    const profiles = await profileResponse.json(),
      profile = profiles[0];
    if (!profile?.user_id || !/^[A-Za-z0-9_-]+$/.test(String(profile.user_id)))
      return fail(res, 409, "El perfil no tiene un user_id operativo vÃ¡lido.");
    const permissionUrl = new URL(base + "/rest/v1/user_permissions");
    permissionUrl.searchParams.set("select", "permission_key");
    permissionUrl.searchParams.set("user_id", "eq." + user.id);
    const permissionResponse = await fetch(permissionUrl, {
      headers: privilegedHeaders,
      signal: AbortSignal.timeout(8000),
    });
    if (!permissionResponse.ok)
      return fail(res, 503, "No se pudieron validar los permisos de Cloud.");
    const permissions = (await permissionResponse.json()).map((row) =>
      String(row.permission_key || "").toLowerCase(),
    );
    const roles = String(profile.roles || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (!roles.includes("admin") && !permissions.includes("cloud.upload") && !permissions.includes("academia.admin"))
      return fail(res, 403, "No tienes permiso para usar Cloud.");
    const identity = {
      authSubject: user.id,
      businessUserId: String(profile.user_id),
      rootSlug: slug(
        profile.username || profile.display_name || profile.email,
        profile.user_id,
      ),
      roles,
      permissions,
    };
    const session = store.issueSession(identity, SESSION_TTL_MS);
    return reply(res, 200, {
      success: true,
      token: session.token,
      expires_at: session.expiresAt,
      business_user_id: identity.businessUserId,
    });
  } catch {
    return fail(
      res,
      503,
      "Supabase no estÃ¡ disponible para iniciar esta sesiÃ³n.",
    );
  }
}
async function receiveBackup(req, res, identity, url) {
  const relativePath = safeRelative(url.searchParams.get("path"));
  const idempotencyKey = String(req.headers["idempotency-key"] || "");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(idempotencyKey))
    return fail(res, 400, "Falta una clave de idempotencia vÃ¡lida.");
  const size = Number(req.headers["content-length"]);
  const expectedHash = String(
    req.headers["x-content-sha256"] || "",
  ).toLowerCase();
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_BYTES)
    return fail(res, 413, "TamaÃ±o fuera del lÃ­mite configurado.");
  if (!/^[a-f0-9]{64}$/.test(expectedHash))
    return fail(res, 400, "Falta una huella SHA-256 vÃ¡lida.");
  if (store.blocked(identity.businessUserId, relativePath))
    return fail(
      res,
      409,
      "El archivo estÃ¡ bloqueado por un borrado manual en Cloud.",
    );
  await fsp.mkdir(STAGE, { recursive: true, mode: 0o700 });
  await fsp.mkdir(ROOT, { recursive: true, mode: 0o700 });
  const stageStats = await fsp.statfs(STAGE),
    rootStats = await fsp.statfs(ROOT);
  const stageFree = Number(stageStats.bavail) * Number(stageStats.bsize),
    rootFree = Number(rootStats.bavail) * Number(rootStats.bsize);
  const reserve = Number(
      env.CLOUD_LOCAL_MIN_FREE_BYTES || 2 * 1024 * 1024 * 1024,
    ),
    sameDevice = (await fsp.stat(STAGE)).dev === (await fsp.stat(ROOT)).dev;
  if (
    stageFree < size + reserve ||
    rootFree < size + (sameDevice ? size : 0) + reserve
  )
    return fail(
      res,
      507,
      "Espacio insuficiente en staging o almacenamiento Cloud.",
    );
  const stageName = crypto.randomUUID() + ".upload";
  const stagePath = path.join(STAGE, stageName);
  const handle = await fsp.open(stagePath, "wx", 0o600),
    hash = crypto.createHash("sha256");
  let received = 0;
  try {
    for await (const chunk of req) {
      received += chunk.length;
      if (received > size || received > MAX_BYTES)
        throw Object.assign(
          new Error("El cuerpo excede el tamaÃ±o declarado."),
          { statusCode: 413 },
        );
      hash.update(chunk);
      let offset = 0;
      while (offset < chunk.length) {
        const out = await handle.write(chunk, offset, chunk.length - offset);
        offset += out.bytesWritten;
      }
    }
    await handle.sync();
    if (received !== size)
      throw Object.assign(
        new Error("La transferencia terminÃ³ antes de recibir todos los bytes."),
        { statusCode: 400 },
      );
    if (hash.digest("hex") !== expectedHash)
      throw Object.assign(new Error("La huella SHA-256 no coincide."), {
        statusCode: 422,
      });
  } catch (error) {
    await handle.close().catch(() => {});
    await fsp.unlink(stagePath).catch(() => {});
    return fail(res, error.statusCode || 400, error.message);
  }
  await handle.close();
  try {
    const outcome = store.enqueue({
      action: "backup_upload",
      businessUserId: identity.businessUserId,
      createdBy: identity.authSubject,
      path: relativePath,
      payload: {
        stage_name: stageName,
        size,
        sha256: expectedHash,
        root_slug: identity.rootSlug,
      },
      idempotencyKey,
    });
    if (!outcome.created) await fsp.unlink(stagePath).catch(() => {});
    return reply(res, 202, { success: true, job: outcome.job });
  } catch (error) {
    await fsp.unlink(stagePath).catch(() => {});
    return fail(res, error.statusCode || 500, error.message);
  }
}

const CHUNK_BYTES = Math.max(64 * 1024, Math.min(16 * 1024 * 1024, Number(env.CLOUD_LOCAL_CHUNK_BYTES || 5 * 1024 * 1024)));
const transferLocks = new Set();
function uploadOffsetHeaders(offset, size, status, jobId) {
  return {
    "Upload-Offset": String(offset),
    "Upload-Length": String(size),
    "Tus-Resumable": "1.0.0",
    "X-Transfer-Status": status || "uploading",
    ...(jobId ? { "X-Job-Id": jobId } : {}),
    "Cache-Control": "no-store",
  };
}
function transferIdFrom(url) {
  const match = url.pathname.match(/^\/api\/transfers\/([0-9a-f-]{36})$/i);
  return match?.[1] || "";
}
async function hashFile(file) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function ensureTransferStage(row) {
  await fsp.mkdir(STAGE, { recursive: true, mode: 0o700 });
  const file = path.join(STAGE, row.stage_name);
  let actual = 0;
  try { actual = (await fsp.stat(file)).size; }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fsp.writeFile(file, Buffer.alloc(0), { flag: "wx", mode: 0o600 });
  }
  if (actual !== row.offset) {
    const committed = Math.min(actual, row.offset);
    const handle = await fsp.open(file, "r+");
    try { await handle.truncate(committed); await handle.sync(); }
    finally { await handle.close(); }
    store.setTransferOffset(row.id, row.business_user_id, committed);
    row.offset = committed;
  }
  return file;
}
async function createTransfer(req, res, identity) {
  let body;
  try { body = await readJson(req, 16 * 1024); }
  catch (error) { return fail(res, 400, error.message); }
  const relativePath = safeRelative(body.path);
  const size = Number(body.size), expectedHash = String(body.sha256 || "").toLowerCase();
  const idempotencyKey = String(req.headers["idempotency-key"] || "");
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_BYTES) return fail(res, 413, "TamaÃ±o fuera del lÃ­mite configurado.");
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return fail(res, 400, "Falta una huella SHA-256 vÃ¡lida.");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(idempotencyKey)) return fail(res, 400, "Falta una clave de idempotencia vÃ¡lida.");
  if (store.blocked(identity.businessUserId, relativePath)) return fail(res, 409, "El archivo estÃ¡ bloqueado por un borrado manual en Cloud.");
  const outcome = store.createTransfer({
    businessUserId: identity.businessUserId,
    createdBy: identity.authSubject,
    path: relativePath,
    size,
    sha256: expectedHash,
    rootSlug: identity.rootSlug,
    idempotencyKey,
  });
  if (outcome.transfer.status !== "uploading") {
    const job = outcome.transfer.job_id ? store.getJob(outcome.transfer.job_id, identity.businessUserId) : null;
    return reply(res, 200, { success: true, transfer_id: outcome.transfer.id, offset: outcome.transfer.offset, length: outcome.transfer.size, status: outcome.transfer.status, job_id: outcome.transfer.job_id, job });
  }
  const file = await ensureTransferStage(outcome.transfer);
  await fsp.mkdir(STAGE, { recursive: true, mode: 0o700 });
  await fsp.mkdir(ROOT, { recursive: true, mode: 0o700 });
  const stageStats = await fsp.statfs(STAGE);
  const rootStats = await fsp.statfs(ROOT);
  const stageFree = Number(stageStats.bavail) * Number(stageStats.bsize);
  const rootFree = Number(rootStats.bavail) * Number(rootStats.bsize);
  const reserve = Number(env.CLOUD_LOCAL_MIN_FREE_BYTES || 2 * 1024 * 1024 * 1024);
  const sameDevice = (await fsp.stat(STAGE)).dev === (await fsp.stat(ROOT)).dev;
  const remaining = Math.max(0, size - outcome.transfer.offset);
  if (stageFree < remaining + reserve || rootFree < size + (sameDevice ? remaining : 0) + reserve)
    return fail(res, 507, "Espacio insuficiente en staging o almacenamiento Cloud.");
  if (outcome.transfer.status === "uploading" && outcome.transfer.offset === size) {
    const digest = await hashFile(file);
    if (digest !== expectedHash) return fail(res, 422, "La huella SHA-256 no coincide.");
    const queued = store.enqueue({
      action: "backup_upload",
      businessUserId: identity.businessUserId,
      createdBy: identity.authSubject,
      path: relativePath,
      payload: { stage_name: outcome.transfer.stage_name, size, sha256: expectedHash, root_slug: identity.rootSlug, transfer_id: outcome.transfer.id },
      idempotencyKey: "transfer-" + outcome.transfer.id,
    });
    store.queueTransfer(outcome.transfer.id, identity.businessUserId, queued.job.id);
    return reply(res, 202, { success: true, transfer_id: outcome.transfer.id, offset: 0, length: size, job: queued.job });
  }
  return reply(res, 201, { success: true, transfer_id: outcome.transfer.id, offset: outcome.transfer.offset, length: outcome.transfer.size, status: outcome.transfer.status, job_id: outcome.transfer.job_id, job: outcome.transfer.job_id ? store.getJob(outcome.transfer.job_id, identity.businessUserId) : null });
}
async function inspectTransfer(req, res, identity, id) {
  const row = store.getTransfer(id, identity.businessUserId);
  if (!row) return fail(res, 404, "Transferencia no encontrada.");
  if (row.status === "uploading") {
    const file = await ensureTransferStage(row);
    const actual = (await fsp.stat(file)).size;
    if (actual !== row.offset) store.setTransferOffset(id, identity.businessUserId, actual);
    row.offset = actual;
  }
  return reply(res, 200, {
    success: true, transfer_id: id, offset: row.offset, length: row.size,
    status: row.status, job_id: row.job_id,
    ...uploadOffsetHeaders(row.offset, row.size, row.status, row.job_id),
  }, uploadOffsetHeaders(row.offset, row.size, row.status, row.job_id));
}
async function receiveTransferChunk(req, res, identity, id) {
  if (transferLocks.has(id)) return fail(res, 409, "Ya hay un fragmento de esta transferencia en curso.");
  transferLocks.add(id);
  let temp = "";
  try {
    const row = store.getTransfer(id, identity.businessUserId);
    if (!row) return fail(res, 404, "Transferencia no encontrada.");
    if (row.status === "queued") return reply(res, 202, { success: true, status: row.status, job: store.getJob(row.job_id, identity.businessUserId) });
    if (row.status !== "uploading") return fail(res, 409, "La transferencia ya terminÃ³.");
    const headerOffset = Number(req.headers["upload-offset"]);
    const contentLength = Number(req.headers["content-length"]);
    if (!Number.isSafeInteger(headerOffset) || headerOffset !== row.offset)
      return fail(res, 409, "El offset no coincide.", uploadOffsetHeaders(row.offset, row.size, row.status, row.job_id));
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > CHUNK_BYTES || row.offset + contentLength > row.size)
      return fail(res, 413, "El tamaÃ±o del fragmento estÃ¡ fuera del lÃ­mite.");
    const stage = await ensureTransferStage(row);
    temp = path.join(STAGE, row.stage_name + ".chunk");
    await fsp.unlink(temp).catch((error) => { if (error.code !== "ENOENT") throw error; });
    const handle = await fsp.open(temp, "wx", 0o600);
    let received = 0;
    try {
      for await (const chunk of req) {
        received += chunk.length;
        if (received > contentLength) throw Object.assign(new Error("El fragmento excede su tamaÃ±o declarado."), { statusCode: 413 });
        let written = 0;
        while (written < chunk.length) {
          const result = await handle.write(chunk, written, chunk.length - written, received - chunk.length + written);
          written += result.bytesWritten;
        }
      }
      await handle.sync();
    } catch (error) {
      await handle.close().catch(() => {});
      await fsp.unlink(temp).catch(() => {});
      return fail(res, error.statusCode || 400, error.message);
    }
    await handle.close();
    if (received !== contentLength) { await fsp.unlink(temp).catch(() => {}); return fail(res, 400, "El fragmento llegÃ³ incompleto."); }
    const chunkHandle = await fsp.open(temp, "r");
    const stageHandle = await fsp.open(stage, "r+");
    try {
      const buffer = Buffer.allocUnsafe(256 * 1024);
      let position = 0;
      while (position < received) {
        const read = await chunkHandle.read(buffer, 0, Math.min(buffer.length, received - position), position);
        if (!read.bytesRead) throw new Error("Fragmento temporal incompleto.");
        let written = 0;
        while (written < read.bytesRead) {
          const result = await stageHandle.write(buffer, written, read.bytesRead - written, row.offset + position + written);
          written += result.bytesWritten;
        }
        position += read.bytesRead;
      }
      await stageHandle.sync();
    } finally { await chunkHandle.close(); await stageHandle.close(); await fsp.unlink(temp).catch(() => {}); }
    const nextOffset = row.offset + received;
    store.setTransferOffset(id, identity.businessUserId, nextOffset);
    if (nextOffset < row.size) return reply(res, 204, {}, uploadOffsetHeaders(nextOffset, row.size));
    if (await hashFile(stage) !== row.sha256) {
      const reset = await fsp.open(stage, "r+");
      try { await reset.truncate(0); await reset.sync(); } finally { await reset.close(); }
      store.setTransferOffset(id, identity.businessUserId, 0);
      return fail(res, 422, "La huella SHA-256 no coincide; la transferencia se reiniciÃ³.", uploadOffsetHeaders(0, row.size));
    }
    const outcome = store.enqueue({
      action: "backup_upload", businessUserId: identity.businessUserId, createdBy: identity.auth_subject || identity.authSubject,
      path: row.path,
      payload: { stage_name: row.stage_name, size: row.size, sha256: row.sha256, root_slug: row.root_slug, transfer_id: id },
      idempotencyKey: "transfer-" + id,
    });
    store.queueTransfer(id, identity.businessUserId, outcome.job.id);
    return reply(res, 202, { success: true, transfer_id: id, offset: row.size, length: row.size, status: "queued", job: outcome.job });
  } catch (error) {
    return fail(res, error.statusCode || 500, error.statusCode ? error.message : "No se pudo guardar el fragmento.");
  } finally { transferLocks.delete(id); }
}
function requestedCloudPath(raw) {
  const value = String(raw ?? '/').replace(/\\/g, '/');
  if (!value || value === '/') return [];
  const parts = value.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[\u0000-\u001f\u007f]/.test(part)) || parts[0] === '.cloud-runtime-trash') {
    const error = new Error('Ruta de Cloud invÃ¡lida.'); error.statusCode = 400; throw error;
  }
  return parts;
}
function canManageCloudPath(identity, parts) {
  return identity.roles.includes('admin') ||
    (identity.permissions.includes('academia.admin') && (parts[0] === 'academia'));
}
async function resolveCloudPath(parts, { allowMissing = false } = {}) {
  await fsp.mkdir(ROOT, { recursive: true, mode: 0o700 });
  const realRoot = await fsp.realpath(ROOT);
  let current = realRoot;
  for (const part of parts) {
    current = path.join(current, part);
    if (!current.startsWith(realRoot + path.sep)) { const error = new Error('Ruta fuera de Cloud.'); error.statusCode = 400; throw error; }
    try {
      const item = await fsp.lstat(current);
      if (item.isSymbolicLink()) { const error = new Error('Cloud no permite enlaces simbÃ³licos.'); error.statusCode = 400; throw error; }
    } catch (error) {
      if (error.code === 'ENOENT' && allowMissing) break;
      if (error.code === 'ENOENT') { error.statusCode = 404; throw error; }
      throw error;
    }
  }
  return { realRoot, target: current };
}
function safeEntryName(value) {
  const name = String(value || '').trim();
  if (!name || name === '.' || name === '..' || /[\\/\u0000-\u001f\u007f]/.test(name)) {
    const error = new Error('El nombre no es vÃ¡lido.'); error.statusCode = 400; throw error;
  }
  return name;
}
function backupFolderText(value, max, fallback = "") {
  const text = String(value ?? fallback).trim();
  if (text.length > max || /[\u0000-\u001f\u007f]/.test(text)) { const error = new Error("Metadato de carpeta inv\u00e1lido."); error.statusCode = 400; throw error; }
  return text || fallback;
}
function backupFolderCloudName(value) {
  const name = backupFolderText(value, 120);
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === "..") { const error = new Error("Nombre de carpeta Cloud inv\u00e1lido."); error.statusCode = 400; throw error; }
  return name;
}
function backupFolderUserRoot(identity) {
  return path.resolve(ROOT, "users", identity.businessUserId + "__" + identity.rootSlug);
}
async function listBackupFolders(req, res, identity) {
  const rows = store.listBackupFolders(identity.businessUserId);
  const byCloudName = new Map(rows.map((row) => [row.cloud_name, {
    folder_id: row.folder_id, folder_name: row.folder_name, cloud_name: row.cloud_name, local_path: row.local_path, host_name: row.host_name, marker_version: row.marker_version, created_at: row.created_at, updated_at: row.updated_at, has_cloud_data: false, source: "metadata",
  }]));
  const userRoot = backupFolderUserRoot(identity);
  try {
    for (const entry of await fsp.readdir(userRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const existing = byCloudName.get(entry.name);
      if (existing) { existing.has_cloud_data = true; existing.source = "metadata+storage"; }
      else byCloudName.set(entry.name, { folder_id: "", folder_name: entry.name, cloud_name: entry.name, local_path: "", host_name: "", marker_version: 0, created_at: "", updated_at: "", has_cloud_data: true, source: "storage" });
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return reply(res, 200, { success: true, folders: [...byCloudName.values()].sort((a, b) => String(a.folder_name).localeCompare(String(b.folder_name), undefined, { sensitivity: "base" })) });
}
async function updateBackupFolder(req, res, identity) {
  let body; try { body = await readJson(req, 32 * 1024); } catch (error) { return fail(res, 400, error.message); }
  const folderId = backupFolderText(body.folder_id, 80);
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(folderId)) return fail(res, 400, "Identificador de carpeta inv\u00e1lido.");
  const folderName = backupFolderText(body.folder_name, 240, "Carpeta sin nombre");
  const cloudName = backupFolderCloudName(body.cloud_name);
  const conflict = store.db.prepare("SELECT folder_id FROM backup_folders WHERE business_user_id=? AND cloud_name=? AND folder_id<>?").get(identity.businessUserId, cloudName, folderId);
  if (conflict) return fail(res, 409, "Ya existe otra carpeta respaldada con el mismo nombre Cloud. RenÃ³mbrala para evitar mezclar respaldos.");
  const localPath = backupFolderText(body.local_path, 4096);
  const hostName = backupFolderText(body.host_name, 240, "Equipo desconocido");
  const row = store.upsertBackupFolder({ businessUserId: identity.businessUserId, folderId, folderName, cloudName, localPath, hostName, markerVersion: Number(body.marker_version) || 1 });
  return reply(res, 200, { success: true, folder: { folder_id: row.folder_id, folder_name: row.folder_name, cloud_name: row.cloud_name, local_path: row.local_path, host_name: row.host_name, marker_version: row.marker_version, created_at: row.created_at, updated_at: row.updated_at, has_cloud_data: true, source: "metadata+storage" } });
}
async function listCloudDirectory(req, res, identity, url) {
  const parts = requestedCloudPath(url.searchParams.get('path'));
  if (!canManageCloudPath(identity, parts)) return fail(res, 403, 'No tienes permiso para explorar esta ruta.');
  const { target } = await resolveCloudPath(parts);
  const info = await fsp.lstat(target);
  if (!info.isDirectory()) return fail(res, 400, 'La ruta no es una carpeta.');
  const folders = [], files = [];
  for (const entry of await fsp.readdir(target, { withFileTypes: true })) {
    if (entry.name === '.cloud-runtime-trash' || entry.name.startsWith('.cloud-delete-') || entry.name.startsWith('.cloud-upload-') || entry.name.endsWith('.part') || entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { folders.push(entry.name); continue; }
    if (!entry.isFile()) continue;
    const stat = await fsp.stat(path.join(target, entry.name));
    files.push({ type: 'file', name: entry.name, size: String(stat.size), modified: stat.mtime.toISOString(), url: `/api/files/download?path=${encodeURIComponent('/' + [...parts, entry.name].join('/'))}` });
  }
  folders.sort((a,b) => a.localeCompare(b)); files.sort((a,b) => a.name.localeCompare(b.name));
  store.appendMetric({ event: "files.list", business_user_id: identity.businessUserId, entries: folders.length + files.length });
  return reply(res, 200, { success: true, path: parts.length ? '/' + parts.join('/') : '/', folders, files });
}
const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  return table;
})();
function zipDosDate(date) {
  const year = Math.max(1980, date.getFullYear());
  return { time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2), date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() };
}
async function collectZipFiles(root, current = root, output = []) {
  for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.cloud-upload-') || entry.name.startsWith('.cloud-delete-') || entry.name.endsWith('.part') || (current === root && entry.name === '.cloud-runtime-trash')) continue;
    const file = path.join(current, entry.name);
    if (!file.startsWith(root + path.sep)) continue;
    if (entry.isDirectory()) await collectZipFiles(root, file, output);
    else if (entry.isFile()) {
      const stat = await fsp.lstat(file);
      const relative = path.relative(root, file).split(path.sep).join('/');
      const name = Buffer.from(relative, 'utf8');
      if (name.length > 65535 || stat.size > 0xffffffff || output.length >= 65534) {
        const error = new Error('La carpeta excede los lÃ­mites ZIP32 para descarga.'); error.statusCode = 413; throw error;
      }
      output.push({ file, name, size: stat.size, modified: stat.mtime });
    }
  }
  return output;
}
async function downloadCloudFolder(req, res, identity, url) {
  const parts = requestedCloudPath(url.searchParams.get('path'));
  if (!parts.length || !canManageCloudPath(identity, parts)) return fail(res, 403, 'No tienes permiso para descargar esta carpeta.');
  const { target } = await resolveCloudPath(parts);
  const stat = await fsp.lstat(target);
  if (!stat.isDirectory()) return fail(res, 400, 'El destino no es una carpeta.');
  const files = await collectZipFiles(target);
  const zipSize = files.reduce((total, item) => total + BigInt(item.size) + BigInt(item.name.length * 2 + 92), 22n);
  if (zipSize > 0xffffffffn) return fail(res, 413, 'La carpeta excede el lÃ­mite de 4 GiB de ZIP32.');
  const zipName = path.basename(target).replace(/[\r\n"\\]/g, '_') + '.zip';
  const central = [];
  let offset = 0;
  const emit = async (buffer) => { offset += buffer.length; if (!res.write(buffer)) await new Promise(resolve => res.once('drain', resolve)); };
  res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  try {
    for (const item of files) {
      const dos = zipDosDate(item.modified), localOffset = offset;
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0808, 6); header.writeUInt16LE(0, 8);
      header.writeUInt16LE(dos.time, 10); header.writeUInt16LE(dos.date, 12); header.writeUInt16LE(item.name.length, 26);
      await emit(Buffer.concat([header, item.name]));
      let crc = 0xffffffff, size = 0;
      for await (const chunk of fs.createReadStream(item.file)) {
        size += chunk.length;
        if (size > 0xffffffff) throw new Error('El archivo excede el lÃ­mite de ZIP32.');
        for (const byte of chunk) crc = ZIP_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        await emit(chunk);
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50, 0); descriptor.writeUInt32LE(crc, 4); descriptor.writeUInt32LE(size, 8); descriptor.writeUInt32LE(size, 12);
      await emit(descriptor);
      central.push({ ...item, dos, crc, size, offset: localOffset });
    }
    const centralOffset = offset;
    for (const item of central) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x0808, 8); header.writeUInt16LE(0, 10);
      header.writeUInt16LE(item.dos.time, 12); header.writeUInt16LE(item.dos.date, 14); header.writeUInt32LE(item.crc, 16); header.writeUInt32LE(item.size, 20); header.writeUInt32LE(item.size, 24);
      header.writeUInt16LE(item.name.length, 28); header.writeUInt32LE(item.offset, 42);
      await emit(Buffer.concat([header, item.name]));
    }
    const centralSize = offset - centralOffset;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length, 8); end.writeUInt16LE(central.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(centralOffset, 16);
    res.end(end);
    store.appendMetric({ event: 'files.download_folder', business_user_id: identity.businessUserId, files: central.length });
  } catch (error) {
    console.error('Cloud ZIP streaming failed:', error.message);
    res.destroy(error);
  }
}

async function downloadCloudFile(req, res, identity, url) {
  const parts = requestedCloudPath(url.searchParams.get('path'));
  if (!parts.length || !canManageCloudPath(identity, parts.slice(0, -1))) return fail(res, 403, 'No tienes permiso para descargar este archivo.');
  const { target } = await resolveCloudPath(parts);
  const info = await fsp.lstat(target);
  if (!info.isFile()) return fail(res, 400, 'El destino no es un archivo regular.');
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': info.size, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(target))}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  return fs.createReadStream(target).pipe(res);
}
async function createCloudFolder(req, res, identity) {
  let body;
  try { body = await readJson(req, 16 * 1024); } catch (error) { return fail(res, 400, error.message); }
  const parts = requestedCloudPath(body.path), name = safeEntryName(body.folderName);
  const allowedAcademiaRoot = identity.permissions.includes('academia.admin') && parts.length === 0 && name.toLowerCase() === 'academia';
  if ((!canManageCloudPath(identity, parts) || !canManageCloudPath(identity, [...parts, name])) && !allowedAcademiaRoot) return fail(res, 403, 'No tienes permiso para crear en esta ruta.');
  const { target: parent } = await resolveCloudPath(parts);
  if (!(await fsp.stat(parent)).isDirectory()) return fail(res, 400, 'La ruta no es una carpeta.');
  try { await fsp.mkdir(path.join(parent, name), { mode: 0o700 }); }
  catch (error) { if (error.code === 'EEXIST') return fail(res, 409, 'La carpeta ya existe.'); throw error; }
  store.appendMetric({ event: "folders.create", business_user_id: identity.businessUserId });
  return reply(res, 201, { success: true, path: '/' + [...parts, name].join('/') });
}
async function uploadCloudFile(req, res, identity, url) {
  const parts = requestedCloudPath(url.searchParams.get('path'));
  const name = safeEntryName(url.searchParams.get('name'));
  if (!canManageCloudPath(identity, parts)) return fail(res, 403, 'No tienes permiso para subir a esta ruta.');
  const { realRoot, target: parent } = await resolveCloudPath(parts);
  if (!(await fsp.stat(parent)).isDirectory()) return fail(res, 400, 'La ruta no es una carpeta.');
  const target = path.join(parent, name), temp = path.join(parent, `.cloud-upload-${crypto.randomUUID()}.part`);
  if (!target.startsWith(realRoot + path.sep)) return fail(res, 400, 'Destino fuera de Cloud.');
  const declared = Number(req.headers['content-length']);
  if (!Number.isSafeInteger(declared) || declared < 1 || declared > MAX_BYTES) return fail(res, 413, 'TamaÃ±o fuera del lÃ­mite configurado.');
  const free = await fsp.statfs(parent);
  const freeBytes = Number(free.bavail) * Number(free.bsize);
  const reserve = Number(env.CLOUD_LOCAL_MIN_FREE_BYTES || 2 * 1024 * 1024 * 1024);
  if (freeBytes < declared + reserve) return fail(res, 507, 'Espacio insuficiente en Cloud para completar la subida.');
  const expected = String(req.headers['x-content-sha256'] || '').toLowerCase();
  if (expected && !/^[a-f0-9]{64}$/.test(expected)) return fail(res, 400, 'La huella SHA-256 no es vÃ¡lida.');
  const handle = await fsp.open(temp, 'wx', 0o600), hash = crypto.createHash('sha256');
  let bytes = 0;
  try {
    for await (const chunk of req) { bytes += chunk.length; if (bytes > declared || bytes > MAX_BYTES) { const error = new Error('El cuerpo excede el tamaÃ±o declarado.'); error.statusCode = 413; throw error; } hash.update(chunk); await handle.write(chunk); }
    await handle.sync();
    if (bytes !== declared) { const error = new Error('La transferencia terminÃ³ antes de recibir todos los bytes.'); error.statusCode = 400; throw error; }
    const actualHash = hash.digest('hex');
    if (expected && actualHash !== expected) { const error = new Error('La huella SHA-256 no coincide.'); error.statusCode = 422; throw error; }
    const existing = await fsp.lstat(target).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (existing && (existing.isSymbolicLink() || !existing.isFile())) { const error = new Error('El destino existente no es un archivo regular.'); error.statusCode = 409; throw error; }
    await handle.close();
    await fsp.rename(temp, target);
    try { const dir = await fsp.open(parent, 'r'); try { await dir.sync(); } finally { await dir.close(); } } catch (error) { if (process.platform !== 'win32') throw error; }
    store.appendMetric({ event: "files.upload", business_user_id: identity.businessUserId, bytes });
    return reply(res, 200, { success: true, name, size: bytes, sha256: actualHash, path: '/' + [...parts, name].join('/') });
  } catch (error) {
    await handle.close().catch(() => {}); await fsp.unlink(temp).catch(() => {});
    return fail(res, error.statusCode || 500, error.statusCode ? error.message : 'No se pudo completar la subida.');
  }
}
async function deleteCloudItem(req, res, identity, url) {
  const parentParts = requestedCloudPath(url.searchParams.get('path'));
  const name = safeEntryName(url.searchParams.get('name'));
  const type = String(url.searchParams.get('type') || '');
  if (type !== 'file' && type !== 'folder') return fail(res, 400, 'Tipo de elemento invÃ¡lido.');
  if (!identity.roles.includes('admin')) return fail(res, 403, 'SÃ³lo un administrador puede eliminar elementos.');
  if (url.searchParams.get('confirm') !== 'yes') return fail(res, 400, 'Confirma explÃ­citamente con confirm=yes.');
  const { realRoot, target: parent } = await resolveCloudPath(parentParts);
  const target = path.join(parent, name);
  if (!target.startsWith(realRoot + path.sep)) return fail(res, 400, 'Destino fuera de Cloud.');
  const info = await fsp.lstat(target);
  if (info.isSymbolicLink() || (type === 'folder' ? !info.isDirectory() : !info.isFile())) return fail(res, 400, 'El tipo del elemento no coincide.');
  const trashRoot = path.join(realRoot, '.cloud-runtime-trash');
  await fsp.mkdir(trashRoot, { recursive: true, mode: 0o700 });
  const id = crypto.randomUUID(), storedName = id + '.item';
  const storedPath = path.join(trashRoot, storedName);
  const originalPath = '/' + [...parentParts, name].join('/');
  const usersRoot = path.join(realRoot, 'users');
  const relativeToUsers = path.relative(usersRoot, target).split(path.sep);
  const owner = relativeToUsers[0]?.match(/^([A-Za-z0-9_-]+)__(.+)$/) || null;
  const tombstoneUserId = owner?.[1] || null;
  const tombstonePath = owner ? relativeToUsers.slice(1).join('/') || '.' : null;
  let tombstoneCreated = false;
  try {
    if (tombstoneUserId) {
      tombstoneCreated = !store.db.prepare("SELECT 1 FROM tombstones WHERE business_user_id=? AND relative_path=?").get(tombstoneUserId, tombstonePath);
      store.addTombstone({ businessUserId: tombstoneUserId, relativePath: tombstonePath, itemType: type, createdBy: identity.authSubject });
    }
    store.addTrashEntry({
      id, deletedBy: identity.authSubject, businessUserId: identity.businessUserId,
      originalPath, name, itemType: type, storedName, size: info.isFile() ? info.size : 0,
      modifiedAt: info.mtime.toISOString(), deletedAt: new Date().toISOString(),
      tombstoneUserId, tombstonePath,
    });
    await fsp.rename(target, storedPath);
    for (const directory of [parent, trashRoot]) {
      try { const handle = await fsp.open(directory, 'r'); try { await handle.sync(); } finally { await handle.close(); } }
      catch (error) { if (process.platform !== 'win32') throw error; }
    }
  } catch (error) {
    await fsp.rename(storedPath, target).catch(() => {});
    store.removeTrash(id);
    if (tombstoneCreated && tombstoneUserId) store.removeTombstone(tombstoneUserId, tombstonePath);
    throw error;
  }
  store.appendMetric({ event: "files.delete", business_user_id: identity.businessUserId, item_type: type });
  return reply(res, 200, { success: true, deleted: name, path: originalPath, trashed: true, trash_id: id });
}
async function listCloudTrash(req, res, identity) {
  if (!identity.roles.includes('admin') && !identity.permissions.includes('academia.admin')) return fail(res, 403, 'No tienes permiso para consultar la papelera.');
  const trashRoot = path.join(await fsp.realpath(ROOT), '.cloud-runtime-trash');
  const rows = store.listTrash(), files = [], folders = [];
  for (const row of rows) {
    if (!identity.roles.includes('admin') && !row.original_path.toLowerCase().startsWith('/academia/')) continue;
    const payload = path.join(trashRoot, row.stored_name);
    try {
      const stat = await fsp.lstat(payload);
      if (stat.isSymbolicLink()) continue;
      const entry = { id: row.id, name: row.name, path: path.posix.dirname(row.original_path), type: row.item_type, size: stat.isFile() ? stat.size : 0, modified: row.modified_at, deletedAt: row.deleted_at };
      (row.item_type === 'folder' ? folders : files).push(entry);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return reply(res, 200, { success: true, path: '/', folders, files, view: 'trash' });
}
async function restoreCloudTrash(req, res, identity) {
  let body;
  try { body = await readJson(req, 16 * 1024); } catch (error) { return fail(res, 400, error.message); }
  const id = String(body.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(res, 400, 'Identificador de papelera invÃ¡lido.');
  const row = store.getTrash(id);
  if (!row) return fail(res, 404, 'Elemento de papelera no encontrado.');
  const parts = requestedCloudPath(row.original_path);
  if (!canManageCloudPath(identity, parts.slice(0, -1))) return fail(res, 403, 'No tienes permiso para restaurar esta ruta.');
  const trashRoot = path.join(await fsp.realpath(ROOT), '.cloud-runtime-trash');
  const source = path.join(trashRoot, row.stored_name);
  if (!source.startsWith(trashRoot + path.sep)) return fail(res, 400, 'Referencia de papelera invÃ¡lida.');
  if (!parts.length) return fail(res, 400, 'No se puede restaurar sobre la raÃ­z de Cloud.');
  const { realRoot, target: parent } = await resolveCloudPath(parts.slice(0, -1));
  const target = path.join(parent, parts.at(-1));
  if (!target.startsWith(realRoot + path.sep)) return fail(res, 400, 'Destino fuera de Cloud.');
  const conflict = await fsp.lstat(target).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (conflict) return fail(res, 409, 'Ya existe un elemento con ese nombre en su ubicaciÃ³n original.');
  await fsp.rename(source, target);
  try {
    store.removeTrash(id);
    if (row.tombstone_user_id && row.tombstone_path) store.removeTombstone(row.tombstone_user_id, row.tombstone_path);
  } catch (error) { await fsp.rename(target, source).catch(() => {}); throw error; }
  store.appendMetric({ event: "files.restore", business_user_id: identity.businessUserId, item_type: row.item_type });
  return reply(res, 200, { success: true, name: row.name, path: path.posix.dirname(row.original_path) });
}
async function purgeCloudTrash(req, res, identity, url) {
  const id = String(url.searchParams.get('id') || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(res, 400, 'Identificador de papelera invÃ¡lido.');
  if (url.searchParams.get('confirm') !== 'yes') return fail(res, 400, 'Confirma explÃ­citamente con confirm=yes.');
  const row = store.getTrash(id);
  if (!row) return fail(res, 404, 'Elemento de papelera no encontrado.');
  const parts = requestedCloudPath(row.original_path);
  if (!canManageCloudPath(identity, parts.slice(0, -1))) return fail(res, 403, 'No tienes permiso para eliminar permanentemente esta ruta.');
  const trashRoot = path.join(await fsp.realpath(ROOT), '.cloud-runtime-trash');
  const payload = path.join(trashRoot, row.stored_name);
  if (!payload.startsWith(trashRoot + path.sep)) return fail(res, 400, 'Referencia de papelera invÃ¡lida.');
  await fsp.rm(payload, { recursive: row.item_type === 'folder', force: false });
  store.removeTrash(id);
  store.appendMetric({ event: "files.purge", business_user_id: identity.businessUserId, item_type: row.item_type });
  return reply(res, 200, { success: true, deleted: true });
}

async function readJson(req, maxBytes) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString("utf8");
    if (Buffer.byteLength(raw) > maxBytes) throw new Error("Solicitud demasiado grande.");
  }
  try { return JSON.parse(raw || "{}"); } catch { throw new Error("JSON no vÃ¡lido."); }
}
const allowedOrigins = new Set(
  String(env.CLOUD_LOCAL_ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);
function isAllowedOrigin(origin) {
  if (allowedOrigins.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return (
      parsed.origin === origin &&
      parsed.protocol === "http:" &&
      parsed.hostname === "127.0.0.1" &&
      Boolean(parsed.port) &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === "/" &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    const origin = String(req.headers.origin || "");
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Expose-Headers", "Upload-Offset,Upload-Length,Tus-Resumable,X-Transfer-Status,X-Job-Id,Content-Disposition,Content-Length,Accept-Ranges");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS")
      return reply(
        res,
        204,
        {},
        {
          "Access-Control-Allow-Methods": "GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers":
            "Authorization,Content-Type,Idempotency-Key,X-Content-Sha256,Upload-Offset,Upload-Length,Tus-Resumable",
        },
      );
    if (req.method === "GET" && url.pathname === "/health")
      return reply(res, 200, {
        success: true,
        service: "cloud-local-runtime",
        database: "sqlite",
        time: new Date().toISOString(),
      });
    if (req.method === "POST" && url.pathname === "/auth/exchange")
      return await exchangeSupabaseSession(req, res);
    if (req.method === "GET" && url.pathname === "/auth/validate") {
      const identity = authenticate(req, res, 600);
      if (!identity) return;
      return reply(res, 200, { success: true, identity: { authSubject: identity.authSubject, businessUserId: identity.businessUserId, rootSlug: identity.rootSlug, roles: identity.roles, permissions: identity.permissions } });
    }
    if (req.method === "POST" && url.pathname === "/internal/metrics") {
      const remote = String(req.socket.remoteAddress || "");
      if (!(remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1")) return fail(res, 403, "SÃ³lo se reciben mÃ©tricas locales de Debian.");
      let body;
      try { body = await readJson(req, 64 * 1024); } catch (error) { return fail(res, 400, error.message); }
      if (body.event !== "server_status" || !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) return fail(res, 400, "MÃ©trica local invÃ¡lida.");
      const allowed = { event: "server_status", created_at: String(body.created_at || ""), hostname: String(body.hostname || "").slice(0, 128), cpu_percent: Number.isFinite(body.cpu_percent) ? body.cpu_percent : null, ram_percent: Number.isFinite(body.ram_percent) ? body.ram_percent : null, disk_percent: Number.isFinite(body.disk_percent) ? body.disk_percent : null, temperature_celsius: Number.isFinite(body.temperature_celsius) ? body.temperature_celsius : null, payload: body.payload };
      if (allowed.created_at && Number.isNaN(Date.parse(allowed.created_at))) return fail(res, 400, "Fecha de mÃ©trica invÃ¡lida.");
      store.appendMetric(allowed, 1000);
      return reply(res, 201, { success: true });
    }
    const identity = authenticate(req, res, 120);
    if (!identity) return;
    if (req.method === "POST" && url.pathname === "/auth/revoke") {
      const revoked = store.revokeSession(req.cloudToken, identity.businessUserId);
      return reply(res, 200, { success: true, revoked });
    }
    if (req.method === "POST" && url.pathname === "/api/transfers") return await createTransfer(req, res, identity);
    const transferId = transferIdFrom(url);
    if (transferId && req.method === "HEAD") {
      const row = store.getTransfer(transferId, identity.businessUserId);
      if (!row) { res.writeHead(404, { "Cache-Control": "no-store" }); return res.end(); }
      if (row.status === "uploading") { const file = await ensureTransferStage(row); const actual = (await fsp.stat(file)).size; if (actual !== row.offset) store.setTransferOffset(transferId, identity.businessUserId, actual); row.offset = actual; }
      res.writeHead(200, uploadOffsetHeaders(row.offset, row.size, row.status, row.job_id)); return res.end();
    }
    if (transferId && req.method === "PATCH") return await receiveTransferChunk(req, res, identity, transferId);
    if (req.method === "PUT" && url.pathname === "/api/backups")
      return await receiveBackup(req, res, identity, url);
    if (req.method === "GET" && url.pathname === "/api/files") return await listCloudDirectory(req, res, identity, url);
    if (req.method === "GET" && url.pathname === "/api/files/download") return await downloadCloudFile(req, res, identity, url);
    if (req.method === "GET" && url.pathname === "/api/files/download-folder") return await downloadCloudFolder(req, res, identity, url);
    if (req.method === "POST" && url.pathname === "/api/files/upload") return await uploadCloudFile(req, res, identity, url);
    if (req.method === "POST" && url.pathname === "/api/folders") return await createCloudFolder(req, res, identity);
    if (req.method === "DELETE" && url.pathname === "/api/files/item") return await deleteCloudItem(req, res, identity, url);
    if (req.method === "GET" && url.pathname === "/api/trash") return await listCloudTrash(req, res, identity);
    if (req.method === "POST" && url.pathname === "/api/trash/restore") return await restoreCloudTrash(req, res, identity);
    if (req.method === "DELETE" && url.pathname === "/api/trash/item") return await purgeCloudTrash(req, res, identity, url);
    if (req.method === "GET" && url.pathname === "/api/metrics") {
      if (!identity.roles.includes("admin")) return fail(res, 403, "SÃ³lo un administrador puede consultar mÃ©tricas.");
      const rows = store.db.prepare("SELECT created_at,payload_json FROM metrics ORDER BY id DESC LIMIT 100").all();
      return reply(res, 200, { success: true, metrics: rows.map(row => ({ created_at: row.created_at, ...JSON.parse(row.payload_json) })) });
    }
    if (req.method === "GET" && url.pathname === "/api/jobs") {
      const limit = Math.max(
        1,
        Math.min(100, Number(url.searchParams.get("limit") || 50)),
      );
      return reply(res, 200, {
        success: true,
        jobs: store.listJobs(identity.businessUserId, limit),
      });
    }
    const match = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]{36})$/i);
    if (req.method === "GET" && match) {
      const job = store.getJob(match[1], identity.businessUserId);
      return job
        ? reply(res, 200, { success: true, job })
        : fail(res, 404, "Trabajo no encontrado.");
    }
    if (req.method === "POST" && url.pathname === "/api/tombstones") {
      let body; try { body = await readJson(req, 16 * 1024); } catch (error) { return fail(res, 400, error.message); }
      const userId = String(body.business_user_id || ""), relativePath = String(body.relative_path || ""), itemType = String(body.item_type || "");
      if (!identity.roles.includes("admin") && userId !== identity.businessUserId) return fail(res, 403, "No puedes crear bloqueos para otro usuario.");
      if (!/^[A-Za-z0-9_-]+$/.test(userId) || !(relativePath === "." || safeRelative(relativePath)) || !["file", "folder"].includes(itemType)) return fail(res, 400, "Bloqueo de respaldo invÃ¡lido.");
      store.addTombstone({ businessUserId: userId, relativePath, itemType, createdBy: identity.authSubject });
      return reply(res, 201, { success: true });
    }
    if (req.method === "POST" && url.pathname === "/api/tombstones/remove") {
      let body; try { body = await readJson(req, 16 * 1024); } catch (error) { return fail(res, 400, error.message); }
      const userId = String(body.business_user_id || ""), relativePath = String(body.relative_path || "");
      if (!/^[A-Za-z0-9_-]+$/.test(userId) || !(relativePath === "." || safeRelative(relativePath))) return fail(res, 400, "Ruta de bloqueo invÃ¡lida.");
      if (!identity.roles.includes("admin") && identity.businessUserId !== userId) return fail(res, 403, "No puedes cambiar bloqueos de otro usuario.");
      return reply(res, 200, { success: true, removed: store.removeTombstone(userId, relativePath) });
    }
    if (req.method === "GET" && url.pathname === "/api/tombstones") {
      const rows = store.db
        .prepare(
          "SELECT relative_path,item_type,created_at FROM tombstones WHERE business_user_id=? ORDER BY relative_path",
        )
        .all(identity.businessUserId);
      return reply(res, 200, { success: true, business_user_id: identity.businessUserId, tombstones: rows });
    }
    if (req.method === "GET" && url.pathname === "/api/backup-folders") return await listBackupFolders(req, res, identity);
    if (req.method === "PUT" && url.pathname === "/api/backup-folders") return await updateBackupFolder(req, res, identity);
    if (req.method === "GET" && url.pathname === "/api/count") {
      const requested = safeRelative(url.searchParams.get("path"));
      const userFolder = identity.businessUserId + "__" + identity.rootSlug;
      const userRoot = path.resolve(ROOT, "users", userFolder);
      const root = path.resolve(userRoot, requested);
      if (!root.startsWith(userRoot + path.sep)) return fail(res, 400, "Ruta fuera de la carpeta del usuario.");
      let realRoot;
      try {
        const realUserRoot = await fsp.realpath(userRoot);
        realRoot = await fsp.realpath(root);
        if (!realRoot.startsWith(realUserRoot + path.sep)) return fail(res, 400, "La ruta contiene un enlace fuera de la carpeta del usuario.");
      } catch (error) {
        if (error.code === "ENOENT") return reply(res, 200, { success: true, count: 0 });
        throw error;
      }
      let total = 0;
      async function walk(dir) {
        let entries;
        try { entries = await fsp.readdir(dir, { withFileTypes: true }); }
        catch (error) { if (error.code === "ENOENT") return; throw error; }
        for (const entry of entries) {
          if (entry.isSymbolicLink()) continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) await walk(full);
          else if (entry.isFile()) total += 1;
        }
      }
      await walk(realRoot);
      return reply(res, 200, { success: true, count: total });
    }    if (req.method === "DELETE" && url.pathname === "/api/tombstones") {
      if (
        !identity.roles.includes("admin") &&
        !identity.permissions.includes("cloud.upload")
      )
        return fail(res, 403, "No tienes permiso para cambiar bloqueos.");
      if (url.searchParams.get("confirm") !== "yes")
        return fail(
          res,
          400,
          "Confirma explÃ­citamente el desbloqueo con confirm=yes.",
        );
      const target = safeRelative(url.searchParams.get("path"));
      return reply(res, 200, {
        success: true,
        removed: store.removeTombstone(identity.businessUserId, target),
      });
    }
    return fail(res, 404, "Ruta de Cloud no encontrada.");
  } catch (error) {
    console.error("Cloud local API request failed:", error.message);
    return fail(
      res,
      error.statusCode || 500,
      error.statusCode ? error.message : "Error interno de Cloud.",
    );
  }
});
server.requestTimeout = Number(
  env.CLOUD_LOCAL_REQUEST_TIMEOUT_MS || 30 * 60 * 1000,
);
server.headersTimeout = 60000;
server.keepAliveTimeout = 5000;
server.listen(PORT, HOST, () =>
  console.log(`Cloud local API listening on ${HOST}:${PORT}; db=${DB_PATH}`),
);
function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

