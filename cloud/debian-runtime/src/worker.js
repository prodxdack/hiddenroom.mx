"use strict";
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { CloudStore } = require("./store");
const env = process.env;
const store = new CloudStore(
  env.CLOUD_SQLITE_PATH || path.join(__dirname, "..", "data", "cloud.sqlite"),
);
const cloudRoot = path.resolve(
  env.CLOUD_HIDDENROOM_ROOT ||
    env.CLOUD_ROOT ||
    path.join(__dirname, "..", "..", "..", "..", "hiddenroom-data"),
);
const staging = path.resolve(
  env.CLOUD_LOCAL_STAGING_ROOT ||
    path.join(path.dirname(store.filePath), "staging"),
);
const workerId = `${process.pid}-${crypto.randomUUID()}`;
const leaseMs = Number(env.CLOUD_LOCAL_JOB_LEASE_MS || 60000),
  idleMs = Number(env.CLOUD_LOCAL_WORKER_IDLE_MS || 1000);
let stopping = false;
function contained(root, target) {
  const rel = path.relative(root, target);
  return (
    rel === "" ||
    (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel))
  );
}
function validRelative(value) {
  const s = String(value || "").replace(/\\/g, "/"),
    parts = s.split("/");
  if (
    !s ||
    s.startsWith("/") ||
    parts.some(
      (p) => !p || p === "." || p === ".." || /[\u0000-\u001f\u007f]/.test(p),
    )
  )
    throw new Error("Ruta de respaldo invÃ¡lida.");
  return parts;
}
async function ensureDirectories(root, parts) {
  await fsp.mkdir(root, { recursive: true, mode: 0o700 });
  const realRoot = await fsp.realpath(root);
  let current = realRoot;
  for (const segment of parts) {
    current = path.join(current, segment);
    if (!contained(realRoot, current))
      throw new Error("La ruta intenta salir de la carpeta del usuario.");
    try {
      const info = await fsp.lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory())
        throw new Error("La ruta contiene un enlace o componente inseguro.");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      await fsp.mkdir(current, { mode: 0o700 });
    }
  }
  return { realRoot, current };
}
async function fileMatches(filePath, expectedSize, expectedHash) {
  try {
    const info = await fsp.lstat(filePath);
    if (
      info.isSymbolicLink() ||
      !info.isFile() ||
      info.size !== Number(expectedSize)
    )
      return false;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex") === expectedHash;
}
async function processBackup(job) {
  const payload = job.payload,
    stageName = String(payload.stage_name || "");
  if (!/^[0-9a-f-]{36}\.upload$/i.test(stageName))
    throw new Error("Referencia de staging invÃ¡lida.");
  if (store.blocked(job.business_user_id, job.path))
    throw Object.assign(
      new Error("El destino estÃ¡ bloqueado por un borrado manual en Cloud."),
      { retryable: false },
    );
  if (
    !/^[A-Za-z0-9_-]+$/.test(job.business_user_id) ||
    !/^[a-z0-9._-]{1,48}$/.test(payload.root_slug)
  )
    throw new Error("Identidad o carpeta raÃ­z invÃ¡lida.");
  const cloudReal = await fsp.realpath(cloudRoot),
    usersPath = path.join(cloudReal, "users");
  await fsp.mkdir(usersPath, { recursive: true, mode: 0o700 });
  const usersInfo = await fsp.lstat(usersPath);
  if (usersInfo.isSymbolicLink() || !usersInfo.isDirectory())
    throw new Error("La carpeta users no es segura.");
  const root = path.join(
    usersPath,
    `${job.business_user_id}__${payload.root_slug}`,
  );
  await fsp.mkdir(root, { recursive: true, mode: 0o700 });
  const rootInfo = await fsp.lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory())
    throw new Error("La raÃ­z de usuario no es segura.");
  const parts = validRelative(job.path);
  const { realRoot, current: parent } = await ensureDirectories(
    root,
    parts.slice(0, -1),
  );
  const target = path.join(parent, parts.at(-1));
  if (!contained(realRoot, target))
    throw new Error("Destino fuera de la carpeta del usuario.");
  try {
    const info = await fsp.lstat(target);
    if (info.isSymbolicLink() || !info.isFile())
      throw new Error("El destino existente no es un archivo regular.");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const source = path.join(staging, stageName),
    temporary = path.join(parent, `.${parts.at(-1)}.${job.id}.part`);
  if (!contained(staging, source) || !contained(realRoot, temporary))
    throw new Error("Ruta temporal fuera de su raÃ­z.");
  if (await fileMatches(target, payload.size, payload.sha256)) {
    await fsp.unlink(source).catch(() => {});
    return {
      path: job.path,
      size: Number(payload.size),
      sha256: payload.sha256,
      recovered_existing: true,
    };
  }
  const digest = crypto.createHash("sha256");
  let bytes = 0,
    lastProgress = 0;
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      digest.update(chunk);
      if (bytes - lastProgress >= 4 * 1024 * 1024) {
        lastProgress = bytes;
        store.heartbeat(job.id, workerId, leaseMs, {
          bytes,
          total: Number(payload.size),
          percent: Math.floor((bytes / Number(payload.size)) * 100),
        });
      }
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      fs.createReadStream(source),
      meter,
      fs.createWriteStream(temporary, { flags: "wx", mode: 0o600 }),
    );
    if (
      bytes !== Number(payload.size) ||
      digest.digest("hex") !== payload.sha256
    )
      throw new Error("La verificaciÃ³n de tamaÃ±o o SHA-256 fallÃ³.");
    const handle = await fsp.open(temporary, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fsp.rename(temporary, target);
    try {
      const dirHandle = await fsp.open(parent, "r");
      try {
        await dirHandle.sync();
      } finally {
        await dirHandle.close();
      }
    } catch (error) {
      if (process.platform !== "win32") throw error;
    }
    await fsp.unlink(source).catch(() => {});
    return { path: job.path, size: bytes, sha256: payload.sha256 };
  } catch (error) {
    await fsp.unlink(temporary).catch(() => {});
    throw error;
  }
}
async function cleanupOrphanStages() {
  await fsp.mkdir(staging, { recursive: true, mode: 0o700 });
  const referenced = store.referencedStages(),
    cutoff =
      Date.now() -
      Number(env.CLOUD_LOCAL_STAGE_ORPHAN_AGE_MS || 24 * 60 * 60 * 1000);
  for (const entry of await fsp.readdir(staging, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      !/^[0-9a-f-]{36}\.upload$/i.test(entry.name) ||
      referenced.has(entry.name)
    )
      continue;
    const file = path.join(staging, entry.name),
      info = await fsp.stat(file);
    if (info.mtimeMs < cutoff) await fsp.unlink(file).catch(() => {});
  }
}
async function loop() {
  await cleanupOrphanStages();
  console.log(`Cloud SQLite worker ${workerId} started`);
  while (!stopping) {
    let job;
    try {
      job = store.claim(workerId, leaseMs);
      if (!job) {
        await new Promise((r) => setTimeout(r, idleMs));
        continue;
      }
      if (job.action !== "backup_upload")
        throw Object.assign(
          new Error(`AcciÃ³n aÃºn no habilitada en este runtime: ${job.action}`),
          { retryable: false },
        );
      const result = await processBackup(job);
      store.complete(job.id, workerId, result);
      if (job.payload.transfer_id) store.setTransferStatus(job.payload.transfer_id, "completed");
      console.log(`job ${job.id} completed`);
    } catch (error) {
      if (job) {
        const retry = store.fail(
          job.id,
          workerId,
          error.message,
          error.retryable !== false,
        );
        if (!retry && job.payload.transfer_id) store.setTransferStatus(job.payload.transfer_id, "failed");
        if (!retry && job.payload.stage_name)
          await fsp
            .unlink(path.join(staging, job.payload.stage_name))
            .catch(() => {});
        console.error(
          `job ${job.id} ${retry ? "scheduled for retry" : "failed"}: ${error.message}`,
        );
      } else console.error("worker loop error:", error.message);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
function shutdown() {
  stopping = true;
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
loop()
  .then(() => {
    store.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    store.close();
    process.exitCode = 1;
  });

