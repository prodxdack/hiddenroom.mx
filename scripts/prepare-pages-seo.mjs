#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_ROOT = ".";
const DEFAULT_SITE_URL = "https://hiddenroom.mx";

const PRIVATE_ROUTE = /^(?:portal(?:\/|$)|analytics(?:\/|$)|cloud(?:\/|$)|store\/(?:admin\.html|cart\.html|checkout\.html|orders\.html|success\.html)|store\/beat_store\/(?:my-beats\.html|new-beat\.html|orders\.html|producer\.html|review\.html)|eventos\/admin\.html|media\/admin\.html|tickets\/(?:generate\.html|validate\.html|view\.html))$/i;

const ROUTE_META = new Map([
  ["/", {
    title: "Hidden Room | Estudio, producción musical y Beat Store",
    description: "Hidden Room reúne estudio de grabación, producción musical, eventos y un Beat Store para artistas en México.",
  }],
  ["/studio/", {
    title: "Estudio de grabación y producción musical | Hidden Room",
    description: "Solicita una sesión de grabación o producción musical en Hidden Room. Revisa servicios, sedes y precios publicados.",
  }],
  ["/store/beat_store/", {
    title: "Beat Store | Beats y licencias para artistas | Hidden Room",
    description: "Explora beats de Hidden Room, compara licencias y prepara tu siguiente lanzamiento con información clara.",
  }],
  ["/store/", {
    title: "Tienda musical | Hidden Room",
    description: "Compra beats y productos de Hidden Room con precios en MXN y soporte para resolver tu pedido.",
  }],
  ["/media/", {
    title: "Hidden Room Media | Producción, estudio y escena",
    description: "Historias y guías de Hidden Room sobre producción musical, estudio, licencias y la escena independiente.",
  }],
  ["/academia/", {
    title: "Academia musical | Hidden Room",
    description: "Recursos de Hidden Room para aprender, producir música y avanzar con más claridad en cada proyecto.",
  }],
  ["/eventos/", {
    title: "Eventos y experiencias | Hidden Room",
    description: "Consulta eventos, experiencias y encuentros de la comunidad Hidden Room.",
  }],
  ["/tickets/", {
    title: "Boletos y accesos | Hidden Room",
    description: "Consulta accesos y boletos para eventos de Hidden Room.",
  }],
]);

const PUBLIC_SCHEMA = {
  "/": {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "{site}/#organization",
        name: "Hidden Room",
        url: "{site}/",
        logo: "{site}/assets/img/social_preview.webp",
      },
      {
        "@type": "WebSite",
        "@id": "{site}/#website",
        name: "Hidden Room",
        url: "{site}/",
        publisher: { "@id": "{site}/#organization" },
        inLanguage: "es-MX",
      },
    ],
  },
  "/studio/": {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Estudio de grabación y producción musical Hidden Room",
    serviceType: "Estudio de grabación y producción musical",
    url: "{site}/studio/",
    areaServed: ["Ixtapaluca", "Iztapalapa", "Venustiano Carranza"],
    provider: { "@type": "Organization", name: "Hidden Room", url: "{site}/" },
  },
  "/store/beat_store/": {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Beat Store | Hidden Room",
    url: "{site}/store/beat_store/",
    isPartOf: { "@type": "WebSite", name: "Hidden Room", url: "{site}/" },
    about: "Beats y licencias para producción musical",
    inLanguage: "es-MX",
  },
};

const escapeJson = (value) => JSON.stringify(value).replaceAll("</", "<\\/");
const baseUrl = (value) => new URL(value).href.replace(/\/$/, "");

function normalizedRoute(root, file) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -"index.html".length)}`;
  return `/${relative}`;
}

function isPrivate(route) {
  return PRIVATE_ROUTE.test(route.replace(/^\//, ""));
}

function setMeta(html, selector, attribute, value) {
  const escaped = value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${selector}=["']${escapedAttribute}["'])[^>]*>`, "i");
  const tag = `<meta ${selector}="${attribute}" content="${escaped}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<head[^>]*>/i, (head) => `${head}\n  ${tag}`);
}

function dedupeMeta(html, selector, attribute) {
  const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${selector}=["']${escapedAttribute}["'])[^>]*>`, "gi");
  let seen = false;
  return html.replace(pattern, (tag) => {
    if (seen) return "";
    seen = true;
    return tag;
  });
}

function setCanonical(html, canonical) {
  const tag = `<link rel="canonical" href="${canonical}">`;
  const pattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<head[^>]*>/i, (head) => `${head}\n  ${tag}`);
}

function setJsonLd(html, route, site) {
  const schema = PUBLIC_SCHEMA[route];
  if (!schema || /application\/ld\+json/i.test(html)) return html;
  const serialized = escapeJson(JSON.parse(JSON.stringify(schema).replaceAll("{site}", site)));
  return html.replace(/<head[^>]*>/i, (head) => `${head}\n  <script type="application/ld+json">${serialized}</script>`);
}

function applyHeadMetadata(html, route, site, beta) {
  const routeMeta = ROUTE_META.get(route);
  let output = html;
  if (beta) output = output.replace(/https:\/\/hiddenroom\.mx/gi, site);
  if (routeMeta) {
    output = output.replace(/<title>[^<]*<\/title>/i, `<title>${routeMeta.title}</title>`);
    output = setMeta(output, "name", "description", routeMeta.description);
    output = setMeta(output, "property", "og:title", routeMeta.title);
    output = setMeta(output, "property", "og:description", routeMeta.description);
  }
  const canonical = `${site}${route === "/" ? "/" : route}`;
  output = setCanonical(output, canonical);
  output = setMeta(output, "property", "og:url", canonical);
  output = setMeta(output, "property", "og:type", route.startsWith("/media/articles/") ? "article" : "website");
  output = setMeta(output, "name", "robots", beta || isPrivate(route) ? "noindex, nofollow" : "index, follow");
  for (const [selector, attribute] of [["name", "description"], ["name", "robots"], ["property", "og:title"], ["property", "og:description"], ["property", "og:type"], ["property", "og:url"]]) {
    output = dedupeMeta(output, selector, attribute);
  }
  output = setJsonLd(output, route, site);
  return output;
}

async function collectHtml(root, directory = root) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules", ".local-backups", ".store-seo-preview"].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtml(root, file));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) files.push(file);
  }
  return files;
}

export async function preparePagesSeo({ root = DEFAULT_ROOT, siteUrl = DEFAULT_SITE_URL, beta = false, only = [] } = {}) {
  const absoluteRoot = path.resolve(root);
  const site = baseUrl(siteUrl);
  const requestedRoutes = new Set(only.map((route) => route.startsWith("/") ? route : `/${route}`));
  const files = (await collectHtml(absoluteRoot)).filter((file) => !requestedRoutes.size || requestedRoutes.has(normalizedRoute(absoluteRoot, file)));
  for (const file of files) {
    const route = normalizedRoute(absoluteRoot, file);
    const source = await fs.readFile(file, "utf8");
    const output = applyHeadMetadata(source, route, site, beta);
    if (output !== source) await fs.writeFile(file, output, "utf8");
  }
  return { root: absoluteRoot, files: files.length, site, beta };
}

function cliArgs(argv) {
  const options = { root: DEFAULT_ROOT, siteUrl: DEFAULT_SITE_URL, beta: false, only: [] };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") options.root = argv[++index];
    else if (argv[index] === "--site-url") options.siteUrl = argv[++index];
    else if (argv[index] === "--beta") options.beta = true;
    else if (argv[index] === "--only") options.only = argv[++index].split(",").map((route) => route.trim()).filter(Boolean);
    else if (argv[index] === "--help") return null;
    else throw new Error(`Argumento desconocido: ${argv[index]}`);
  }
  return options;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href) {
  try {
    const options = cliArgs(process.argv.slice(2));
    if (!options) {
      console.log("Uso: node scripts/prepare-pages-seo.mjs [--root carpeta] [--site-url URL] [--beta] [--only /ruta,/otra-ruta]");
      process.exit(0);
    }
    const result = await preparePagesSeo(options);
    console.log(`SEO preparado: ${result.files} HTML en ${result.root} (${result.beta ? "noindex Beta" : "Producción indexable"}).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
