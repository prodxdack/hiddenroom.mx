"use strict";
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const Database = require("better-sqlite3");
const { CloudStore } = require("./store");
async function main() {
  const dbPath = process.env.CLOUD_SQLITE_PATH;
  if (!dbPath) throw new Error("CLOUD_SQLITE_PATH es obligatorio.");
  const destination = process.env.CLOUD_SQLITE_BACKUP_DIR;
  if (!destination)
    throw new Error(
      "Configura CLOUD_SQLITE_BACKUP_DIR en otro disco o dispositivo.",
    );
  const source = path.resolve(dbPath),
    targetDir = path.resolve(destination);
  await fsp.mkdir(targetDir, { recursive: true, mode: 0o700 });
  const sourceStat = await fsp.stat(source),
    targetStat = await fsp.stat(targetDir);
  const allowSameDevice =
    process.env.CLOUD_SQLITE_BACKUP_ALLOW_SAME_DEVICE === "true";
  if (sourceStat.dev === targetStat.dev && !allowSameDevice)
    throw new Error(
      "El destino del respaldo estÃ¡ en el mismo dispositivo que SQLite. SÃ³lo usa CLOUD_SQLITE_BACKUP_ALLOW_SAME_DEVICE=true si aceptas perder tambiÃ©n este respaldo ante una falla del disco.",
    );
  if (sourceStat.dev === targetStat.dev)
    console.warn("WARNING: this SQLite snapshot is on the same device and will not survive its disk failure.");
  const name = `mysauth-cloud-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
    temporary = path.join(targetDir, `.${name}.tmp`),
    target = path.join(targetDir, name);
  const store = new CloudStore(source);
  try {
    await store.backupTo(temporary);
  } finally {
    store.close();
  }
  const verify = new Database(temporary, { readonly: true });
  try {
    const result = verify.pragma("quick_check");
    if (result.length !== 1 || result[0].quick_check !== "ok")
      throw new Error("quick_check rechazÃ³ el respaldo SQLite.");
  } finally {
    verify.close();
  }
  const h = await fsp.open(temporary, "r");
  try {
    await h.sync();
  } finally {
    await h.close();
  }
  await fsp.rename(temporary, target);
  const dh = await fsp.open(targetDir, "r");
  try {
    await dh.sync();
  } finally {
    await dh.close();
  }
  console.log(`SQLite backup verified: ${target}`);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

