"use strict";

const fs = require("node:fs");
const path = require("node:path");

function serializeTombstones(rows) {
  if (!Array.isArray(rows) || rows.length > 100000) throw new Error("Conjunto de tombstones invÃ¡lido.");
  return {
    version: 1,
    tombstones: rows.map(row => ({
      business_user_id: String(row.business_user_id || ""),
      relative_path: String(row.relative_path || ""),
      item_type: String(row.item_type || ""),
      created_by: String(row.created_by || ""),
      created_at: String(row.created_at || ""),
    })),
  };
}

function writeExport(store, outputPath) {
  const rows = store.db.prepare(
    "SELECT business_user_id,relative_path,item_type,created_by,created_at FROM tombstones ORDER BY business_user_id,relative_path",
  ).all();
  const manifest = serializeTombstones(rows);
  const target = path.resolve(outputPath);
  fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return { count: manifest.tombstones.length, path: target };
}

if (require.main === module) {
  const outputPath = process.argv[2];
  if (!outputPath || process.argv.length !== 3) {
    console.error("Uso: node src/export-tombstones.js <manifest.json>");
    process.exitCode = 2;
  } else {
    try {
      const { CloudStore } = require("./store");
      const store = new CloudStore(process.env.CLOUD_SQLITE_PATH);
      try {
        const result = writeExport(store, outputPath);
        console.log(JSON.stringify({ success: true, count: result.count, output: result.path }));
      } finally { store.close(); }
    } catch (error) {
      console.error(error.message || "FallÃ³ la exportaciÃ³n.");
      process.exitCode = 1;
    }
  }
}

module.exports = { serializeTombstones, writeExport };
