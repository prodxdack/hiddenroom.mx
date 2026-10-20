'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const { URL } = require('url');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rpcunbkstadgngqrjafp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_7v_FIgTjWjJgtT1YHIAYSw_bRBmQjZO';
const STAGING_BUCKET = process.env.CLOUD_STAGING_BUCKET || 'cloud-staging';
const STORAGE_RESUMABLE_URL = process.env.SUPABASE_STORAGE_RESUMABLE_URL || (SUPABASE_URL.replace('.supabase.co', '.storage.supabase.co') + '/storage/v1/upload/resumable');
const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024;
const STAGING_OBJECT_MAX_BYTES = 40 * 1024 * 1024;
const FUNCTION_BASE = SUPABASE_URL + '/functions/v1';
const LOCAL_CLOUD_API = String(process.env.MYSAUTH_CLOUD_LOCAL_API_URL || 'https://cloud.mysauth.com/local-api').replace(/\/+$/, '');
const PORT = Number(process.env.MYSAUTH_CLOUD_BACKUP_PORT || 17321);
const NETWORK_TIMEOUT_MS = 30000;
const POWERSHELL_TIMEOUT_MS = 15000;
const DATA_DIR = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'MysAuth Cloud Backup');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const HTML_FILE = path.join(__dirname, 'index.html');
const PHOSPHOR_DIR = path.resolve(__dirname, '..', '..', 'assets', 'vendor', 'phosphor');
const FOLDER_MARKER_FILE = '.mysauth-cloud-folder.json';
const FOLDER_MARKER_VERSION = 1;
let watchers = [];
let watchTimer = null;
let changeTimer = null;
let folderPickerActive = false;
const pendingChanges = new Map();
let lastAutomaticPassFinishedAt = 0;

const config = { folders: [], folderMeta: {}, intervalMs: 30000, email: '', encryptedRefreshToken: '', encryptedCloudToken: '', cloudTokenExpiresAt: 0 };
const auth = { accessToken: '', refreshToken: '', expiresAt: 0, userId: '', cloudToken: '', cloudTokenExpiresAt: 0 };
const state = {
  files: {},
  pending: [],
  tombstones: [],
  running: false,
  lastRun: null,
  lastSuccess: null,
  lastError: '',
  checked: 0,
  uploaded: 0,
  unchanged: 0,
  blocked: 0,
  errors: 0,
  current: '',
  currentFolder: '',
  currentFile: '',
  businessUserId: '',
  cloudUserDirectory: '',
  cloudCountCache: {},
  currentProgress: 0,
  uploads: {},
  folderStats: {},
  remoteFolders: [],
  remoteFoldersError: '',
};

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function ensureDataDir() { await fsp.mkdir(DATA_DIR, { recursive: true }); }

async function writeJsonAtomic(filePath, value) {
  await ensureDataDir();
  const temp = filePath + '.' + process.pid + '.part';
  await fsp.writeFile(temp, JSON.stringify(value, null, 2), { encoding: 'utf8', flag: 'w' });
  await fsp.rename(temp, filePath);
}

function validFolderId(value) { return /^[A-Za-z0-9_-]{16,80}$/.test(String(value || '')); }
function folderMetaFor(root) {
  const resolved = path.resolve(root);
  const meta = config.folderMeta?.[resolved];
  return meta && typeof meta === 'object' ? meta : {};
}
function folderMarkerPath(root) { return path.join(path.resolve(root), FOLDER_MARKER_FILE); }
async function readFolderMarker(root) {
  try {
    const marker = JSON.parse(await fsp.readFile(folderMarkerPath(root), 'utf8'));
    return marker && validFolderId(marker.folderId) ? marker : null;
  } catch { return null; }
}
async function writeFolderMarker(root, folderId) {
  const target = folderMarkerPath(root);
  const temporary = target + '.' + process.pid + '.part';
  try {
    await fsp.writeFile(temporary, JSON.stringify({ version: FOLDER_MARKER_VERSION, folderId, createdAt: new Date().toISOString() }, null, 2), { encoding: 'utf8', flag: 'wx' });
    await fsp.rename(temporary, target);
    return true;
  } catch { await fsp.unlink(temporary).catch(() => {}); return Boolean(await readFolderMarker(root)); }
}
async function ensureFolderIdentity(root) {
  const resolved = path.resolve(root);
  const marker = await readFolderMarker(resolved);
  if (marker) return { folderId: marker.folderId, markerWritten: true };
  const folderId = crypto.randomUUID();
  const markerWritten = await writeFolderMarker(resolved, folderId);
  return { folderId, markerWritten };
}
function fallbackCloudName(root) {
  const resolved = path.resolve(root);
  const raw = path.basename(resolved) || path.parse(resolved).root.replace(/[:\\]/g, '');
  return (raw || 'Raiz').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[-._]+|[-._]+$/g, '') || 'Raiz';
}
function findRemoteFolder(folderId, cloudName) {
  return (state.remoteFolders || []).find((folder) => folderId && folder.folder_id === folderId) || (state.remoteFolders || []).find((folder) => folder.cloud_name === cloudName && folder.has_cloud_data);
}
async function ensureConfiguredFolderIdentities() {
  let changed = false;
  for (const root of config.folders) {
    const info = await fsp.stat(root).catch(() => null);
    if (!info?.isDirectory()) continue;
    const identity = await ensureFolderIdentity(root);
    const resolved = path.resolve(root);
    const meta = folderMetaFor(resolved);
    const next = { ...meta, folderId: identity.folderId, cloudName: meta.cloudName || fallbackCloudName(resolved), markerWritten: identity.markerWritten };
    if (JSON.stringify(meta) !== JSON.stringify(next)) { config.folderMeta[resolved] = next; changed = true; }
  }
  if (changed) await saveConfig();
}
async function refreshBackupFolders() {
  if (!LOCAL_CLOUD_API || !auth.cloudToken) return state.remoteFolders;
  try {
    const body = await (await localRequest('/api/backup-folders')).json();
    state.remoteFolders = Array.isArray(body.folders) ? body.folders : [];
    state.remoteFoldersError = '';
  } catch (error) {
    state.remoteFoldersError = error.message || 'No se pudieron consultar las carpetas de Cloud.';
  }
  return state.remoteFolders;
}
async function registerBackupFolder(root) {
  if (!LOCAL_CLOUD_API || !auth.cloudToken) return null;
  const resolved = path.resolve(root);
  const identity = await ensureFolderIdentity(resolved);
  const currentName = fallbackCloudName(resolved);
  const remote = findRemoteFolder(identity.folderId, currentName);
  const meta = { ...folderMetaFor(resolved), folderId: identity.folderId, cloudName: remote?.cloud_name || folderMetaFor(resolved).cloudName || currentName, markerWritten: identity.markerWritten };
  config.folderMeta[resolved] = meta;
  const response = await localRequest('/api/backup-folders', { method: 'PUT', body: { folder_id: meta.folderId, folder_name: path.basename(resolved) || resolved, cloud_name: meta.cloudName, local_path: resolved, host_name: os.hostname(), marker_version: FOLDER_MARKER_VERSION } });
  const body = await response.json();
  const registered = body.folder || null;
  if (registered?.cloud_name) meta.cloudName = registered.cloud_name;
  state.remoteFolders = registered ? [...(state.remoteFolders || []).filter((folder) => folder.folder_id !== registered.folder_id && folder.cloud_name !== registered.cloud_name), registered] : state.remoteFolders;
  await saveConfig();
  return registered;
}
function runPowerShell(script, input = '', options = {}) {
  const interactive = options.interactive === true;
  const args = ['-NoLogo', '-NoProfile'];
  if (!interactive) args.push('-NonInteractive');
  args.push('-STA', '-ExecutionPolicy', 'Bypass');
  if (interactive) args.push('-WindowStyle', 'Normal');
  args.push('-Command', script);
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', args, { windowsHide: !interactive });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(reject, new Error(interactive ? 'El selector de archivos de Windows no respondiÃ³. IntÃ©ntalo de nuevo.' : 'PowerShell tardÃ³ demasiado. La sesiÃ³n continuarÃ¡ sin renovarse.'));
    }, interactive ? 10 * 60 * 1000 : POWERSHELL_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (err) => finish(reject, err));
    child.on('close', (code) => {
      if (code === 0) finish(resolve, stdout.trim());
      else finish(reject, new Error(stderr.trim() || 'PowerShell terminÃ³ con error.'));
    });
    child.stdin.end(input);
  });
}
async function protectToken(token) {
  if (process.platform !== 'win32') return token;
  return runPowerShell(
    'Add-Type -AssemblyName System.Security;$raw=[Console]::In.ReadToEnd();$bytes=[Convert]::FromBase64String($raw);$protected=[Security.Cryptography.ProtectedData]::Protect($bytes,[byte[]]::new(0),[Security.Cryptography.DataProtectionScope]::CurrentUser);[Convert]::ToBase64String($protected)',
    Buffer.from(token, 'utf8').toString('base64'),
  );
}

async function unprotectToken(value) {
  if (!value) return '';
  if (process.platform !== 'win32') return value;
  const output = await runPowerShell(
    'Add-Type -AssemblyName System.Security;$raw=[Console]::In.ReadToEnd();$bytes=[Convert]::FromBase64String($raw);$plain=[Security.Cryptography.ProtectedData]::Unprotect($bytes,[byte[]]::new(0),[Security.Cryptography.DataProtectionScope]::CurrentUser);[Text.Encoding]::UTF8.GetString($plain)',
    value,
  );
  return output;
}

async function loadLocalState() {
  await ensureDataDir();
  try {
    Object.assign(config, JSON.parse(await fsp.readFile(CONFIG_FILE, 'utf8')));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  try {
    Object.assign(state, JSON.parse(await fsp.readFile(STATE_FILE, 'utf8')));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (!Array.isArray(config.folders)) config.folders = [];
  if (!config.folderMeta || typeof config.folderMeta !== 'object' || Array.isArray(config.folderMeta)) config.folderMeta = {};
  for (const root of config.folders) {
    if (typeof root === 'string' && (!config.folderMeta[path.resolve(root)] || typeof config.folderMeta[path.resolve(root)] !== 'object')) config.folderMeta[path.resolve(root)] = {};
  }
  if (!state.files || typeof state.files !== 'object') state.files = {};
  if (!Array.isArray(state.pending)) state.pending = [];
  if (!state.uploads || typeof state.uploads !== 'object') state.uploads = {};
  if (!state.folderStats || typeof state.folderStats !== 'object') state.folderStats = {};
  if (!Array.isArray(state.remoteFolders)) state.remoteFolders = [];
  if (typeof state.remoteFoldersError !== 'string') state.remoteFoldersError = '';
  state.currentFile = '';
  state.businessUserId = ''; 
  state.cloudUserDirectory = ''; 
  state.cloudCountCache = {};
  // These fields belong to the previous process, not resumable work. A crash
  // must never leave the next launch believing a scan is still active.
  state.running = false;
  state.stage = '';
  state.current = '';
  state.currentFolder = '';
  state.currentFile = '';
  state.currentProgress = 0;
  for (const stats of Object.values(state.folderStats)) {
    if (stats.status === 'Revisando') stats.status = 'Esperando';
    stats.currentFile = '';
    stats.currentProgress = 0;
  }
  auth.cloudTokenExpiresAt = Number(config.cloudTokenExpiresAt || 0);
  if (config.encryptedCloudToken) {
    try { auth.cloudToken = await unprotectToken(config.encryptedCloudToken); } catch { auth.cloudToken = ''; }
  }
  if (config.encryptedRefreshToken) {
    try {
      auth.refreshToken = await unprotectToken(config.encryptedRefreshToken);
    } catch {
      // Conserva el token cifrado: otro reinicio con el mismo usuario puede recuperarlo.
      auth.refreshToken = '';
    }
  }
}

async function saveConfig() {
  await writeJsonAtomic(CONFIG_FILE, {
    folders: [...new Set(config.folders)].sort(),
    folderMeta: Object.fromEntries(Object.entries(config.folderMeta || {}).filter(([root]) => config.folders.includes(root)).map(([root, meta]) => [root, { folderId: String(meta?.folderId || ''), cloudName: String(meta?.cloudName || ''), markerWritten: Boolean(meta?.markerWritten) }])),
    intervalMs: Math.max(10000, Number(config.intervalMs) || 30000),
    email: config.email || '',
    encryptedRefreshToken: config.encryptedRefreshToken || '',
    encryptedCloudToken: config.encryptedCloudToken || '',
    cloudTokenExpiresAt: Number(config.cloudTokenExpiresAt || 0),
  });
}

async function saveState() {
  await writeJsonAtomic(STATE_FILE, {
    files: state.files,
    pending: state.pending,
    uploads: state.uploads,
    folderStats: state.folderStats,
    lastRun: state.lastRun,
    lastSuccess: state.lastSuccess,
  });
}

async function jsonResponse(response) {
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text || 'Respuesta no vÃ¡lida.' }; }
  if (!response.ok) { const error = new Error(body.error || body.message || 'Cloud request failed (' + response.status + ').'); error.status = response.status; throw error; }
  return body;
}

async function timedFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('La conexiÃ³n con Cloud tardÃ³ demasiado. Se reintentarÃ¡ automÃ¡ticamente.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function httpsJsonRequest(target, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body ? Buffer.from(String(options.body), 'utf8') : null;
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 12000);
    const headers = { Connection: 'close', 'Accept-Encoding': 'identity', ...(options.headers || {}) };
    if (body) headers['Content-Length'] = String(body.length);
    let settled = false;
    let hardTimeout;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimeout);
      callback(value);
    };
    const request = https.request(target, { method: options.method || 'GET', headers }, (response) => {
      const chunks = [];
      if (state.running) state.stage = 'Respuesta recibida: HTTP ' + (response.statusCode || 0);
      response.on('data', (chunk) => { chunks.push(chunk); if (state.running) state.stage = 'Recibiendo respuesta de Cloud (' + chunks.reduce((n, part) => n + part.length, 0) + ' bytes)'; });
      response.on('error', (err) => finish(reject, err));
      response.on('aborted', () => finish(reject, new Error('La respuesta de Cloud se interrumpiÃ³.')));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (state.running) state.stage = 'Respuesta de Cloud completa (' + text.length + ' caracteres)';
        finish(resolve, {
          ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
          status: response.statusCode || 0,
          text: async () => text,
        });
      });
    });
    hardTimeout = setTimeout(() => {
      request.destroy();
      finish(reject, new Error('Cloud no respondiÃ³ en ' + Math.ceil(timeoutMs / 1000) + ' segundos. Se reintentarÃ¡ automÃ¡ticamente.'));
    }, timeoutMs);
    request.setTimeout(Math.max(NETWORK_TIMEOUT_MS, timeoutMs), () => request.destroy(new Error('La conexiÃ³n con Cloud tardÃ³ demasiado.')));
    request.on('error', (err) => finish(reject, err));
    if (body) request.end(body);
    else request.end();
  });
}
async function exchangeLocalSession() {
  if (!LOCAL_CLOUD_API || !auth.accessToken) return;
  state.stage = 'Validando sesiÃ³n local de Cloud';
  const response = await fetch(LOCAL_CLOUD_API + '/auth/exchange', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + auth.accessToken, 'Content-Length': '0' },
    signal: AbortSignal.timeout(12000),
  });
  const body = await jsonResponse(response);
  auth.cloudToken = body.token || '';
  auth.cloudTokenExpiresAt = Date.parse(body.expires_at || '') || 0;
  state.businessUserId = String(body.business_user_id || state.businessUserId);
  config.cloudTokenExpiresAt = auth.cloudTokenExpiresAt;
  try { config.encryptedCloudToken = await protectToken(auth.cloudToken); await saveConfig(); } catch {}
}
async function ensureLocalSession() {
  if (!LOCAL_CLOUD_API) throw new Error('No se configurÃ³ la API local de Cloud.');
  if (auth.cloudToken && Date.now() < auth.cloudTokenExpiresAt - 60000) return auth.cloudToken;
  if (!auth.accessToken || Date.now() >= auth.expiresAt - 60000) await refreshSession();
  else await exchangeLocalSession();
  if (!auth.cloudToken) throw new Error('Inicia sesiÃ³n para activar Cloud local.');
  return auth.cloudToken;
}
async function localRequest(apiPath, options = {}) {
  const token = options.token || await ensureLocalSession();
  const headers = { Authorization: 'Bearer ' + token, ...(options.headers || {}) };
  if (options.body !== undefined && !Buffer.isBuffer(options.body) && typeof options.body !== 'string')
    headers['Content-Type'] = 'application/json';
  const body = options.body !== undefined && !Buffer.isBuffer(options.body) && typeof options.body !== 'string'
    ? JSON.stringify(options.body) : options.body;
  const response = await fetch(LOCAL_CLOUD_API + apiPath, {
    method: options.method || 'GET', headers, body,
    signal: AbortSignal.timeout(options.timeoutMs || 30 * 60 * 1000),
  });
  if (!response.ok) {
    let message = 'Cloud local respondiÃ³ HTTP ' + response.status + '.';
    try { const result = await response.json(); message = result.error || message; } catch {}
    const error = new Error(message); error.status = response.status; throw error;
  }
  return response;
}
async function login(email, password) {
  state.stage = 'Iniciando sesiÃ³n';
  const response = await httpsJsonRequest(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await jsonResponse(response);
  auth.accessToken = body.access_token || '';
  auth.refreshToken = body.refresh_token || '';
  auth.expiresAt = Date.now() + Number(body.expires_in || 3600) * 1000;
  auth.userId = body.user?.id || '';
  config.email = email;
  try {
    config.encryptedRefreshToken = await protectToken(auth.refreshToken);
    await saveConfig();
  } catch {}
  if (LOCAL_CLOUD_API) await exchangeLocalSession();
  state.lastError = '';
  await refreshTombstones();
  return { email };
}

async function refreshSession() {
  if (!auth.refreshToken) throw new Error('Inicia sesiÃ³n para activar los respaldos.');
  state.stage = 'Renovando sesiÃ³n';
  const response = await httpsJsonRequest(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: auth.refreshToken }),
  });
  const body = await jsonResponse(response);
  auth.accessToken = body.access_token || '';
  auth.refreshToken = body.refresh_token || auth.refreshToken;
  auth.expiresAt = Date.now() + Number(body.expires_in || 3600) * 1000;
  auth.userId = body.user?.id || auth.userId;
  try {
    config.encryptedRefreshToken = await protectToken(auth.refreshToken);
    await saveConfig();
  } catch {}
  if (LOCAL_CLOUD_API) await exchangeLocalSession();
}

async function ensureSession() {
  if (LOCAL_CLOUD_API) return ensureLocalSession();
  if (auth.accessToken && Date.now() < auth.expiresAt - 60000) return auth.accessToken;
  await refreshSession();
  return auth.accessToken;
}
async function authenticatedFetch(url, options = {}, retry = true) {
  const token = await ensureSession();
  const headers = { ...(options.headers || {}), apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token };
  const response = await httpsJsonRequest(url, { ...options, headers });
  if (response.status === 401 && retry) {
    auth.accessToken = '';
    await refreshSession();
    return authenticatedFetch(url, options, false);
  }
  return response;
}
async function callFunction(name, method = 'GET', body = null, query = '') {
  const timeoutMs = name === 'cloud-backup-upload' ? 28000 : name === 'cloud-list' ? 30000 : 12000;
  const options = { method, timeoutMs, headers: { 'Content-Type': 'application/json' } };
  if (body !== null) options.body = JSON.stringify(body);
  let guard;
  try {
    const timeout = new Promise((_, reject) => {
      guard = setTimeout(() => reject(new Error('La funciÃ³n ' + name + ' tardÃ³ mÃ¡s de ' + Math.ceil(timeoutMs / 1000) + ' segundos.')), timeoutMs);
    });
    const completeRequest = (async () => {
      const response = await authenticatedFetch(FUNCTION_BASE + '/' + name + query, options);
      if (state.running) state.stage = 'Procesando respuesta de ' + name;
      return jsonResponse(response);
    })();
    return await Promise.race([completeRequest, timeout]);
  } finally {
    clearTimeout(guard);
  }
}
async function cloudListPath(pathValue) {
  let result = await callFunction('cloud-list', 'GET', null, '?path=' + encodeURIComponent(pathValue));
  if (result.pending && result.jobId) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      await delay(1500);
      const body = await callFunction('cloud-backup-status', 'GET', null, '?job_id=' + encodeURIComponent(result.jobId));
      const job = body.job || {};
      if (job.status === (LOCAL_CLOUD_API ? 'completed' : 'done')) { result = job.result || {}; break; }
      if (job.status === (LOCAL_CLOUD_API ? 'failed' : 'error')) throw new Error(String(job.error || 'Cloud no pudo leer la carpeta.'));
    }
    if (result.pending) throw new Error('La consulta de archivos de Cloud sigue pendiente; se volverÃ¡ a intentar.');
  }
  if (!Array.isArray(result.files) || !Array.isArray(result.folders)) throw new Error('Cloud devolviÃ³ una lista de carpeta incompleta.');
  return result;
}
async function countCloudFiles(root) {
  if (!state.businessUserId) throw new Error('Cloud no devolviÃ³ el user_id operativo para localizar tu carpeta.');
  if (LOCAL_CLOUD_API) {
    const body = await (await localRequest('/api/count?path=' + encodeURIComponent(cloudFolderName(root)))).json();
    return Number(body.count || 0);
  }
  if (!state.cloudUserDirectory) {
    const users = await cloudListPath('/users');
    state.cloudUserDirectory = users.folders.find((name) => String(name).startsWith(state.businessUserId + '__')) || '';
    if (!state.cloudUserDirectory) return 0;
  }
  const base = '/users/' + state.cloudUserDirectory + '/' + cloudFolderName(root);
  let first;
  try { first = await cloudListPath(base); }
  catch (err) { if (/ENOENT|no such file or directory/i.test(err.message || '')) return 0; throw err; }
  let total = first.files.length;
  const queue = first.folders.map((name) => base + '/' + name);
  while (queue.length) {
    const currentPath = queue.shift();
    const listing = await cloudListPath(currentPath);
    total += listing.files.length;
    for (const name of listing.folders) queue.push(currentPath + '/' + name);
  }
  return total;
}
async function refreshCloudCount(root, force = false) {
  const cache = state.cloudCountCache[root];
  const stats = getFolderStats(root);
  if (!force && cache && Date.now() - cache.checkedAt < 120000) {
    stats.cloudFiles = cache.count;
    stats.cloudCountError = cache.error || '';
    return;
  }
  state.stage = 'Contando archivos en Cloud: ' + stats.name;
  try {
    const count = await countCloudFiles(root);
    state.cloudCountCache[root] = { count, error: '', checkedAt: Date.now() };
  } catch (err) {
    const detail = err && err.status ? 'HTTP ' + err.status + ': ' : '';
    state.cloudCountCache[root] = { count: null, error: detail + (err.message || 'No se pudo contar Cloud.'), checkedAt: Date.now() };
  }
  stats.cloudFiles = state.cloudCountCache[root].count;
  stats.cloudCountError = state.cloudCountCache[root].error;
}
async function refreshTombstones() {
  state.stage = 'Consultando bloqueos';
  const body = LOCAL_CLOUD_API ? await (await localRequest('/api/tombstones')).json() : await callFunction('cloud-backup-state');
  state.tombstones = Array.isArray(body.tombstones) ? body.tombstones : [];
  const nextBusinessUserId = String(body.business_user_id || (LOCAL_CLOUD_API ? state.businessUserId : ''));
  if (state.businessUserId && state.businessUserId !== nextBusinessUserId) { state.cloudUserDirectory = ''; state.cloudCountCache = {}; }
  state.businessUserId = nextBusinessUserId;
  await refreshBackupFolders();
  for (const root of config.folders) {
    try { await registerBackupFolder(root); } catch (error) { if (error.status === 409) state.remoteFoldersError = error.message || 'Hay una colisiÃ³n de nombres en Cloud.'; }
  }
  return state.tombstones;
}

function isBlocked(relativePath) {
  return state.tombstones.some((marker) => {
    const markerPath = String(marker.relative_path || '');
    return markerPath === '.' || relativePath === markerPath
      || (marker.item_type === 'folder' && relativePath.startsWith(markerPath + '/'));
  });
}

async function runPickerWithFallback(primaryScript, fallbackScript, emptyMessage) {
  try {
    return (await runPowerShell(primaryScript, '', { interactive: true })).trim();
  } catch (primaryError) {
    try { return (await runPowerShell(fallbackScript, '', { interactive: true })).trim(); }
    catch (fallbackError) { throw new Error(emptyMessage + ' ' + (fallbackError.message || primaryError.message || 'error desconocido')); }
  }
}
async function chooseFolder() {
  if (folderPickerActive) throw new Error('El selector de carpetas ya estÃ¡ abierto.');
  folderPickerActive = true;
  const primary = "Add-Type -AssemblyName System.Windows.Forms;$dialog=New-Object System.Windows.Forms.FolderBrowserDialog;$dialog.Description='Selecciona una carpeta para respaldar en MysAuth Cloud';$dialog.ShowNewFolderButton=$false;if($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Write($dialog.SelectedPath)}";
  const fallback = "$shell=New-Object -ComObject Shell.Application;$folder=$shell.BrowseForFolder(0,'Selecciona una carpeta para respaldar en MysAuth Cloud',0,0);if($folder){[Console]::Write($folder.Self.Path)}";
  try { return await runPickerWithFallback(primary, fallback, 'No se pudo abrir el selector de carpetas de Windows.'); }
  finally { folderPickerActive = false; }
}
async function chooseFile(root) {
  if (folderPickerActive) throw new Error('Ya hay un selector de archivos abierto.');
  folderPickerActive = true;
  const quotedRoot = String(root).replace(/'/g, "''");
  const primary = "Add-Type -AssemblyName System.Windows.Forms;$owner=New-Object System.Windows.Forms.Form;$owner.TopMost=$true;$owner.ShowInTaskbar=$false;$owner.FormBorderStyle='FixedToolWindow';$owner.StartPosition='CenterScreen';$owner.Size=New-Object System.Drawing.Size(1,1);$owner.Opacity=0;$owner.Show();$dialog=New-Object System.Windows.Forms.OpenFileDialog;$dialog.Title='Selecciona un archivo para respaldar';$dialog.InitialDirectory='" + quotedRoot + "';$dialog.CheckFileExists=$true;$dialog.Multiselect=$false;$dialog.RestoreDirectory=$true;$dialog.Filter='Todos los archivos (*.*)|*.*';$dialog.ShowHelp=$false;try{$owner.Activate();$result=$dialog.ShowDialog($owner);if($result -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Write($dialog.FileName)}elseif($result -ne [System.Windows.Forms.DialogResult]::Cancel){throw 'Windows no pudo mostrar el selector de archivos.'}}finally{$owner.Dispose()}";
  const fallback = "Add-Type -AssemblyName PresentationFramework;$dialog=New-Object Microsoft.Win32.OpenFileDialog;$dialog.Title='Selecciona un archivo para respaldar';$dialog.InitialDirectory='" + quotedRoot + "';$dialog.CheckFileExists=$true;$dialog.Multiselect=$false;$dialog.Filter='Todos los archivos (*.*)|*.*';if($dialog.ShowDialog()){[Console]::Write($dialog.FileName)}";
  try { return await runPickerWithFallback(primary, fallback, 'No se pudo abrir el explorador de archivos de Windows.'); }
  finally { folderPickerActive = false; }
}
async function validateSelectedFile(root, selectedPath) {
  const configuredRoot = path.resolve(root);
  const candidate = path.resolve(selectedPath);
  const relative = path.relative(configuredRoot, candidate);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('El archivo seleccionado no pertenece a la carpeta respaldada.');
  }
  let rootReal;
  let candidateReal;
  try { [rootReal, candidateReal] = await Promise.all([fsp.realpath(configuredRoot), fsp.realpath(candidate)]); }
  catch (err) { throw new Error('No se pudo abrir el archivo seleccionado: ' + fileReadErrorMessage(err)); }
  const realRelative = path.relative(rootReal, candidateReal);
  if (!realRelative || realRelative === '..' || realRelative.startsWith('..' + path.sep) || path.isAbsolute(realRelative)) {
    throw new Error('El archivo seleccionado apunta fuera de la carpeta respaldada.');
  }
  const info = await fsp.stat(candidateReal);
  if (!info.isFile()) throw new Error('La ruta seleccionada no es un archivo.');
  return { path: candidate, relative: relative.split(path.sep).join('/') };
}
function isFileUnchanged(relative, stable) {
  const saved = state.files[relative];
  return Boolean(saved && stable && saved.sha256 === stable.sha256 && saved.size === stable.size);
}

function storageObjectUrl(storagePath) {
  return SUPABASE_URL + '/storage/v1/object/' + encodeURIComponent(STAGING_BUCKET) + '/' + storagePath.split('/').map(encodeURIComponent).join('/');
}

function storageRequest(method, target, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const request = https.request(target, { method, headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.setTimeout(NETWORK_TIMEOUT_MS, () => request.destroy(new Error('La subida tardÃ³ demasiado y se reintentarÃ¡.')));
    request.on('error', reject);
    if (body) {
      body.on('error', reject);
      body.pipe(request);
    } else {
      request.end();
    }
  });
}

function metadataValue(value) {
  return Buffer.from(String(value), 'utf8').toString('base64');
}

function uploadLocation(value) {
  return new URL(String(value), STORAGE_RESUMABLE_URL).toString();
}

function resumableError(response) {
  const detail = response.body ? ': ' + response.body.slice(0, 240) : '.';
  if (response.status === 413) {
    return new Error('Supabase rechazÃ³ el objeto temporal (' + response.status + '): ' + (response.body || 'lÃ­mite mÃ¡ximo de objeto excedido').slice(0, 240));
  }
  return new Error('Subida grande fallida (' + response.status + ')' + detail);
}

async function tusRequest(method, target, headers, bodyFactory = null) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const body = bodyFactory ? bodyFactory() : null;
      const response = await storageRequest(method, target, headers, body);
      if (response.status >= 200 && response.status < 300) return response;
      if (response.status === 404 || response.status === 410) return response;
      throw resumableError(response);
    } catch (err) {
      lastError = err;
      if (attempt < 3) await delay([0, 2000, 5000, 10000][attempt]);
    }
  }
  throw lastError || new Error('No se pudo completar la subida reanudable.');
}

async function uploadToStaging(filePath, size, storagePath, mimeType, previous = {}, checkpoint = async () => undefined, onProgress = () => undefined, sourceOffset = 0) {
  const token = await ensureSession();
  let uploadUrl = previous.url || '';
  let offset = Number(previous.offset) || 0;
  if (uploadUrl) {
    const head = await tusRequest('HEAD', uploadUrl, { Authorization: 'Bearer ' + token, 'Tus-Resumable': '1.0.0' });
    if (head.status === 404 || head.status === 410) {
      uploadUrl = '';
      offset = 0;
    } else {
      offset = Number(head.headers['upload-offset'] || offset || 0);
    }
  }
  if (!uploadUrl) {
    const created = await tusRequest('POST', STORAGE_RESUMABLE_URL, {
      Authorization: 'Bearer ' + token,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(size),
      'Upload-Metadata': [
        'bucketName ' + metadataValue(STAGING_BUCKET),
        'objectName ' + metadataValue(storagePath),
        'contentType ' + metadataValue(mimeType || 'application/octet-stream'),
      ].join(','),
      'x-upsert': 'false',
      'Content-Length': '0',
    });
    uploadUrl = uploadLocation(created.headers.location);
    offset = Number(created.headers['upload-offset'] || 0);
  }
  if (!uploadUrl || offset > size) throw new Error('La sesiÃ³n de subida no es vÃ¡lida.');
  await checkpoint({ url: uploadUrl, offset, size, storagePath });
  onProgress(offset, size);
  while (offset < size) {
    const chunkStart = offset;
    const chunkEnd = Math.min(size, chunkStart + UPLOAD_CHUNK_SIZE);
    const response = await tusRequest('PATCH', uploadUrl, {
      Authorization: 'Bearer ' + token,
      'Tus-Resumable': '1.0.0',
      'Upload-Offset': String(chunkStart),
      'Content-Type': 'application/offset+octet-stream',
      'Content-Length': String(chunkEnd - chunkStart),
    }, () => fs.createReadStream(filePath, { start: sourceOffset + chunkStart, end: sourceOffset + chunkEnd - 1 }));
    const nextOffset = Number(response.headers['upload-offset']);
    if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset || nextOffset > size) throw new Error('El servidor devolviÃ³ un avance invÃ¡lido.');
    offset = nextOffset;
    await checkpoint({ url: uploadUrl, offset, size, storagePath });
    onProgress(offset, size);
  }
  return { url: uploadUrl, offset, size, storagePath };
}
async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function readStableFile(filePath) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const first = await fsp.stat(filePath);
      if (!first.isFile()) return null;
      await delay(350);
      const second = await fsp.stat(filePath);
      if (first.size !== second.size || first.mtimeMs !== second.mtimeMs) {
        lastError = new Error('El archivo todavÃ­a estÃ¡ cambiando.');
        continue;
      }
      const sha256 = await hashFile(filePath);
      const final = await fsp.stat(filePath);
      if (final.size !== second.size || final.mtimeMs !== second.mtimeMs) {
        lastError = new Error('El archivo cambiÃ³ durante la lectura.');
        continue;
      }
      return { size: final.size, mtimeMs: final.mtimeMs, sha256 };
    } catch (err) {
      lastError = err;
      await delay(350);
    }
  }
  throw lastError || new Error('No se pudo leer el archivo de forma estable.');
}
async function listFilesRecursive(root) {
  const results = [];
  async function visit(current) {
    let entries;
    try { entries = await fsp.readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === 'Thumbs.db' || entry.name === 'desktop.ini' || entry.name === FOLDER_MARKER_FILE) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) results.push(full);
    }
  }
  await visit(root);
  return results;
}

function cloudFolderName(root) {
  const configured = folderMetaFor(root).cloudName;
  return configured || fallbackCloudName(root);
}
function relativePath(root, filePath) {
  const localRelative = path.relative(root, filePath).split(path.sep).join('/');
  return cloudFolderName(root) + '/' + localRelative;
}

function queueFileChange(root, filename = '') {
  const candidate = filename ? path.resolve(root, String(filename)) : path.resolve(root);
  const enqueue = () => {
    pendingChanges.set(candidate, root);
    schedulePrioritySync();
  };
  if (filename) {
    const previous = state.files[relativePath(root, candidate)];
    if (previous) {
      fsp.stat(candidate).then((info) => {
        if (info.isFile() && Number(previous.size) === info.size && Number(previous.mtimeMs) === info.mtimeMs) return;
        enqueue();
      }).catch((err) => {
        if (err.code !== 'ENOENT') enqueue();
      });
      return;
    }
  }
  enqueue();
}

function schedulePrioritySync() {
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    changeTimer = null;
    processPriorityChanges().catch((err) => {
      state.lastError = err.message || 'No se pudo procesar el cambio local.';
      state.errors += 1;
      saveState().catch(() => undefined);
    });
  }, 700);
}

function refreshWatchers() {
  for (const watcher of watchers) watcher.close();
  watchers = [];
  for (const root of [...new Set(config.folders)]) {
    try {
      const watcher = fs.watch(root, { recursive: true }, (_eventType, filename) => {
        queueFileChange(root, filename || '');
      });
      watchers.push(watcher);
    } catch {
      // La revisiÃ³n periÃ³dica permanece como respaldo si Windows no puede observar la ruta.
    }
  }
}
async function pollPendingJobs() {
  const remaining = [];
  for (const pending of state.pending) {
    try {
      const body = LOCAL_CLOUD_API ? await (await localRequest('/api/jobs/' + encodeURIComponent(pending.jobId))).json() : await callFunction('cloud-backup-status', 'GET', null, '?job_id=' + encodeURIComponent(pending.jobId));
      const job = body.job || {};
      if (job.status === (LOCAL_CLOUD_API ? 'completed' : 'done')) {
        state.uploaded += 1;
        continue;
      }
      if (job.status === (LOCAL_CLOUD_API ? 'failed' : 'error')) {
        delete state.files[pending.relativePath];
        state.lastError = String(job.error || 'El respaldo fallÃ³.');
        state.errors += 1;
        continue;
      }
      remaining.push(pending);
    } catch {
      remaining.push(pending);
    }
  }
  state.pending = remaining;
}

function getFolderStats(root) {
  if (!state.folderStats[root]) {
    state.folderStats[root] = {
      path: root,
      name: path.basename(path.resolve(root)) || root,
      folderId: folderMetaFor(root).folderId || '',
      cloudName: cloudFolderName(root),
      markerWritten: Boolean(folderMetaFor(root).markerWritten),
      status: 'Esperando',
      checked: 0,
      uploaded: 0,
      unchanged: 0,
      pending: 0,
      errors: 0,
      processed: 0,
      totalFiles: 0,
      progress: 0,
      currentFile: '',
      currentProgress: 0,
      cloudFiles: state.cloudCountCache[root]?.count ?? null,
      cloudCountError: state.cloudCountCache[root]?.error || '',
    };
  }
  return state.folderStats[root];
}

function updateFolderProgress(stats) {
  const total = Math.max(1, Number(stats.totalFiles) || 0);
  const current = stats.currentFile ? Number(stats.currentProgress || 0) / 100 : 0;
  stats.progress = Math.min(100, Math.round(((Number(stats.processed || 0) + current) / total) * 100));
}

async function backupFileLocal(root, filePath, relative, stable, stats) {
  const previous = state.uploads[relative];
  const reusable = previous && previous.sha256 === stable.sha256 && previous.size === stable.size;
  const transferKey = reusable && previous.transferKey ? previous.transferKey : crypto.randomBytes(12).toString('base64url');
  const localTransferId = reusable ? previous.localTransferId : '';
  state.uploads[relative] = { sha256: stable.sha256, size: stable.size, transferKey, localTransferId };
  await saveState();
  stats.currentFile = relative; state.currentFile = relative;
  state.stage = 'Subiendo archivo: ' + relative; stats.status = 'Subiendo';
  const created = await (await localRequest('/api/transfers', {
    method: 'POST', headers: { 'Idempotency-Key': transferKey },
    body: { path: relative, size: stable.size, sha256: stable.sha256 },
  })).json();
  const transferId = created.transfer_id || localTransferId;
  if (!transferId) throw new Error('Cloud no devolviÃ³ el identificador de transferencia.');
  state.uploads[relative] = { sha256: stable.sha256, size: stable.size, transferKey, localTransferId: transferId };
  await saveState();
  let job = created.job || null;
  if (!job) {
    const head = await localRequest('/api/transfers/' + encodeURIComponent(transferId), { method: 'HEAD' });
    let offset = Number(head.headers.get('upload-offset') || 0);
    let status = head.headers.get('x-transfer-status') || created.status || 'uploading';
    let jobId = head.headers.get('x-job-id') || created.job_id || '';
    const handle = await fsp.open(filePath, 'r');
    try {
      while (!job && offset < stable.size) {
        const chunk = Buffer.allocUnsafe(Math.min(5 * 1024 * 1024, stable.size - offset));
        const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset);
        if (!bytesRead) throw new Error('El archivo local cambiÃ³ durante la transferencia.');
        const body = bytesRead === chunk.length ? chunk : chunk.subarray(0, bytesRead);
        const response = await localRequest('/api/transfers/' + encodeURIComponent(transferId), {
          method: 'PATCH', headers: { 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream', 'Content-Length': String(body.length) },
          body, timeoutMs: 30 * 60 * 1000,
        });
        offset = Number(response.headers.get('upload-offset') || (offset + body.length));
        status = response.headers.get('x-transfer-status') || status;
        jobId = response.headers.get('x-job-id') || jobId;
        stats.currentProgress = stable.size ? Math.round(offset / stable.size * 100) : 100;
        state.currentProgress = stats.currentProgress; updateFolderProgress(stats);
        if (response.status === 202) job = (await response.json()).job || null;
      }
    } finally { await handle.close(); }
    if (!job && status === 'queued' && jobId) job = (await (await localRequest('/api/jobs/' + encodeURIComponent(jobId))).json()).job;
    if (!job && stable.size === 0) {
      const refreshed = await (await localRequest('/api/transfers', {
        method: 'POST', headers: { 'Idempotency-Key': transferKey },
        body: { path: relative, size: stable.size, sha256: stable.sha256 },
      })).json();
      job = refreshed.job || null;
    }
  }
  if (!job?.id) throw new Error('La carga terminÃ³, pero Cloud no confirmÃ³ el trabajo de respaldo.');
  delete state.uploads[relative];
  state.files[relative] = { size: stable.size, mtimeMs: stable.mtimeMs, sha256: stable.sha256, lastSeen: Date.now() };
  stats.uploaded += 1; state.uploaded += 1;
  state.pending.push({ jobId: job.id, relativePath: relative, sha256: stable.sha256 }); stats.pending += 1;
  stats.processed += 1; stats.currentFile = ''; stats.currentProgress = 0; updateFolderProgress(stats);
  await saveState();
  return { unchanged: false, uploaded: true };
}
async function backupFile(root, filePath, relative) {
  const stable = await readStableFile(filePath);
  if (!stable) return { unchanged: false, skipped: true };
  const stats = getFolderStats(root);
  if (state.files[relative] && state.files[relative].sha256 === stable.sha256 && state.files[relative].size === stable.size) {
    state.unchanged += 1;
    stats.unchanged += 1;
    stats.processed += 1;
    stats.currentFile = '';
    stats.currentProgress = 0;
    updateFolderProgress(stats);
    return { unchanged: true, uploaded: false };
  }

  if (LOCAL_CLOUD_API) return backupFileLocal(root, filePath, relative, stable, stats);
  state.current = relative;
  const previous = state.uploads[relative];
  const reusable = previous && previous.sha256 === stable.sha256 && previous.size === stable.size;
  const transferId = reusable && previous.transferId ? previous.transferId : crypto.randomBytes(12).toString('base64url');
  const storagePath = auth.userId + '/' + transferId + '.bin';
  stats.currentFile = relative;
  state.currentFile = relative;
  state.stage = 'Subiendo archivo: ' + relative;
  stats.status = 'Subiendo';
  const chunkCheckpoints = reusable && Array.isArray(previous.parts) ? [...previous.parts] : [];
  const checkpointPart = async (index, info, partPath) => {
    chunkCheckpoints[index] = { ...info, storagePath: partPath };
    state.uploads[relative] = { parts: [...chunkCheckpoints], sha256: stable.sha256, size: stable.size, transferId, storagePath };
    await saveState();
  };
  const onProgress = (sent, total) => {
    stats.currentProgress = total ? Math.round((sent / total) * 100) : 0;
    updateFolderProgress(stats);
    state.currentProgress = stats.currentProgress;
  };

  let stagedParts = [];
  if (stable.size > STAGING_OBJECT_MAX_BYTES) {
    const partCount = Math.ceil(stable.size / STAGING_OBJECT_MAX_BYTES);
    let completedBytes = 0;
    for (let index = 0; index < partCount; index += 1) {
      const sourceOffset = index * STAGING_OBJECT_MAX_BYTES;
      const partSize = Math.min(STAGING_OBJECT_MAX_BYTES, stable.size - sourceOffset);
      const partPath = auth.userId + '/' + transferId + '-' + String(index).padStart(6, '0') + '.part';
      const saved = chunkCheckpoints[index]?.storagePath === partPath ? chunkCheckpoints[index] : {};
      await uploadToStaging(filePath, partSize, partPath, 'application/octet-stream', saved,
        (info) => checkpointPart(index, info, partPath),
        (sent) => onProgress(completedBytes + sent, stable.size),
        sourceOffset);
      stagedParts.push({ storage_path: partPath, size: partSize });
      completedBytes += partSize;
    }
  } else {
    await uploadToStaging(filePath, stable.size, storagePath, 'application/octet-stream', reusable ? previous : {}, async (info) => {
      state.uploads[relative] = { ...info, sha256: stable.sha256, size: stable.size, transferId, storagePath };
      await saveState();
    }, onProgress);
  }

  const uploadPayload = {
    relative_path: relative,
    size: stable.size,
    sha256: stable.sha256,
    mime_type: 'application/octet-stream',
    transfer_id: transferId,
  };
  if (stagedParts.length) uploadPayload.parts = stagedParts;
  else uploadPayload.storage_path = storagePath;
  const result = await callFunction('cloud-backup-upload', 'POST', uploadPayload);
  delete state.uploads[relative];
  state.files[relative] = { size: stable.size, mtimeMs: stable.mtimeMs, sha256: stable.sha256, lastSeen: Date.now() };
  stats.uploaded += 1;
  state.uploaded += 1;
  if (result.pending && result.jobId) {
    state.pending.push({ jobId: result.jobId, relativePath: relative, sha256: stable.sha256 });
    stats.pending += 1;
  }
  stats.processed += 1;
  stats.currentFile = '';
  stats.currentProgress = 0;
  updateFolderProgress(stats);
  await saveState();
  return { unchanged: false, uploaded: true };
}
function fileReadErrorMessage(err) {
  if (err && (err.code === 'EACCES' || err.code === 'EPERM')) {
    return 'Windows denegÃ³ la lectura del archivo. Revisa sus permisos.';
  }
  return err && err.message ? err.message : 'No se pudo leer el archivo.';
}

async function processOneFile(root, filePath, priority = false) {
  const stats = getFolderStats(root);
  const candidateRelative = relativePath(root, filePath);
  state.currentFile = candidateRelative;
  stats.currentFile = candidateRelative;
  state.stage = 'Leyendo archivo: ' + candidateRelative;

  let info;
  try {
    info = await fsp.stat(filePath);
  } catch (err) {
    stats.checked += 1;
    state.checked += 1;
    stats.processed += 1;
    if (err.code !== 'ENOENT') {
      state.errors += 1;
      stats.errors += 1;
      stats.status = 'Error';
      state.lastError = relativePath(root, filePath) + ': ' + fileReadErrorMessage(err);
    }
    updateFolderProgress(stats);
    state.currentFile = ''; 
    stats.currentFile = ''; 
    return;
  }

  stats.checked += 1;
  state.checked += 1;
  if (!info.isFile()) {
    stats.processed += 1;
    updateFolderProgress(stats);
    state.currentFile = ''; 
    stats.currentFile = ''; 
    return;
  }

  const relative = candidateRelative;
  if (isBlocked(relative)) {
    state.blocked += 1;
    stats.processed += 1;
    stats.status = 'Bloqueado';
    updateFolderProgress(stats);
    state.currentFile = ''; 
    stats.currentFile = ''; 
    return;
  }

  try {
    await backupFile(root, filePath, relative);
  } catch (err) {
    state.errors += 1;
    stats.errors += 1;
    stats.processed += 1;
    stats.status = 'Error';
    state.lastError = relative + ': ' + fileReadErrorMessage(err);
    state.currentFile = '';
    stats.currentFile = '';
    stats.currentProgress = 0;
    updateFolderProgress(stats);
  }
}
async function processPriorityChanges() {
  if (state.running || !auth.refreshToken || !pendingChanges.size) return;
  state.running = true;
  state.lastRun = new Date().toISOString();
  state.lastError = '';
  state.current = '';
  state.currentFolder = '';
  state.currentFile = '';
  state.currentProgress = 0;
  const changes = [...pendingChanges.entries()];
  pendingChanges.clear();
  const touched = new Set();

  try {
    state.stage = 'Autenticando';
    await ensureSession();
    await refreshTombstones();
    state.stage = 'Consultando pendientes';
    await pollPendingJobs();

    for (const [candidate, root] of changes) {
      touched.add(root);
      const stats = getFolderStats(root);
      stats.status = 'Revisando';
      state.currentFolder = root;
      state.stage = 'Leyendo carpeta: ' + stats.name;
      let info;
      try { info = await fsp.stat(candidate); } catch { continue; }
      const files = info.isDirectory() ? await listFilesRecursive(candidate) : [candidate];
      for (const filePath of files) await processOneFile(root, filePath, true);
      if (stats.status !== 'Error' && stats.status !== 'Bloqueado') stats.status = 'Completado';
      stats.currentFile = '';
      stats.currentProgress = 0;
      updateFolderProgress(stats);
    }

    for (const root of touched) await refreshCloudCount(root, true);
    for (const root of [...new Set(config.folders)]) await refreshCloudCount(root, true);
    state.lastSuccess = new Date().toISOString();
    await saveState();
  } catch (err) {
    state.lastError = err.message;
    state.errors += 1;
    for (const root of [...new Set(config.folders)]) {
      const stats = getFolderStats(root);
      if (stats.status === 'Revisando') stats.status = 'Error';
    }
  } finally {
    state.current = '';
    state.currentFolder = '';
    state.currentFile = '';
    state.currentProgress = 0;
    state.stage = '';
    state.running = false;
    lastAutomaticPassFinishedAt = Date.now();
    if (pendingChanges.size) schedulePrioritySync();
  }
}

async function processQueuedChangesForFolder(root) {
  const queued = [...pendingChanges.entries()].filter(([, queuedRoot]) => queuedRoot === root);
  for (const [candidate] of queued) {
    pendingChanges.delete(candidate);
    let info;
    try { info = await fsp.stat(candidate); } catch { continue; }
    const files = info.isDirectory() ? await listFilesRecursive(candidate) : [candidate];
    for (const filePath of files) await processOneFile(root, filePath, true);
  }
}
async function syncNow() {
  if (state.running) return;
  state.running = true;
  state.lastRun = new Date().toISOString();
  state.lastError = '';
  state.checked = 0;
  state.uploaded = 0;
  state.unchanged = 0;
  state.blocked = 0;
  state.current = '';
  state.currentFolder = '';
  state.currentFile = '';
  state.currentProgress = 0;
  try {
    state.stage = 'Preparando analisis';
    state.folderStats = {};
    for (const root of [...new Set(config.folders)]) {
      const stats = getFolderStats(root);
      stats.status = 'Esperando';
    }
    pendingChanges.clear();
    state.stage = 'Autenticando';
    await ensureSession();
    await refreshTombstones();
    state.stage = 'Consultando pendientes';
    await pollPendingJobs();
    state.stage = 'Leyendo carpetas';
    for (const root of [...new Set(config.folders)]) {
      const stats = getFolderStats(root);
      stats.status = 'Revisando';
      state.currentFolder = root;
      state.stage = 'Leyendo carpeta: ' + stats.name;
      let statInfo;
      try { statInfo = await fsp.stat(root); } catch {
        stats.status = 'Error';
        stats.errors += 1;
        state.errors += 1;
        state.lastError = 'La carpeta local ya no estÃ¡ disponible: ' + root;
        continue;
      }
      if (!statInfo.isDirectory()) {
        stats.status = 'Error';
        stats.errors += 1;
        state.errors += 1;
        continue;
      }
      const files = await listFilesRecursive(root);
      stats.totalFiles = files.length;
      updateFolderProgress(stats);
      for (const filePath of files) {
        await processQueuedChangesForFolder(root);
        await processOneFile(root, filePath);
      }
      await processQueuedChangesForFolder(root);
      if (stats.status !== 'Error' && stats.status !== 'Bloqueado') stats.status = 'Completado';
      stats.currentFile = '';
      stats.currentProgress = 0;
      updateFolderProgress(stats);
    }
    for (const root of [...new Set(config.folders)]) await refreshCloudCount(root, true);
    state.lastSuccess = new Date().toISOString();
    await saveState();
  } catch (err) {
    state.lastError = err.message;
    state.errors += 1;
    for (const root of [...new Set(config.folders)]) {
      const stats = getFolderStats(root);
      if (stats.status === 'Revisando') stats.status = 'Error';
    }
  } finally {
    state.current = '';
    state.currentFolder = '';
    state.currentFile = '';
    state.currentProgress = 0;
    state.stage = '';
    state.running = false;
    lastAutomaticPassFinishedAt = Date.now();
    if (pendingChanges.size) schedulePrioritySync();
  }
}
function publicStatus() {
  return {
    authenticated: Boolean(LOCAL_CLOUD_API ? auth.cloudToken && Date.now() < auth.cloudTokenExpiresAt : auth.refreshToken),
    backend: LOCAL_CLOUD_API ? "debian-local" : "supabase",
    email: config.email || '',
    folders: config.folders.map((root) => ({
      path: root,
      name: path.basename(path.resolve(root)) || root,
      folderId: folderMetaFor(root).folderId || '',
      cloudName: cloudFolderName(root),
      markerWritten: Boolean(folderMetaFor(root).markerWritten),
      ...(state.folderStats[root] || { status: state.running ? 'Esperando' : 'Sin actividad', checked: 0, uploaded: 0, unchanged: 0, pending: 0, errors: 0, processed: 0, totalFiles: 0, cloudFiles: null, cloudCountError: '', progress: 0, currentFile: '', currentProgress: 0 }),
    })),
    running: state.running,
    current: state.current,
    currentFile: state.currentFile || state.current,
    currentFolderName: state.currentFolder ? path.basename(path.resolve(state.currentFolder)) : '',
    currentProgress: state.currentProgress,
    stage: state.stage,
    lastRun: state.lastRun,
    lastSuccess: state.lastSuccess,
    lastError: state.lastError,
    checked: state.checked,
    uploaded: state.uploaded,
    unchanged: state.unchanged,
    blocked: state.blocked,
    errors: state.errors,
    pending: state.pending.length,
    tombstones: state.tombstones,
    remoteFolders: state.remoteFolders,
    remoteFoldersError: state.remoteFoldersError,
    dataDir: DATA_DIR,
  };
}
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error('Solicitud demasiado grande.');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

async function configureFolder(selectedPath) {
  const selected = path.resolve(String(selectedPath || ''));
  const info = await fsp.stat(selected).catch(() => null);
  if (!info?.isDirectory()) throw new Error('La ruta seleccionada no es una carpeta vÃ¡lida.');
  const identity = await ensureFolderIdentity(selected);
  const currentName = fallbackCloudName(selected);
  const remote = findRemoteFolder(identity.folderId, currentName);
  config.folders = [...new Set([...config.folders, selected])].sort();
  config.folderMeta[selected] = { ...folderMetaFor(selected), folderId: identity.folderId, cloudName: remote?.cloud_name || folderMetaFor(selected).cloudName || currentName, markerWritten: identity.markerWritten };
  await saveConfig();
  if (auth.cloudToken) { try { await registerBackupFolder(selected); } catch (error) { if (error.status === 409) { config.folders = config.folders.filter((folder) => folder !== selected); delete config.folderMeta[selected]; await saveConfig(); refreshWatchers(); throw error; } state.remoteFoldersError = error.message || 'No se pudo registrar la ruta local.'; } }
  refreshWatchers();
  return { path: selected, folder_id: config.folderMeta[selected].folderId, cloud_name: config.folderMeta[selected].cloudName, marker_written: identity.markerWritten, matched_remote: Boolean(remote) };
}
async function handle(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1:' + PORT);
  try {
    if (req.method === 'GET' && url.pathname === '/assets/phosphor.css') {
      return send(res, 200, await fsp.readFile(path.join(PHOSPHOR_DIR, 'phosphor.css'), 'utf8'), 'text/css; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/assets/Phosphor.woff2') {
      return send(res, 200, await fsp.readFile(path.join(PHOSPHOR_DIR, 'Phosphor.woff2'), null), 'font/woff2');
    }
    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, await fsp.readFile(HTML_FILE, 'utf8'), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, publicStatus());
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const body = await readBody(req);
      return send(res, 200, await login(String(body.email || '').trim(), String(body.password || '')));
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      auth.accessToken = ''; auth.refreshToken = ''; auth.expiresAt = 0; auth.userId = '';
      config.encryptedRefreshToken = ''; config.encryptedCloudToken = ''; config.cloudTokenExpiresAt = 0; auth.cloudToken = ''; auth.cloudTokenExpiresAt = 0; auth.accessToken = ''; auth.refreshToken = ''; await saveConfig(); return send(res, 200, { success: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/select-folder') {
      const selected = await chooseFolder();
      if (!selected) return send(res, 200, { success: true, canceled: true });
      return send(res, 200, { success: true, ...(await configureFolder(selected)) });
    }
    if (req.method === 'POST' && url.pathname === '/api/select-folder-path') {
      const body = await readBody(req);
      return send(res, 200, { success: true, ...(await configureFolder(body.path)) });
    }
    if (req.method === 'POST' && url.pathname === '/api/select-file') {
      const body = await readBody(req);
      const root = path.resolve(String(body.root || ''));
      if (!config.folders.includes(root)) throw new Error('La carpeta seleccionada ya no estÃ¡ configurada para respaldo.');
      const selected = await chooseFile(root);
      if (!selected) return send(res, 200, { success: true, canceled: true });
      const validated = await validateSelectedFile(root, selected);
      const relative = relativePath(root, validated.path);
      if (isBlocked(relative)) {
        return send(res, 409, { success: false, error: 'El archivo estÃ¡ bloqueado porque se eliminÃ³ manualmente desde Cloud. DesbloquÃ©alo antes de volver a respaldarlo.' });
      }
      const stable = await readStableFile(validated.path);
      if (isFileUnchanged(relative, stable)) {
        return send(res, 200, { success: true, unchanged: true, relative, message: 'Archivo sin cambios pendientes' });
      }
      queueFileChange(root, validated.path);
      return send(res, 202, { success: true, queued: true, relative, message: 'Archivo agregado a la prioridad de respaldo' });
    }    if (req.method === 'POST' && url.pathname === '/api/remove-folder') {
      const body = await readBody(req);
      config.folders = config.folders.filter((folder) => folder !== body.path);
      delete config.folderMeta[path.resolve(String(body.path || ''))];
      await saveConfig();
      refreshWatchers();
      return send(res, 200, { success: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/sync') {
      syncNow().catch(() => undefined);
      return send(res, 202, { success: true, message: 'Escaneo iniciado.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/unblock') {
      const body = await readBody(req);
      const pathValue = String(body.relative_path || '');
      if (!pathValue || !isBlocked(pathValue)) throw new Error('Ese archivo no estÃ¡ bloqueado.');
      const result = LOCAL_CLOUD_API
        ? await (await localRequest('/api/tombstones?path=' + encodeURIComponent(pathValue) + '&confirm=yes', { method: 'DELETE' })).json()
        : await callFunction('cloud-backup-unblock', 'POST', { relative_path: pathValue });
      await refreshTombstones();
      return send(res, 200, result);
    }
    return send(res, 404, { success: false, error: 'Ruta no encontrada.' });
  } catch (err) {
    return send(res, Number(err.status || 500), { success: false, error: err.message || 'Error interno.' });
  }
}

async function main() {
  await loadLocalState();
  await ensureConfiguredFolderIdentities();
  refreshWatchers();
  http.createServer(handle).listen(PORT, '127.0.0.1', () => {
    console.log('MysAuth Cloud Backup local UI: http://127.0.0.1:' + PORT);
  });
  if (auth.refreshToken && config.folders.length) syncNow().catch(() => undefined);
  const schedulerCheckMs = Math.max(10000, Number(config.intervalMs) || 30000);
  const fullScanCooldownMs = Math.max(5 * 60 * 1000, Number(config.intervalMs) || 30000);
  setInterval(() => {
    if (!auth.refreshToken || !config.folders.length || state.running) return;
    const lastFinishedAt = lastAutomaticPassFinishedAt || Date.parse(state.lastSuccess || "") || 0;
    if (!lastFinishedAt || Date.now() - lastFinishedAt >= fullScanCooldownMs) syncNow().catch(() => undefined);
  }, schedulerCheckMs);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });








