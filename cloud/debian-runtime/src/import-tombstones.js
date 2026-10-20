"use strict";

const fs = require("node:fs");

function validateManifest(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.tombstones)) {
    throw new Error("Manifest invÃ¡lido: se esperaba version 1 y una lista tombstones.");
  }
  if (value.tombstones.length > 100000) throw new Error("El manifest supera el lÃ­mite de 100000 bloqueos.");
  const seen = new Map();
  const tombstones = value.tombstones.map((row, index) => {
    const businessUserId = String(row?.business_user_id || "");
    const relativePath = String(row?.relative_path ?? "");
    const itemType = String(row?.item_type || "");
    const createdBy = String(row?.created_by || "");
    const createdAt = String(row?.created_at || "");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(businessUserId)) throw new Error("user_id invÃ¡lido en el bloqueo " + (index + 1) + ".");
    if (relativePath !== "." && (!relativePath || relativePath.startsWith("/") || relativePath.includes("\\") || relativePath.split("/").some(part => !part || part === "." || part === ".." || /[\u0000-\u001f\u007f]/.test(part)))) {
      throw new Error("Ruta invÃ¡lida en el bloqueo " + (index + 1) + ".");
    }
    if (!["file", "folder"].includes(itemType)) throw new Error("Tipo invÃ¡lido en el bloqueo " + (index + 1) + ".");
    if (!createdBy || createdBy.length > 128) throw new Error("created_by invÃ¡lido en el bloqueo " + (index + 1) + ".");
    if (!createdAt || Number.isNaN(Date.parse(createdAt))) throw new Error("created_at invÃ¡lido en el bloqueo " + (index + 1) + ".");
    const key = businessUserId + "\u0000" + relativePath;
    const prior = seen.get(key);
    if (prior && (prior.item_type !== itemType || prior.created_by !== createdBy || prior.created_at !== createdAt)) {
      throw new Error("El manifest repite una ruta con valores distintos.");
    }
    seen.set(key, row);
    return { businessUserId, relativePath, itemType, createdBy, createdAt };
  });
  return [...new Map(tombstones.map(row => [row.businessUserId + "\u0000" + row.relativePath, row])).values()];
}

function loadManifest(filePath) {
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch (error) { throw new Error("No se pudo leer el manifest JSON: " + error.message); }
  return validateManifest(parsed);
}

function importTombstones(store, tombstones) {
  const insert = store.db.prepare(
    "INSERT INTO tombstones(business_user_id,relative_path,item_type,created_by,created_at) VALUES(?,?,?,?,?) ON CONFLICT(business_user_id,relative_path) DO NOTHING",
  );
  const find = store.db.prepare(
    "SELECT item_type FROM tombstones WHERE business_user_id=? AND relative_path=?",
  );
  let inserted = 0;
  const run = store.db.transaction(() => {
    for (const row of tombstones) {
      const existing = find.get(row.businessUserId, row.relativePath);
      if (existing && existing.item_type !== row.itemType) {
        throw new Error("Conflicto con un bloqueo local existente; no se aplicÃ³ la importaciÃ³n.");
      }
      if (!existing) {
        insert.run(row.businessUserId, row.relativePath, row.itemType, row.createdBy, row.createdAt);
        inserted++;
      }
    }
  });
  run.immediate();
  return { total: tombstones.length, inserted, unchanged: tombstones.length - inserted };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const unknown = args.filter(arg => arg.startsWith("--") && arg !== "--apply");
  const filePath = args.find(arg => !arg.startsWith("--"));
  if (!filePath || unknown.length) {
    console.error("Uso: node src/import-tombstones.js <manifest.json> [--apply]");
    process.exitCode = 2;
  } else {
    try {
      const tombstones = loadManifest(filePath);
      if (!apply) {
        console.log(JSON.stringify({ mode: "dry-run", valid: true, tombstones: tombstones.length }));
      } else {
        const { CloudStore } = require("./store");
        const store = new CloudStore(process.env.CLOUD_SQLITE_PATH);
        try { console.log(JSON.stringify({ mode: "applied", ...importTombstones(store, tombstones) })); }
        finally { store.close(); }
      }
    } catch (error) {
      console.error(error.message || "FallÃ³ la importaciÃ³n.");
      process.exitCode = 1;
    }
  }
}

module.exports = { validateManifest, loadManifest, importTombstones };
