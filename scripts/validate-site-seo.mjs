#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PUBLIC_ROUTES = new Set(["/", "/studio/", "/store/", "/store/beat_store/", "/media/", "/media/articles/", "/academia/", "/eventos/", "/tickets/"]);
const PRIVATE_ROUTE = /^(?:portal(?:\/|$)|analytics(?:\/|$)|cloud(?:\/|$)|store\/(?:admin\.html|cart\.html|checkout\.html|orders\.html|success\.html)|store\/beat_store\/(?:my-beats\.html|new-beat\.html|orders\.html|producer\.html|review\.html)|eventos\/admin\.html|media\/admin\.html|tickets\/(?:generate\.html|validate\.html|view\.html))$/i;

function args(argv) {
  const result = { root: ".", siteUrl: "https://hiddenroom.mx", beta: false, ignore: [] };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") result.root = argv[++index];
    else if (argv[index] === "--site-url") result.siteUrl = argv[++index];
    else if (argv[index] === "--beta") result.beta = true;
    else if (argv[index] === "--ignore") result.ignore = argv[++index].split(",").map((item) => item.trim()).filter(Boolean);
    else if (argv[index] === "--help") return null;
    else throw new Error(`Argumento desconocido: ${argv[index]}`);
  }
  return result;
}

function routeFor(root, file) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -"index.html".length)}`;
  return `/${relative}`;
}

async function collect(root, directory = root) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules", ".local-backups", ".store-seo-preview"].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(root, file));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) files.push(file);
  }
  return files;
}

function metadata(html, name, attribute = "name") {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html.match(new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${escapedName}["'])[^>]*>`, "i"))?.[0] ?? "";
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "";
}

export async function validateSiteSeo({ root = ".", siteUrl = "https://hiddenroom.mx", beta = false, ignore = [] } = {}) {
  const absoluteRoot = path.resolve(root);
  const site = new URL(siteUrl).href.replace(/\/$/, "");
  const ignored = new Set(ignore.map((item) => item.replaceAll("\\", "/")));
  const files = (await collect(absoluteRoot)).filter((file) => !ignored.has(path.relative(absoluteRoot, file).replaceAll(path.sep, "/")));
  assert.ok(files.length, "No se encontraron HTML para validar.");
  let jsonLdCount = 0;
  for (const file of files) {
    const route = routeFor(absoluteRoot, file);
    const html = await fs.readFile(file, "utf8");
    const robots = metadata(html, "robots");
    const requiresRobots = beta || PUBLIC_ROUTES.has(route) || PRIVATE_ROUTE.test(route.replace(/^\//, ""));
    if (requiresRobots) assert.ok(robots, `Falta meta robots: ${route}`);
    if (beta) assert.match(robots, /noindex/i, `Beta debe ser noindex: ${route}`);
    if (!beta && PRIVATE_ROUTE.test(route.replace(/^\//, ""))) assert.match(robots, /noindex/i, `Ruta privada indexable: ${route}`);
    if (!beta && PUBLIC_ROUTES.has(route)) {
      const canonical = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["']/i)?.[1] ?? "";
      assert.equal(canonical, `${site}${route === "/" ? "/" : route}`, `Canonical incorrecto: ${route}`);
      assert.equal(metadata(html, "og:url", "property"), canonical, `og:url incorrecto: ${route}`);
    }
    for (const block of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      JSON.parse(block[1]);
      jsonLdCount += 1;
    }
  }
  const robotsFile = path.join(absoluteRoot, "robots.txt");
  const sitemapFile = path.join(absoluteRoot, "sitemap.xml");
  try {
    const robots = await fs.readFile(robotsFile, "utf8");
    assert.match(robots, /User-agent:\s*\*/i, "robots.txt no declara User-agent.");
    if (!beta) assert.match(robots, new RegExp(`Sitemap:\\s*${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sitemap\\.xml`, "i"), "Sitemap ausente en robots.txt.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (!beta) throw new Error("Producción necesita robots.txt.");
  }
  try {
    const sitemap = await fs.readFile(sitemapFile, "utf8");
    assert.match(sitemap, /<urlset[\s>]/i, "sitemap.xml no es XML urlset.");
    assert.doesNotMatch(sitemap, /beta\.hiddenroom\.mx/i, "Producción contiene URLs Beta en sitemap.xml.");
    if (beta) assert.doesNotMatch(sitemap, /https:\/\/hiddenroom\.mx\//i, "Beta contiene URLs de Producción en sitemap.xml.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return { root: absoluteRoot, files: files.length, jsonLdCount, beta };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href) {
  try {
    const options = args(process.argv.slice(2));
    if (!options) { console.log("Uso: node scripts/validate-site-seo.mjs [--root carpeta] [--site-url URL] [--beta] [--ignore rutas]"); process.exit(0); }
    const result = await validateSiteSeo(options);
    console.log(`SEO del sitio validado: ${result.files} HTML, ${result.jsonLdCount} JSON-LD (${result.beta ? "Beta noindex" : "Producción"}).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
