"use strict";
const http = require("node:http");
const PUBLIC_ROUTES = [
  ["GET", /^\/health$/], ["POST", /^\/auth\/exchange$/], ["POST", /^\/auth\/revoke$/],
  ["POST", /^\/api\/transfers$/], ["HEAD", /^\/api\/transfers\/[0-9a-f-]{36}$/i],
  ["PATCH", /^\/api\/transfers\/[0-9a-f-]{36}$/i], ["PUT", /^\/api\/backups$/],
  ["GET", /^\/api\/(files|count|jobs|tombstones|trash|metrics)$/], ["GET", /^\/api\/backup-folders$/], ["PUT", /^\/api\/backup-folders$/],
  ["GET", /^\/api\/jobs\/[0-9a-f-]{36}$/i],
  ["GET", /^\/api\/files\/(download|download-folder)$/], ["POST", /^\/api\/files\/upload$/],
  ["POST", /^\/api\/folders$/], ["DELETE", /^\/api\/files\/item$/],
  ["POST", /^\/api\/trash\/restore$/], ["DELETE", /^\/api\/trash\/item$/],
  ["POST", /^\/api\/tombstones$/], ["POST", /^\/api\/tombstones\/remove$/],
  ["DELETE", /^\/api\/tombstones$/],
];
const REQUEST_HEADERS = new Set([
  "accept", "authorization", "content-length", "content-type",
  "access-control-request-headers", "access-control-request-method", "origin",
  "idempotency-key", "range", "upload-length", "upload-offset", "tus-resumable", "x-content-sha256",
]);
const HOP_HEADERS = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
]);
function localApiRouteAllowed(method, pathname) {
  return PUBLIC_ROUTES.some(([allowedMethod, pattern]) => method === allowedMethod && pattern.test(pathname));
}
function createLocalApiProxy({ internalUrl, fail }) {
  const configured = String(internalUrl || "").replace(/\/+$/, "");
  return function proxyLocalApi(req, res, url) {
    if (!configured) return fail(res, 503, "La API local de Cloud no estÃ¡ habilitada.");
    let base;
    try { base = new URL(configured); }
    catch { return fail(res, 503, "La API local de Cloud no tiene una direcciÃ³n vÃ¡lida."); }
    if (base.protocol !== "http:" || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(base.hostname)) {
      return fail(res, 503, "La API local debe permanecer enlazada a loopback.");
    }
    const pathname = url.pathname.slice("/local-api".length) || "/";
    const method = req.method === "OPTIONS" ? String(req.headers["access-control-request-method"] || "").toUpperCase() : req.method;
    if (!localApiRouteAllowed(method, pathname)) return fail(res, 404, "Ruta local de Cloud no disponible.");
    const target = new URL(base);
    target.pathname = base.pathname.replace(/\/$/, "") + pathname;
    target.search = url.search;
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) if (REQUEST_HEADERS.has(name.toLowerCase())) headers[name] = value;
    const upstream = http.request(target, { method: req.method, headers }, (response) => {
      const responseHeaders = {};
      for (const [name, value] of Object.entries(response.headers)) {
        if (!HOP_HEADERS.has(name.toLowerCase()) && value !== undefined) responseHeaders[name] = value;
      }
      res.writeHead(response.statusCode || 502, responseHeaders);
      response.pipe(res);
    });
    upstream.setTimeout(31 * 60 * 1000, () => upstream.destroy(new Error("La API local de Cloud agotÃ³ el tiempo de espera.")));
    upstream.on("error", (error) => {
      if (res.headersSent) return res.destroy(error);
      return fail(res, 503, error.message || "La API local de Cloud no estÃ¡ disponible.");
    });
    req.pipe(upstream);
    res.on("close", () => { if (!upstream.destroyed) upstream.destroy(); });
  };
}
module.exports = { createLocalApiProxy, localApiRouteAllowed };
