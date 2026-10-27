#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { URL } = require('url');
const { createLocalApiProxy } = require('./local-api-proxy');
const sharp = require('sharp');

const APP_DIR = __dirname;
loadEnv(path.join(APP_DIR, '.env'));
sharp.cache(false);
sharp.concurrency(Number(process.env.SHARP_CONCURRENCY || 1));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOUD_LOCAL_API_INTERNAL_URL = String(process.env.CLOUD_LOCAL_API_INTERNAL_URL || "").replace(/\/+$/, "");
const CLOUD_ROOT = process.env.CLOUD_HIDDENROOM_ROOT || process.env.CLOUD_ROOT;
const CLOUD_HIDDENROOM_URL = process.env.CLOUD_HIDDENROOM_URL || 'https://cloud.hiddenroom.mx';
const MYSAUTH_LOGO_URL = 'https://hiddenroom.mx/assets/img/mysauth-logo.webp';
const CLOUD_STATE_FILE = '.mysauth-cloud-state.json';
const CLOUD_TRASH_DIR = '.trash';
const CLOUD_TRASH_MANIFEST = '.manifest.json';
const CLOUD_SHARE_PRIVACIES = new Set(['public','link']);
const CLOUD_SHARE_TOKEN_BYTES = 24;
const PORT = Number(process.env.CLOUD_PORT || process.env.PORT || 3001);
const BIND_HOST = process.env.CLOUD_BIND_HOST || '0.0.0.0';
const MAX_UPLOAD_BYTES = Number(process.env.CLOUD_MAX_UPLOAD_BYTES || 100 * 1024 * 1024);
const FFMPEG_PATH = process.env.FFMPEG_PATH || resolveFfmpegStaticPath() || 'ffmpeg';
const BEAT_PREVIEW_MAX_UPLOAD_BYTES = Number(process.env.BEAT_PREVIEW_MAX_UPLOAD_BYTES || MAX_UPLOAD_BYTES);
const BEAT_MASTER_MP3_BITRATE = process.env.BEAT_MASTER_MP3_BITRATE || '192k';
const BEAT_PREVIEW_MP3_BITRATE = process.env.BEAT_PREVIEW_MP3_BITRATE || '160k';
const BEAT_STEMS_MAX_UPLOAD_BYTES = Number(process.env.BEAT_STEMS_MAX_UPLOAD_BYTES || 500 * 1024 * 1024);
const BEAT_COVER_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const BEAT_COVER_MAX_DIMENSION = 8000;
const BEAT_COVER_MAIN_SIZE = 1200;
const BEAT_COVER_THUMB_SIZE = 300;
const PRODUCER_AVATAR_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const PRODUCER_AVATAR_MAX_DIMENSION = 8000;
const PRODUCER_AVATAR_SIZE = 640;
const SERVER_STATUS_INTERVAL_MS = Number(process.env.SERVER_STATUS_INTERVAL_MS || 20_000);
const SERVER_STATUS_HISTORY_LIMIT = Number(process.env.SERVER_STATUS_HISTORY_LIMIT || 50);
const SERVER_STATUS_TABLE = process.env.SERVER_STATUS_TABLE || 'server_status_history';
const SERVER_STATUS_DISK_PATH = process.env.SERVER_STATUS_DISK_PATH || CLOUD_ROOT || '/';
const CLOUD_UPLOAD_PERMISSION = 'cloud.upload';
const BEAT_UPLOAD_PERMISSION = 'beats.upload';
const DOWNLOAD_TOKEN_TTL_MS = Number(process.env.CLOUD_DOWNLOAD_TOKEN_TTL_MS || 2 * 60 * 1000);
const BEAT_PERMISSION_KEYS = ['beat.store', 'beats.store', 'store.beats', 'store.beat', 'beat_store', 'beats', 'Beat Store', 'module.beats', 'module.beat-store'];
const BEAT_STORE_DIR = 'beats_store';
const BEAT_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.aif', '.aiff']);
const BEAT_UPLOAD_AUDIO_EXTENSIONS = new Set(['.wav']);
const BEAT_PREVIEW_AUDIO_EXTENSIONS = new Set(['.mp3']);
const BEAT_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const BEAT_MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const PUBLIC_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Range, Content-Type, X-Beat-Product-Id, X-Beat-Slug, X-Beat-Crop, X-Producer-Profile-Id, X-Producer-Avatar-Crop, X-File-Name',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Disposition',
};
const API_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name',
};
let lastCpuSnapshot = null;
let latestServerStatus = null;
let serverStatusHistory = [];
let serverStatusPersisting = false;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

// Only these formats may be served inline to the browser. Downloads keep the
// historical octet-stream/attachment contract, while previews use the real
// MIME type so native browser players can request byte ranges.
const CLOUD_PREVIEW_MIME_TYPES = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.aac': 'audio/aac',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.oga': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.avi': 'video/x-msvideo',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.ogv': 'video/ogg',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.text': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};


if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CLOUD_ROOT) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or CLOUD_HIDDENROOM_ROOT/CLOUD_ROOT');
  process.exit(1);
}

function resolveFfmpegStaticPath() {
  try { return require('ffmpeg-static'); } catch { return ''; }
}
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}
function sendJson(res, status, body) { send(res, status, JSON.stringify(body), { ...API_CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' }); }
function sendPublicJson(res, status, body) { send(res, status, JSON.stringify(body), { ...PUBLIC_CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' }); }
function fail(res, status, message) { sendJson(res, status, { success: false, error: message }); }
function failPublic(res, status, message) { sendPublicJson(res, status, { success: false, error: message }); }

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8');
}

function signDownloadPayload(payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', SERVICE_ROLE_KEY).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyDownloadToken(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) throw new Error('Enlace de descarga invalido.');
  const expected = crypto.createHmac('sha256', SERVICE_ROLE_KEY).update(body).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) throw new Error('Enlace de descarga invalido.');
  let payload;
  try { payload = JSON.parse(base64UrlDecode(body)); } catch { throw new Error('Enlace de descarga invalido.'); }
  if (!payload.exp || Date.now() > Number(payload.exp)) throw new Error('El enlace de descarga expiro.');
  return payload;
}

function streamFile(req, res, filePath, stats, headers = {}) {
  const range = req.headers.range;
  const baseHeaders = {
    'Accept-Ranges': 'bytes',
    ...headers,
  };

  function pipeReadStream(options = {}) {
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(filePath, options);
    stream.on('error', (err) => {
      console.error('File stream failed:', err.message || err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'No se pudo leer el archivo.' }));
        return;
      }
      res.destroy(err);
    });
    return stream.pipe(res);
  }

  if (range) {
    const match = String(range).match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${stats.size}` });
      return res.end();
    }
    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : stats.size - 1;
    if (!match[1] && match[2]) {
      const suffix = Number(match[2]);
      start = Math.max(stats.size - suffix, 0);
      end = stats.size - 1;
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stats.size) {
      res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${stats.size}` });
      return res.end();
    }
    end = Math.min(end, stats.size - 1);
    res.writeHead(206, { ...baseHeaders, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stats.size}` });
    return pipeReadStream({ start, end });
  }

  res.writeHead(200, { ...baseHeaders, 'Content-Length': stats.size });
  return pipeReadStream();
}

function cloudPreviewMimeType(name) {
  return CLOUD_PREVIEW_MIME_TYPES[path.extname(String(name || '')).toLowerCase()] || null;
}
async function detectCloudPreviewMimeType(name, filePath) {
  const named = cloudPreviewMimeType(name);
  if (named) return named;
  let handle;
  try {
    handle = await fsp.open(filePath, 'r');
    const header = Buffer.alloc(32);
    await handle.read(header, 0, header.length, 0);
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg';
    if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (header.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
    if (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    if (header[0] === 0x42 && header[1] === 0x4d) return 'image/bmp';
    if ((header[0] === 0x49 && header[1] === 0x49 && header[2] === 0x2a && header[3] === 0x00) || (header[0] === 0x4d && header[1] === 0x4d && header[2] === 0x00 && header[3] === 0x2a)) return 'image/tiff';
    if (header.toString('ascii', 4, 8) === 'ftyp') {
      const brand = header.toString('ascii', 8, 12).toLowerCase();
      if (brand === 'avif' || brand === 'avis') return 'image/avif';
      if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') return 'image/heic';
    }
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {});
  }
  return null;
}


function normalizeCloudPath(input) {
  if (!input || input === '/') return '/';
  let normalized = String(input).replace(/\\/g, '/').replace(/\/+/g, '/');
  if (normalized.startsWith('/../') || normalized === '/..') throw new Error('Ruta no permitida.');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized !== '/' && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  if (normalized.split('/').some((part) => part === '..')) throw new Error('Ruta no permitida.');
  return normalized;
}

function safeChildName(raw) {
  const name = String(raw || '').trim();
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Nombre no permitido.');
  return name;
}

function parseRoles(rawRoles) {
  return String(rawRoles || '').split(',').map((role) => role.trim().toLowerCase()).filter(Boolean);
}

function isAdminRole(roles) {
  return roles.includes('admin');
}

function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function supabaseHeaders() {
  return { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, Accept: 'application/json' };
}

async function supabaseFetch(pathname, options = {}) {
  const url = new URL(pathname, SUPABASE_URL);
  const res = await fetch(url, options);
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.msg || body?.message || body?.error_description || body?.error || `Supabase ${res.status}`);
  return body;
}

function cloudDownloadReference(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  let parsed;
  try { parsed = new URL(raw, CLOUD_HIDDENROOM_URL); } catch { return null; }
  if (!['/api/download', '/api/download-link', '/api/download-folder'].includes(parsed.pathname)) return null;
  const requestedPath = parsed.searchParams.get('path');
  const name = parsed.searchParams.get('name');
  if (!requestedPath || !name) return null;
  return {
    path: normalizeCloudPath(requestedPath),
    name: safeChildName(name),
    type: parsed.pathname === '/api/download-folder' ? 'folder' : 'file',
  };
}

async function findAuthorizedLegacyDownload(user, requestedName) {
  const operationalUserId = String(user.profile?.user_id || '').trim();
  if (!operationalUserId) return null;
  const name = safeChildName(requestedName);
  const encodedUserId = encodeURIComponent(operationalUserId);
  const downloads = await supabaseFetch(`/rest/v1/downloads?select=storage_path,type,release_mode,membership_id,membership_delivery_id,membership_cycle_number&user_id=eq.${encodedUserId}&limit=1000`, {
    headers: supabaseHeaders(),
  });
  const membershipDownloads = (Array.isArray(downloads) ? downloads : []).filter((row) => row?.release_mode === 'membership_delivery');
  let releasedDeliveryIds = new Set();
  let releasedMembershipCycles = new Set();
  if (membershipDownloads.length) {
    const deliveries = await supabaseFetch(`/rest/v1/membership_material_deliveries?select=id,membership_id,cycle_number,delivered_at&user_id=eq.${encodedUserId}&limit=1000`, {
      headers: supabaseHeaders(),
    });
    releasedDeliveryIds = new Set((Array.isArray(deliveries) ? deliveries : [])
      .filter((row) => row?.delivered_at)
      .map((row) => String(row.id))
      .filter(Boolean));
    releasedMembershipCycles = new Set((Array.isArray(deliveries) ? deliveries : [])
      .filter((row) => row?.delivered_at && row?.cycle_number !== null && row?.cycle_number !== undefined)
      .map((row) => `${row.membership_id || ''}\u0000${row.cycle_number}`));
  }
  for (const download of Array.isArray(downloads) ? downloads : []) {
    if (download.release_mode === 'membership_delivery') {
      const released = (download.membership_delivery_id && releasedDeliveryIds.has(String(download.membership_delivery_id)))
        || releasedMembershipCycles.has(`${download.membership_id || ''}\u0000${download.membership_cycle_number}`);
      if (!released) continue;
    }
    let reference;
    try { reference = cloudDownloadReference(download.storage_path); } catch { reference = null; }
    if (!reference || reference.type !== 'file' || reference.name !== name) continue;
    if (!/^\/users\/[^/]+\/downloads$/i.test(reference.path)) continue;
    return reference;
  }
  return null;
}

function slugifyUsername(value, fallback) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/[-._]{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || fallback;
}

function permissionsInclude(permissions, keys) {
  const normalized = new Set(permissions.map((permission) => String(permission).toLowerCase()));
  return keys.some((key) => normalized.has(String(key).toLowerCase()));
}

async function fetchPermissions(userId) {
  const rows = await supabaseFetch(`/rest/v1/user_permissions?select=permission_key&user_id=eq.${encodeURIComponent(userId)}`, {
    headers: supabaseHeaders(),
  }).catch((err) => {
    console.error('Permissions lookup failed:', err.message || err);
    return [];
  });
  return Array.isArray(rows) ? rows.map((row) => row.permission_key).filter(Boolean) : [];
}

async function hasBeatStoreDownload(userId) {
  const downloads = await supabaseFetch(`/rest/v1/store_downloads?select=product_id&user_id=eq.${encodeURIComponent(userId)}&available=eq.true&limit=50`, {
    headers: supabaseHeaders(),
  }).catch(() => []);
  const productIds = [...new Set((Array.isArray(downloads) ? downloads : []).map((row) => row.product_id).filter(Boolean))];
  if (!productIds.length) return false;
  const ids = productIds.map((id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '')).filter(Boolean).join(',');
  const products = await supabaseFetch(`/rest/v1/store_products?select=id&id=in.(${ids})&category=eq.beats&limit=1`, {
    headers: supabaseHeaders(),
  }).catch(() => []);
  return Array.isArray(products) && products.length > 0;
}

async function requireCloudUser(req) {
  const token = getBearerToken(req);
  if (!token) { const err = new Error('Sesión requerida.'); err.status = 401; throw err; }
  if (!token.includes('.')) {
    if (!CLOUD_LOCAL_API_INTERNAL_URL) { const err = new Error('La sesión local de Cloud no está habilitada.'); err.status = 401; throw err; }
    let response;
    try {
      response = await fetch(CLOUD_LOCAL_API_INTERNAL_URL + '/auth/validate', {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
    } catch { const err = new Error('El servicio local de sesiones Cloud no está disponible.'); err.status = 503; throw err; }
    const body = await response.json().catch(() => null);
    const identity = body?.identity;
    if (!response.ok || !identity?.authSubject || !identity?.businessUserId || !identity?.rootSlug) {
      const err = new Error(body?.error || 'Sesión local de Cloud inválida.'); err.status = response.status === 403 ? 403 : 401; throw err;
    }
    const roles = Array.isArray(identity.roles) ? identity.roles : [];
    const permissions = Array.isArray(identity.permissions) ? identity.permissions : [];
    const isAdmin = isAdminRole(roles);
    const user = {
      id: identity.authSubject,
      profile: { id: identity.authSubject, user_id: String(identity.businessUserId), username: String(identity.rootSlug), display_name: String(identity.rootSlug), email: null, roles: roles.join(',') },
      roles, permissions, isAdmin, localSession: true, localToken: token,
      isAcademiaAdmin: permissionsInclude(permissions, ['academia.admin']),
      isApprovedProducer: false,
      hasBeatStore: isAdmin || permissionsInclude(permissions, BEAT_PERMISSION_KEYS),
      canUpload: isAdmin || permissionsInclude(permissions, [CLOUD_UPLOAD_PERMISSION]),
      canUploadBeats: isAdmin || permissionsInclude(permissions, [BEAT_UPLOAD_PERMISSION]),
    };
    if (!isAdmin) await ensureUserCloudFolder(user);
    return user;
  }
  const userData = await supabaseFetch('/auth/v1/user', {
    headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_ROLE_KEY, Accept: 'application/json' },
  });
  const userId = userData?.id;
  if (!userId) { const err = new Error('Sesión inválida.'); err.status = 401; throw err; }

  const encodedUserId = encodeURIComponent(userId);
  const profiles = await supabaseFetch(`/rest/v1/users?select=id,user_id,username,display_name,email,roles&or=(id.eq.${encodedUserId},user_id.eq.${encodedUserId})&limit=1`, {
    headers: supabaseHeaders(),
  });
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) { const err = new Error('Perfil no encontrado.'); err.status = 403; throw err; }

  const roles = parseRoles(profile.roles);
  const permissions = await fetchPermissions(userId);
  const isAdmin = isAdminRole(roles);
  const isAcademiaAdmin = permissionsInclude(permissions, ['academia.admin']);
  const producerProfiles = await supabaseFetch(`/rest/v1/producer_profiles?select=id,approval_status,is_active&user_id=eq.${encodedUserId}&limit=1`, { headers: supabaseHeaders() }).catch(() => []);
  const producerProfile = Array.isArray(producerProfiles) ? producerProfiles[0] : null;
  const isApprovedProducer = Boolean(producerProfile?.is_active && producerProfile?.approval_status === 'approved');
  const hasBeatStore = isAdmin || permissionsInclude(permissions, BEAT_PERMISSION_KEYS) || await hasBeatStoreDownload(userId);
  const user = {
    id: userId,
    profile,
    roles,
    permissions,
    isAdmin,
    isAcademiaAdmin,
    isApprovedProducer,
    canUpload: isAdmin || permissionsInclude(permissions, [CLOUD_UPLOAD_PERMISSION]),
    canUploadBeats: isAdmin || permissionsInclude(permissions, [BEAT_UPLOAD_PERMISSION]),
    hasBeatStore,
  };

  if (!isAdmin) await ensureUserCloudFolder(user);
  return user;
}

function getUserCloudRoot(user) {
  const operationalUserId = String(user.profile?.user_id || "").trim();
  if (!operationalUserId) {
    const err = new Error("El perfil no tiene user_id operativo; no se puede crear una ruta Cloud.");
    err.status = 409;
    throw err;
  }
  const label = user.profile?.username || user.profile?.display_name || user.profile?.email || operationalUserId;
  const slug = slugifyUsername(label, 'user');
  return path.join(path.resolve(CLOUD_ROOT), 'users', `${operationalUserId}__${slug}`);
}

async function ensureUserCloudFolder(user) {
  const userRoot = getUserCloudRoot(user);
  const folders = ['uploads', 'downloads', 'private'];
  if (user.hasBeatStore) folders.push('beats');
  await fsp.mkdir(userRoot, { recursive: true });
  await Promise.all(folders.map((folder) => fsp.mkdir(path.join(userRoot, folder), { recursive: true })));
  return userRoot;
}

function getCloudBaseRoot(user) {
  return user.isAdmin ? path.resolve(CLOUD_ROOT) : getUserCloudRoot(user);
}

function cloudStatePath(baseRoot) {
  const resolvedRoot = path.resolve(baseRoot);
  const statePath = path.resolve(resolvedRoot, CLOUD_STATE_FILE);
  assertInsideRoot(resolvedRoot, statePath);
  return statePath;
}

async function readCloudState(baseRoot) {
  try {
    const raw = await fsp.readFile(cloudStatePath(baseRoot), 'utf8');
    const parsed = JSON.parse(raw);
    return { favorites: Array.isArray(parsed?.favorites) ? parsed.favorites : [], shares: Array.isArray(parsed?.shares) ? parsed.shares : [] };
  } catch (err) {
    if (err?.code === 'ENOENT' || err instanceof SyntaxError) return { favorites: [], shares: [] };
    throw err;
  }
}

async function writeCloudState(baseRoot, state) {
  const favorites = Array.isArray(state?.favorites) ? state.favorites : [];
  const shares = Array.isArray(state?.shares) ? state.shares : [];
  await writeAtomicCloudFile(cloudStatePath(baseRoot), JSON.stringify({ version: 1, favorites, shares }, null, 2));
}

function favoriteKey(requestedPath, name) {
  return normalizeCloudPath(requestedPath) + '\u0000' + safeChildName(name);
}

function cloudShareKey(p,n){return favoriteKey(p,n)}
function normalizeCloudSharePrivacy(v){v=String(v||'').trim().toLowerCase();if(v==='private')return v;if(!CLOUD_SHARE_PRIVACIES.has(v))throw Error('Privacidad no permitida.');return v}
function cloudShareUrl(t){return String(CLOUD_HIDDENROOM_URL).replace(/\/$/,'')+'/share/'+encodeURIComponent(t)}
function validCloudShareEntry(e){try{return Boolean(e&&new RegExp('^[a-f0-9]{'+(CLOUD_SHARE_TOKEN_BYTES*2)+'}$','i').test(String(e.token||''))&&CLOUD_SHARE_PRIVACIES.has(String(e.privacy||''))&&cloudShareKey(e.path,e.name))}catch{return false}}
function relocateCloudShare(entry, oldItemPath, newItemPath, isFolder) {
  try {
    const entryPath = normalizeCloudPath(entry.path), entryName = safeChildName(entry.name);
    const entryFullPath = cloudShareKey(entryPath, entryName).replace('\u0000', '/');
    if (entryFullPath === oldItemPath) {
      const split = newItemPath.lastIndexOf('/');
      return { ...entry, path: split <= 0 ? '/' : newItemPath.slice(0, split), name: newItemPath.slice(split + 1) };
    }
    if (isFolder && entryFullPath.startsWith(oldItemPath + '/')) {
      const movedPath = newItemPath + entryFullPath.slice(oldItemPath.length), split = movedPath.lastIndexOf('/');
      return { ...entry, path: split <= 0 ? '/' : movedPath.slice(0, split), name: movedPath.slice(split + 1) };
    }
  } catch {}
  return entry;
}
function requireShareAdmin(u){if(!u.isAdmin){const e=Error('Solo admin puede compartir archivos.');e.status=403;throw e}}
async function setCloudFileSharing(u,req,res){requireShareAdmin(u);const b=await readJson(req),p=normalizeCloudPath(b.path),n=safeChildName(b.name),privacy=normalizeCloudSharePrivacy(b.privacy),root=path.resolve(CLOUD_ROOT);const {child}=await resolveSafeChild(root,p,n,{mustExist:true});if(!(await fsp.stat(child)).isFile())throw Error('Solo se pueden compartir archivos.');const s=await readCloudState(root),key=cloudShareKey(p,n);const shares=(s.shares||[]).filter(validCloudShareEntry).filter(e=>{try{return cloudShareKey(e.path,e.name)!==key}catch{return false}});let share=null;if(privacy!=='private'){share={token:crypto.randomBytes(CLOUD_SHARE_TOKEN_BYTES).toString('hex'),path:p,name:n,privacy,createdAt:new Date().toISOString()};shares.push(share)}await writeCloudState(root,{favorites:s.favorites,shares});sendJson(res,200,{success:true,privacy,share_url:share?cloudShareUrl(share.token):null})}
async function resolveSharedFile(raw){const token=String(raw||'').trim();if(!new RegExp('^[a-f0-9]{'+(CLOUD_SHARE_TOKEN_BYTES*2)+'}$','i').test(token)){const e=Error('Enlace compartido no valido.');e.status=404;throw e}const root=path.resolve(CLOUD_ROOT),s=await readCloudState(root),share=(s.shares||[]).find(e=>validCloudShareEntry(e)&&e.token.toLowerCase()===token.toLowerCase());if(!share){const e=Error('Enlace compartido no encontrado.');e.status=404;throw e}const {name,child}=await resolveSafeChild(root,share.path,share.name,{mustExist:true}),stats=await fsp.stat(child);if(!stats.isFile()){const e=Error('El archivo compartido no esta disponible.');e.status=404;throw e}return{share,name,child,stats}}
async function streamSharedFile(req,res,url){const {name,child,stats}=await resolveSharedFile(url.searchParams.get('token')),mode=url.searchParams.get('mode')==='view'?'view':'download',type=mode==='view'?await detectCloudPreviewMimeType(name,child):null,inline=mode==='view'&&Boolean(type),encoded=encodeURIComponent(name).replace(/['()]/g,escape).replace(/\*/g,'%2A'),safe=name.replace(/["\r\n]/g,'_');return streamFile(req,res,child,stats,{...PUBLIC_CORS_HEADERS,'Content-Type':type||'application/octet-stream','Content-Disposition':(inline?'inline':'attachment')+'; filename="'+safe+'"; filename*=UTF-8\'\''+encoded,'Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'})}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function renderSharedPreviewPage(req,res,url){const {share,name}=await resolveSharedFile(url.pathname.split('/').filter(Boolean).pop()),token=share.token,view='/api/shared-file?token='+encodeURIComponent(token)+'&mode=view',download='/api/shared-file?token='+encodeURIComponent(token)+'&mode=download',type=await detectCloudPreviewMimeType(name,(await resolveSharedFile(token)).child)||'';let preview='<p>No hay vista previa para este formato.</p>';if(type.startsWith('image/'))preview='<img src="'+view+'" alt="'+escapeHtml(name)+'">';else if(type.startsWith('audio/'))preview='<audio controls src="'+view+'"></audio>';else if(type.startsWith('video/'))preview='<video controls playsinline src="'+view+'"></video>';else if(type==='application/pdf'||type.startsWith('text/')||type==='application/json'||type==='application/xml')preview='<iframe title="Vista previa" src="'+view+'"></iframe>';const robots=share.privacy==='public'?'index,follow':'noindex,nofollow',html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="'+robots+'"><title>'+escapeHtml(name)+' ? MysAuth Cloud</title><style>body{margin:0;padding:28px;background:#090b10;color:#f5f7fb;font:16px system-ui;display:grid;place-items:center;min-height:100vh;box-sizing:border-box}.card{width:min(960px,100%);padding:24px;border:1px solid #ffffff2b;border-radius:20px;background:#151923}.share-header{display:flex;align-items:center;gap:12px;margin-bottom:18px}.share-logo{display:block;width:min(190px,52vw);height:auto;max-height:52px;object-fit:contain;object-position:left center}.share-product{color:#aab2c0;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase}.preview{display:grid;place-items:center;min-height:220px;padding:18px;background:#090b10;border-radius:14px}.preview img,.preview video,.preview iframe{max-width:100%;width:100%;border:0;border-radius:10px}.preview iframe{min-height:60vh;background:#fff}.preview audio{width:min(620px,100%)}a{display:inline-block;margin:18px 8px 0 0;padding:11px 15px;border-radius:10px;background:#e0525d;color:#fff;text-decoration:none;font-weight:700}</style></head><body><main class="card"><header class="share-header"><img class="share-logo" src="'+MYSAUTH_LOGO_URL+'" alt="MysAuth"><span class="share-product">Cloud</span></header><h1>'+escapeHtml(name)+'</h1><section class="preview">'+preview+'</section><a href="'+download+'">Descargar</a><a href="'+view+'" target="_blank" rel="noopener">Abrir archivo</a></main></body></html>';send(res,200,html,{...PUBLIC_CORS_HEADERS,'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' https://hiddenroom.mx data:; media-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'"})}

function getTrashRoot(baseRoot) {
  const resolvedRoot = path.resolve(baseRoot);
  const trashRoot = path.resolve(resolvedRoot, CLOUD_TRASH_DIR);
  assertInsideRoot(resolvedRoot, trashRoot);
  return trashRoot;
}

function trashManifestPath(baseRoot) {
  const root = path.resolve(baseRoot);
  const manifest = path.resolve(getTrashRoot(root), CLOUD_TRASH_MANIFEST);
  assertInsideRoot(root, manifest);
  return manifest;
}

async function readTrashManifest(baseRoot) {
  try {
    const raw = await fsp.readFile(trashManifestPath(baseRoot), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err?.code === 'ENOENT' || err instanceof SyntaxError) return [];
    throw err;
  }
}

async function writeTrashManifest(baseRoot, entries) {
  const trashRoot = getTrashRoot(baseRoot);
  await fsp.mkdir(trashRoot, { recursive: true });
  await writeAtomicCloudFile(trashManifestPath(baseRoot), JSON.stringify(entries, null, 2));
}

function safeTrashId(raw) {
  const id = String(raw || '').trim();
  if (!/^[a-f0-9-]{16,80}$/i.test(id)) throw new Error('Elemento de papelera no permitido.');
  return id;
}

function trashStoredPath(baseRoot, storedName) {
  const name = safeChildName(storedName);
  const root = path.resolve(baseRoot);
  const candidate = path.resolve(getTrashRoot(root), name);
  assertInsideRoot(root, candidate);
  return candidate;
}

function getPublicPath(user, normalizedPath) {
  return normalizedPath;
}

async function getRealRoot(baseRoot) {
  await fsp.mkdir(baseRoot, { recursive: true });
  return fsp.realpath(baseRoot);
}

function assertInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Ruta no permitida.');
}

async function resolveSafePath(baseRoot, requestedPath, options = {}) {
  const normalized = normalizeCloudPath(requestedPath);
  const realRoot = await getRealRoot(baseRoot);
  const candidate = path.resolve(realRoot, `.${normalized}`);
  assertInsideRoot(realRoot, candidate);

  if (options.mustExist === false) {
    const parentReal = await fsp.realpath(path.dirname(candidate));
    assertInsideRoot(realRoot, parentReal);
    return { normalized, resolved: candidate, root: realRoot };
  }

  const realCandidate = await fsp.realpath(candidate);
  assertInsideRoot(realRoot, realCandidate);
  return { normalized, resolved: realCandidate, root: realRoot };
}

async function resolveSafeChild(baseRoot, requestedPath, rawName, options = {}) {
  const parent = await resolveSafePath(baseRoot, requestedPath, { mustExist: true });
  const name = safeChildName(rawName);
  const child = path.resolve(parent.resolved, name);
  if (path.dirname(child) !== parent.resolved) throw new Error('Ruta no permitida.');
  assertInsideRoot(parent.root, child);

  if (options.mustExist === false) {
    return { ...parent, name, child };
  }

  const realChild = await fsp.realpath(child);
  assertInsideRoot(parent.root, realChild);
  return { ...parent, name, child };
}

async function resolveDownloadChild(user, baseRoot, requestedPath, rawName) {
  try {
    return await resolveSafeChild(baseRoot, requestedPath, rawName, { mustExist: true });
  } catch (err) {
    const normalizedPath = normalizeCloudPath(requestedPath);
    const name = safeChildName(rawName);
    if (!user.isAdmin && normalizedPath === '/downloads') {
      const legacyReference = await findAuthorizedLegacyDownload(user, name);
      if (legacyReference) {
        return resolveSafeChild(path.resolve(CLOUD_ROOT), legacyReference.path, legacyReference.name, { mustExist: true });
      }
    }
    const canSearchLegacyUserDownloads = user.isAdmin && /^\/users\/[^/]+\/downloads$/i.test(normalizedPath);
    if (!canSearchLegacyUserDownloads) throw err;

    const root = await getRealRoot(baseRoot);
    const usersRoot = path.resolve(root, 'users');
    assertInsideRoot(root, usersRoot);
    const entries = await fsp.readdir(usersRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.resolve(usersRoot, entry.name, 'downloads', name);
      assertInsideRoot(root, candidate);
      const stats = await fsp.stat(candidate).catch(() => null);
      if (!stats?.isFile()) continue;
      const realChild = await fsp.realpath(candidate);
      assertInsideRoot(root, realChild);
      return { normalized: '/users/' + entry.name + '/downloads', resolved: path.dirname(realChild), root, name, child: realChild };
    }

    const notFound = new Error('Archivo no encontrado en Cloud. Vuelve a subirlo o corrige la ruta en BB.DD > descargas.');
    notFound.status = 404;
    throw notFound;
  }
}
function requireUploadPermission(user) {
  if (!user.canUpload) { const err = new Error('No tienes permiso cloud.upload.'); err.status = 403; throw err; }
}

function normalizeBackupRelativePath(raw) {
  const value = String(raw || '').replace(/\\/g, '/').replace(/\/+/g, '/').trim();
  const parts = value.split('/');
  if (!value || value.startsWith('/') || parts.some((part) => !part || part === '..' || /[\u0000-\u001f\u007f]/.test(part))) {
    throw new Error('Ruta de respaldo no permitida.');
  }
  return value === '.' ? '.' : parts.join('/');
}

function getBackupDeleteMarker(user, requestedPath, itemName, itemType) {
  const normalizedPath = normalizeCloudPath(requestedPath);
  const pathParts = normalizedPath === '/' ? [] : normalizedPath.slice(1).split('/');
  const safeName = safeChildName(itemName);
  let businessUserId = '';
  let relativeParts = [];

  if (!user.isAdmin) {
    businessUserId = String(user.profile?.user_id || '').trim();
    relativeParts = pathParts.concat(safeName);
  } else if (pathParts[0] === 'users' && pathParts[1]) {
    const match = String(pathParts[1]).match(/^(.+?)__(?:[^/]+)$/);
    if (!match) return null;
    businessUserId = match[1];
    relativeParts = pathParts.slice(2).concat(safeName);
  } else if (pathParts.length === 1 && pathParts[0] === 'users') {
    const match = safeName.match(/^(.+?)__(?:[^/]+)$/);
    if (!match) return null;
    businessUserId = match[1];
    relativeParts = [];
  } else {
    return null;
  }

  if (!businessUserId) return null;
  return {
    business_user_id: businessUserId,
    relative_path: relativeParts.length ? normalizeBackupRelativePath(relativeParts.join('/')) : '.',
    item_type: itemType,
    created_by: user.id,
  };
}

async function recordBackupTombstone(marker, user) {
  if (user?.localSession) {
    const response = await fetch(CLOUD_LOCAL_API_INTERNAL_URL + '/api/tombstones', {
      method: 'POST', headers: { Authorization: 'Bearer ' + user.localToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(marker), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('No se pudo guardar el bloqueo local de respaldo.');
    return;
  }
  await supabaseFetch('/rest/v1/cloud_backup_tombstones', {
    method: 'POST',
    headers: { ...supabaseHeaders(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(marker),
  });
}
async function removeBackupTombstone(marker, user) {
  if (!marker || !user?.localSession) return;
  const response = await fetch(CLOUD_LOCAL_API_INTERNAL_URL + '/api/tombstones/remove', {
    method: 'POST', headers: { Authorization: 'Bearer ' + user.localToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ business_user_id: marker.business_user_id, relative_path: marker.relative_path }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('No se pudo retirar el bloqueo local del respaldo.');
}
async function writeAtomicCloudFile(targetPath, buffer) {
  const directory = path.dirname(targetPath);
  await fsp.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, '.' + path.basename(targetPath) + '.upload-' + crypto.randomBytes(10).toString('hex') + '.part');
  try {
    await fsp.writeFile(temporaryPath, buffer, { flag: 'wx' });
    const handle = await fsp.open(temporaryPath, 'r');
    try { await handle.sync(); } finally { await handle.close(); }
    await fsp.rename(temporaryPath, targetPath);
  } finally {
    await fsp.unlink(temporaryPath).catch(() => undefined);
  }
}
async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('Payload demasiado grande.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function readUpload(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_UPLOAD_BYTES) { const err = new Error('Archivo demasiado grande.'); err.status = 413; throw err; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readLimitedUploadToTemp(req, limitBytes) {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'hr-beat-cover-'));
  const tempPath = path.join(tempDir, 'upload.bin');
  let size = 0;
  const out = fs.createWriteStream(tempPath, { flags: 'wx' });
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limitBytes) {
        const err = new Error('La imagen supera el límite de 12 MB');
        err.status = 413;
        throw err;
      }
      if (!out.write(chunk)) await new Promise((resolve) => out.once('drain', resolve));
    }
    await new Promise((resolve, reject) => out.end((err) => err ? reject(err) : resolve()));
    return { tempDir, tempPath, size };
  } catch (err) {
    out.destroy();
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}
async function readLimitedUploadToTempNamed(req, limitBytes, prefix) {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
  const tempPath = path.join(tempDir, 'upload.bin');
  let size = 0;
  const out = fs.createWriteStream(tempPath, { flags: 'wx' });
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limitBytes) {
        const err = new Error('El audio supera el limite permitido.');
        err.status = 413;
        throw err;
      }
      if (!out.write(chunk)) await new Promise((resolve) => out.once('drain', resolve));
    }
    await new Promise((resolve, reject) => out.end((err) => err ? reject(err) : resolve()));
    return { tempDir, tempPath, size };
  } catch (err) {
    out.destroy();
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

function parseBeatCoverCrop(raw) {
  if (!raw) return null;
  let crop;
  try { crop = JSON.parse(String(raw)); } catch { return null; }
  const x = Number(crop?.x);
  const y = Number(crop?.y);
  const size = Number(crop?.size);
  if (![x, y, size].every(Number.isFinite) || size <= 0) return null;
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), size: Math.max(0.05, Math.min(1, size)) };
}

function producerProfileId(req, url) {
  const raw = String(req.headers['x-producer-profile-id'] || url?.searchParams.get('profile_id') || '').trim();
  if (!raw) {
    const err = new Error('Perfil de productor requerido.');
    err.status = 400;
    throw err;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    const err = new Error('Perfil de productor invalido.');
    err.status = 400;
    throw err;
  }
  return raw;
}

function beatCoverProductId(req) {
  const raw = String(req.headers['x-beat-product-id'] || '').trim();
  if (!raw) return '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    const err = new Error('Beat invalido.');
    err.status = 400;
    throw err;
  }
  return raw;
}

async function fetchBeatProduct(productId) {
  if (!productId) return null;
  const rows = await supabaseFetch(`/rest/v1/store_products?select=id,category,producer_user_id,image_url,beat_cover_path,beat_thumb_path&id=eq.${encodeURIComponent(productId)}&limit=1`, { headers: supabaseHeaders() });
  return Array.isArray(rows) ? rows[0] : null;
}

function canManageBeatUploads(user) {
  return Boolean(user?.isAdmin || user?.isApprovedProducer || user?.canUploadBeats);
}

async function assertCanMutateBeatCover(user, productId) {
  if (!canManageBeatUploads(user)) {
    const err = new Error('Se requiere beats.upload, productor aprobado o admin para actualizar portadas de beats.');
    err.status = 403;
    throw err;
  }
  const product = await fetchBeatProduct(productId);
  if (productId && (!product || product.category !== 'beats')) {
    const err = new Error('Beat no encontrado.');
    err.status = 404;
    throw err;
  }
  if (!user.isAdmin && (!productId || product.producer_user_id !== user.id)) {
    const err = new Error('No puedes actualizar archivos de otro productor.');
    err.status = 403;
    throw err;
  }
  return product;
}

function coverPathIsManaged(value) {
  return /^covers\/[0-9a-f-]{36}\/(cover|thumb)\.webp$/i.test(String(value || ''));
}

async function removeManagedBeatCover(product) {
  if (!product) return;
  const root = await fsp.realpath(beatStoreRoot());
  for (const value of [product.image_url, product.beat_cover_path, product.beat_thumb_path]) {
    if (!coverPathIsManaged(value)) continue;
    const target = path.resolve(root, value);
    assertInsideRoot(root, target);
    await fsp.rm(target, { force: true }).catch(() => {});
  }
}

function sharpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function writeBeatCoverImages(tempPath, crop, outputDir) {
  let meta;
  try {
    meta = await sharp(tempPath, { animated: true, limitInputPixels: BEAT_COVER_MAX_DIMENSION * BEAT_COVER_MAX_DIMENSION }).metadata();
  } catch {
    throw sharpError('La portada debe ser una imagen válida');
  }
  if (!meta?.width || !meta?.height) throw sharpError('La portada debe ser una imagen válida');
  if (meta.format === 'svg') throw sharpError('Formato de imagen no permitido');
  if (!['jpeg', 'png', 'webp'].includes(meta.format)) throw sharpError('Formato de imagen no permitido');
  if ((meta.pages || 1) > 1) throw sharpError('Formato de imagen no permitido');
  if (meta.width > BEAT_COVER_MAX_DIMENSION || meta.height > BEAT_COVER_MAX_DIMENSION) throw sharpError('La imagen tiene dimensiones demasiado grandes', 413);

  const squareMax = Math.min(meta.width, meta.height);
  const cropSize = crop ? Math.min(squareMax, Math.max(1, Math.round(crop.size * squareMax))) : squareMax;
  const maxLeft = Math.max(0, meta.width - cropSize);
  const maxTop = Math.max(0, meta.height - cropSize);
  const left = crop ? Math.max(0, Math.min(maxLeft, Math.round(crop.x * maxLeft))) : Math.round((meta.width - cropSize) / 2);
  const top = crop ? Math.max(0, Math.min(maxTop, Math.round(crop.y * maxTop))) : Math.round((meta.height - cropSize) / 2);
  const extract = { left, top, width: cropSize, height: cropSize };
  const inputOptions = { limitInputPixels: BEAT_COVER_MAX_DIMENSION * BEAT_COVER_MAX_DIMENSION };

  await sharp(tempPath, inputOptions)
    .rotate()
    .extract(extract)
    .resize(BEAT_COVER_MAIN_SIZE, BEAT_COVER_MAIN_SIZE, { fit: 'cover' })
    .webp({ quality: 84 })
    .toFile(path.join(outputDir, 'cover.webp'));
  await sharp(tempPath, inputOptions)
    .rotate()
    .extract(extract)
    .resize(BEAT_COVER_THUMB_SIZE, BEAT_COVER_THUMB_SIZE, { fit: 'cover' })
    .webp({ quality: 78 })
    .toFile(path.join(outputDir, 'thumb.webp'));
}
let activeBeatCoverProcesses = 0;
const MAX_ACTIVE_BEAT_COVER_PROCESSES = Number(process.env.BEAT_COVER_MAX_CONCURRENCY || 2);

async function uploadBeatCover(user, req, res) {
  if (activeBeatCoverProcesses >= MAX_ACTIVE_BEAT_COVER_PROCESSES) {
    const err = new Error('El procesador de portadas está ocupado. Intenta de nuevo en unos segundos.');
    err.status = 429;
    throw err;
  }
  activeBeatCoverProcesses += 1;
  let temp;
  let outputDir = '';
  try {
    const productId = beatCoverProductId(req);
    const product = await assertCanMutateBeatCover(user, productId);
    const crop = parseBeatCoverCrop(req.headers['x-beat-crop']);
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > BEAT_COVER_MAX_UPLOAD_BYTES) throw sharpError('La imagen supera el límite de 12 MB', 413);
    temp = await readLimitedUploadToTemp(req, BEAT_COVER_MAX_UPLOAD_BYTES);
    if (!temp.size) throw sharpError('La portada debe ser una imagen válida');
    const coverId = crypto.randomUUID();
    const root = await getRealRoot(beatStoreRoot());
    outputDir = path.resolve(root, 'covers', coverId);
    assertInsideRoot(root, outputDir);
    await fsp.mkdir(outputDir, { recursive: false });
    await writeBeatCoverImages(temp.tempPath, crop, outputDir);
    const coverPath = `covers/${coverId}/cover.webp`;
    const thumbPath = `covers/${coverId}/thumb.webp`;
    if (productId) {
      await supabaseFetch(`/rest/v1/store_products?id=eq.${encodeURIComponent(productId)}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ image_url: coverPath, beat_cover_path: coverPath, beat_thumb_path: thumbPath }),
      });
      await removeManagedBeatCover(product);
    }
    sendJson(res, 201, { success: true, image_url: coverPath, beat_cover_path: coverPath, beat_thumb_path: thumbPath });
  } catch (err) {
    if (outputDir) await fsp.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    if (err.message && /Input image exceeds pixel limit|unsupported image format|corrupt|invalid/i.test(err.message)) throw sharpError('No se pudo procesar la imagen');
    throw err;
  } finally {
    activeBeatCoverProcesses = Math.max(0, activeBeatCoverProcesses - 1);
    if (temp?.tempDir) await fsp.rm(temp.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function producerAvatarPathIsManaged(value) {
  return /^users\/[a-z0-9._-]+\/profile\/avatar\.webp$/i.test(String(value || ''));
}

function producerAvatarPublicPath(relativeFile) {
  return `/api/beat-store/producer-avatar?file=${encodeURIComponent(relativeFile)}`;
}

async function resolveProducerAvatarFile(rawFile) {
  const relativeFile = String(rawFile || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!producerAvatarPathIsManaged(relativeFile)) throw new Error('Archivo de perfil no permitido.');
  const root = await getRealRoot(CLOUD_ROOT);
  const candidate = path.resolve(root, relativeFile);
  assertInsideRoot(root, candidate);
  const resolved = await fsp.realpath(candidate);
  assertInsideRoot(root, resolved);
  const stats = await fsp.stat(resolved);
  if (!stats.isFile()) throw new Error('Foto de perfil no encontrada.');
  return { relativeFile, resolved, stats };
}

async function fetchProducerProfileForAvatar(profileId, userId) {
  const rows = await supabaseFetch(`/rest/v1/producer_profiles?select=id,user_id,avatar_url&id=eq.${encodeURIComponent(profileId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`, {
    headers: supabaseHeaders(),
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function writeProducerAvatarImage(tempPath, crop, outputPath) {
  let meta;
  try {
    meta = await sharp(tempPath, { animated: true, limitInputPixels: PRODUCER_AVATAR_MAX_DIMENSION * PRODUCER_AVATAR_MAX_DIMENSION }).metadata();
  } catch {
    throw sharpError('La foto de perfil debe ser una imagen valida');
  }
  if (!meta?.width || !meta?.height) throw sharpError('La foto de perfil debe ser una imagen valida');
  if (meta.format === 'svg' || !['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages || 1) > 1) {
    throw sharpError('Formato de imagen no permitido');
  }
  if (meta.width > PRODUCER_AVATAR_MAX_DIMENSION || meta.height > PRODUCER_AVATAR_MAX_DIMENSION) {
    throw sharpError('La imagen tiene dimensiones demasiado grandes', 413);
  }

  const squareMax = Math.min(meta.width, meta.height);
  const cropSize = crop ? Math.min(squareMax, Math.max(1, Math.round(crop.size * squareMax))) : squareMax;
  const maxLeft = Math.max(0, meta.width - cropSize);
  const maxTop = Math.max(0, meta.height - cropSize);
  const left = crop ? Math.max(0, Math.min(maxLeft, Math.round(crop.x * maxLeft))) : Math.round((meta.width - cropSize) / 2);
  const top = crop ? Math.max(0, Math.min(maxTop, Math.round(crop.y * maxTop))) : Math.round((meta.height - cropSize) / 2);

  await sharp(tempPath, { limitInputPixels: PRODUCER_AVATAR_MAX_DIMENSION * PRODUCER_AVATAR_MAX_DIMENSION })
    .rotate()
    .extract({ left, top, width: cropSize, height: cropSize })
    .resize(PRODUCER_AVATAR_SIZE, PRODUCER_AVATAR_SIZE, { fit: 'cover' })
    .webp({ quality: 82, effort: 4 })
    .toFile(outputPath);
}

async function uploadProducerAvatar(user, req, res, url) {
  const profileId = producerProfileId(req, url);
  const profile = await fetchProducerProfileForAvatar(profileId, user.id);
  if (!profile) {
    const err = new Error('Solo el propietario puede cambiar la foto de este productor.');
    err.status = 403;
    throw err;
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > PRODUCER_AVATAR_MAX_UPLOAD_BYTES) throw sharpError('La imagen supera el limite de 12 MB', 413);
  const crop = parseBeatCoverCrop(req.headers['x-producer-avatar-crop'] || url?.searchParams.get('crop'));
  let temp;
  let outputPath = '';
  let tempOutput = '';
  let outputWritten = false;
  try {
    temp = await readLimitedUploadToTemp(req, PRODUCER_AVATAR_MAX_UPLOAD_BYTES);
    if (!temp.size) throw sharpError('Selecciona una imagen valida');

    const userRoot = await getRealRoot(getUserCloudRoot(user));
    const profileDir = path.resolve(userRoot, 'profile');
    assertInsideRoot(userRoot, profileDir);
    await fsp.mkdir(profileDir, { recursive: true });
    outputPath = path.resolve(profileDir, 'avatar.webp');
    assertInsideRoot(userRoot, outputPath);
    const relativeFile = path.relative(await getRealRoot(CLOUD_ROOT), outputPath).replace(/\\/g, '/');
    if (!producerAvatarPathIsManaged(relativeFile)) throw new Error('Ruta de foto de perfil no permitida.');

    tempOutput = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
    await writeProducerAvatarImage(temp.tempPath, crop, tempOutput);
    await fsp.rename(tempOutput, outputPath);
    outputWritten = true;
    const avatarUrl = producerAvatarPublicPath(relativeFile);
    await supabaseFetch(`/rest/v1/producer_profiles?id=eq.${encodeURIComponent(profileId)}&user_id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      headers: { ...supabaseHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ avatar_url: avatarUrl }),
    });
    sendJson(res, 201, { success: true, avatar_url: avatarUrl });
  } catch (err) {
    if (outputWritten && outputPath) await fsp.rm(outputPath, { force: true }).catch(() => {});
    if (tempOutput) await fsp.rm(tempOutput, { force: true }).catch(() => {});
    if (err.message && /Input image exceeds pixel limit|unsupported image format|corrupt|invalid/i.test(err.message)) throw sharpError('No se pudo procesar la imagen');
    throw err;
  } finally {
    if (temp?.tempDir) await fsp.rm(temp.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function safeBeatSlug(rawSlug, fallback) {
  const slug = String(rawSlug || fallback || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  if (!slug) {
    const err = new Error('Slug de beat requerido.');
    err.status = 400;
    throw err;
  }
  return slug;
}
function safeBeatUploadName(rawName) {
  const decoded = decodeURIComponent(String(rawName || 'beat').trim());
  const ext = path.extname(decoded).toLowerCase();
  if (!BEAT_UPLOAD_AUDIO_EXTENSIONS.has(ext)) {
    const err = new Error('El master debe subirse como WAV sin comprimir (.wav).');
    err.status = 400;
    throw err;
  }
  const base = path.basename(decoded, ext)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/[-._]{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'beat';
  return { base, ext };
}

function beatManagedPath(kind, id, name) {
  return `${kind}/${id}/${name}`;
}

async function moveUploadIntoPlace(fromPath, toPath) {
  await fsp.rm(toPath, { force: true }).catch(() => {});
  try {
    await fsp.rename(fromPath, toPath);
  } catch (err) {
    if (err?.code !== 'EXDEV') throw err;
    await fsp.copyFile(fromPath, toPath);
    await fsp.unlink(fromPath);
  }
}
async function inspectUncompressedWav(filePath) {
  const handle = await fsp.open(filePath, 'r');
  const buffer = Buffer.alloc(64 * 1024);
  let bytesRead = 0;
  try {
    ({ bytesRead } = await handle.read(buffer, 0, buffer.length, 0));
  } finally {
    await handle.close().catch(() => {});
  }
  if (bytesRead < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    const err = new Error('El master debe ser un WAV sin comprimir valido.');
    err.status = 400;
    throw err;
  }

  let offset = 12;
  let formatCode = null;
  let hasDataChunk = false;
  while (offset + 8 <= bytesRead) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > bytesRead) break;
    if (chunkId === 'fmt ' && chunkSize >= 16) {
      formatCode = buffer.readUInt16LE(chunkStart);
      if (formatCode === 0xfffe && chunkSize >= 40) formatCode = buffer.readUInt16LE(chunkStart + 24);
    }
    if (chunkId === 'data') hasDataChunk = true;
    offset = chunkEnd + (chunkSize % 2);
  }
  if (!hasDataChunk || ![1, 3].includes(formatCode)) {
    const err = new Error('El master debe ser un WAV PCM sin compresion.');
    err.status = 400;
    throw err;
  }
  return { formatCode };
}

async function convertBeatPreview(inputPath, outputPath, bitrate = BEAT_PREVIEW_MP3_BITRATE) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  const tempOutput = `${outputPath}.tmp-${process.pid}-${Date.now()}.mp3`;
  try {
    await new Promise((resolve, reject) => {
      execFile(FFMPEG_PATH, [
        '-y',
        '-i', inputPath,
        '-vn',
        '-ar', '44100',
        '-ac', '2',
        '-b:a', bitrate,
        '-map_metadata', '-1',
        tempOutput,
      ], { timeout: Number(process.env.BEAT_PREVIEW_FFMPEG_TIMEOUT_MS || 180000) }, (error, stdout, stderr) => {
        if (error) {
          error.ffmpegStderr = String(stderr || '').slice(-2000);
          return reject(error);
        }
        resolve();
      });
    });
    await fsp.rename(tempOutput, outputPath);
  } catch (err) {
    await fsp.rm(tempOutput, { force: true }).catch(() => {});
    throw err;
  }
}

async function patchBeatProduct(productId, payload) {
  if (!productId) return;
  await supabaseFetch(`/rest/v1/store_products?id=eq.${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  });
}

async function uploadBeatAudio(user, req, res) {
  if (!canManageBeatUploads(user)) {
    const err = new Error('Se requiere beats.upload, productor aprobado o admin para subir beats.');
    err.status = 403;
    throw err;
  }
  const productId = beatCoverProductId(req);
  const product = await fetchBeatProduct(productId);
  if (!user.isAdmin && (!productId || !product || product.category !== 'beats' || product.producer_user_id !== user.id)) {
    const err = new Error('El beat no pertenece al productor autenticado.');
    err.status = 403;
    throw err;
  }
  if (productId && (!product || product.category !== 'beats')) {
    const err = new Error('Beat no encontrado.');
    err.status = 404;
    throw err;
  }
  const sourceName = safeBeatUploadName(req.headers['x-file-name']);
  const beatSlug = safeBeatSlug(req.headers['x-beat-slug'], sourceName.base);
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > BEAT_PREVIEW_MAX_UPLOAD_BYTES) {
    const err = new Error('El audio supera el limite permitido.');
    err.status = 413;
    throw err;
  }

  let temp;
  let originalStored = false;
  const root = await getRealRoot(beatStoreRoot());
  const storageKey = productId || beatSlug;
  const managedKind = productId ? 'masters' : 'originals';
  const originalRelative = beatManagedPath(managedKind, storageKey, 'master.wav');
  const compressedRelative = beatManagedPath(managedKind, storageKey, 'master.mp3');
  const previewRelative = beatManagedPath('previews', storageKey, 'preview.mp3');
  const originalPath = path.resolve(root, originalRelative);
  const compressedPath = path.resolve(root, compressedRelative);
  const previewPath = path.resolve(root, previewRelative);
  assertInsideRoot(root, originalPath);
  assertInsideRoot(root, compressedPath);
  assertInsideRoot(root, previewPath);

  try {
    temp = await readLimitedUploadToTempNamed(req, BEAT_PREVIEW_MAX_UPLOAD_BYTES, 'hr-beat-audio-');
    if (!temp.size) {
      const err = new Error('Selecciona un archivo WAV sin comprimir.');
      err.status = 400;
      throw err;
    }
    await inspectUncompressedWav(temp.tempPath);
    await fsp.mkdir(path.dirname(originalPath), { recursive: true });
    await moveUploadIntoPlace(temp.tempPath, originalPath);
    temp.tempPath = '';
    originalStored = true;
    await convertBeatPreview(originalPath, compressedPath, BEAT_MASTER_MP3_BITRATE);
    await convertBeatPreview(originalPath, previewPath, BEAT_PREVIEW_MP3_BITRATE);
    await patchBeatProduct(productId, {
      file_url: `/${BEAT_STORE_DIR}/${originalRelative}`,
      beat_original_path: originalRelative,
      beat_mp3_path: compressedRelative,
      beat_preview_path: previewRelative,
      beat_preview_status: 'ready',
      beat_preview_error: null,
    });
    sendJson(res, 201, {
      success: true,
      file_url: `/${BEAT_STORE_DIR}/${originalRelative}`,
      beat_original_path: originalRelative,
      beat_mp3_path: compressedRelative,
      beat_preview_path: previewRelative,
      beat_preview_status: 'ready',
      preview_url: beatPublicPath(previewRelative),
    });
  } catch (err) {
    console.error('Beat preview conversion failed:', {
      original: originalRelative,
      ffmpegPath: FFMPEG_PATH,
      message: err.message || String(err),
      stderr: err.ffmpegStderr || '',
    });
    if (!err.status || err.status === 422) err.message = 'No se pudo generar el MP3 del WAV. El original se conservo, pero el beat no se publico.';
    if (originalStored) {
      await patchBeatProduct(productId, {
        file_url: `/${BEAT_STORE_DIR}/${originalRelative}`,
        beat_original_path: originalRelative,
        beat_mp3_path: null,
        beat_preview_path: null,
        beat_preview_status: 'error',
        beat_preview_error: 'No se pudo generar el preview MP3.',
        is_active: false,
      }).catch((patchErr) => console.error('Beat preview status patch failed:', patchErr.message || patchErr));
    }
    err.status = err.status || 422;
    if (originalStored) {
      err.original_file_url = `/${BEAT_STORE_DIR}/${originalRelative}`;
      err.original_path = originalRelative;
    }
    throw err;
  } finally {
    if (temp?.tempPath) await fsp.rm(temp.tempPath, { force: true }).catch(() => {});
    if (temp?.tempDir) await fsp.rm(temp.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function uploadBeatStems(user, req, res) {
  if (!canManageBeatUploads(user)) {
    const err = new Error('Se requiere beats.upload, productor aprobado o admin para subir stems.');
    err.status = 403;
    throw err;
  }
  const productId = beatCoverProductId(req);
  const product = await fetchBeatProduct(productId);
  if (!productId || !product || product.category !== 'beats' || (!user.isAdmin && product.producer_user_id !== user.id)) {
    const err = new Error('El beat no pertenece al productor autenticado.');
    err.status = 403;
    throw err;
  }
  const fileName = decodeURIComponent(String(req.headers['x-file-name'] || 'stems.zip').trim());
  if (path.extname(fileName).toLowerCase() !== '.zip') {
    const err = new Error('Los stems deben subirse como un archivo ZIP.');
    err.status = 400;
    throw err;
  }
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > BEAT_STEMS_MAX_UPLOAD_BYTES) {
    const err = new Error('El ZIP de stems supera el límite permitido.');
    err.status = 413;
    throw err;
  }
  const temp = await readLimitedUploadToTempNamed(req, BEAT_STEMS_MAX_UPLOAD_BYTES, 'hr-beat-stems-');
  if (!temp.size) {
    await fsp.rm(temp.tempPath, { force: true }).catch(() => {});
    const err = new Error('El archivo de stems está vacío.');
    err.status = 400;
    throw err;
  }
  const root = await getRealRoot(beatStoreRoot());
  const relativePath = beatManagedPath('stems', productId, 'stems.zip');
  const target = path.resolve(root, relativePath);
  assertInsideRoot(root, target);
  try {
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await moveUploadIntoPlace(temp.tempPath, target);
    await patchBeatProduct(productId, { beat_stems_path: relativePath });
    sendJson(res, 201, { success: true, beat_stems_path: relativePath });
  } finally {
    if (temp.tempPath) await fsp.rm(temp.tempPath, { force: true }).catch(() => {});
  }
}
function downloadTokenUser(payload) {
  return {
    id: payload.uid,
    profile: payload.profile || { id: payload.uid, user_id: payload.uid },
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    permissions: [],
    isAdmin: Boolean(payload.isAdmin),
    canUpload: false,
    canUploadBeats: false,
    hasBeatStore: false,
  };
}

function sessionPayload(user) {
  return {
    success: true,
    user: {
      id: user.id,
      username: user.profile?.username ?? null,
      display_name: user.profile?.display_name ?? null,
      roles: user.roles,
    },
    isAdmin: user.isAdmin,
    canUpload: user.canUpload,
    canUploadBeats: user.canUploadBeats,
    hasBeatStore: user.hasBeatStore,
    canManageSharing: user.isAdmin,
    rootLabel: user.isAdmin ? 'Raíz Cloud' : 'Mi Cloud',
    homePath: '/',
  };
}

async function listFiles(user, res, url) {
  const baseRoot = getCloudBaseRoot(user);
  const { normalized, resolved } = await resolveSafePath(baseRoot, url.searchParams.get('path'), { mustExist: true });
  const cloudState = await readCloudState(baseRoot);
  const favorites = new Set((cloudState.favorites || []).map((entry) => {
    try { return favoriteKey(entry.path, entry.name); } catch { return ''; }
  }).filter(Boolean));
  const entries = await fsp.readdir(resolved, { withFileTypes: true });
  const folders = [];
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const childPath = path.join(resolved, entry.name);
    let stats;
    try {
      stats = await fsp.stat(childPath);
      const realChild = await fsp.realpath(childPath);
      assertInsideRoot(await getRealRoot(baseRoot), realChild);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      folders.push({ name: entry.name, modified: stats.mtime.toISOString() });
      continue;
    }
    if (!stats.isFile()) continue;
    const share=user.isAdmin?(cloudState.shares||[]).find(e=>{try{return validCloudShareEntry(e)&&cloudShareKey(e.path,e.name)===cloudShareKey(normalized,entry.name)}catch{return false}}):null;
    files.push({ name: entry.name, size: stats.size, modified: stats.mtime.toISOString(), favorite: favorites.has(favoriteKey(normalized, entry.name)), ...(user.isAdmin?{privacy:share?.privacy||'private',share_url:share?cloudShareUrl(share.token):null}:{}) });
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  sendJson(res, 200, { success: true, path: getPublicPath(user, normalized), folders, files, meta: sessionPayload(user) });
}

async function listFavorites(user, res) {
  const baseRoot = getCloudBaseRoot(user);
  const state = await readCloudState(baseRoot);
  const files = [];
  for (const favorite of state.favorites || []) {
    try {
      const parentPath = normalizeCloudPath(favorite.path);
      const name = safeChildName(favorite.name);
      const { child } = await resolveSafeChild(baseRoot, parentPath, name, { mustExist: true });
      const stats = await fsp.stat(child);
      if (!stats.isFile()) continue;
      files.push({ name, path: parentPath, size: stats.size, modified: stats.mtime.toISOString(), favorite: true });
    } catch {
      // Stale favorites are hidden until the target is restored or recreated.
    }
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  sendJson(res, 200, { success: true, path: '/', folders: [], files, meta: sessionPayload(user), view: 'favorites' });
}

async function toggleFavorite(user, req, res) {
  const body = await readJson(req);
  const parentPath = normalizeCloudPath(body.path);
  const name = safeChildName(body.name);
  if (String(body.type || 'file').toLowerCase() !== 'file') throw new Error('Solo los archivos pueden ser favoritos.');
  const baseRoot = getCloudBaseRoot(user);
  const { child } = await resolveSafeChild(baseRoot, parentPath, name, { mustExist: true });
  const stats = await fsp.stat(child);
  if (!stats.isFile()) throw new Error('Solo los archivos pueden ser favoritos.');
  const state = await readCloudState(baseRoot);
  const key = favoriteKey(parentPath, name);
  const favorites = (state.favorites || []).filter((entry) => {
    try { return favoriteKey(entry.path, entry.name) !== key; } catch { return false; }
  });
  const favorite = body.favorite !== false;
  if (favorite) favorites.push({ path: parentPath, name, type: 'file', addedAt: new Date().toISOString() });
  await writeCloudState(baseRoot, { favorites, shares: user.isAdmin ? (state.shares || []).map((entry) => relocateCloudShare(entry, oldItemPath, newItemPath, stats.isDirectory())) : state.shares });
  sendJson(res, 200, { success: true, favorite, path: parentPath, name });
}

async function listTrash(user, res) {
  const baseRoot = getCloudBaseRoot(user);
  const manifest = await readTrashManifest(baseRoot);
  const files = [];
  const folders = [];
  const valid = [];
  for (const entry of manifest) {
    try {
      const storedPath = trashStoredPath(baseRoot, entry.storedName);
      const stats = await fsp.stat(storedPath);
      const item = {
        id: safeTrashId(entry.id),
        name: safeChildName(entry.name),
        path: normalizeCloudPath(entry.path),
        type: entry.type === 'folder' ? 'folder' : 'file',
        size: stats.isFile() ? stats.size : 0,
        modified: stats.mtime.toISOString(),
        deletedAt: entry.deletedAt || stats.mtime.toISOString(),
      };
      valid.push(entry);
      (item.type === 'folder' ? folders : files).push(item);
    } catch {
      // A missing trash payload is ignored and cleaned on the next mutation.
    }
  }
  files.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  folders.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  sendJson(res, 200, { success: true, path: '/', folders, files, meta: sessionPayload(user), view: 'trash' });
}

async function createFolder(user, req, res) {
  requireUploadPermission(user);
  const body = await readJson(req);
  const baseRoot = getCloudBaseRoot(user);
  const { name, child } = await resolveSafeChild(baseRoot, body.path, body.name, { mustExist: false });
  await fsp.mkdir(child, { recursive: false });
  sendJson(res, 201, { success: true, name });
}

async function uploadFile(user, req, res, url) {
  requireUploadPermission(user);
  const baseRoot = getCloudBaseRoot(user);
  const { name, child } = await resolveSafeChild(baseRoot, url.searchParams.get('path'), decodeURIComponent(String(req.headers['x-file-name'] || '')), { mustExist: false });
  await fsp.mkdir(path.dirname(child), { recursive: true });
  const buffer = await readUpload(req);
  await fsp.writeFile(child, buffer, { flag: 'wx' });
  const stats = await fsp.stat(child);
  sendJson(res, 201, { success: true, file: { name, size: stats.size, modified: stats.mtime.toISOString() } });
}

async function copyCloudEntry(source, target, stats) {
  if (stats.isDirectory()) {
    await fsp.mkdir(target, { recursive: false });
    const entries = await fsp.readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error('No se copian enlaces simb�licos.');
      const childSource = path.join(source, entry.name);
      const childTarget = path.join(target, entry.name);
      const childStats = await fsp.stat(childSource);
      await copyCloudEntry(childSource, childTarget, childStats);
    }
    return;
  }
  if (!stats.isFile()) throw new Error('Solo se pueden copiar archivos o carpetas.');
  await fsp.copyFile(source, target);
}

function cloudItemPath(parentPath, name) {
  const normalized = normalizeCloudPath(parentPath);
  return normalized === '/' ? '/' + safeChildName(name) : normalized + '/' + safeChildName(name);
}

function relocateFavorite(entry, oldItemPath, newItemPath, isFolder) {
  try {
    const entryPath = normalizeCloudPath(entry.path);
    const entryName = safeChildName(entry.name);
    const entryFullPath = cloudItemPath(entryPath, entryName);
    if (entryFullPath === oldItemPath) {
      const split = newItemPath.lastIndexOf('/');
      return { ...entry, path: split <= 0 ? '/' : newItemPath.slice(0, split), name: newItemPath.slice(split + 1) };
    }
    if (isFolder && entryFullPath.startsWith(oldItemPath + '/')) {
      const movedPath = newItemPath + entryFullPath.slice(oldItemPath.length);
      const split = movedPath.lastIndexOf('/');
      return { ...entry, path: split <= 0 ? '/' : movedPath.slice(0, split), name: movedPath.slice(split + 1) };
    }
  } catch {
    return entry;
  }
  return entry;
}

async function relocateItem(user, req, res, mode) {
  requireUploadPermission(user);
  const body = await readJson(req);
  const baseRoot = getCloudBaseRoot(user);
  const fromInfo = await resolveSafeChild(baseRoot, body.path, body.name, { mustExist: true });
  const destinationPath = normalizeCloudPath(body.destinationPath ?? body.toPath ?? '/');
  const destinationInfo = await resolveSafePath(baseRoot, destinationPath, { mustExist: true });
  const destinationStats = await fsp.stat(destinationInfo.resolved);
  if (!destinationStats.isDirectory()) throw new Error('La ruta destino no es una carpeta.');

  const itemType = String(body.type || '').toLowerCase();
  const stats = await fsp.stat(fromInfo.child);
  if (itemType === 'folder' && !stats.isDirectory()) throw new Error('El origen no es carpeta.');
  if (itemType === 'file' && !stats.isFile()) throw new Error('El origen no es archivo.');
  if (!['file', 'folder'].includes(itemType)) throw new Error('Tipo no permitido.');

  if (stats.isDirectory()) {
    const relativeDestination = path.relative(fromInfo.child, destinationInfo.resolved);
    if (relativeDestination && !relativeDestination.startsWith('..') && !path.isAbsolute(relativeDestination)) {
      throw new Error('No puedes mover o copiar una carpeta dentro de s� misma.');
    }
  }

  const targetName = safeChildName(body.newName || fromInfo.name);
  const targetInfo = await resolveSafeChild(baseRoot, destinationPath, targetName, { mustExist: false });
  await fsp.access(targetInfo.child).then(() => { throw new Error('Ya existe un elemento con ese nombre en la ruta destino.'); }).catch((err) => { if (err && err.code !== 'ENOENT') throw err; });

  if (mode === 'move') {
    await fsp.rename(fromInfo.child, targetInfo.child);
    const state = await readCloudState(baseRoot);
    const oldItemPath = cloudItemPath(body.path, fromInfo.name);
    const newItemPath = cloudItemPath(destinationPath, targetName);
    await writeCloudState(baseRoot, { favorites: (state.favorites || []).map((entry) => relocateFavorite(entry, oldItemPath, newItemPath, stats.isDirectory())), shares: state.shares });
  } else {
    await copyCloudEntry(fromInfo.child, targetInfo.child, stats);
  }

  sendJson(res, 200, { success: true, mode, type: itemType, name: targetName, path: destinationPath });
}

async function renameItem(user, req, res) {
  requireUploadPermission(user);
  const body = await readJson(req);
  const baseRoot = getCloudBaseRoot(user);
  const fromInfo = await resolveSafeChild(baseRoot, body.path, body.name, { mustExist: true });
  const toInfo = await resolveSafeChild(baseRoot, body.path, body.newName, { mustExist: false });
  const itemType = String(body.type || '').toLowerCase();
  const stats = await fsp.stat(fromInfo.child);
  if (itemType === 'folder' && !stats.isDirectory()) throw new Error('El origen no es carpeta.');
  if (itemType === 'file' && !stats.isFile()) throw new Error('El origen no es archivo.');
  await fsp.access(toInfo.child).then(() => { throw new Error('Ya existe un elemento con ese nombre.'); }).catch((err) => { if (err && err.code !== 'ENOENT') throw err; });
  await fsp.rename(fromInfo.child, toInfo.child);
  const state = await readCloudState(baseRoot);
  const oldKey = favoriteKey(body.path, fromInfo.name);
  const favorites = (state.favorites || []).map((entry) => {
    try {
      if (favoriteKey(entry.path, entry.name) !== oldKey) return entry;
      return { ...entry, path: normalizeCloudPath(body.path), name: toInfo.name };
    } catch { return entry; }
  });
  const oldItemPath = cloudItemPath(body.path, fromInfo.name);
  const newItemPath = cloudItemPath(body.path, toInfo.name);
  const shares = user.isAdmin ? (state.shares || []).map((entry) => relocateCloudShare(entry, oldItemPath, newItemPath, stats.isDirectory())) : state.shares;
  await writeCloudState(baseRoot, { favorites, shares });
  sendJson(res, 200, { success: true, name: fromInfo.name, newName: toInfo.name });
}

async function deleteItem(user, res, url) {
  requireUploadPermission(user);
  const baseRoot = getCloudBaseRoot(user);
  const itemType = String(url.searchParams.get('type') || '').toLowerCase();
  const { name, child } = await resolveSafeChild(baseRoot, url.searchParams.get('path'), url.searchParams.get('name'), { mustExist: true });
  const stats = await fsp.stat(child);
  if (itemType === 'folder') {
    if (!stats.isDirectory()) throw new Error('El elemento no es carpeta.');

  } else if (itemType === 'file') {
    if (!stats.isFile()) throw new Error('El elemento no es archivo.');

  } else {
    throw new Error('Tipo no permitido.');
  }
  const backupMarker = getBackupDeleteMarker(user, url.searchParams.get('path'), name, itemType);
  if (backupMarker) await recordBackupTombstone(backupMarker, user);
  const normalizedPath = normalizeCloudPath(url.searchParams.get('path'));
  const id = Date.now().toString(16) + '-' + crypto.randomBytes(8).toString('hex');
  const storedName = id + '-' + name;
  const trashTarget = trashStoredPath(baseRoot, storedName);
  await fsp.mkdir(getTrashRoot(baseRoot), { recursive: true });
  await fsp.rename(child, trashTarget);
  const manifest = await readTrashManifest(baseRoot);
  manifest.push({
    id,
    storedName,
    path: normalizedPath,
    name,
    type: itemType,
    deletedAt: new Date().toISOString(),
  });
  await writeTrashManifest(baseRoot, manifest);
  const state = await readCloudState(baseRoot);
  const favorites = (state.favorites || []).filter((entry) => {
    try {
      const entryPath = normalizeCloudPath(entry.path);
      const sameItem = entryPath === normalizedPath && safeChildName(entry.name) === name;
      const insideFolder = itemType === 'folder' && (entryPath === normalizedPath || entryPath.startsWith(normalizedPath + '/'));
      return !sameItem && !insideFolder;
    } catch { return false; }
  });
  const shares = user.isAdmin ? (state.shares || []).filter((entry) => { try { const entryPath = normalizeCloudPath(entry.path); const sameItem = entryPath === normalizedPath && safeChildName(entry.name) === name; const insideFolder = itemType === 'folder' && (entryPath === normalizedPath || entryPath.startsWith(normalizedPath + '/')); return !sameItem && !insideFolder; } catch { return false; } }) : state.shares;
  await writeCloudState(baseRoot, { favorites, shares });
  sendJson(res, 200, { success: true, type: itemType, name, trashed: true });
}

async function restoreTrashItem(user, req, res) {
  requireUploadPermission(user);
  const body = await readJson(req);
  const baseRoot = getCloudBaseRoot(user);
  const id = safeTrashId(body.id);
  const manifest = await readTrashManifest(baseRoot);
  const index = manifest.findIndex((entry) => String(entry.id) === id);
  if (index < 0) { const err = new Error('Elemento de papelera no encontrado.'); err.status = 404; throw err; }
  const entry = manifest[index];
  const parentPath = normalizeCloudPath(entry.path);
  const name = safeChildName(entry.name);
  const { child } = await resolveSafeChild(baseRoot, parentPath, name, { mustExist: false });
  await fsp.access(child).then(() => { throw new Error('Ya existe un elemento con ese nombre en su ubicacion original.'); }).catch((err) => { if (err && err.code !== 'ENOENT') throw err; });
  const storedPath = trashStoredPath(baseRoot, entry.storedName);
  await fsp.rename(storedPath, child);
  manifest.splice(index, 1);
  await writeTrashManifest(baseRoot, manifest);
  const backupMarker = getBackupDeleteMarker(user, parentPath, name, entry.type);
  if (backupMarker) await removeBackupTombstone(backupMarker, user);
  sendJson(res, 200, { success: true, name, path: parentPath });
}

async function deleteTrashItem(user, res, url) {
  requireUploadPermission(user);
  const baseRoot = getCloudBaseRoot(user);
  const id = safeTrashId(url.searchParams.get('id'));
  const manifest = await readTrashManifest(baseRoot);
  const index = manifest.findIndex((entry) => String(entry.id) === id);
  if (index < 0) { const err = new Error('Elemento de papelera no encontrado.'); err.status = 404; throw err; }
  await fsp.rm(trashStoredPath(baseRoot, manifest[index].storedName), { recursive: manifest[index].type === 'folder', force: false });
  manifest.splice(index, 1);
  await writeTrashManifest(baseRoot, manifest);
  sendJson(res, 200, { success: true, deleted: true });
}


function beatStoreRoot() {
  return path.join(path.resolve(CLOUD_ROOT), BEAT_STORE_DIR);
}

function beatPublicPath(relativeFile) {
  return `/api/beat-store/stream?file=${encodeURIComponent(relativeFile)}`;
}

function titleFromBeatFile(fileName) {
  return path.basename(fileName, path.extname(fileName))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Beat';
}

function normalizeBeatRelativePath(rawFile, options = {}) {
  const file = String(rawFile || '').replace(/\\/g, '/').replace(/\/+/g, '/').trim();
  if (!file || file.startsWith('/') || file.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Archivo no permitido.');
  if (/[\u0000-\u001f\u007f]/.test(file)) throw new Error('Archivo no permitido.');
  const ext = path.extname(file).toLowerCase();
  const allowed = options.allowImages ? (BEAT_AUDIO_EXTENSIONS.has(ext) || BEAT_IMAGE_EXTENSIONS.has(ext)) : BEAT_AUDIO_EXTENSIONS.has(ext);
  if (!allowed) throw new Error(options.allowImages ? 'Formato Beat Store no permitido.' : 'Formato de audio no permitido.');
  return file;
}

async function resolveBeatFile(rawFile) {
  const relativeFile = normalizeBeatRelativePath(rawFile, { allowImages: true });
  const root = beatStoreRoot();
  const realRoot = await fsp.realpath(root);
  const candidate = path.resolve(realRoot, relativeFile);
  assertInsideRoot(realRoot, candidate);
  const realCandidate = await fsp.realpath(candidate);
  assertInsideRoot(realRoot, realCandidate);
  const stats = await fsp.stat(realCandidate);
  if (!stats.isFile()) throw new Error('Beat no encontrado.');
  return { relativeFile, resolved: realCandidate, stats };
}

async function resolveBeatAudioFile(rawFile) {
  const relativeFile = normalizeBeatRelativePath(rawFile, { allowImages: false });
  const root = beatStoreRoot();
  const realRoot = await fsp.realpath(root);
  const candidate = path.resolve(realRoot, relativeFile);
  assertInsideRoot(realRoot, candidate);
  const realCandidate = await fsp.realpath(candidate);
  assertInsideRoot(realRoot, realCandidate);
  const stats = await fsp.stat(realCandidate);
  if (!stats.isFile()) throw new Error('Beat no encontrado.');
  return { relativeFile, resolved: realCandidate, stats };
}

function storeDownloadNotFound() {
  const err = new Error('Descarga no disponible.');
  err.status = 404;
  return err;
}

async function authorizedStoreBeatDownload(downloadId, userId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(downloadId || '') || !userId) throw storeDownloadNotFound();
  const encodedDownloadId = encodeURIComponent(downloadId);
  const encodedUserId = encodeURIComponent(userId);
  const downloads = await supabaseFetch(`/rest/v1/store_downloads?select=id,order_id,product_id,beat_id,license_id,license_snapshot,file_url&and=(id.eq.${encodedDownloadId},user_id.eq.${encodedUserId},available.eq.true)&limit=1`, { headers: supabaseHeaders() });
  const download = Array.isArray(downloads) ? downloads[0] : null;
  if (!download?.id || !download.order_id || !download.product_id) throw storeDownloadNotFound();

  const orders = await supabaseFetch(`/rest/v1/store_orders?select=id,status,user_id&id=eq.${encodeURIComponent(download.order_id)}&user_id=eq.${encodedUserId}&limit=1`, { headers: supabaseHeaders() });
  const order = Array.isArray(orders) ? orders[0] : null;
  if (!order || !['approved', 'paid', 'authorized'].includes(String(order.status || '').toLowerCase())) throw storeDownloadNotFound();

  const products = await supabaseFetch(`/rest/v1/store_products?select=id,category,beat_original_path,beat_mp3_path,file_url,name&id=eq.${encodeURIComponent(download.product_id)}&limit=1`, { headers: supabaseHeaders() });
  const product = Array.isArray(products) ? products[0] : null;
  if (!product || product.category !== 'beats') throw storeDownloadNotFound();

  let relativeFile = String(download.file_url || product.beat_original_path || '').trim().replace(/^\/+/, '').replace(new RegExp(`^${BEAT_STORE_DIR}/`, 'i'), '');
  if (!relativeFile) {
    const legacyPath = String(product.file_url || '').trim();
    const prefix = `/${BEAT_STORE_DIR}/`;
    if (legacyPath.startsWith(prefix)) relativeFile = legacyPath.slice(prefix.length);
  }
  if (!relativeFile) throw storeDownloadNotFound();
  let file;
  try { file = await resolveBeatAudioFile(relativeFile); } catch { throw storeDownloadNotFound(); }
  return { download, order, product, file };
}

async function createStoreDownloadToken(user, req, res) {
  let body;
  try { body = await readJson(req); } catch {
    const err = new Error('Solicitud invalida.');
    err.status = 400;
    throw err;
  }
  const downloadId = String(body?.store_download_id || '').trim();
  const authorized = await authorizedStoreBeatDownload(downloadId, user.id);
  const name = safeChildName(path.basename(authorized.file.relativeFile));
  const token = signDownloadPayload({
    kind: 'store-beat-download',
    uid: user.id,
    download_id: authorized.download.id,
    path: authorized.file.relativeFile,
    name,
    exp: Date.now() + DOWNLOAD_TOKEN_TTL_MS,
  });
  sendJson(res, 200, {
    success: true,
    url: `${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}/api/store/download?token=${encodeURIComponent(token)}`,
    expiresInMs: DOWNLOAD_TOKEN_TTL_MS,
  });
}

async function downloadStorePublic(req, res, url) {
  let payload;
  try { payload = verifyDownloadToken(url.searchParams.get('token')); } catch { throw storeDownloadNotFound(); }
  if (payload.kind !== 'store-beat-download' || !payload.uid || !payload.download_id) throw storeDownloadNotFound();
  const authorized = await authorizedStoreBeatDownload(String(payload.download_id), String(payload.uid));
  const encoded = encodeURIComponent(path.basename(authorized.file.relativeFile)).replace(/['()]/g, escape).replace(/\*/g, '%2A');
  const ext = path.extname(authorized.file.relativeFile).toLowerCase();
  return streamFile(req, res, authorized.file.resolved, authorized.file.stats, {
    ...API_CORS_HEADERS,
    'Content-Type': BEAT_MIME_TYPES[ext] || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${path.basename(authorized.file.relativeFile).replace(/["\r\n]/g, '_')}"; filename*=UTF-8''${encoded}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
}

async function walkBeatFiles(currentDir, rootDir, depth = 0, options = {}) {
  if (depth > 4) return [];
  const entries = await fsp.readdir(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(currentDir, entry.name);
    const relativeEntry = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (depth === 0 && ['originals', 'masters', 'stems', 'admin', 'covers'].includes(entry.name) && !options.includeManaged) continue;
      files.push(...await walkBeatFiles(fullPath, rootDir, depth + 1, options));
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const isPreview = relativeEntry.toLowerCase().startsWith('previews/');
    if (isPreview ? !BEAT_PREVIEW_AUDIO_EXTENSIONS.has(ext) : !BEAT_AUDIO_EXTENSIONS.has(ext)) continue;
    const stats = await fsp.stat(fullPath);
    const relativeFile = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    files.push({
      file: relativeFile,
      slug: slugifyUsername(path.basename(relativeFile, ext), 'beat'),
      title: titleFromBeatFile(relativeFile),
      size: stats.size,
      modified: stats.mtime.toISOString(),
      stream_url: beatPublicPath(relativeFile),
      mime: BEAT_MIME_TYPES[ext] || 'audio/mpeg',
    });
  }
  return files;
}

async function backfillBeatPreviews(user, res) {
  if (!user.isAdmin) {
    const err = new Error('Solo admin puede generar previews.');
    err.status = 403;
    throw err;
  }
  const root = await getRealRoot(beatStoreRoot());
  const products = await supabaseFetch('/rest/v1/store_products?select=id,file_url,beat_original_path,beat_preview_path,beat_mp3_path&category=eq.beats&limit=1000', { headers: supabaseHeaders() });
  const candidates = [];
  const seen = new Set();
  for (const product of Array.isArray(products) ? products : []) {
    const storedPath = String(product.beat_original_path || product.file_url || '').trim();
    const relativeFile = storedPath.replace(/^\/+/, '').replace(new RegExp(`^${BEAT_STORE_DIR}/`, 'i'), '');
    if (!relativeFile || relativeFile.toLowerCase().startsWith('previews/') || relativeFile.toLowerCase().startsWith('stems/')) continue;
    if (seen.has(relativeFile)) continue;
    seen.add(relativeFile);
    candidates.push({ relativeFile, product });
  }
  for (const beat of await walkBeatFiles(root, root)) {
    if (beat.file.toLowerCase().startsWith('previews/') || beat.file.toLowerCase().startsWith('stems/') || seen.has(beat.file)) continue;
    seen.add(beat.file);
    candidates.push({ relativeFile: beat.file, product: null });
  }
  const results = [];
  for (const candidate of candidates) {
    const { relativeFile, product } = candidate;
    try {
      const source = await resolveBeatFile(relativeFile);
      const id = product?.id || crypto.createHash('sha1').update(relativeFile).digest('hex').slice(0, 16);
      const previewRelative = product?.beat_preview_path || beatManagedPath('previews', id, 'preview.mp3');
      const previewPath = path.resolve(root, previewRelative);
      assertInsideRoot(root, previewPath);
      const previewStats = await fsp.stat(previewPath).catch(() => null);
      if (!previewStats?.isFile()) await convertBeatPreview(source.resolved, previewPath);
      const isWavMaster = path.extname(relativeFile).toLowerCase() === '.wav';
      const compressedRelative = isWavMaster ? (product?.beat_mp3_path || `${path.posix.dirname(relativeFile)}/master.mp3`) : null;
      if (compressedRelative) {
        const compressedPath = path.resolve(root, compressedRelative);
        assertInsideRoot(root, compressedPath);
        const compressedStats = await fsp.stat(compressedPath).catch(() => null);
        if (!compressedStats?.isFile()) await convertBeatPreview(source.resolved, compressedPath, BEAT_MASTER_MP3_BITRATE);
      }
      const updates = {
        beat_original_path: relativeFile,
        ...(compressedRelative ? { beat_mp3_path: compressedRelative } : {}),
        beat_preview_path: previewRelative,
        beat_preview_status: 'ready',
        beat_preview_error: null,
      };
      if (product?.id) {
        await supabaseFetch(`/rest/v1/store_products?id=eq.${encodeURIComponent(product.id)}`, {
          method: 'PATCH',
          headers: { ...supabaseHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(updates),
        });
      } else {
        const variants = [relativeFile, `/${BEAT_STORE_DIR}/${relativeFile}`];
        for (const original of variants) {
          await supabaseFetch(`/rest/v1/store_products?category=eq.beats&file_url=eq.${encodeURIComponent(original)}`, {
            method: 'PATCH',
            headers: { ...supabaseHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify(updates),
          }).catch(() => {});
        }
      }
      results.push({ file: relativeFile, preview: previewRelative, mp3: compressedRelative, status: 'ready' });
    } catch (err) {
      results.push({ file: relativeFile, status: 'error', error: err.message || 'No se pudo convertir.' });
    }
  }
  sendJson(res, 200, { success: true, results });
}
async function listBeatStore(res) {
  const root = beatStoreRoot();
  try {
    const realRoot = await fsp.realpath(root);
    const beats = await walkBeatFiles(realRoot, realRoot);
    beats.sort((a, b) => b.modified.localeCompare(a.modified) || a.title.localeCompare(b.title));
    return sendPublicJson(res, 200, { success: true, root: BEAT_STORE_DIR, beats });
  } catch (err) {
    if (err && err.code === 'ENOENT') return sendPublicJson(res, 200, { success: true, root: BEAT_STORE_DIR, beats: [] });
    throw err;
  }
}

async function streamBeatFile(req, res, url) {
  const { relativeFile, resolved, stats } = await resolveBeatFile(url.searchParams.get('file'));
  const publicPath = /^(?:previews\/[^/]+\/[^/]+\.mp3|covers\/[^/]+\/(?:cover|thumb)\.(?:webp|jpg|jpeg|png))$/i.test(relativeFile);
  if (!publicPath) {
    const err = new Error('Ese archivo sólo está disponible mediante una descarga autorizada.');
    err.status = 404;
    throw err;
  }
  const ext = path.extname(relativeFile).toLowerCase();
  const range = req.headers.range;
  const baseHeaders = {
    ...PUBLIC_CORS_HEADERS,
    'Content-Type': BEAT_MIME_TYPES[ext] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  };

  if (range) {
    const match = String(range).match(/^bytes=(\d*)-(\d*)$/);
    if (!match) return send(res, 416, '', { ...baseHeaders, 'Content-Range': `bytes */${stats.size}` });
    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : stats.size - 1;
    if (!match[1] && match[2]) {
      const suffix = Number(match[2]);
      start = Math.max(stats.size - suffix, 0);
      end = stats.size - 1;
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stats.size) {
      return send(res, 416, '', { ...baseHeaders, 'Content-Range': `bytes */${stats.size}` });
    }
    end = Math.min(end, stats.size - 1);
    res.writeHead(206, { ...baseHeaders, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stats.size}` });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(resolved, { start, end }).pipe(res);
  }

  res.writeHead(200, { ...baseHeaders, 'Content-Length': stats.size });
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(resolved).pipe(res);
}

async function streamProducerAvatarFile(req, res, url) {
  const { resolved, stats } = await resolveProducerAvatarFile(url.searchParams.get('file'));
  const headers = {
    ...PUBLIC_CORS_HEADERS,
    'Content-Type': 'image/webp',
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  };
  res.writeHead(200, { ...headers, 'Content-Length': stats.size });
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(resolved).pipe(res);
}

function execFileText(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: options.timeout || 2500 }, (error, stdout) => {
      if (error) return reject(error);
      resolve(String(stdout || '').trim());
    });
  });
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${days} d ${hours} h ${minutes} m`;
}

function readCpuSnapshot() {
  const totals = os.cpus().map((cpu) => {
    const times = cpu.times;
    const idle = times.idle;
    const total = Object.values(times).reduce((sum, value) => sum + value, 0);
    return { idle, total };
  });
  const idle = totals.reduce((sum, item) => sum + item.idle, 0);
  const total = totals.reduce((sum, item) => sum + item.total, 0);
  return { idle, total };
}

function readCpuPercent() {
  const current = readCpuSnapshot();
  if (!lastCpuSnapshot) {
    lastCpuSnapshot = current;
    return null;
  }
  const idleDelta = current.idle - lastCpuSnapshot.idle;
  const totalDelta = current.total - lastCpuSnapshot.total;
  lastCpuSnapshot = current;
  if (totalDelta <= 0) return null;
  return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
}

function findTemperaturesInObject(value, readings = []) {
  if (!value || typeof value !== 'object') return readings;
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'number' && /(^|_)temp\d*_input$|^temp\d+_input$/i.test(key)) {
      readings.push(child);
      continue;
    }
    if (child && typeof child === 'object') findTemperaturesInObject(child, readings);
  }
  return readings;
}

function parseSensorsText(output) {
  const preferred = [];
  const fallback = [];
  String(output || '').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([^:]+):\s*\+?(-?\d+(?:\.\d+)?)\s*(?:°\s*)?C\b/i);
    if (!match) return;
    const label = match[1].toLowerCase();
    const value = Number(match[2]);
    if (!Number.isFinite(value)) return;
    if (/package|tctl|tdie|cpu|composite|temp1/.test(label)) preferred.push(value);
    else fallback.push(value);
  });
  const values = preferred.length ? preferred : fallback;
  return values.length ? Math.max(...values) : null;
}

async function readSysTemperature() {
  const root = '/sys/class/thermal';
  try {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    const readings = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('thermal_zone')) continue;
      const raw = await fsp.readFile(path.join(root, entry.name, 'temp'), 'utf8').catch(() => '');
      const value = Number(String(raw).trim());
      if (Number.isFinite(value)) readings.push(value > 1000 ? value / 1000 : value);
    }
    return readings.length ? Math.max(...readings) : null;
  } catch {
    return null;
  }
}

async function readTemperatureCelsius() {
  const rawEnvTemperature = String(process.env.SERVER_STATUS_TEMPERATURE || '').trim();
  const envTemperature = rawEnvTemperature ? Number(rawEnvTemperature.replace(/[^\d.-]/g, '')) : NaN;
  if (Number.isFinite(envTemperature)) return envTemperature;

  try {
    const sensorsJson = await execFileText('sensors', ['-j']);
    const readings = findTemperaturesInObject(JSON.parse(sensorsJson));
    if (readings.length) return Math.max(...readings);
  } catch {
    // Fall back to classic lm-sensors text output.
  }

  try {
    const sensorsText = await execFileText('sensors');
    const parsed = parseSensorsText(sensorsText);
    if (parsed !== null) return parsed;
  } catch {
    // Fall back to sysfs thermal zones.
  }

  return readSysTemperature();
}

async function readDiskUsage() {
  try {
    const output = await execFileText('df', ['-Pk', SERVER_STATUS_DISK_PATH || '/']);
    const lines = output.split(/\r?\n/).filter(Boolean);
    const parts = lines[1]?.trim().split(/\s+/) ?? [];
    const total = Number(parts[1]) * 1024;
    const used = Number(parts[2]) * 1024;
    const available = Number(parts[3]) * 1024;
    const percent = total > 0 ? (used / total) * 100 : null;
    return { total, used, available, percent };
  } catch {
    return null;
  }
}

async function readTailscaleIp() {
  try {
    const ip = await execFileText('tailscale', ['ip', '-4'], { timeout: 1500 });
    if (ip) return ip.split(/\s+/)[0];
  } catch {
    // hostname -I is enough as a fallback.
  }
  try {
    const ips = await execFileText('hostname', ['-I'], { timeout: 1500 });
    return ips.split(/\s+/).find((item) => item.startsWith('100.')) || ips.split(/\s+/).find(Boolean) || null;
  } catch {
    return null;
  }
}

function normalizeMetricSample(status) {
  return {
    at: status.checkedAt,
    cpu: status.cpuPercent,
    ram: status.memory?.percent ?? null,
    disk: status.diskUsage?.percent ?? null,
    temperature: status.temperatureCelsius,
  };
}

async function persistServerStatus(status) {
  if (serverStatusPersisting) return;
  serverStatusPersisting = true;
  try {
    if (CLOUD_LOCAL_API_INTERNAL_URL) {
      const response = await fetch(CLOUD_LOCAL_API_INTERNAL_URL + '/internal/metrics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'server_status', created_at: status.checkedAt, hostname: status.hostname, cpu_percent: status.cpuPercent, ram_percent: status.memory?.percent ?? null, disk_percent: status.diskUsage?.percent ?? null, temperature_celsius: status.temperatureCelsius, payload: status }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Local metrics API returned ' + response.status);
      return;
    }
    const payload = {
      created_at: status.checkedAt,
      hostname: status.hostname,
      cpu_percent: status.cpuPercent,
      ram_percent: status.memory?.percent ?? null,
      disk_percent: status.diskUsage?.percent ?? null,
      temperature_celsius: status.temperatureCelsius,
      payload: status,
    };
    await supabaseFetch(`/rest/v1/${SERVER_STATUS_TABLE}`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    });

    const oldRows = await supabaseFetch(`/rest/v1/${SERVER_STATUS_TABLE}?select=id&order=created_at.desc&offset=${SERVER_STATUS_HISTORY_LIMIT}`, {
      headers: supabaseHeaders(),
    }).catch(() => []);
    const oldIds = Array.isArray(oldRows) ? oldRows.map((row) => row.id).filter(Boolean) : [];
    if (oldIds.length) {
      await supabaseFetch(`/rest/v1/${SERVER_STATUS_TABLE}?id=in.(${oldIds.join(',')})`, {
        method: 'DELETE',
        headers: supabaseHeaders(),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Server status Supabase history skipped:', err.message || err);
  } finally {
    serverStatusPersisting = false;
  }
}

async function collectServerStatus({ persist = true } = {}) {
  const cpuPercent = readCpuPercent();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryPercent = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : null;
  const [diskUsage, temperatureCelsius, tailscaleIp] = await Promise.all([
    readDiskUsage(),
    readTemperatureCelsius(),
    readTailscaleIp(),
  ]);
  const checkedAt = new Date().toISOString();
  const status = {
    online: true,
    hostname: os.hostname(),
    tailscaleIp,
    uptime: formatUptime(os.uptime()),
    uptimeSeconds: Math.floor(os.uptime()),
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    checkedAt,
    cpu: cpuPercent === null ? `${os.cpus().length} nucleos` : `${Math.round(cpuPercent)}% / ${os.cpus().length} nucleos`,
    cpuPercent,
    loadAverage: os.loadavg(),
    cores: os.cpus().length,
    ram: `${formatBytes(usedMemory)} / ${formatBytes(totalMemory)}`,
    memory: { total: totalMemory, used: usedMemory, free: freeMemory, percent: memoryPercent },
    memoryPercent,
    disk: diskUsage ? `${formatBytes(diskUsage.used)} / ${formatBytes(diskUsage.total)}` : null,
    diskUsage,
    diskPercent: diskUsage?.percent ?? null,
    temperature: temperatureCelsius === null ? 'Sin sensor' : `${temperatureCelsius.toFixed(1)} C`,
    temperatureCelsius,
  };

  serverStatusHistory = [...serverStatusHistory, normalizeMetricSample(status)].slice(-SERVER_STATUS_HISTORY_LIMIT);
  latestServerStatus = { ...status, samples: serverStatusHistory };
  if (persist) persistServerStatus(status);
  return latestServerStatus;
}

function startServerStatusCollector() {
  collectServerStatus({ persist: true }).catch((err) => console.warn('Initial server status failed:', err.message || err));
  setInterval(() => {
    collectServerStatus({ persist: true }).catch((err) => console.warn('Server status collection failed:', err.message || err));
  }, Math.max(5000, SERVER_STATUS_INTERVAL_MS));
}

async function serverStatus(user, res) {
  if (!user.isAdmin) { const err = new Error('Solo admin puede leer estado de servidor.'); err.status = 403; throw err; }
  const status = latestServerStatus || await collectServerStatus({ persist: false });
  sendJson(res, 200, status);
}
async function createDownloadLink(user, res, url) {
  const requestedPath = normalizeCloudPath(url.searchParams.get('path'));
  const name = safeChildName(url.searchParams.get('name'));
  const baseRoot = getCloudBaseRoot(user);
  const mode = url.searchParams.get('mode') === 'view' ? 'view' : 'download';
  await resolveDownloadChild(user, baseRoot, requestedPath, name);
  const token = signDownloadPayload({
    uid: user.id,
    isAdmin: user.isAdmin,
    roles: user.roles,
    profile: {
      id: user.profile?.id || user.id,
      user_id: user.profile?.user_id || null,
      username: user.profile?.username || null,
      display_name: user.profile?.display_name || null,
      email: user.profile?.email || null,
    },
    path: requestedPath,
    name,
    mode,
    exp: Date.now() + DOWNLOAD_TOKEN_TTL_MS,
  });
  sendJson(res, 200, { success: true, url: `/api/download-public?token=${encodeURIComponent(token)}`, expiresInMs: DOWNLOAD_TOKEN_TTL_MS });
}

async function downloadPublic(req, res, url) {
  const payload = verifyDownloadToken(url.searchParams.get('token'));
  const user = downloadTokenUser(payload);
  const tokenUrl = new URL(`/api/download?path=${encodeURIComponent(payload.path)}&name=${encodeURIComponent(payload.name)}&mode=${encodeURIComponent(payload.mode === 'view' ? 'view' : 'download')}`, `http://${req.headers.host || 'localhost'}`);
  return downloadFile(user, req, res, tokenUrl);
}

async function assertAcademiaFileAccess(req, storagePaths) {
  const token = getBearerToken(req);
  if (!token) { const err = new Error('Sesion requerida.'); err.status = 401; throw err; }
  for (const storagePath of Array.isArray(storagePaths) ? storagePaths : [storagePaths]) {
    const encodedStoragePath = encodeURIComponent(storagePath);
    const rows = await supabaseFetch(`/rest/v1/academy_content_files?select=id,content_id&storage_path=eq.${encodedStoragePath}&limit=1`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }).catch((err) => {
      const accessError = new Error(err.message || 'No se pudo validar acceso Academia.');
      accessError.status = 403;
      throw accessError;
    });
    if (Array.isArray(rows) && rows.length) return rows[0];
  }
  const err = new Error('No tienes acceso a este archivo de Academia.');
  err.status = 403;
  throw err;
}

async function assertAcademiaFileDownloadAccess(req, contentId) {
  const token = getBearerToken(req);
  if (!token) { const err = new Error('Sesion requerida.'); err.status = 401; throw err; }
  const encodedContentId = encodeURIComponent(contentId);
  const rows = await supabaseFetch(`/rest/v1/academy_content_download_access?select=id&content_id=eq.${encodedContentId}&limit=1`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  }).catch((err) => {
    const accessError = new Error(err.message || 'No se pudo validar descarga Academia.');
    accessError.status = 403;
    throw accessError;
  });
  if (Array.isArray(rows) && rows.length) return;
  const err = new Error('No tienes permiso de descarga para este contenido.');
  err.status = 403;
  throw err;
}

async function downloadAcademiaFile(user, req, res, url) {
  let requestedPath = normalizeCloudPath(url.searchParams.get('path'));
  if (requestedPath.startsWith('/files/academia/')) requestedPath = normalizeCloudPath(requestedPath.slice('/files'.length));
  if (!requestedPath.startsWith('/academia/')) {
    const err = new Error('Ruta Academia no permitida.');
    err.status = 403;
    throw err;
  }
  const name = safeChildName(url.searchParams.get('name'));
  const filePath = requestedPath === '/' ? `/${name}` : `${requestedPath}/${name}`;
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const cloudBaseUrl = CLOUD_HIDDENROOM_URL.replace(/\/$/, '');
  const accessMode = url.searchParams.get('mode') === 'view' ? 'view' : 'download';
  const academyFile = await assertAcademiaFileAccess(req, [
    `${cloudBaseUrl}${encodedPath}`,
    `${cloudBaseUrl}/files${encodedPath}`,
  ]);
  if (accessMode === 'download') await assertAcademiaFileDownloadAccess(req, academyFile.content_id);
  const { child } = await resolveSafeChild(path.resolve(CLOUD_ROOT), requestedPath, name, { mustExist: true });
  const stats = await fsp.stat(child);
  if (!stats.isFile()) throw new Error('El elemento no es archivo.');
  const encoded = encodeURIComponent(name).replace(/['()]/g, escape).replace(/\*/g, '%2A');
  const safeName = name.replace(/["\r\n]/g, '_');
  return streamFile(req, res, child, stats, {
    ...API_CORS_HEADERS,
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
}
async function streamCloudDownloadFile(req, res, name, child, url) {
  const mode = url.searchParams.get('mode') === 'view' ? 'view' : 'download';
  const contentType = mode === 'view' ? await detectCloudPreviewMimeType(name, child) : null;
  const isInline = mode === 'view' && Boolean(contentType);
  const stats = await fsp.stat(child);
  if (!stats.isFile()) throw new Error('El elemento no es archivo.');
  const encoded = encodeURIComponent(name).replace(/['()]/g, escape).replace(/\*/g, '%2A');
  const safeName = name.replace(/["\r\n]/g, '_');
  return streamFile(req, res, child, stats, {
    ...API_CORS_HEADERS,
    'Content-Type': contentType || 'application/octet-stream',
    'Content-Disposition': (isInline ? 'inline' : 'attachment') + '; filename="' + safeName + '"; filename*=UTF-8\'\'' + encoded,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
}
async function downloadFile(user, req, res, url) {
  const requestedPath = normalizeCloudPath(url.searchParams.get('path'));
  const isAcademiaPath = requestedPath === '/academia' || requestedPath.startsWith('/academia/');
  if (user.isAcademiaAdmin && isAcademiaPath) {
    const baseRoot = path.resolve(CLOUD_ROOT);
    const { name, child } = await resolveDownloadChild(user, baseRoot, requestedPath, url.searchParams.get('name'));
    return streamCloudDownloadFile(req, res, name, child, url);
  }
  const baseRoot = getCloudBaseRoot(user);
  const { name, child } = await resolveDownloadChild(user, baseRoot, requestedPath, url.searchParams.get('name'));
  return streamCloudDownloadFile(req, res, name, child, url);
}
async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.resolve(APP_DIR, 'public', `.${pathname}`);
  const publicRoot = path.resolve(APP_DIR, 'public');
  const relative = path.relative(publicRoot, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return fail(res, 404, 'No encontrado.');
  try {
    const stats = await fsp.stat(filePath);
    if (!stats.isFile()) return fail(res, 404, 'No encontrado.');
    send(res, 200, await fsp.readFile(filePath), {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': pathname === '/index.html' ? 'no-store' : 'public, max-age=300',
    });
  } catch {
    send(res, 200, await fsp.readFile(path.join(APP_DIR, 'public', 'index.html')), {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
  }
}

const proxyLocalApi = createLocalApiProxy({ internalUrl: CLOUD_LOCAL_API_INTERNAL_URL, fail });
async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/local-api' || url.pathname.startsWith('/local-api/')) return proxyLocalApi(req, res, url);
    if ((req.method === 'GET' || req.method === 'HEAD') && /^\/share\/[a-f0-9]{48}$/i.test(url.pathname)) return await renderSharedPreviewPage(req, res, url);
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/shared-file') return await streamSharedFile(req, res, url);
    if (url.pathname === '/api/shared-file' && req.method === 'OPTIONS') return send(res, 204, '', PUBLIC_CORS_HEADERS);
    if (url.pathname === '/health') return sendJson(res, 200, { ok: true, service: 'mysauth-cloud' });
    if (url.pathname.startsWith('/api/beat-store')) {
      if (req.method === 'OPTIONS') return send(res, 204, '', PUBLIC_CORS_HEADERS);
      if (req.method === 'POST' && url.pathname === '/api/beat-store/cover') return await uploadBeatCover(await requireCloudUser(req), req, res);
      if (req.method === 'POST' && url.pathname === '/api/beat-store/producer-avatar') return await uploadProducerAvatar(await requireCloudUser(req), req, res, url);
      if (req.method === 'POST' && url.pathname === '/api/beat-store/upload-audio') return await uploadBeatAudio(await requireCloudUser(req), req, res);
      if (req.method === 'POST' && url.pathname === '/api/beat-store/upload-stems') return await uploadBeatStems(await requireCloudUser(req), req, res);
      if (req.method === 'POST' && url.pathname === '/api/beat-store/previews/backfill') return await backfillBeatPreviews(await requireCloudUser(req), res);
      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/beat-store') return await listBeatStore(res);
      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/beat-store/producer-avatar') return await streamProducerAvatarFile(req, res, url);
      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/beat-store/stream') return await streamBeatFile(req, res, url);
      return failPublic(res, 404, 'Ruta Beat Store no encontrada.');
    }
    if (url.pathname.startsWith('/api/store/')) {
      if (req.method === 'OPTIONS') return send(res, 204, '', API_CORS_HEADERS);
      if (req.method === 'POST' && url.pathname === '/api/store/download-token') return await createStoreDownloadToken(await requireCloudUser(req), req, res);
      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/store/download') return await downloadStorePublic(req, res, url);
      return fail(res, 404, 'Ruta Store no encontrada.');
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/download-public') return await downloadPublic(req, res, url);
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'OPTIONS') return send(res, 204, '', API_CORS_HEADERS);
      const user = await requireCloudUser(req);
      if (req.method === 'GET' && url.pathname === '/api/session') return sendJson(res, 200, sessionPayload(user));
      if (req.method === 'POST' && url.pathname === '/api/file-sharing') return await setCloudFileSharing(user, req, res);
      if (req.method === 'GET' && url.pathname === '/api/server-status') return await serverStatus(user, res);
      if (req.method === 'GET' && url.pathname === '/api/files') return await listFiles(user, res, url);
      if (req.method === 'GET' && url.pathname === '/api/favorites') return await listFavorites(user, res);
      if (req.method === 'POST' && url.pathname === '/api/favorites') return await toggleFavorite(user, req, res);
      if (req.method === 'GET' && url.pathname === '/api/trash') return await listTrash(user, res);
      if (req.method === 'POST' && url.pathname === '/api/trash/restore') return await restoreTrashItem(user, req, res);
      if (req.method === 'DELETE' && url.pathname === '/api/trash/item') return await deleteTrashItem(user, res, url);
      if (req.method === 'POST' && url.pathname === '/api/folders') return await createFolder(user, req, res);
      if (req.method === 'POST' && url.pathname === '/api/upload') return await uploadFile(user, req, res, url);
      if (req.method === 'POST' && url.pathname === '/api/move') return await relocateItem(user, req, res, 'move');
      if (req.method === 'POST' && url.pathname === '/api/copy') return await relocateItem(user, req, res, 'copy');
      if (req.method === 'POST' && url.pathname === '/api/rename') return await renameItem(user, req, res);
      if (req.method === 'DELETE' && url.pathname === '/api/item') return await deleteItem(user, res, url);
      if (req.method === 'GET' && url.pathname === '/api/download-link') return await createDownloadLink(user, res, url);
      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/academy-download') return await downloadAcademiaFile(user, req, res, url);
      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/academy-folder') return await downloadAcademiaFolder(user, req, res, url);
      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/download-folder') return await downloadFolder(user, req, res, url);
      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/download') return await downloadFile(user, req, res, url);
      return fail(res, 404, 'Ruta API no encontrada.');
    }
    return serveStatic(req, res, url);
  } catch (err) {
    const status = Number(err.status || 500);
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    const body = { success: false, error: err.message || 'Error interno.' };
    if (err.original_file_url) body.original_file_url = err.original_file_url;
    if (err.original_path) body.beat_original_path = err.original_path;
    if (err.original_file_url || err.original_path) body.beat_preview_status = 'error';
    sendJson(res, safeStatus, body);
  }
}

http.createServer(route).listen(PORT, BIND_HOST, () => {
  console.log(`MysAuth Cloud listening on ${PORT}`);
  console.log(`Cloud root: ${path.resolve(CLOUD_ROOT)}`);
  startServerStatusCollector();
});

