/**
 * ================================================================
 *  HIDDEN ROOM / MYSAUTH - Dashboard Controller
 *  portal/dashboard.js
 * ================================================================
 *  Architecture: lightweight SPA router over a static HTML shell.
 *  No framework. No build step. Vanilla ES modules.
 *
 *  Responsibilities:
 *    1. Session bootstrap (Supabase auth)
 *    2. Role-composable sidebar gating  <- cumulative hierarchy
 *    3. Client-side section router (hash-free, state-driven)
 *    4. Per-module render functions (one per section)
 *    5. Notification + toast system
 *    6. Global state object  <- single source of truth
 * ================================================================
 */

import { cloudSourceToFile, createCloudSourcePicker, joinCloudPath, walkCloudSource } from "../assets/js/cloud-source-picker.js?v=20261026-cloud-picker-lock-v1";
import { getHrDisclosureState, renderHrDisclosure } from "../assets/js/hr-disclosure.js?v=20261028-hr-disclosure-v2";
import { initProfileAvatarEditor, resolveProfileAvatarUrl } from "../assets/js/profile-avatar-editor.js?v=20261030-profile-avatar-editor-v1";

'use strict';


/* ================================================================
   Section 1  SUPABASE CLIENT
================================================================ */

const SUPABASE_URL = "https://rpcunbkstadgngqrjafp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7v_FIgTjWjJgtT1YHIAYSw_bRBmQjZO";
const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const SUPABASE_AUTH_OPTIONS = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
};

async function getSupabaseClient() {
  if (window.HiddenRoomSupabase?.getClient) {
    return window.HiddenRoomSupabase.getClient();
  }

  if (window.__hiddenRoomSupabaseClient) {
    return window.__hiddenRoomSupabaseClient;
  }

  if (!window.__hiddenRoomSupabaseClientPromise) {
    window.__hiddenRoomSupabaseClientPromise = import(SUPABASE_CDN).then(({ createClient }) => {
      window.__hiddenRoomSupabaseClient = window.__hiddenRoomSupabaseClient
        || createClient(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_AUTH_OPTIONS);
      return window.__hiddenRoomSupabaseClient;
    });
  }

  return window.__hiddenRoomSupabaseClientPromise;
}

const supabase = await getSupabaseClient();

const PROFILE_UPDATE_WHATSAPP = '5210000000000';
const SHARE_LOGIN_WHATSAPP_FALLBACK = '5210000000000';
const MEMBERSHIP_SUPPORT_WHATSAPP = '5215542881737';
const LOCAL_SCORE_SYNC_KEYS = ['dem00nz_best', 'gol_gana_record'];
const NOTIFICATIONS_ENABLED = true;
const ACTIVE_SECTION_STORAGE_KEY = 'hr_dashboard_active_section';
const ADMIN_TABLE_STORAGE_KEY = 'hr_dashboard_admin_table';
const DASHBOARD_PREFS_STORAGE_KEY = 'hr_dashboard_prefs';
const FINANCE_GOAL_DEFAULTS = { income: 0, profit: 0, hours: 0 };
const MEMBERSHIP_CANONICAL = 'MEMBRESÍA';
const MEMBERSHIP_WEEKLY_COST = 500;
const ERP_TYPE_OPTIONS = ['INGRESO', 'EGRESO'];
const ERP_STATUS_OPTIONS = ['sin apartado', 'apartado', 'saldado'];
const SERVICE_OPTIONS = [
  MEMBERSHIP_CANONICAL,
  'GRABACIÓN',
  'PRODUCCIÓN BÁSICA',
  'PRODUCCIÓN PREMIUM',
  'EP 3 CANCIONES',
  'DISTRIBUCIÓN',
  'PERSONALIZADO',
];
const TRANSACTION_CONCEPT_OPTIONS = [
  MEMBERSHIP_CANONICAL,
  'PAGO',
  'ABONO',
  'APARTADO',
  'SALDO',
  'RENTA DE ESTUDIO',
  'PERSONALIZADO',
];
const EVENT_FINANCE_CONCEPT_OPTIONS = ['VENUE APARTADO', 'VENUE LIQUIDACIÓN', 'FLYER', 'OTRO'];
const CLOUD_HIDDENROOM_URL = 'https://cloud.hiddenroom.mx/';
const CLOUD_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;
const INSTAGRAM_SCRAPER_URL = 'http://127.0.0.1:4317';
const INSTAGRAM_SCRAPER_STORAGE_KEY = 'hr_instagram_scraper_last_result';
const BEAT_STORE_CLOUD_PATH = '/beats_store';
const BEAT_AUDIO_ACCEPT = '.mp3,.wav,.m4a,.aac,.ogg,.flac,.aif,.aiff,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/flac,audio/aiff';
const BEAT_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aif', 'aiff']);
const CLOUD_PREVIEW_AUDIO_EXTENSIONS = new Set([...BEAT_AUDIO_EXTENSIONS, 'oga', 'opus']);

function normalizeCloudPath(path) {
  if (!path || path === '/') return '/';
  let normalized = String(path).replace(/\\/g, '/');
  normalized = normalized.replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized !== '/' && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
}

async function getCloudAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Sesión de Supabase no disponible');
  }
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function cloudApiFetch(url, options = {}) {
  const authHeaders = await getCloudAuthHeaders();
  const headers = { ...authHeaders, ...(options.headers || {}) };
  return fetch(url, { ...options, headers });
}

async function igFunctionFetch(functionName, payload) {
  const response = await cloudApiFetch(`${CLOUD_FUNCTION_BASE}/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null) || {};
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `No se pudo completar la solicitud (${response.status})`);
  }
  return body;
}
async function igAnalyzeCommentsStream(payload) {
  const response = await cloudApiFetch(`${CLOUD_FUNCTION_BASE}/ig-analyze-comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, progress_stream: true }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo completar el analisis (${response.status})`);
  }
  if (!response.body) throw new Error('El navegador no pudo abrir el stream del analisis.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  const consumeLine = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.event === 'error') throw new Error(event.error || 'No se pudo analizar la publicacion.');
    if (event.event === 'complete') result = event.result;
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(consumeLine);
    if (done) break;
  }
  if (buffer.trim()) consumeLine(buffer);
  if (!result?.ok) throw new Error(result?.error || 'El analisis termino sin devolver resultados.');
  return result;
}

async function listCloudFiles(path = state.erpCloud.currentPath) {
  const currentPath = normalizeCloudPath(path);
  const response = await cloudApiFetch(`${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}/api/files?path=${encodeURIComponent(currentPath)}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `No se pudieron obtener los archivos (${response.status})`);
  }

  const body = await response.json().catch(() => null) || {};

  // If a job is pending, return an empty normalized structure and mark pending
  if (body.status === 'pending') {
    return { path: currentPath, folders: [], files: [], pending: true };
  }

  // Support several response shapes: { result: { items: [...] } }, { items: [...] },
  // or already-normalized { path, folders, files }.
  let folders = [];
  let files = [];

  if (Array.isArray(body.folders) || Array.isArray(body.files)) {
    folders = Array.isArray(body.folders) ? body.folders : [];
    files = Array.isArray(body.files) ? body.files : [];
    return { path: body.path || currentPath, folders, files };
  }

  let items = null;
  if (body.result && Array.isArray(body.result.items)) items = body.result.items;
  else if (Array.isArray(body.items)) items = body.items;

  if (Array.isArray(items)) {
    for (const it of items) {
      const type = String(it.type || '').toLowerCase();
      if (type === 'folder' || (it.isDirectory || it.directory)) {
        folders.push(it.name || it.folderName || '');
      } else {
        files.push({
          name: it.name || it.fileName || '',
          type: it.type || it.mimeType || '',
          size: it.size || it.sizeText || '',
          modified: it.modified || it.mtime || '',
          url: it.url || '',
        });
      }
    }
    return { path: currentPath, folders, files };
  }

  // Fallback: return an empty normalized structure
  return { path: currentPath, folders: [], files: [] };
}

async function uploadCloudFile(file, targetPath = state.erpCloud.currentPath) {
  return uploadCloudFileToPath(file, targetPath);
}

async function uploadCloudFileToPath(file, targetPath = '/') {
  if (!file) return null;
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('El archivo esta vacio. Vuelve a exportarlo o elige otro archivo.');
  }
  const currentPath = normalizeCloudPath(targetPath);
  const response = await cloudApiFetch(`${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}/api/upload?path=${encodeURIComponent(currentPath)}`, {
    method: 'POST',
    headers: {
      'X-File-Name': encodeURIComponent(file.name),
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `No se pudo subir el archivo (${response.status})`);
  }

  const payload = await response.json().catch(() => ({}));
  return {
    ...payload,
    targetPath: currentPath,
    fileName: file.name,
    url: cloudUploadResultUrl(payload) || buildCloudFileFallbackUrl(currentPath, file.name),
  };
}

async function createCloudFolder(folderName, basePath = state.erpCloud.currentPath) {
  return createCloudFolderAt(basePath, folderName);
}

async function createCloudFolderAt(basePath, folderName) {
  if (!folderName) return null;
  const response = await cloudApiFetch(`${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}/api/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: normalizeCloudPath(basePath),
      name: folderName.trim(),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const message = error?.error || `No se pudo crear la carpeta (${response.status})`;
    if (response.status === 409 || /exist|existe|already/i.test(message)) return { ok: true, existed: true };
    throw new Error(message);
  }

  return response.json();
}

async function ensureCloudFolderPath(path) {
  const normalized = normalizeCloudPath(path);
  if (normalized === '/') return;
  const segments = normalized.slice(1).split('/').filter(Boolean);
  let current = '/';
  for (const segment of segments) {
    await createCloudFolderAt(current, segment);
    current = normalizeCloudPath(current === '/' ? `/${segment}` : `${current}/${segment}`);
  }
}

function cloudUploadResultUrl(payload) {
  return payload?.url
    || payload?.public_url
    || payload?.publicUrl
    || payload?.file_url
    || payload?.fileUrl
    || payload?.result?.url
    || payload?.result?.public_url
    || payload?.result?.publicUrl
    || null;
}

function buildCloudFileFallbackUrl(path, fileName) {
  const safePath = normalizeCloudPath(path);
  const fullPath = safePath === '/' ? `/${fileName}` : `${safePath}/${fileName}`;
  return `${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}${fullPath.split('/').map(encodeURIComponent).join('/')}`;
}

function buildCloudFolderDownloadUrl(path, folderName) {
  const safePath = normalizeCloudPath(path);
  return CLOUD_HIDDENROOM_URL.replace(/\/$/, '') + '/api/download-folder?path=' + encodeURIComponent(safePath) + '&name=' + encodeURIComponent(String(folderName || '').trim());
}
function buildCloudDownloadUrl(path, fileName) {
  const safePath = normalizeCloudPath(path);
  const safeName = String(fileName || '').trim();
  return `${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}/api/download?path=${encodeURIComponent(safePath)}&name=${encodeURIComponent(safeName)}`;
}

async function deleteCloudFile(itemType, itemName) {
  const currentPath = normalizeCloudPath(state.erpCloud.currentPath);
  const response = await cloudApiFetch(`${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}/api/item?path=${encodeURIComponent(currentPath)}&type=${encodeURIComponent(itemType)}&name=${encodeURIComponent(itemName)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `No se pudo eliminar el elemento (${response.status})`);
  }

  return response.json();
}

function copyCloudLink(url) {
  return url;
}

const FINANCE_STUDIO_SOURCES = [
  { value: 'IXT', label: 'Ixtapaluca' },
  { value: 'VC', label: 'Venustiano Carranza' },
  { value: '003', label: 'Los $antos' },
];
const SESSION_TYPE_OPTIONS = [
  { value: MEMBERSHIP_CANONICAL, label: MEMBERSHIP_CANONICAL, minutes: 120, cost: MEMBERSHIP_WEEKLY_COST },
  { value: 'GRABACIÓN', label: 'GRABACIÓN', minutes: 60, cost: 650 },
  { value: 'SESIÓN BÁSICA', label: 'SESIÓN BÁSICA', minutes: 90, cost: 1700 },
  { value: 'SESIÓN PREMIUM', label: 'SESIÓN PREMIUM', minutes: 150, cost: 3700 },
  { value: 'EP 3 CANCIONES', label: 'EP 3 CANCIONES', minutes: 0, cost: 9850 },
];


/* ================================================================
   Section 2  GLOBAL STATE
================================================================ */

const state = {
  /** @type {Object|null} Full public.users profile merged with auth user */
  user: null,

  /** @type {Object|null} Authenticated administrator kept separate during view-as */
  actualUser: null,

  /** @type {Object|null} Effective view-as context resolved from Supabase */
  viewAs: null,

  /**
   * @type {string[]}
   * Cumulative expanded roles, e.g. ['client','pr','collaborator']
   * Always derived from expandRoles(state.user.roles).
   */
  roles: [],

  /**
   * @type {string[]}
   * Permission keys from user_permissions table,
   * e.g. ['scrum.view', 'accounting.input']
   */
  permissions: [],

  /** Currently active section key */
  activeSection: 'overview',

  /** Active folder in the client downloads library, or null at the root. */
  clientDownloads: {
    selectedFolder: null,
    browser: null,
  },

  /** Fetched data cache, keyed by section */
  data: {},

  /** Notification items */
  notifications: [],

  /** Disabled after Supabase reports public.notifications is not available */
  notificationsAvailable: NOTIFICATIONS_ENABLED,

  /** Whether the sidebar is open on mobile */
  sidebarOpen: false,

  /** Monotonic render guard for async section transitions */
  renderToken: 0,

  /** Session may be stale when UI role and API/RLS responses disagree */
  sessionStale: false,

  /** Active timer for live infrastructure metrics */
  infrastructureRefreshTimer: null,
  erpCloud: {
    currentPath: '/',
  },
  instagramScraper: {
    comments: readInstagramScraperCache().comments,
    sourceUrl: readInstagramScraperCache().sourceUrl,
    expectedCount: readInstagramScraperCache().expectedCount,
    pagesFetched: readInstagramScraperCache().pagesFetched,
    source: readInstagramScraperCache().source,
    stoppedReason: readInstagramScraperCache().stoppedReason,
    isRunning: false,
    isHydrating: false,
    hasHydrated: false,
    error: '',
  },
};

let portalAvatarEditorController = null;

/**
 * Immutable-ish state update.
 * @param {Partial<typeof state>} patch
 */
function setState(patch) {
  Object.assign(state, patch);
  if (Array.isArray(patch.roles)) {
    window.HiddenRoomNavigation?.setAdminLinksVisible(patch.roles.includes("admin"));
  }
}

function getCloudBreadcrumb(path) {
  const normalized = normalizeCloudPath(path);
  if (normalized === '/') return [{ name: 'Root', path: '/' }];
  const segments = normalized.slice(1).split('/');
  const result = [{ name: 'Root', path: '/' }];
  let current = '';
  for (const segment of segments) {
    current = `${current}/${segment}`;
    result.push({ name: segment, path: current });
  }
  return result;
}

function renderCloudBreadcrumb(path) {
  const items = getCloudBreadcrumb(path);
  return `
    <nav aria-label="Ruta actual" class="hr-stack hr-stack-sm">
      ${items.map((item, index) => `
        <button class="hr-btn" type="button" data-action="cloud-breadcrumb" data-path="${escapeHTML(item.path)}">
          ${escapeHTML(item.name)}
        </button>
        ${index < items.length - 1 ? '<span>/</span>' : ''}
      `).join('')}
    </nav>
  `;
}

function renderPortalResourceCard({
  kind = 'file',
  title = '',
  meta = '',
  count = '',
  action = '',
  tag = 'article',
  attributes = '',
} = {}) {
  const resourceKind = kind === 'folder' ? 'folder' : 'file';
  const element = tag === 'button' ? 'button' : 'article';
  const icon = resourceKind === 'folder' ? 'ph-folder-open' : 'ph-file';
  const buttonType = element === 'button' && !/\btype=/.test(attributes) ? ' type="button"' : '';

  return `
    <${element} class="hr-resource-card hr-resource-card--${resourceKind}"${buttonType}${attributes ? ` ${attributes}` : ''}>
      <span class="hr-resource-card__icon" aria-hidden="true"><i class="ph ${icon}"></i></span>
      <span class="hr-resource-card__body">
        <strong class="hr-resource-card__title">${escapeHTML(title)}</strong>
        ${meta ? `<span class="hr-resource-card__meta">${escapeHTML(meta)}</span>` : ''}
      </span>
      ${count ? `<span class="hr-resource-card__count">${escapeHTML(count)}</span>` : ''}
      ${action ? `<span class="hr-resource-card__actions">${action}</span>` : ''}
      ${resourceKind === 'folder' && !action ? '<i class="ph ph-caret-right hr-resource-card__arrow" aria-hidden="true"></i>' : ''}
    </${element}>
  `;
}

function renderCloudFolderList(node, currentPath) {
  const folders = Array.isArray(node && node.folders) ? node.folders : [];
  if (!folders.length) return `<p>No hay carpetas en esta ubicación.</p>`;

  return folders.map((folder) => renderPortalResourceCard({
    kind: 'folder',
    title: folder,
    meta: 'Carpeta',
    action: `
      <button class="hr-btn" type="button" data-action="cloud-open-folder" data-path="${escapeHTML(currentPath === '/' ? `/${folder}` : `${currentPath}/${folder}`)}">Abrir</button>
      <button class="hr-btn" type="button" data-action="cloud-delete-item" data-item-type="folder" data-item-name="${escapeHTML(folder)}">Eliminar</button>
    `,
  })).join('');
}

function renderCloudFileList(node) {
  const files = Array.isArray(node && node.files) ? node.files : [];
  if (!files.length) return `<p>No hay archivos en esta carpeta.</p>`;

  return files.map((file) => renderPortalResourceCard({
    kind: 'file',
    title: file.name,
    meta: `${file.type} · ${file.size} · ${file.modified}`,
    action: `
      <button class="hr-btn" type="button" data-action="cloud-copy-link" data-url="${escapeHTML(file.url)}">Copiar enlace</button>
      <button class="hr-btn" type="button" data-action="cloud-delete-item" data-item-type="file" data-item-name="${escapeHTML(file.name)}">Eliminar</button>
    `,
  })).join('');
}

/* ================================================================
   Section 3  ROLE ENGINE
   -------------------------------------------------------------
   Hierarchy (cumulative, bottom roles inherit all above):
     client = 1
     pr     = 2
     collaborator = 3
     partner = 4
     admin  = 5
================================================================ */

/** Ordered hierarchy - index = level (0-based, lower = less access) */
const ROLE_HIERARCHY = ['client', 'pr', 'collaborator', 'partner', 'admin'];

/**
 * Takes the raw roles string from public.users.roles (e.g. "client,pr" or
 * "collaborator") and returns the full cumulative set of roles the user has.
 *
 * Examples:
 *   expandRoles("admin")       -> ['client','pr','collaborator','partner','admin']
 *   expandRoles("collaborator") -> ['client','pr','collaborator']
 *   expandRoles("client,pr")   -> ['client','pr']   (already cumulative, safe)
 *   expandRoles("client")      -> ['client']
 *
 * @param {string|null|undefined} rawRoles  Value of public.users.roles field
 * @returns {string[]}
 */
function expandRoles(rawRoles) {
  if (!rawRoles) return ['client'];

  // Split in case the field already lists multiple roles
  const parts = rawRoles.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);

  // Find the highest role in the hierarchy
  let maxLevel = -1;
  for (const part of parts) {
    const level = ROLE_HIERARCHY.indexOf(part);
    if (level > maxLevel) maxLevel = level;
  }

  // Fallback to 'client' if nothing matched
  if (maxLevel < 0) maxLevel = 0;

  // Return all roles up to and including the highest
  return ROLE_HIERARCHY.slice(0, maxLevel + 1);
}

/**
 * Returns true if the user has the given role (cumulative - higher roles
 * automatically include all lower ones).
 * @param {string} role
 */
const hasRole = (role) => state.roles.includes(role);

/**
 * Returns true if the user has at least one of the given roles.
 * @param {string[]} roles
 */
const hasAnyRole = (roles) => roles.some(hasRole);

/**
 * Returns true if the user has all of the given roles.
 * @param {string[]} roles
 */
const hasAllRoles = (roles) => roles.every(hasRole);

/**
 * Returns true if the user has the given permission key.
 * Admins always pass every permission check.
 * @param {string} permission
 */
const hasPermission = (permission) =>
  hasRole('admin') || state.permissions.includes(permission);

/**
 * Returns true if the user has at least one of the given permission keys.
 * Admins always pass.
 * @param {string[]} permissions
 */
const hasAnyPermission = (permissions) =>
  hasRole('admin') || permissions.some((p) => state.permissions.includes(p));

/**
 * Returns true when the active user can mutate SCRUM tasks.
 */
const canEditScrum = (event = null) =>
  hasPermission('scrum.edit') && (hasRole('admin') || Boolean(event?.can_edit_scrum));

const canViewScrum = (event = null) =>
  hasAnyPermission(['scrum.view', 'scrum.edit'])
    && (hasRole('admin') || Boolean(event?.can_view_scrum || event?.can_edit_scrum));

/**
 * Shows sidebar nav groups whose data-role-gate the user satisfies.
 * Works with the cumulative role array in state.roles.
 */
function applyRoleGates() {
  const groups = document.querySelectorAll('[data-role-gate]');
  groups.forEach((group) => {
    const requiredRole = group.dataset.roleGate;
    group.hidden = !hasRole(requiredRole);
  });

  const permissionGroups = document.querySelectorAll('[data-permission-gate]');
  permissionGroups.forEach((group) => {
    const requiredPermission = group.dataset.permissionGate;
    group.hidden = !hasPermission(requiredPermission);
  });

  const permissionAnyGroups = document.querySelectorAll('[data-permission-any-gate]');
  permissionAnyGroups.forEach((group) => {
    const requiredPermissions = String(group.dataset.permissionAnyGate || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    group.hidden = !hasAnyPermission(requiredPermissions);
  });
}


/* ================================================================
   Section 4  SECTION REGISTRY
   -------------------------------------------------------------
   Maps section key -> { label, roleRequired, render }
   roleRequired uses the cumulative hasRole() check.
   render() is always treated as async - may return a string or
   a Promise<string>. renderSection() awaits it either way.
================================================================ */

async function renderViewAs() {
  if (!hasRole('admin') || state.viewAs?.active) {
    return sectionShell('Administración', 'Ver como', 'title-view-as', `
      <p class="db-empty db-empty--error">Esta herramienta sólo está disponible en la vista propia del administrador.</p>
    `);
  }

  const users = await ensureUsersLoaded();
  const selectedId = window.HiddenRoomViewAs?.getSelection?.()?.userId || '';
  return sectionShell('Administración', 'Ver como', 'title-view-as', `
    <div class="db-card hr-card db-card--view-as">
      <div class="db-card__inner">
        <p class="db-section__summary">Selecciona un usuario para cargar el sitio con su perfil, roles y permisos reales.</p>
        <p class="db-note">La vista se mantiene en esta sesión del navegador. Las acciones de escritura quedan bloqueadas mientras observas otra cuenta.</p>
        <form data-form="view-as" class="db-inline-form">
          ${renderUserPicker('view_as_user_id', 'Usuario', selectedId, {
            valueField: 'id',
            users,
            limit: USER_PICKER_RENDER_LIMIT,
            placeholder: 'Buscar por nombre, usuario o correo',
            emptyLabel: 'No se encontraron usuarios.',
          })}
          <div class="db-form__actions">
            <button class="btn-primary" type="submit">Cargar vista</button>
            <button class="db-btn-secondary" type="button" data-action="view-as-cancel">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `);
}

const SECTIONS = {

  /* -- CORE -------------------------------------------- */
  overview: {
    label: 'Inicio',
    roleRequired: null,
    render: renderOverview,
  },
  'account-settings': {
    label: 'Ajustes de Cuenta',
    roleRequired: null,
    render: renderAccountSettings,
  },

  /* -- CLIENT ------------------------------------------ */
  'client-downloads': {
    label: 'Descargas',
    roleRequired: 'client',
    render: renderClientDownloads,
  },
  'client-sessions': {
    label: 'Sesiones',
    roleRequired: 'client',
    render: renderClientSessions,
  },
  'client-transactions': {
    label: 'Transacciones',
    roleRequired: 'client',
    render: renderClientTransactions,
  },
  'client-contracts': {
    label: 'Contratos',
    roleRequired: 'client',
    render: renderClientContracts,
  },
  'client-membership': {
    label: 'Membresía',
    roleRequired: 'client',
    render: renderClientMembership,
  },
  'client-tickets': {
    label: 'Tickets de Evento',
    roleRequired: 'client',
    render: renderClientTickets,
  },
  'client-store': {
    label: 'Tienda Online',
    roleRequired: 'client',
    render: renderClientStore,
  },
  'client-rewards': {
    label: 'Premios',
    roleRequired: 'client',
    render: renderClientRewards,
  },

  /* -- COLLABORATOR ------------------------------------- */
  'collab-docs': {
    label: 'Documentos/Contratos',
    roleRequired: 'collaborator',
    render: renderCollabDocs,
  },
  'collab-finance': {
    label: 'Financiero',
    roleRequired: 'collaborator',
    render: renderCollabFinance,
  },
  'collab-tasks': {
    label: 'SCRUM / Tareas',
    roleRequired: 'collaborator',
    permissionAnyRequired: ['scrum.view', 'scrum.edit'],
    render: renderCollabTasks,
  },
  'collab-log': {
    label: 'Log de Actividad',
    roleRequired: 'collaborator',
    render: renderCollabLog,
  },

  /* -- RRPP (pr role) ----------------------------------- */
  'rrpp-contacts': {
    label: 'Boletos vendidos',
    roleRequired: 'pr',
    render: renderRrppContacts,
  },
  'rrpp-invitations': {
    label: 'Invitaciones',
    roleRequired: 'pr',
    render: renderRrppInvitations,
  },
  'rrpp-campaigns': {
    label: 'Campañas',
    roleRequired: 'pr',
    render: renderRrppCampaigns,
  },
  'rrpp-guestlist': {
    label: 'Lista de invitados',
    roleRequired: 'pr',
    render: renderRrppGuestlist,
  },
  'rrpp-benefits': {
    label: 'Beneficios',
    roleRequired: 'pr',
    render: renderRrppBenefits,
  },
  'rrpp-scrum': {
    label: 'SCRUM / Tareas',
    roleRequired: 'pr',
    permissionAnyRequired: ['scrum.view', 'scrum.edit'],
    render: () => renderCollabTasks('Embajador'),
  },

  /* -- ERP / ADMIN -------------------------------------- */
  'erp-finance': {
    label: 'Finanzas',
    roleRequired: 'admin',
    render: renderErpFinance,
  },
  'erp-ops': {
    label: 'Operaciones',
    roleRequired: 'admin',
    render: renderErpOps,
  },
  'erp-csv-upload': {
    label: 'Subir CSV',
    permissionAnyRequired: ['erp.finance.input', 'erp.ops.input'],
    render: renderErpCsvUpload,
  },
  'erp-permissions': {
    label: 'Permisos',
    roleRequired: 'admin',
    render: renderErpPermissions,
  },
  'view-as': {
    label: 'Ver como',
    roleRequired: 'admin',
    render: renderViewAs,
  },
  'erp-auth-audit': {
    label: 'Auth / Registros',
    roleRequired: 'admin',
    render: renderErpAuthAudit,
  },
  'erp-infrastructure': {
    label: 'Servidor Mysauth',
    roleRequired: 'admin',
    render: renderErpInfrastructure,
  },
  'erp-cloud': {
    label: 'Cloud Hidden Room',
    roleRequired: 'admin',
    render: renderErpCloud,
  },
  'erp-ig-mention-rank': {
    label: 'Instagram Mention Rank',
    roleRequired: 'admin',
    render: renderErpInstagramMentionRank,
  },
  'erp-ig-benefits-audit': {
    label: 'IG Beneficios',
    roleRequired: 'admin',
    render: renderErpIgBenefitsAudit,
  },
  'erp-instagram-scraper': {
    label: 'Instagram Comments Scraper',
    roleRequired: 'admin',
    render: renderErpInstagramScraper,
  },
  'admin-table-editor': {
    label: 'BB.DD',
    roleRequired: 'admin',
    render: renderAdminTableEditor,
  },
};

const PORTAL_NAV_GROUPS = [
  {
    key: 'system',
    title: 'Sistema',
    items: [
      { label: 'Inicio', section: 'overview', icon: 'grid' },
    ],
  },
  {
    key: 'client',
    title: 'Cliente',
    role: 'client',
    items: [
      { label: 'Membresía', section: 'client-membership', icon: 'star' },
      { label: 'Descargas', section: 'client-downloads', icon: 'download' },
      { label: 'Transacciones', section: 'client-transactions', icon: 'receipt' },
      { label: 'Premios', section: 'client-rewards', icon: 'gift' },
      { label: 'Sesiones', section: 'client-sessions', icon: 'calendar' },
      { label: 'Contratos', section: 'client-contracts', icon: 'doc' },
      { label: 'Tickets', section: 'client-tickets', icon: 'ticket' },
      { label: 'Tienda', section: 'client-store', icon: 'bag' },
      { label: 'Minijuegos', action: 'minigames', icon: 'grid' },
    ],
  },
  {
    key: 'collaborator',
    title: 'Colaborador',
    role: 'collaborator',
    items: [
      { label: 'Documentos/Contratos', section: 'collab-docs', icon: 'folder' },
      { label: 'Financiero', section: 'collab-finance', icon: 'receipt' },
      { label: 'SCRUM / Tareas', section: 'collab-tasks', icon: 'check', permissionAny: ['scrum.view', 'scrum.edit'] },
      { label: 'Actividad', section: 'collab-log', icon: 'activity' },
      { label: 'Boletera', href: '../tickets/', icon: 'ticket' },
    ],
  },
  {
    key: 'rrpp',
    title: 'Embajador / RRPP',
    role: 'pr',
    items: [
      { label: 'Boletos vendidos', section: 'rrpp-contacts', icon: 'users' },
      { label: 'Invitaciones', section: 'rrpp-invitations', icon: 'mail' },
      { label: 'Campañas', section: 'rrpp-campaigns', icon: 'broadcast' },
      { label: 'Lista de invitados', section: 'rrpp-guestlist', icon: 'list' },
      { label: 'Beneficios', section: 'rrpp-benefits', icon: 'gift' },
      { label: 'SCRUM / Tareas', section: 'rrpp-scrum', icon: 'check', permissionAny: ['scrum.view', 'scrum.edit'] },
    ],
  },
  {
    key: 'media',
    title: 'Media',
    permission: 'media.posts',
    items: [
      { label: 'Publicaciones', href: '../media/admin.html?view=posts', icon: 'doc' },
      { label: 'Crear publicación', href: '../media/admin.html?view=editor', icon: 'activity' },
      { label: 'Borradores', href: '../media/admin.html?view=drafts', icon: 'folder' },
    ],
  },
  {
    key: 'erp',
    title: 'ERP / Operaciones',
    permissionAny: ['erp.finance.input', 'erp.ops.input'],
    items: [
      { label: 'Finanzas', section: 'erp-finance', icon: 'chart' },
      { label: 'Operaciones', section: 'erp-ops', icon: 'settings' },
      { label: 'Subir CSV', section: 'erp-csv-upload', icon: 'doc' },
      { label: 'Permisos', section: 'erp-permissions', icon: 'users' },
      { label: 'Auth / Registros', section: 'erp-auth-audit', icon: 'activity' },
      { label: 'Servidor Mysauth', section: 'erp-infrastructure', icon: 'server' },
      { label: 'Cloud Hidden Room', section: 'erp-cloud', icon: 'cloud' },
      { label: 'Instagram Mention Rank', section: 'erp-ig-mention-rank', icon: 'chart' },
      { label: 'IG Beneficios', section: 'erp-ig-benefits-audit', icon: 'gift' },
      { label: 'Instagram Comments Scraper', section: 'erp-instagram-scraper', icon: 'activity' },
      { label: 'Boletera', href: '../tickets/', icon: 'ticket' },
      { label: 'BB.DD', section: 'admin-table-editor', icon: 'settings' },
    ],
  },
  {
    key: 'administration',
    title: 'Administración',
    role: 'admin',
    items: [
      { label: 'Ver como', section: 'view-as', icon: 'users' },
    ],
  },
  {
    key: 'account',
    title: 'Cuenta',
    items: [
      { label: 'Perfil', action: 'profile', icon: 'users' },
      { label: 'Ajustes', section: 'account-settings', icon: 'settings' },
      { label: 'Cerrar sesión', action: 'logout', icon: 'settings', danger: true },
    ],
  },
];

const SCRUM_COLUMNS = [
  { key: 'todo', label: 'Todo' },
  { key: 'in_progress', label: 'En progreso' },
  { key: 'review', label: 'Revision' },
  { key: 'done', label: 'Hecho' },
];

const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const AVAILABLE_ROLES = ['client', 'pr', 'collaborator', 'partner', 'admin'];
const SECTION_LOADING_MIN_MS = 300;
const CLIENT_HOME_PREFS_PREFIX = 'hr_dashboard_client_home_v1_';
const CLIENT_HOME_SECTIONS = [
  {
    section: 'client-membership',
    label: 'Membresía',
    icon: 'star',
    defaultScore: 40,
    noveltyTerms: ['membres', 'ciclo', 'sesion', 'sesión'],
  },
  {
    section: 'client-downloads',
    label: 'Descargas',
    icon: 'download',
    defaultScore: 30,
    noveltyTerms: ['descarg', 'contenido', 'archivo', 'material'],
  },
  {
    section: 'client-transactions',
    label: 'Transacciones',
    icon: 'receipt',
    defaultScore: 20,
    noveltyTerms: ['transacc', 'pago', 'abono', 'saldo'],
  },
  {
    section: 'client-rewards',
    label: 'Premios',
    icon: 'gift',
    defaultScore: 10,
    noveltyTerms: ['premio', 'recompensa', 'punto', 'ranking'],
  },
];
const CLIENT_HOME_SECTION_KEYS = new Set(CLIENT_HOME_SECTIONS.map((item) => item.section));
const SUGGESTED_PERMISSIONS = [
  'Kairen AI',
  'cloud.upload',
  'beats.upload',
  'media.posts',
  'scrum.view',
  'scrum.edit',
  'erp.finance.input',
  'erp.ops.input',
  'rrpp.manage',
  'events.access',
  'tickets.view',
  'tickets.edit',
  'tickets.validate',
];

const EVENT_PERMISSION_FLAGS = [
  ['can_view', 'Ver Evento'],
  ['can_add_finance', 'Capturar Finanzas'],
  ['can_view_scrum', 'SCRUM View'],
  ['can_edit_scrum', 'Editar SCRUM'],
];

const EVENT_MOVEMENT_TYPES = [
  { value: 'income', label: 'Ingreso', sign: 1, legacyType: 'INGRESO' },
  { value: 'expense', label: 'Egreso', sign: -1, legacyType: 'EGRESO' },
  { value: 'investment_in', label: 'Inversión ingresada', sign: 1, legacyType: 'INVERSION INGRESADA' },
  { value: 'investment_return', label: 'Utilidad devuelta', sign: -1, legacyType: 'UTILIDAD DEVUELTA' },
  { value: 'counterparty_transfer', label: 'Entrega a favor', sign: 1, legacyType: 'ENTREGA A FAVOR' },
  { value: 'internal_absorption', label: 'Absorción interna', sign: 1, legacyType: 'ABSORCION INTERNA' },
  { value: 'adjustment', label: 'Ajuste', sign: 1, legacyType: 'AJUSTE' },
];

const EVENT_STATUS_OPTIONS = ['draft', 'active', 'closed', 'cancelled'];

const ADMIN_TABLE_FETCH_SIZE = 200;
const ADMIN_TABLE_INITIAL_ROW_LIMIT = 200;
const ADMIN_TABLE_RENDER_LIMIT = 200;
const USER_PICKER_RENDER_LIMIT = 120;
const ADMIN_TABLE_REMOTE_SEARCH_MIN_CHARS = 2;

const ADMIN_TABLE_SUMMARY_COLUMN_GROUPS = [
  ['type', 'movement_type', 'category', 'entity_type', 'role', 'status', 'release_mode'],
  ['username', 'display_name', 'email', 'user_id', 'from_user_id', 'to_user_id', 'owner_user_id'],
  ['date', 'movement_date', 'session_date', 'created_at', 'fecha_de_sesion', 'fecha_de_saldo', 'delivered_at', 'start_date', 'end_date', 'updated_at'],
  ['amount', 'price', 'cost', 'stock', 'quantity', 'weekly_price', 'saldo', 'participation_percent', 'sessions_per_week', 'membership_cycle_number'],
  ['hour', 'sc_end', 'time'],
];

const TABLE_EDITOR_CONFIG = {
  users: {
    label: 'Usuarios',
    primaryKey: 'id',
    select: 'id, user_id, display_name, email, whatsapp, avatar_url, username, occupations, ig_username, passline_tracking, roles, has_auth, old_id, temp_password',
    lockedFields: ['id', 'user_id', 'roles', 'has_auth', 'old_id', 'temp_password'],
    editableFields: ['user_id', 'display_name', 'email', 'whatsapp', 'avatar_url', 'username', 'occupations', 'ig_username', 'passline_tracking'],
    hiddenColumns: ['id', 'old_id', 'temp_password'],
    summaryFields: ['user_id', 'display_name', 'email', 'whatsapp', 'username', 'ig_username', 'passline_tracking', 'roles', 'has_auth'],
    pdfColumns: ['user_id', 'display_name', 'email', 'whatsapp', 'username', 'occupations', 'ig_username', 'passline_tracking', 'roles', 'has_auth'],
    pdfColumnLabels: {
      user_id: 'User ID',
      display_name: 'Nombre',
      email: 'Email',
      whatsapp: 'WhatsApp',
      username: 'Username',
      occupations: 'Ocupaciones',
      ig_username: 'Instagram',
      passline_tracking: 'Passline tracking',
      roles: 'Roles',
      has_auth: 'Auth',
    },
  },
  transactions: {
    label: 'Transacciones',
    primaryKey: 'id',
    select: 'id, user_id, type, concept, service, date, amount, via, username, id_trans, notes',
    defaultSort: { field: 'date', direction: 'desc' },
    lockedFields: ['id'],
    editableFields: ['user_id', 'type', 'concept', 'service', 'date', 'amount', 'via', 'username', 'id_trans', 'notes'],
    hiddenColumns: ['id'],
  },
  hr_transactions: {
    label: 'hr_transactions',
    primaryKey: 'id',
    select: 'id, event_id, event_key, movement_type, concept, amount, hidden_room_share, from_user_id, to_user_id, owner_user_id, owner_entity_id, payment_method, movement_date, notes, user_id, username, created_by_user_id, type, via, date',
    defaultSort: { field: 'movement_date', direction: 'desc' },
    lockedFields: ['id', 'created_by_user_id'],
    editableFields: ['event_id', 'event_key', 'movement_type', 'concept', 'amount', 'hidden_room_share', 'from_user_id', 'to_user_id', 'owner_user_id', 'owner_entity_id', 'payment_method', 'movement_date', 'notes', 'user_id', 'username', 'type', 'via', 'date'],
    hiddenColumns: ['id'],
  },
  sessions: {
    label: 'Sesiones',
    primaryKey: 'id',
    select: 'id, session_date, concept, user_id, status, type, notes, username, hour, sc_end, cost, promo',
    defaultSort: { field: 'session_date', direction: 'desc' },
    lockedFields: ['id'],
    editableFields: ['session_date', 'concept', 'user_id', 'status', 'type', 'notes', 'username', 'hour', 'sc_end', 'cost', 'promo'],
    hiddenColumns: ['id'],
  },
  scores: {
    label: 'Puntuaciones',
    primaryKey: 'id',
    select: 'id, created_at, game_id, user_id, username, type, amount',
    defaultSort: { field: 'created_at', direction: 'desc' },
    lockedFields: ['id', 'created_at'],
    editableFields: ['game_id', 'user_id', 'username', 'type', 'amount'],
    hiddenColumns: ['id'],
  },
  downloads: {
    label: 'Descargas',
    primaryKey: 'id',
    select: 'id, user_id, name, storage_path, notes, type, release_mode, membership_id, membership_delivery_id, membership_cycle_number',
    lockedFields: ['id'],
    editableFields: ['user_id', 'name', 'storage_path', 'notes', 'type', 'release_mode', 'membership_id', 'membership_delivery_id', 'membership_cycle_number'],
    hiddenColumns: ['id'],
    summaryFields: ['user_id', 'name', 'type', 'release_mode', 'notes'],
    pdfColumns: ['user_id', 'name', 'type', 'release_mode', 'notes'],
    pdfColumnLabels: {
      user_id: 'Usuario',
      name: 'Producto',
      type: 'Formato',
      release_mode: 'Origen',
      notes: 'Notas',
    },
  },
  store_products: {
    label: 'Beats a la venta',
    primaryKey: 'id',
    select: 'id, slug, name, description, category, price, currency, image_url, file_url, producer, stock, is_digital, is_active, featured, stripe_price_id, created_at, updated_at',
    defaultSort: { field: 'created_at', direction: 'desc' },
    lockedFields: ['id', 'created_at', 'updated_at'],
    editableFields: ['slug', 'name', 'description', 'category', 'price', 'currency', 'image_url', 'file_url', 'producer', 'stock', 'is_digital', 'is_active', 'featured', 'stripe_price_id'],
    hiddenColumns: ['id', 'updated_at'],
    rowFilter: (row) => String(row.category ?? '').toLowerCase() === 'beats',
    pdfColumnLabels: {
      category: 'tipo',
      created_at: 'fecha',
      price: 'cantidad',
      producer: 'productor',
    },
  },
  rewards: {
    label: 'Recompensas',
    primaryKey: 'id',
    select: 'id, user_id, concept',
    lockedFields: ['id'],
    editableFields: ['user_id', 'concept'],
    hiddenColumns: ['id'],
  },
  ig_contest: {
    label: 'IG Contest',
    primaryKey: 'id',
    select: 'id, concepto, user_id, ig_username, created_at',
    defaultSort: { field: 'created_at', direction: 'desc' },
    lockedFields: ['id', 'user_id', 'created_at'],
    editableFields: ['concepto', 'ig_username'],
    hiddenColumns: ['id'],
    summaryFields: ['concepto', 'ig_username', 'user_id', 'created_at'],
    pdfColumns: ['concepto', 'ig_username', 'user_id', 'created_at'],
    pdfColumnLabels: {
      concepto: 'Concepto',
      ig_username: 'Instagram',
      user_id: 'User ID',
      created_at: 'Creado',
    },
  },
  membership_dashboard: {
    label: 'Membresia',
    primaryKey: null,
    select: 'user_id, username, semana, fecha_de_sesion, estado, fecha_de_saldo, saldo, notas',
    defaultSort: { field: 'fecha_esperada', direction: 'desc' },
    lockedFields: ['user_id', 'username', 'display_name', 'email', 'semana', 'periodo', 'fecha_esperada', 'week_end', 'fecha_de_sesion', 'sesiones_usadas', 'estado', 'estado_operativo', 'fecha_de_saldo', 'saldo', 'notas', 'material_estimated_delivery', 'material_delivery_delay_weeks', 'material_delivery_delay_label', 'material_delivery_status'],
    editableFields: [],
    hiddenColumns: ['membership_id', 'display_name', 'email'],
    readOnly: true,
    pdfColumnLabels: {
      user_id: 'User ID',
      username: 'Username',
      semana: 'Semana',
      periodo: 'Periodo',
      fecha_esperada: 'Fecha esperada',
      week_end: 'Corte de pago',
      fecha_de_sesion: 'Fecha de sesion',
      sesiones_usadas: 'Sesiones usadas',
      estado: 'Estado',
      estado_operativo: 'Membresia',
      fecha_de_saldo: 'Fecha de saldo',
      saldo: 'Adeudo / crédito',
      notas: 'Notas',
      material_estimated_delivery: 'Entrega programada',
      material_delivery_delay_weeks: 'Atraso entrega',
      material_delivery_delay_label: 'Atraso entrega',
      material_delivery_status: 'Estado entrega',
    },
  },
  memberships: {
    label: 'Membresias',
    primaryKey: 'id',
    select: 'id, user_id, username, status, start_date, end_date, weekly_price, sessions_per_week, notes',
    defaultSort: { field: 'start_date', direction: 'desc' },
    lockedFields: ['id'],
    editableFields: ['user_id', 'username', 'status', 'start_date', 'end_date', 'weekly_price', 'sessions_per_week', 'notes'],
    hiddenColumns: ['id'],
  },
  membership_material_deliveries: {
    label: 'Entregas material',
    primaryKey: 'id',
    select: 'id, membership_id, user_id, cycle_number, delivered_at, notes, created_at',
    defaultSort: { field: 'delivered_at', direction: 'desc' },
    lockedFields: ['id', 'created_at'],
    editableFields: ['membership_id', 'user_id', 'cycle_number', 'delivered_at', 'notes'],
    hiddenColumns: ['id'],
  },
  events: {
    label: 'Eventos',
    primaryKey: 'id',
    select: 'id, event_key, name, event_date, venue, city, status, notes',
    defaultSort: { field: 'event_date', direction: 'desc' },
    lockedFields: ['id'],
    editableFields: ['event_key', 'name', 'event_date', 'venue', 'city', 'status', 'notes'],
    hiddenColumns: ['id'],
  },
  event_participations: {
    label: 'Participaciones de evento',
    primaryKey: 'id',
    select: 'id, event_id, user_id, participation_percent, role, notes, created_at',
    defaultSort: { field: 'created_at', direction: 'desc' },
    lockedFields: ['id', 'created_at'],
    editableFields: ['event_id', 'user_id', 'participation_percent', 'role', 'notes'],
    hiddenColumns: ['id'],
    hidden: true,
  },
  participants: {
    label: 'Participantes',
    primaryKey: 'id',
    select: 'id, user_id, role, status, notes, created_at',
    defaultSort: { field: 'created_at', direction: 'desc' },
    lockedFields: ['id', 'created_at'],
    editableFields: ['user_id', 'role', 'status', 'notes'],
    hiddenColumns: ['id'],
  },
  finance_entities: {
    label: 'Entidades financieras',
    primaryKey: 'id',
    select: 'id, entity_key, name, entity_type, status, notes, created_at',
    defaultSort: { field: 'name', direction: 'asc' },
    lockedFields: ['id', 'created_at'],
    editableFields: ['entity_key', 'name', 'entity_type', 'status', 'notes'],
    hiddenColumns: ['id'],
  },
  payment_methods: {
    label: 'Metodos de pago',
    primaryKey: 'id',
    select: 'id, key, name, status, sort_order, created_at',
    defaultSort: { field: 'sort_order', direction: 'asc' },
    lockedFields: ['id', 'created_at'],
    editableFields: ['key', 'name', 'status', 'sort_order'],
    hiddenColumns: ['id'],
    summaryFields: ['key', 'name', 'status', 'sort_order'],
    pdfColumns: ['key', 'name', 'status', 'sort_order'],
    pdfColumnLabels: { key: 'Clave', name: 'Nombre', status: 'Status', sort_order: 'Orden' },
  },
  services: {
    label: 'Servicios',
    primaryKey: 'id',
    select: 'id, key, name, status, sort_order, show_in_finance, show_in_session, session_cost, session_minutes, created_at',
    defaultSort: { field: 'sort_order', direction: 'asc' },
    lockedFields: ['id', 'created_at'],
    editableFields: ['key', 'name', 'status', 'sort_order', 'show_in_finance', 'show_in_session', 'session_cost', 'session_minutes'],
    hiddenColumns: ['id'],
    summaryFields: ['key', 'name', 'status', 'sort_order', 'show_in_finance', 'show_in_session', 'session_cost', 'session_minutes'],
    pdfColumns: ['key', 'name', 'status', 'sort_order', 'show_in_finance', 'show_in_session', 'session_cost', 'session_minutes'],
    pdfColumnLabels: { key: 'Clave', name: 'Nombre', status: 'Status', sort_order: 'Orden', show_in_finance: 'Finanzas', show_in_session: 'Sesion', session_cost: 'Costo sesion', session_minutes: 'Minutos sesion' },
  },
};

async function fetchAllTableEditorRows(tableName, select, defaultSort = null, options = {}) {
  const rows = [];
  const maxRows = Number.isFinite(options.maxRows) ? Math.max(1, Number(options.maxRows)) : Infinity;
  let from = 0;

  while (rows.length < maxRows) {
    const remaining = maxRows - rows.length;
    const pageSize = Math.min(ADMIN_TABLE_FETCH_SIZE, remaining);
    let query = supabase
      .from(tableName)
      .select(select)
      .range(from, from + pageSize - 1);

    if (options.searchQuery && options.config) {
      query = applyAdminTableRemoteSearch(query, tableName, options.config, options.searchQuery);
    }

    if (defaultSort?.field) {
      query = query.order(defaultSort.field, { ascending: defaultSort.direction !== 'desc' });
    }

    const { data, error } = await query;

    if (error) throw error;

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function ensureMembershipDashboardUsersLoaded() {
  if (Array.isArray(state.data.membershipDashboardUsers)) {
    return state.data.membershipDashboardUsers;
  }

  const usersResult = await fetchAllTableEditorRows(
    'users',
    'id, user_id, display_name, email, username',
    { field: 'display_name', direction: 'asc' }
  );
  state.data.membershipDashboardUsers = uniqueUsers(usersResult ?? [])
    .filter((user) => String(user.user_id ?? '').trim());
  return state.data.membershipDashboardUsers;
}

function resolveMembershipDashboardUserId(value, users = []) {
  const requestedValue = String(value || '').trim();
  if (!requestedValue) return '';

  const exactUser = users.find((user) => String(user.user_id ?? '') === requestedValue);
  // Reject stale free-text or cross-table filters; this state may only hold a selected user_id.
  return exactUser ? requestedValue : '';
}

async function fetchComputedMembershipDashboardRows(selectedUserId = '') {
  const users = await ensureMembershipDashboardUsersLoaded();
  const userId = resolveMembershipDashboardUserId(selectedUserId, users);
  state.data.membershipDashboardSelectedUserId = userId;
  if (!userId) return [];

  const [membershipsResult, sessionsResult, transactionsResult, materialDeliveriesResult] = await Promise.all([
    supabase
      .from('memberships')
      .select('id, user_id, username, status, start_date, end_date, weekly_price, sessions_per_week, notes')
      .eq('user_id', userId)
      .order('start_date', { ascending: true }),
    supabase
      .from('sessions')
      .select('id, user_id, username, session_date, concept, status, type, notes, hour, sc_end, cost, promo')
      .eq('user_id', userId)
      .order('session_date', { ascending: true }),
    supabase
      .from('transactions')
      .select('id, user_id, type, concept, service, date, amount, via, username, id_trans, notes')
      .eq('user_id', userId)
      .order('date', { ascending: true }),
    fetchMembershipMaterialDeliveries(userId),
  ]);

  const loadError = membershipsResult.error || sessionsResult.error || transactionsResult.error;
  if (loadError) throw loadError;

  const usersByUserId = new Map(users
    .filter((user) => user.user_id)
    .map((user) => [String(user.user_id), user]));

  return buildMembershipRows(
    membershipsResult.data ?? [],
    sessionsResult.data ?? [],
    transactionsResult.data ?? [],
    materialDeliveriesResult ?? []
  ).map((row) => {
    const user = usersByUserId.get(String(row.user_id ?? ''));
    return {
      ...row,
      display_name: user?.display_name ?? row.username ?? null,
      email: user?.email ?? null,
      username: row.username ?? user?.username ?? null,
    };
  });
}

async function fetchMembershipMaterialDeliveries(userId = null) {
  try {
    let query = supabase
      .from('membership_material_deliveries')
      .select('id, membership_id, user_id, cycle_number, delivered_at, notes, created_at')
      .order('delivered_at', { ascending: true });

    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.info('[HR] membership material deliveries unavailable:', error?.message ?? error);
    return [];
  }
}

function sortTableEditorRows(rows, field, direction = 'asc') {
  const multiplier = direction === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const left = normalizeTableSortValue(a?.[field]);
    const right = normalizeTableSortValue(b?.[field]);

    if (left.empty && right.empty) return 0;
    if (left.empty) return 1;
    if (right.empty) return -1;

    if (left.type === 'number' && right.type === 'number') {
      return (left.value - right.value) * multiplier;
    }

    return String(left.value).localeCompare(String(right.value), 'es', {
      numeric: true,
      sensitivity: 'base',
    }) * multiplier;
  });
}

function getTableSort(tableId, fallbackField = '', fallbackDirection = 'asc') {
  const sorts = state.data.tableSorts ?? {};
  return sorts[tableId] ?? { field: fallbackField, direction: fallbackDirection };
}

function isDateSortField(field) {
  return /(^|_)(date|fecha)(_de)?|date$|fecha$|_at$/i.test(String(field ?? ''));
}

function setTableSort(tableId, field) {
  const current = getTableSort(tableId);
  const direction = current.field === field
    ? (current.direction === 'asc' ? 'desc' : 'asc')
    : (isDateSortField(field) ? 'desc' : 'asc');
  state.data.tableSorts = {
    ...(state.data.tableSorts ?? {}),
    [tableId]: { field, direction },
  };
}

function sortRowsByColumn(rows, field, direction = 'asc') {
  if (!field) return rows ?? [];
  return sortTableEditorRows(rows ?? [], field, direction);
}

function readDashboardPrefs() {
  try {
    return JSON.parse(localStorage.getItem(DASHBOARD_PREFS_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeDashboardPrefs(patch = {}) {
  try {
    localStorage.setItem(DASHBOARD_PREFS_STORAGE_KEY, JSON.stringify({
      ...readDashboardPrefs(),
      ...patch,
    }));
  } catch {
    // localStorage can fail in private or restricted contexts; memory still works.
  }
}

function isClientOnlyUser() {
  return state.roles.length === 1 && state.roles[0] === 'client';
}

function clientHomeStorageKey() {
  const userKey = String(state.user?.id || state.user?.user_id || 'current').trim();
  return CLIENT_HOME_PREFS_PREFIX + userKey;
}

function readClientHomePrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(clientHomeStorageKey()) || '{}');
    return {
      visits: raw?.visits && typeof raw.visits === 'object' ? raw.visits : {},
      lastVisitedAt: raw?.lastVisitedAt && typeof raw.lastVisitedAt === 'object' ? raw.lastVisitedAt : {},
    };
  } catch {
    return { visits: {}, lastVisitedAt: {} };
  }
}

function writeClientHomePrefs(prefs) {
  try {
    localStorage.setItem(clientHomeStorageKey(), JSON.stringify(prefs));
  } catch {
    // localStorage can fail in private or restricted contexts; keep the current view usable.
  }
}

function recordClientSectionVisit(sectionKey) {
  if (!isClientOnlyUser() || !CLIENT_HOME_SECTION_KEYS.has(sectionKey)) return;
  const prefs = readClientHomePrefs();
  prefs.visits[sectionKey] = Math.max(0, Number(prefs.visits[sectionKey] || 0)) + 1;
  prefs.lastVisitedAt[sectionKey] = Date.now();
  writeClientHomePrefs(prefs);
}

function normalizeClientHomeSignalText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getClientHomeRanking() {
  const prefs = readClientHomePrefs();
  const notifications = Array.isArray(state.notifications) ? state.notifications : [];

  return CLIENT_HOME_SECTIONS
    .map((item, defaultIndex) => {
      const visits = Math.max(0, Number(prefs.visits[item.section] || 0));
      const hasNews = notifications.some((notification) => {
        if (notification?.read) return false;
        const message = normalizeClientHomeSignalText(notification.message);
        return item.noveltyTerms.some((term) => message.includes(normalizeClientHomeSignalText(term)));
      });

      return {
        ...item,
        defaultIndex,
        visits,
        hasNews,
        score: item.defaultScore + visits * 10 + (hasNews ? 100 : 0),
      };
    })
    .sort((left, right) => right.score - left.score || left.defaultIndex - right.defaultIndex);
}
function persistedDataValue(key, fallback = '') {
  if (state.data[key] !== undefined) return state.data[key];
  const stored = readDashboardPrefs()[key];
  return stored !== undefined ? stored : fallback;
}

function setPersistedDataValue(key, value) {
  state.data[key] = value;
  writeDashboardPrefs({ [key]: value });
  return value;
}

function tableSearchStorageKey(inputOrId) {
  if (!inputOrId) return '';
  if (typeof inputOrId === 'string') return inputOrId;
  return inputOrId.dataset.adminTableName || inputOrId.dataset.tableTarget || '';
}

function tableSearchFor(inputOrId) {
  const key = tableSearchStorageKey(inputOrId);
  if (!key) return '';
  if (state.data.tableSearches?.[key] !== undefined) return state.data.tableSearches[key];
  return readDashboardPrefs().tableSearches?.[key] ?? '';
}

function setTableSearch(inputOrId, query) {
  const key = tableSearchStorageKey(inputOrId);
  if (!key) return;
  state.data.tableSearches = {
    ...(state.data.tableSearches ?? {}),
    [key]: query,
  };
  writeDashboardPrefs({
    tableSearches: {
      ...(readDashboardPrefs().tableSearches ?? {}),
      [key]: query,
    },
  });
}

function adminTableSearchFor(tableName) {
  return state.data.adminTableSearches?.[tableName] ?? tableSearchFor(tableName);
}

function normalizeAdminTableName(tableName) {
  return TABLE_EDITOR_CONFIG[tableName] ? tableName : 'users';
}

function readStoredAdminTableName() {
  try {
    return normalizeAdminTableName(localStorage.getItem(ADMIN_TABLE_STORAGE_KEY));
  } catch {
    return 'users';
  }
}

function setAdminTableName(tableName) {
  const normalized = normalizeAdminTableName(tableName);
  state.data.adminTableName = normalized;
  try {
    localStorage.setItem(ADMIN_TABLE_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures; in-memory state still updates.
  }
  return normalized;
}

function setAdminTableSearch(tableName, query) {
  state.data.adminTableSearches = {
    ...(state.data.adminTableSearches ?? {}),
    [tableName]: query,
  };
  setTableSearch(tableName, query);
}

function isSessionStaleError(error) {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ].filter(Boolean).join(' ').toLowerCase();

  return /jwt|token|expired|permission denied|row-level security|rls|invalid claim|not authorized|unauthorized/.test(text);
}

function persistAdminTableSearchFromDOM(tableName = state.data.adminTableName || readStoredAdminTableName()) {
  const input = [...document.querySelectorAll('[data-table-search]')]
    .find((item) => item.dataset.adminTableName === tableName);
  if (input) setAdminTableSearch(tableName, input.value.trim());
}

function restorePersistedTableSearches(root = document) {
  root.querySelectorAll('[data-table-search]').forEach((input) => {
    const query = tableSearchFor(input);
    if (!query) return;
    input.value = query;
    filterTableRows(input);
  });
}

function rowMatchesSearch(row, columns, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const searchable = columns
    .map((field) => row?.[field])
    .filter((value) => value !== null && value !== undefined)
    .join(' ');

  return normalizeSearchText(searchable).includes(normalizedQuery);
}

function adminTableRemoteSearchColumns(tableName, config) {
  const preferred = [
    'display_name',
    'username',
    'email',
    'user_id',
    'concept',
    'service',
    'notes',
    'name',
    'event_key',
    'storage_path',
    'id_trans',
  ];
  const allowed = new Set([...(config.lockedFields ?? []), ...(config.editableFields ?? [])]);
  return preferred.filter((field) => allowed.has(field));
}

function applyAdminTableRemoteSearch(query, tableName, config, searchQuery) {
  const normalized = normalizeSearchText(searchQuery);
  if (!normalized || normalized.length < ADMIN_TABLE_REMOTE_SEARCH_MIN_CHARS || tableName === 'membership_dashboard') {
    return query;
  }

  const columns = adminTableRemoteSearchColumns(tableName, config);
  if (!columns.length) return query;

  const escaped = String(searchQuery).replace(/[%*]/g, '').trim();
  if (!escaped) return query;

  return query.or(columns.map((field) => `${field}.ilike.%${escaped}%`).join(','));
}

function renderSortableHeader(tableId, field, label, activeSort) {
  const isActive = activeSort?.field === field;
  const nextDirection = isActive && activeSort.direction === 'asc' ? 'desc' : 'asc';
  const glyph = isActive ? (activeSort.direction === 'asc' ? '↑' : '↓') : '↕';

  return `
    <th scope="col">
      <button
        class="db-table-sort"
        type="button"
        data-action="table-sort"
        data-table-id="${escapeAttr(tableId)}"
        data-sort-field="${escapeAttr(field)}"
        aria-label="Ordenar ${escapeAttr(label)} ${nextDirection === 'asc' ? 'ascendente' : 'descendente'}"
      >
        <span>${escapeHTML(label)}</span>
        <span aria-hidden="true">${glyph}</span>
      </button>
    </th>
  `;
}

function normalizeTableSortValue(value) {
  if (value === null || value === undefined || value === '') {
    return { empty: true, type: 'string', value: '' };
  }

  const raw = String(value).trim();
  const numeric = Number(raw);
  if (raw !== '' && Number.isFinite(numeric)) {
    return { empty: false, type: 'number', value: numeric };
  }

  const timestamp = Date.parse(raw);
  if (Number.isFinite(timestamp) && /\d{4}-\d{2}-\d{2}/.test(raw)) {
    return { empty: false, type: 'number', value: timestamp };
  }

  return { empty: false, type: 'string', value: raw };
}

function uniqueUsers(users) {
  const seen = new Set();
  return (users ?? []).filter((user) => {
    const key = String(user?.user_id ?? user?.id ?? '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
function normalizePhoneForMatch(value) {
  return String(value ?? '').replace(/[^0-9+]/g, '').trim();
}

function normalizeOccupationsValue(value) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(',');
  const occupations = source.map((item) => String(item ?? '').trim()).filter(Boolean);
  return occupations.length ? occupations : ['Comunidad'];
}

function displayOccupationsValue(value) {
  return normalizeOccupationsValue(value).join(', ');
}

function normalizePasslineTrackingValue(value) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(',');
  return source.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function displayPasslineTrackingValue(value) {
  return normalizePasslineTrackingValue(value).join(', ');
}

function buildPasslineTrackingIndex(users = []) {
  const index = new Map();
  const ambiguous = new Set();
  users.forEach((user) => {
    if (!user?.user_id) return;
    normalizePasslineTrackingValue(user.passline_tracking).forEach((alias) => {
      const key = normalizeSearchText(alias);
      if (!key) return;
      const existing = index.get(key);
      if (existing && existing !== user.user_id) {
        ambiguous.add(key);
        return;
      }
      index.set(key, user.user_id);
    });
  });
  ambiguous.forEach((key) => index.delete(key));
  return index;
}

function applyPasslineTracking(row, trackingIndex = new Map()) {
  if (row.user_id) return row;
  const key = normalizeSearchText(row.buyer_name);
  const userId = key ? trackingIndex.get(key) : null;
  return userId ? { ...row, user_id: userId } : row;
}

function renderUserMergeDuplicateAlerts(mode = 'email') {
  const labels = { email: 'Email', name: 'Nombre', whatsapp: 'WhatsApp' };
  const groups = new Map();
  (state.data.users ?? []).forEach((user) => {
    const rawKey = mode === 'name'
      ? (user.display_name || user.username || '')
      : mode === 'whatsapp'
        ? user.whatsapp
        : user.email;
    const key = mode === 'whatsapp' ? normalizePhoneForMatch(rawKey) : normalizeSearchText(rawKey);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(user);
  });

  const duplicates = [...groups.values()].filter((items) => items.length > 1).slice(0, 8);
  const rows = duplicates.map((items) => {
    const title = mode === 'whatsapp'
      ? normalizePhoneForMatch(items[0].whatsapp)
      : mode === 'name'
        ? (items[0].display_name || items[0].username || 'Sin nombre')
        : (items[0].email || 'Sin email');
    const detail = items.map((user) => `${user.display_name || user.username || user.email || 'Usuario'} - ${user.user_id ?? '-'} - ${user.email ?? 'sin email'} - ${user.whatsapp ?? 'sin WhatsApp'}`).join(' | ');
    return `<li><strong>${escapeHTML(title)}</strong><br><small>${escapeHTML(detail)}</small></li>`;
  }).join('');

  return `
    <div class="db-field">
      <span>Detectar posibles duplicados por</span>
      <select data-action="merge-duplicate-mode" aria-label="Detectar duplicados por">
        ${optionHTML('email', 'Email', mode)}
        ${optionHTML('name', 'Nombre', mode)}
        ${optionHTML('whatsapp', 'WhatsApp', mode)}
      </select>
      <small class="db-field__hint">Email es la senal mas importante. Nombre y WhatsApp son alertas operativas, no fusion automatica.</small>
    </div>
    <div class="db-empty">
      <strong>Posibles mismas personas por ${escapeHTML(labels[mode] || 'Email')}</strong>
      ${duplicates.length ? `<ul>${rows}</ul>` : '<p>Sin duplicados detectados con este criterio.</p>'}
    </div>
  `;
}

const userLabel = (userId) => {
  const user = (state.data.users ?? []).find((u) => String(u.user_id) === String(userId));
  if (!user) return userId ? 'Usuario seleccionado' : 'Sin asignar';
  return user.display_name || user.username || user.email || 'Usuario sin nombre';
};

const usernameLabel = (user) => user?.username ? `@${user.username}` : '@sin_username';

function currentUserAuditFields() {
  return {
    created_by: state.user?.id ?? null,
    created_by_user_id: state.user?.user_id ?? null,
    created_by_username: state.user?.username ?? state.user?.display_name ?? state.user?.email ?? null,
  };
}

async function ensureCurrentUserOperationalId(authUser, profile = null) {
  if (profile?.user_id) return profile;
  if (!authUser?.id) return profile;

  try {
    const { data: ensuredUserId, error: ensureError } = await supabase.rpc('ensure_my_user_id');
    if (ensureError) {
      console.info('[HR] ensure user_id skipped:', ensureError.message);
      return profile;
    }

    if (!ensuredUserId) return profile;

    const { data: freshProfile, error: freshError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (freshError) {
      console.info('[HR] profile refresh after user_id skipped:', freshError.message);
      return { ...(profile ?? {}), id: authUser.id, user_id: ensuredUserId };
    }

    return freshProfile ?? { ...(profile ?? {}), id: authUser.id, user_id: ensuredUserId };
  } catch (err) {
    console.info('[HR] ensure user_id failed:', err?.message ?? err);
    return profile;
  }
}

async function syncLocalStorageRecords() {
  if (state.viewAs?.active) return;
  if (!state.user?.user_id) {
    const profile = await ensureCurrentUserOperationalId(state.user, state.user);
    if (profile?.user_id) {
      state.user = { ...state.user, ...profile };
    }
  }

  if (!state.user?.user_id) return;

  for (const key of LOCAL_SCORE_SYNC_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      const amount = Number(raw || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const gameId = key === 'dem00nz_best'
        ? 'flappy-nero'
        : key === 'gol_gana_record'
          ? 'gol-gana'
          : key.replace(/_best$/, '');

      const { data: existing, error: fetchError } = await supabase
        .from('scores')
        .select('id, amount')
        .eq('user_id', state.user.user_id)
        .eq('game_id', gameId)
        .eq('type', 'record')
        .order('amount', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.info('[HR] local score sync fetch skipped:', fetchError.message);
        continue;
      }

      const remoteAmount = Number(existing?.amount || 0);
      if (remoteAmount >= amount) {
        localStorage.setItem(`${key}_synced`, raw);
        continue;
      }

      const payload = {
        user_id: state.user.user_id,
        game_id: gameId,
        type: 'record',
        amount,
        username: state.user.username ?? state.user.display_name ?? state.user.email ?? null,
      };

      const { error: saveError } = existing?.id
        ? await supabase.from('scores').update({ amount }).eq('id', existing.id)
        : await supabase.from('scores').insert(payload);

      if (saveError) {
        console.info('[HR] local score sync save skipped:', saveError.message);
        continue;
      }

      localStorage.setItem(`${key}_synced`, raw);
    } catch (err) {
      console.info('[HR] local score sync skipped:', err?.message ?? err);
      continue;
    }
  }
}


/* ================================================================
   Section 5  SESSION BOOTSTRAP
   -------------------------------------------------------------
   Auth flow:
     1. supabase.auth.getUser()  -> auth user (auth.users.id)
     2. public.users WHERE id = auth.id  -> full profile
     3. public.users.user_id  -> internal operational ID used in
        transactions / sessions / downloads / contracts / scores
     4. user_permissions WHERE user_id = auth.id  -> permission keys
================================================================ */

/**
 * Loads session from Supabase auth, fetches the public profile and
 * permissions, expands roles cumulatively.
 * @returns {Promise<{user:Object, roles:string[], permissions:string[]}|null>}
 */
async function bootstrapSession() {
  try {
    const { data: { session: storedSession }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.warn('[HR] bootstrapSession: could not read stored session', sessionError.message);
      return null;
    }

    if (!storedSession?.user) return null;

    const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.warn('[HR] bootstrapSession: using persisted session while auth is recovering', userError.message);
    }
    const authUser = verifiedUser || storedSession.user;

    if (!authUser) return null;

    // Fetch public profile - join key is public.users.id = auth.users.id
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error('[HR] bootstrapSession: could not fetch profile', profileError);
    }

    const resolvedProfile = await ensureCurrentUserOperationalId(authUser, profile);
    const viewAsContext = await window.HiddenRoomViewAs?.resolveForAdmin?.(
      supabase,
      authUser,
      resolvedProfile,
    );

    // Beat Store and Portal share the producer avatar. Older uploads may only
    // exist in producer_profiles, so prefer that managed avatar when present.
    let producerAvatarUrl = '';
    if (!viewAsContext?.active) {
      const { data: producerProfiles, error: producerAvatarError } = await supabase
        .from('producer_profiles')
        .select('avatar_url')
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .not('avatar_url', 'is', null)
        .limit(1);
      if (producerAvatarError) {
        console.info('[HR] producer avatar fallback skipped:', producerAvatarError.message);
      } else {
        producerAvatarUrl = String(producerProfiles?.[0]?.avatar_url || '').trim();
      }
    }

    // Merge auth user as fallback so email/id are always available
    const actualUser = resolvedProfile
      ? { ...authUser, ...resolvedProfile, ...(producerAvatarUrl ? { avatar_url: producerAvatarUrl } : {}) }
      : { ...authUser, ...(producerAvatarUrl ? { avatar_url: producerAvatarUrl } : {}) };
    const effectiveProfile = viewAsContext?.active ? viewAsContext.profile : resolvedProfile;
    const mergedUser = viewAsContext?.active
      ? { ...viewAsContext.user, ...effectiveProfile }
      : actualUser;

    // Expand roles cumulatively from public.users.roles field
    const roles = expandRoles(mergedUser.roles);

    // Fetch granular permissions from user_permissions
    // user_permissions.user_id references auth.users.id (same as public.users.id)
    const { data: permRows, error: permError } = viewAsContext?.active
      ? { data: (viewAsContext.permissions || []).map((permission_key) => ({ permission_key })), error: null }
      : await supabase
        .from('user_permissions')
        .select('permission_key')
        .eq('user_id', authUser.id);

    if (permError) {
      console.error('[HR] bootstrapSession: could not fetch permissions', permError);
    }

    const permissions = (permRows ?? []).map((r) => r.permission_key);

    return {
      user: mergedUser,
      actualUser,
      viewAs: viewAsContext || null,
      roles,
      permissions,
    };

  } catch (err) {
    console.error('[HR] bootstrapSession: unexpected error', err);
    return null;
  }
}


/* ================================================================
   Section 6  ROUTER
   -------------------------------------------------------------
   navigate() is sync: updates state + sidebar immediately, then
   calls renderSection() which is async and awaits render().
================================================================ */

/**
 * Navigate to a section by key.
 * @param {string} sectionKey
 */
function navigate(sectionKey) {
  const section = SECTIONS[sectionKey];

  if (!section) {
    console.warn(`[HR] Unknown section: ${sectionKey}`);
    return;
  }

  // Permission guard - uses cumulative hasRole()
  if (section.roleRequired && !hasRole(section.roleRequired)) {
    showToast('Acceso no autorizado para este módulo.', 'error');
    return;
  }

  if (section.permissionRequired && !hasPermission(section.permissionRequired)) {
    showToast('No tienes permiso para ver este modulo.', 'error');
    return;
  }

  if (section.permissionAnyRequired && !hasAnyPermission(section.permissionAnyRequired)) {
    showToast('No tienes permiso para ver este modulo.', 'error');
    return;
  }

  if (isClientOnlyUser() && CLIENT_HOME_SECTION_KEYS.has(sectionKey)) {
    recordClientSectionVisit(sectionKey);
  }

  setState({ activeSection: sectionKey });
  refreshClientOnlyBottomNav();
  persistActiveSection(sectionKey);
  updateSidebarActiveState(sectionKey);
  updateTopbarTitle(section.label);
  syncInfrastructureRefresh(sectionKey);

  // Fire-and-forget: renderSection is async but navigate stays sync
  renderSection(sectionKey);
}

function syncInfrastructureRefresh(sectionKey) {
  if (state.infrastructureRefreshTimer && sectionKey !== 'erp-infrastructure') {
    clearInterval(state.infrastructureRefreshTimer);
    setState({ infrastructureRefreshTimer: null });
    return;
  }

  if (sectionKey !== 'erp-infrastructure' || state.infrastructureRefreshTimer) return;

  const timer = setInterval(() => {
    if (state.activeSection !== 'erp-infrastructure') {
      clearInterval(timer);
      if (state.infrastructureRefreshTimer === timer) setState({ infrastructureRefreshTimer: null });
      return;
    }
    if (state.data?.serverStatus) delete state.data.serverStatus;
    renderSection('erp-infrastructure');
  }, 20_000);

  setState({ infrastructureRefreshTimer: timer });
}

function persistActiveSection(sectionKey) {
  const canRestore = hasRole('admin') && !state.viewAs?.active;
  if (canRestore) {
    try {
      localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, sectionKey);
    } catch (err) {
      console.warn('[HR] active section storage unavailable:', err);
    }

    if (window.location.hash !== `#${sectionKey}`) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${sectionKey}`);
    }
    return;
  }

  // Client sessions always start at Inicio; do not leave a section route behind.
  if (window.location.hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
}

function initialSectionKey() {
  if (!hasRole('admin') || state.viewAs?.active) return 'overview';

  const hashKey = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
  if (SECTIONS[hashKey]) return hashKey;

  try {
    const stored = localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY);
    if (SECTIONS[stored]) return stored;
  } catch (err) {
    console.warn('[HR] active section restore unavailable:', err);
  }

  return 'overview';
}

function attachRoutePersistenceListener() {
  window.addEventListener('hashchange', () => {
    const key = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
    if (SECTIONS[key] && key !== state.activeSection) navigate(key);
  });
}

function markSessionStale(reason = '') {
  if (state.sessionStale) return;
  state.sessionStale = true;
  console.warn('[HR] stale session suspected:', reason);
  showToast('Tu sesión parece desactualizada. Actualiza sesión para validar permisos.', 'error', 7000);
}

function renderSessionStaleBanner() {
  if (!state.sessionStale) return '';
  return `
    <div class="db-session-banner" role="alert">
      <div>
        <strong>Sesión desactualizada</strong>
        <span>Tu navegador puede estar usando permisos viejos. Actualiza la sesión para volver a consultar datos protegidos.</span>
      </div>
      <button class="db-btn-secondary" type="button" data-action="refresh-session">Actualizar sesión</button>
    </div>
  `;
}

async function handleRefreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data?.session) {
      markSessionStale(error?.message || 'No se pudo renovar la sesión.');
      return;
    }

    const session = await bootstrapSession();
    if (!session) {
      markSessionStale('La sesión se renovó, pero el perfil aún no está disponible.');
      return;
    }

    setState({
      user: session.user,
      actualUser: session.actualUser || session.user,
      viewAs: session.viewAs || null,
      roles: session.roles,
      permissions: session.permissions,
      data: {},
      sessionStale: false,
    });
    showToast('Sesión actualizada.', 'success');
    navigate(state.activeSection);
  } catch (err) {
    console.error('[HR] refresh session:', err);
    markSessionStale(err?.message || 'No se pudo renovar la sesión.');
  }
}

/**
 * Injects the section's HTML into the main content area.
 * Supports both sync and async render functions uniformly.
 * @param {string} sectionKey
 * @returns {Promise<void>}
 */
async function renderSection(sectionKey) {
  const wrap     = document.getElementById('js-section-wrap');
  const skeleton = document.getElementById('js-skeleton');

  if (!wrap) return;

  portalAvatarEditorController?.destroy();
  portalAvatarEditorController = null;

  const section = SECTIONS[sectionKey];
  const renderToken = state.renderToken + 1;
  const loadingStartedAt = performance.now();
  setState({ renderToken });

  wrap.classList.remove('db-section-wrap--visible');
  wrap.innerHTML = renderLoadingBlock(section?.label ?? 'Cargando');
  if (skeleton) skeleton.hidden = true;
  requestAnimationFrame(() => {
    if (state.renderToken === renderToken) {
      wrap.classList.add('db-section-wrap--visible');
    }
  });

  try {
    // Await the render - works whether the function is sync or async
    const html = await section.render();
    const elapsed = performance.now() - loadingStartedAt;
    if (elapsed < SECTION_LOADING_MIN_MS) {
      await new Promise((resolve) => setTimeout(resolve, SECTION_LOADING_MIN_MS - elapsed));
    }
    if (state.renderToken !== renderToken) return;
    wrap.innerHTML = `${renderSessionStaleBanner()}${html}`;
    enhancePasswordToggles(wrap);
    restorePersistedTableSearches(wrap);
    if (sectionKey === 'overview') initPortalProfileAvatarEditor();
  } catch (error) {
    if (state.renderToken !== renderToken) return;
    console.error('[HR] renderSection:', error);
    if (isSessionStaleError(error)) markSessionStale(error.message || 'render error');
    wrap.innerHTML = sectionShell('Sistema', 'No se pudo cargar', 'title-render-error', `
      ${renderSessionStaleBanner()}
      <p class="db-empty db-empty--error">Error al cargar este modulo.</p>
    `);
    enhancePasswordToggles(wrap);
    restorePersistedTableSearches(wrap);
  } finally {
    if (state.renderToken === renderToken && skeleton) skeleton.hidden = true;
  }
  if (sectionKey === 'client-tickets') {
    requestAnimationFrame(() => renderClientTicketQrs(wrap));
  }


  // Trigger reveal after paint
  requestAnimationFrame(() => {
    wrap.classList.add('db-section-wrap--visible');
  });
}


/* ================================================================
   Section 7  TOPBAR HELPERS
================================================================ */

function portalProfileAvatarUrl(value) {
  const resolved = resolveProfileAvatarUrl(value, CLOUD_HIDDENROOM_URL);
  return /^https?:\/\//i.test(resolved) && isBlockedAvatarHost(resolved) ? '' : resolved;
}

function portalProfileAvatarMarkup(prefix = 'portal-profile-avatar') {
  const user = state.user || {};
  const avatarUrl = portalProfileAvatarUrl(user.avatar_url);
  const fallback = String(user.display_name ?? user.email ?? '?').trim().charAt(0).toUpperCase() || '?';
  const avatarContent = avatarUrl
    ? `<img src="${escapeAttr(avatarUrl)}" alt="Foto de perfil" data-portal-profile-avatar-image />`
    : escapeHTML(fallback);
  const canEdit = !state.viewAs?.active;

  return `<div class="db-profile__avatar-wrap">
    <div class="db-profile__avatar" data-portal-profile-avatar-display aria-label="Foto de perfil">
      ${avatarContent}
    </div>
    ${canEdit ? `<div class="producer-avatar-actions portal-profile-avatar-actions">
      <label class="secondary-button producer-avatar-change" for="${escapeAttr(`${prefix}-file`)}">Cambiar foto<input id="${escapeAttr(`${prefix}-file`)}" type="file" accept="image/*,.jpg,.jpeg,.png,.webp" hidden></label>
    </div>
    <div id="${escapeAttr(`${prefix}-editor`)}" class="beat-cover-editor producer-avatar-editor portal-profile-avatar-editor" hidden>
      <div class="beat-cover-editor__stage" id="${escapeAttr(`${prefix}-stage`)}" aria-label="Recorte de foto de perfil">
        <img id="${escapeAttr(`${prefix}-preview`)}" alt="Vista previa de la foto de perfil">
      </div>
      <div class="beat-cover-editor__controls">
        <button id="${escapeAttr(`${prefix}-reset`)}" class="secondary-button" type="button">Restablecer recorte</button>
        <label class="hr-label" for="${escapeAttr(`${prefix}-zoom`)}">Zoom <input id="${escapeAttr(`${prefix}-zoom`)}" type="range" min="1" max="3" step="0.01" value="1"></label>
        <div class="producer-avatar-editor__actions">
          <button id="${escapeAttr(`${prefix}-save`)}" class="primary-button" type="button">Guardar foto</button>
          <button id="${escapeAttr(`${prefix}-cancel`)}" class="secondary-button" type="button">Cancelar</button>
        </div>
        <p id="${escapeAttr(`${prefix}-status`)}" class="producer-avatar-status" role="status" aria-live="polite"></p>
      </div>
    </div>` : ''}
  </div>`;
}

function updatePortalProfileAvatarDisplay() {
  const display = document.querySelector('[data-portal-profile-avatar-display]');
  if (!display) return;
  const avatarUrl = portalProfileAvatarUrl(state.user?.avatar_url);
  if (avatarUrl) {
    display.innerHTML = `<img src="${escapeAttr(avatarUrl)}" alt="Foto de perfil" data-portal-profile-avatar-image />`;
    return;
  }
  const fallback = String(state.user?.display_name ?? state.user?.email ?? '?').trim().charAt(0).toUpperCase() || '?';
  display.textContent = fallback;
}

function initPortalProfileAvatarEditor() {
  portalAvatarEditorController?.destroy();
  portalAvatarEditorController = null;
  if (state.viewAs?.active) return;

  const prefix = 'portal-profile-avatar';
  const input = document.getElementById(`${prefix}-file`);
  const editor = document.getElementById(`${prefix}-editor`);
  if (!input || !editor) return;

  portalAvatarEditorController = initProfileAvatarEditor({
    input,
    editor,
    preview: document.getElementById(`${prefix}-preview`),
    stage: document.getElementById(`${prefix}-stage`),
    zoom: document.getElementById(`${prefix}-zoom`),
    resetButton: document.getElementById(`${prefix}-reset`),
    cancelButton: document.getElementById(`${prefix}-cancel`),
    saveButton: document.getElementById(`${prefix}-save`),
    status: document.getElementById(`${prefix}-status`),
    onSave: async ({ file, crop }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sesión requerida para cambiar la foto.');
      const endpoint = new URL(`${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}/api/beat-store/producer-avatar`);
      endpoint.searchParams.set('crop', JSON.stringify(crop));
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No se pudo procesar la foto.');
      state.user.avatar_url = result.avatar_url || state.user.avatar_url;
      hydrateTopbar();
      updatePortalProfileAvatarDisplay();
      showToast('Foto de perfil actualizada.', 'success');
    },
  });
}

function hydrateTopbar() {
  const nameEl   = document.getElementById('js-user-display-name');
  const avatarEl = document.getElementById('js-user-avatar');

  if (!state.user) return;

  const fullName = state.user.display_name ?? state.user.username ?? state.user.email?.split('@')[0] ?? 'Usuario';
  const shortName = String(fullName).trim().split(/\s+/)[0] || 'Usuario';
  if (nameEl) nameEl.textContent = `Hola, ${shortName}`;
  if (avatarEl) {
    const avatarUrl = portalProfileAvatarUrl(state.user.avatar_url);
    const renderFallback = () => {
      const fallback = document.createElement('img');
      fallback.src = '/assets/img/np-negative.webp';
      fallback.alt = '';
      avatarEl.replaceChildren(fallback);
      avatarEl.setAttribute('aria-label', 'Foto de perfil predeterminada');
    };

    avatarEl.textContent = '';
    avatarEl.replaceChildren();

    if (/^https?:\/\//i.test(avatarUrl) && !isBlockedAvatarHost(avatarUrl)) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.loading = 'lazy';
      img.addEventListener('error', renderFallback, { once: true });
      avatarEl.appendChild(img);
      avatarEl.setAttribute('aria-label', 'Foto de perfil');
    } else {
      renderFallback();
    }
  }
}

function isBlockedAvatarHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('cdninstagram')
      || host.includes('fbcdn')
      || host.startsWith('scontent.');
  } catch {
    return false;
  }
}

/** @param {string} label */
function updateTopbarTitle(label) {
  const el = document.getElementById('js-topbar-section');
  if (el) el.textContent = label;
}


/* ================================================================
   Section 8  SIDEBAR HELPERS
================================================================ */

/** @param {string} activeKey */
function updateSidebarActiveState(activeKey) {
  document.querySelectorAll('.db-sidebar__item').forEach((btn) => {
    const isActive = btn.dataset.section === activeKey;
    btn.classList.toggle('db-sidebar__item--active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  document.querySelectorAll('.hr-portal-nav-item[data-section]').forEach((btn) => {
    const isActive = btn.dataset.section === activeKey;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  const activeGroup = PORTAL_NAV_GROUPS.find((group) =>
    group.items.some((item) => item.section === activeKey)
  )?.key;
  document.querySelectorAll('.hr-portal-bottom-nav [data-portal-group]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.portalGroup === activeGroup);
  });
  document.querySelectorAll('.hr-portal-bottom-nav [data-section]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.section === activeKey);
  });
}

function canShowPortalGroup(group) {
  if (group.role && !hasRole(group.role)) return false;
  if (group.permission && !hasPermission(group.permission)) return false;
  if (group.permissionAny && !hasAnyPermission(group.permissionAny)) return false;
  return true;
}

function canShowPortalItem(item) {
  if (item.permission && !hasPermission(item.permission)) return false;
  if (item.permissionAny && !hasAnyPermission(item.permissionAny)) return false;
  if (item.section) {
    const section = SECTIONS[item.section];
    if (!section) return false;
    if (section.roleRequired && !hasRole(section.roleRequired)) return false;
    if (section.permissionRequired && !hasPermission(section.permissionRequired)) return false;
    if (section.permissionAnyRequired && !hasAnyPermission(section.permissionAnyRequired)) return false;
  }
  return true;
}

function visiblePortalGroups() {
  return PORTAL_NAV_GROUPS
    .filter(canShowPortalGroup)
    .map((group) => ({
      ...group,
      items: group.items.filter(canShowPortalItem),
    }))
    .filter((group) => group.items.length);
}

function renderPortalNavItem(item, className = 'db-sidebar__item') {
  const icon = `<span class="db-icon db-icon--${escapeHTML(item.icon || 'grid')}" aria-hidden="true"></span>`;
  const text = `<span class="db-sidebar__item-text">${escapeHTML(item.label)}</span>`;
  const active = item.section === state.activeSection;
  const classes = `${className}${item.danger ? ' db-sidebar__item--danger' : ''}${active ? ' is-active' : ''}`;
  const current = active ? ' aria-current="page"' : '';

  if (item.href) {
    return `<a class="${classes}" href="${escapeHTML(item.href)}">${icon}${text}</a>`;
  }

  const data = item.section
    ? `data-section="${escapeHTML(item.section)}"`
    : `data-sidebar-action="${escapeHTML(item.action)}"`;
  return `<button class="${classes}" type="button" ${data}${current}>${icon}${text}</button>`;
}

function renderPortalSidebar() {
  const nav = document.querySelector('#js-sidebar .db-sidebar__nav');
  if (!nav) return;

  nav.innerHTML = visiblePortalGroups().map((group) => `
    <ul class="db-sidebar__group${group.key === 'account' ? ' db-sidebar__group--account' : ''}"
      role="list" data-group="${escapeHTML(group.key)}">
      <li class="db-sidebar__label" aria-hidden="true">${escapeHTML(group.title)}</li>
      ${group.items.map((item) => `<li>${renderPortalNavItem(item)}</li>`).join('')}
    </ul>
  `).join('');
}

function activePortalGroupKey() {
  return PORTAL_NAV_GROUPS.find((group) =>
    group.items.some((item) => item.section === state.activeSection)
  )?.key || '';
}

function renderPortalMoreSheet(openKey = '') {
  const groups = visiblePortalGroups().filter((group) => group.key !== 'system');
  const expandedKey = openKey;
  const currentKey = activePortalGroupKey();

  return groups.map((group) => `
    <details class="hr-portal-drawer__section${group.key === currentKey ? ' is-current' : ''}"
      data-portal-sheet-group="${escapeHTML(group.key)}"${group.key === expandedKey ? ' open' : ''}>
      <summary>
        <span>${escapeHTML(group.title)}</span>
        <span class="hr-portal-drawer__chevron" aria-hidden="true"></span>
      </summary>
      <div class="hr-portal-drawer__list">
        ${group.items.map((item) => renderPortalNavItem(item, 'hr-portal-nav-item')).join('')}
      </div>
    </details>
  `).join('');
}

function renderClientOnlyBottomNav() {
  const iconBySection = {
    'client-membership': 'star',
    'client-downloads': 'download-simple',
    'client-transactions': 'receipt',
    'client-rewards': 'gift',
  };

  const priorityButtons = getClientHomeRanking()
    .slice(0, 3)
    .map((item) => {
      const active = item.section === state.activeSection;
      return '<button type="button" class="' + (active ? 'is-active' : '') + '" data-section="' + escapeAttr(item.section) + '"' + (active ? ' aria-current="page"' : '') + '>'
        + '<span class="hr-icon--nav hr-portal-bottom-nav__icon ph ph-' + escapeAttr(iconBySection[item.section] || 'grid') + '" aria-hidden="true"></span>'
        + escapeHTML(item.label)
        + '</button>';
    })
    .join('');

  return priorityButtons
    + '<button type="button" data-portal-more aria-controls="hr-portal-more" aria-expanded="false">'
    + '<span class="hr-icon--nav hr-portal-bottom-nav__icon ph ph-dots-three-outline" aria-hidden="true"></span>Más</button>';
}

function refreshClientOnlyBottomNav() {
  if (!isClientOnlyUser()) return;
  const nav = document.querySelector('.hr-portal-bottom-nav--client-only');
  if (!nav) return;
  nav.innerHTML = '<button type="button"' + (state.activeSection === 'overview' ? ' class="is-active" aria-current="page"' : '') + ' data-section="overview">'
    + '<span class="hr-icon--nav hr-portal-bottom-nav__icon ph ph-house" aria-hidden="true"></span>Inicio</button>'
    + renderClientOnlyBottomNav();
}

function renderPortalNavigation() {
  renderPortalSidebar();
  releasePortalMoreSheetState();
  document.querySelectorAll('.hr-portal-bottom-nav, .hr-portal-backdrop, .hr-portal-drawer')
    .forEach((node) => node.remove());

  if (isClientOnlyUser()) {
    document.body.insertAdjacentHTML('beforeend',
      '<nav class="hr-portal-bottom-nav hr-portal-bottom-nav--client-only" aria-label="Navegación principal del portal">'
      + '<button type="button"' + (state.activeSection === 'overview' ? ' class="is-active" aria-current="page"' : '') + ' data-section="overview">'
      + '<span class="hr-icon--nav hr-portal-bottom-nav__icon ph ph-house" aria-hidden="true"></span>Inicio</button>'
      + renderClientOnlyBottomNav()
      + '</nav>'
      + '<button class="hr-portal-backdrop" type="button" aria-label="Cerrar menú" hidden></button>'
      + '<aside class="hr-portal-drawer" id="hr-portal-more" aria-label="Menú del portal" aria-hidden="true" hidden>'
      + '<header><div><small>Navegación</small><strong data-portal-sheet-title>Todas las secciones</strong></div>'
      + '<button type="button" data-portal-sheet-close aria-label="Cerrar menú">×</button></header>'
      + '<div class="hr-portal-drawer__content">' + renderPortalMoreSheet() + '</div>'
      + '</aside>');
    return;
  }

  const collaboratorEnabled = visiblePortalGroups().some((group) => group.key === 'collaborator');
  const erpEnabled = visiblePortalGroups().some((group) => group.key === 'erp');
  document.body.insertAdjacentHTML('beforeend',
    '<nav class="hr-portal-bottom-nav" aria-label="Navegación principal del portal">'
    + '<button type="button" data-section="overview"><span class="hr-icon--nav hr-portal-bottom-nav__icon ph ph-house" aria-hidden="true"></span>Inicio</button>'
    + '<button type="button" data-portal-group="client"><span class="hr-icon--nav hr-portal-bottom-nav__icon ph ph-user-circle" aria-hidden="true"></span>Cliente</button>'
    + '<button type="button" data-portal-group="collaborator"' + (collaboratorEnabled ? '' : ' disabled') + '><span class="hr-icon--nav hr-portal-bottom-nav__icon ph ph-users-three" aria-hidden="true"></span>Colaborador</button>'
    + '<button type="button" data-portal-group="erp"' + (erpEnabled ? '' : ' disabled') + '><span class="hr-icon--nav hr-portal-bottom-nav__icon ph ph-chart-bar" aria-hidden="true"></span>ERP</button>'
    + '<button type="button" data-portal-more aria-controls="hr-portal-more" aria-expanded="false"><span class="hr-icon--nav hr-portal-bottom-nav__icon ph ph-dots-three-outline" aria-hidden="true"></span>Más</button>'
    + '</nav>'
    + '<button class="hr-portal-backdrop" type="button" aria-label="Cerrar menú" hidden></button>'
    + '<aside class="hr-portal-drawer" id="hr-portal-more" aria-label="Menú del portal" aria-hidden="true" hidden>'
    + '<header><div><small>Navegación</small><strong data-portal-sheet-title>Todas las secciones</strong></div>'
    + '<button type="button" data-portal-sheet-close aria-label="Cerrar menú">×</button></header>'
    + '<div class="hr-portal-drawer__content">' + renderPortalMoreSheet() + '</div>'
    + '</aside>');
}
function releasePortalMoreSheetState() {
  const sheet = document.getElementById('hr-portal-more');
  const backdrop = document.querySelector('.hr-portal-backdrop');
  const moreButton = document.querySelector('[data-portal-more]');

  if (sheet) {
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
  }
  if (backdrop) backdrop.hidden = true;
  if (moreButton) moreButton.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('hr-portal-menu-open');
  if (!document.body.classList.contains('hr-global-menu-open')) {
    document.body.classList.remove('hr-overlay-open');
  }
}

function togglePortalMoreSheet(forceOpen, filterKey = '') {
  const sheet = document.getElementById('hr-portal-more');
  const backdrop = document.querySelector('.hr-portal-backdrop');
  const moreButton = document.querySelector('[data-portal-more]');
  if (!sheet || !backdrop || !moreButton) return;

  const open = typeof forceOpen === 'boolean' ? forceOpen : sheet.hidden;
  if (open) {
    sheet.querySelector('.hr-portal-drawer__content').innerHTML = renderPortalMoreSheet(filterKey);
    sheet.querySelector('[data-portal-sheet-title]').textContent = 'Todas las secciones';
  }

  sheet.hidden = !open;
  sheet.setAttribute('aria-hidden', String(!open));
  backdrop.hidden = !open;
  moreButton.setAttribute('aria-expanded', String(open && !filterKey));
  if (!open) {
    releasePortalMoreSheetState();
    return;
  }
  document.body.classList.add('hr-portal-menu-open');
  document.body.classList.toggle('hr-overlay-open', open || document.body.classList.contains('hr-global-menu-open'));
  if (open) sheet.querySelector('[data-portal-sheet-close]')?.focus();
}

function closePortalMoreSheet() {
  togglePortalMoreSheet(false);
}

function attachPortalMobileListeners() {
  document.querySelector('.hr-portal-bottom-nav')?.addEventListener('click', (event) => {
    const sectionButton = event.target.closest('[data-section]');
    if (sectionButton) {
      navigate(sectionButton.dataset.section);
      closePortalMoreSheet();
      return;
    }

    const groupButton = event.target.closest('[data-portal-group]');
    if (groupButton && !groupButton.disabled) {
      togglePortalMoreSheet(true, groupButton.dataset.portalGroup);
      return;
    }

    if (event.target.closest('[data-portal-more]')) togglePortalMoreSheet();
  });

  document.querySelector('.hr-portal-backdrop')?.addEventListener('click', closePortalMoreSheet);
  document.querySelector('[data-portal-sheet-close]')?.addEventListener('click', closePortalMoreSheet);
  document.getElementById('hr-portal-more')?.addEventListener('click', (event) => {
    const sectionItem = event.target.closest('[data-section]');
    if (sectionItem) navigate(sectionItem.dataset.section);

    const actionItem = event.target.closest('[data-sidebar-action]');
    if (actionItem) handleNavigationAction(actionItem.dataset.sidebarAction);

    if (event.target.closest('a, button')) closePortalMoreSheet();
  });
  document.getElementById('hr-portal-more')?.addEventListener('toggle', (event) => {
    const opened = event.target.closest('details[open]');
    if (!opened) return;
    document.querySelectorAll('#hr-portal-more details[open]').forEach((group) => {
      if (group !== opened) group.removeAttribute('open');
    });
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('hr-portal-menu-open')) {
      closePortalMoreSheet();
    }
  });
}

function attachSidebarListeners() {
  document.querySelectorAll('.db-sidebar__item[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.section);
      closeUnifiedNavigation();
    });
  });

  document.querySelectorAll('.db-sidebar__item[data-sidebar-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleNavigationAction(btn.dataset.sidebarAction);
      closeUnifiedNavigation();
    });
  });
}

function toggleUnifiedNavigation({ menuOnly = false } = {}) {
  const toggle = document.getElementById('js-user-menu-toggle');
  const menu = document.getElementById('js-user-menu');
  const shouldOpenMenu = menu?.hidden;

  if (menu) menu.hidden = !shouldOpenMenu;
  toggle?.setAttribute('aria-expanded', String(Boolean(shouldOpenMenu)));
}

function closeUnifiedNavigation() {
  const toggle = document.getElementById('js-user-menu-toggle');
  const menu = document.getElementById('js-user-menu');
  const sidebar = document.getElementById('js-sidebar');
  if (menu) menu.hidden = true;
  setState({ sidebarOpen: false });
  sidebar?.classList.remove('db-sidebar--open');
  toggle?.setAttribute('aria-expanded', 'false');
}


/* ================================================================
   Section 9  NOTIFICATIONS
================================================================ */

async function fetchNotifications() {
  if (!state.notificationsAvailable) return [];

  const userUuid = state.user?.id;
  const businessUserId = state.user?.user_id;
  const targets = [userUuid, businessUserId].filter(Boolean).map(String);

  if (!targets.length) return [];

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, message, type, created_at, read, user_id')
      .in('user_id', targets)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      console.info('[HR] notifications unavailable:', error.message);
      if (/schema cache|could not find the table|404/i.test(error.message)) {
        setState({ notificationsAvailable: false });
      }
      return [];
    }

    return (data ?? []).map((item) => ({
      id: item.id,
      message: item.message ?? 'Notificacion',
      type: item.type ?? 'info',
      ts: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
      read: Boolean(item.read),
    }));
  } catch (error) {
    console.info('[HR] notifications not configured:', error);
    setState({ notificationsAvailable: false });
    return [];
  }
}

async function loadAndRenderNotifications() {
  if (!NOTIFICATIONS_ENABLED) {
    document.getElementById('js-notifications-toggle')?.setAttribute('hidden', '');
    document.getElementById('hr-global-notifications')?.setAttribute('hidden', '');
    setState({ notifications: [] });
    return;
  }

  const notifications = await fetchNotifications();
  setState({ notifications });
  refreshClientOnlyBottomNav();

  const unread = notifications.filter((n) => !n.read).length;
  const badge  = document.getElementById('js-notif-count');
  if (badge) {
    badge.textContent = String(unread);
    badge.hidden = unread === 0;
  }

  const list = document.querySelector('[data-hr-notifications-list]');
  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = '<li class="hr-global-notifications__empty">Sin notificaciones nuevas.</li>';
    return;
  }

  list.innerHTML = notifications.map((n) => `
    <li class="hr-notice hr-notice--${escapeAttr(n.type)} hr-global-notifications__item${n.read ? ' is-read' : ''}" data-notif-id="${n.id}">
      <span class="hr-notice__dot hr-global-notifications__dot" aria-hidden="true"></span>
      <span class="hr-notice__message hr-global-notifications__message">${escapeHTML(n.message)}</span>
      <time class="hr-notice__time hr-global-notifications__time" datetime="${new Date(n.ts).toISOString()}">${relativeTime(n.ts)}</time>
    </li>
  `).join('');
}



/* ================================================================
   Section 10  TOAST SYSTEM
================================================================ */

/**
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {number} duration ms
 */
function showToast(message, type = 'info', duration = 4000) {
  const region = document.getElementById('js-toast-region');
  if (!region) return;

  const toast = document.createElement('div');
  toast.className = `hr-toast hr-toast--${type} db-toast db-toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="hr-toast__dot" aria-hidden="true"></span>
    <span class="hr-toast__message">${escapeHTML(message)}</span>
  `;

  region.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('hr-toast--visible', 'db-toast--visible'));

  setTimeout(() => {
    toast.classList.remove('hr-toast--visible', 'db-toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

window.showToast = showToast;


/* ================================================================
   Section 11  USER MENU
================================================================ */

function attachUserMenuListeners() {
  const toggle = document.getElementById('js-user-menu-toggle');
  const menu   = document.getElementById('js-user-menu');

  toggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleUnifiedNavigation();
  });

  menu?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    handleNavigationAction(btn.dataset.action);
    closeUnifiedNavigation();
  });

  document.addEventListener('click', () => {
    if (menu && !menu.hidden) {
      closeUnifiedNavigation();
    }
  });
}

function handleNavigationAction(action) {
  if (action === 'logout')   handleLogout();
  if (action === 'profile')  navigate('overview');
  if (action === 'settings') navigate('account-settings');
  if (action === 'minigames') window.location.href = '../minijuegos/';
}

function handleLogout() {
  supabase.auth.signOut().finally(() => {
    window.location.href = './';
  });
}


/* ================================================================
   Section 12  SECTION RENDERERS
   -------------------------------------------------------------
   Async renderers return Promise<string>.
   Sync renderers return string.
   renderSection() handles both via await.
================================================================ */

/* -- OVERVIEW ----------------------------------------------- */
function renderClientOverview() {
  const { user, roles } = state;
  const sections = getClientHomeRanking();
  const firstName = String(user?.display_name || user?.username || 'cliente')
    .trim()
    .split(/\s+/)[0];
  const roleBadges = roles.map((role) => '<span class="db-badge db-badge--role db-badge--' + escapeAttr(role) + '">' + escapeHTML(role.toUpperCase()) + '</span>').join('');

  return '<section class="db-section db-section--client-home hr-portal-section" aria-labelledby="section-client-home-title">'
    + renderPortalSectionHeader('Cliente', 'Hola, ' + firstName, 'section-client-home-title')
    + '<article class="db-card hr-card db-card--profile hr-profile-card db-client-home-profile" aria-label="Perfil de usuario">'
    + '<div class="db-card__inner hr-profile-card__body">'
    + '<div class="db-profile__header">'
    + portalProfileAvatarMarkup()
    + '<div class="db-profile__info">'
    + '<h2 class="db-profile__name">' + escapeHTML(user?.display_name ?? '-') + '</h2>'
    + '<div class="db-profile__roles" aria-label="Roles activos">' + roleBadges + '</div>'
    + '</div></div>'
    + '<dl class="db-profile__meta">'
    + '<div class="db-profile__row db-profile__row--id"><dt>ID</dt><dd>' + escapeHTML(String(user?.user_id ?? '-')) + '</dd></div>'
    + '<div class="db-profile__row db-profile__row--email"><dt>Email</dt><dd>' + escapeHTML(user?.email ?? '-') + '</dd></div>'
    + '<div class="db-profile__row db-profile__row--whatsapp"><dt>WhatsApp</dt><dd>' + escapeHTML(user?.whatsapp ?? '-') + '</dd></div>'
    + '</dl>'
    + '</div></article>'
    + '<div class="db-client-home-grid">'
    + sections.map((item, index) => '<button class="db-client-home-card' + (item.hasNews ? ' has-news' : '') + '" type="button" data-section="' + escapeAttr(item.section) + '" aria-label="Abrir ' + escapeAttr(item.label) + '">'
      + '<span class="db-client-home-card__icon" aria-hidden="true"><i class="ph ph-' + escapeAttr(item.icon) + '"></i></span>'
      + '<span class="db-client-home-card__body">'
      + '<span class="db-client-home-card__eyebrow">' + (item.hasNews ? 'Novedad' : 'Prioridad ' + (index + 1)) + '</span>'
      + '<strong>' + escapeHTML(item.label) + '</strong>'
      + '<small>' + (item.visits ? item.visits + ' visita' + (item.visits === 1 ? '' : 's') : 'Acceso recomendado') + '</small>'
      + '</span>'
      + '<i class="ph ph-arrow-up-right db-client-home-card__arrow" aria-hidden="true"></i>'
      + '</button>').join('')
    + '</div></section>';
}
function renderOverview() {
  const { user, roles } = state;

  if (isClientOnlyUser()) return renderClientOverview();

  const roleBadges = roles.map((r) => `
    <span class="db-badge db-badge--role db-badge--${escapeHTML(r)}">${escapeHTML(r.toUpperCase())}</span>
  `).join('');

  const quickActions = buildQuickActions(roles);

  return `
    <section class="db-section db-section--overview hr-portal-section" aria-labelledby="section-overview-title">

      ${renderPortalSectionHeader('Sistema', 'Inicio', 'section-overview-title')}

      <div class="db-grid hr-grid hr-grid-2 db-grid--2col">

        <article class="db-card hr-card db-card--profile hr-profile-card" aria-label="Perfil de usuario">
          <div class="db-card__inner hr-profile-card__body">
            <div class="db-profile__header">
              ${portalProfileAvatarMarkup()}
              <div class="db-profile__info">
              <h2 class="db-profile__name">${escapeHTML(user?.display_name ?? '-')}</h2>
              <div class="db-profile__roles" aria-label="Roles activos">
                ${roleBadges}
              </div>
              </div>
            </div>
            <dl class="db-profile__meta">
              <div class="db-profile__row db-profile__row--id">
                <dt>ID</dt>
                <dd>${escapeHTML(String(user?.user_id ?? '-'))}</dd>
              </div>
              <div class="db-profile__row db-profile__row--email">
                <dt>Email</dt>
                <dd>${escapeHTML(user?.email ?? '-')}</dd>
              </div>
              <div class="db-profile__row db-profile__row--whatsapp">
                <dt>WhatsApp</dt>
                <dd>${escapeHTML(user?.whatsapp ?? '-')}</dd>
              </div>
            </dl>
          </div>
        </article>

        <article class="db-card hr-card hr-action-panel" aria-label="Acciones rápidas">
          <header class="db-card__header">
            <span class="section-label">Acciones rápidas</span>
          </header>
          <div class="db-card__inner">
            <div class="db-quick-actions hr-action-list">
              ${quickActions}
            </div>
          </div>
        </article>

      </div>
    </section>
  `;
}

function renderAccountSettings() {
  const email = state.user?.email ?? '';
  const igUsername = state.user?.ig_username ?? '';

  return sectionShell('Cuenta', 'Ajustes de Cuenta', 'title-account-settings', `
    <div class="db-admin-grid">
      <article class="db-card hr-card">
        <header class="db-card__header">
          <span class="section-label">Acceso</span>
        </header>
        <div class="db-card__inner">
          <form class="db-form" data-form="account-update">
            <label class="db-field">
              <span>Nuevo email</span>
              <input type="email" name="email" autocomplete="email" value="${escapeAttr(email)}" required />
            </label>
            <label class="db-field">
              <span>Usuario de Instagram</span>
              <input type="text" name="ig_username" autocomplete="off" autocapitalize="off" spellcheck="false" value="${escapeAttr(igUsername)}" placeholder="tu_usuario" />
            </label>
            <label class="db-field">
              <span>Nueva contraseña</span>
              <input type="password" name="password" autocomplete="new-password" minlength="8" placeholder="Nueva contraseña" />
            </label>
            <label class="db-field">
              <span>Confirmar contraseña</span>
              <input type="password" name="password_confirm" autocomplete="new-password" minlength="8" placeholder="Confirmar contraseña" />
            </label>
            <button class="btn-primary" type="submit">Guardar cuenta</button>
          </form>
          <a class="db-profile-action db-profile-action--link" href="${escapeAttr(buildWhatsAppLink(PROFILE_UPDATE_WHATSAPP, 'Hola, quiero solicitar actualización de mis datos de perfil en Hidden Room / Mysauth.'))}" target="_blank" rel="noopener noreferrer">
            Solicitar actualización de datos
          </a>
        </div>
      </article>
    </div>
  `);
}

function cleanInstagramUsername(value) {
  return String(value ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@+/, '')
    .split(/[/?#\s]/)[0]
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 30);
}
/** @param {string[]} roles */
function buildQuickActions(roles) {
  const actions = [];

  if (roles.includes('client')) {
    actions.push({ label: 'Cliente > Premios', caption: 'Puntaje de minijuegos', section: 'client-rewards' });
    actions.push({ label: 'Ver Sesiones',      section: 'client-sessions'     });
    actions.push({ label: 'Mis Transacciones', section: 'client-transactions' });
  }
  if (roles.includes('pr')) {
    actions.push({ label: 'Lista de invitados', section: 'rrpp-guestlist'      });
  }
  if (roles.includes('collaborator')) {
    actions.push({ label: 'Ver Tareas',        section: 'collab-tasks'        });
    actions.push({ label: 'Financiero',        section: 'collab-finance'      });
  }

  if (actions.length === 0) {
    return `<p class="db-empty">Sin acciones disponibles para tus roles actuales.</p>`;
  }

  return actions.map((a) => `
    <button class="db-quick-action hr-action-card" data-section="${escapeHTML(a.section)}">
      <span class="db-quick-action__copy">
        <span>${escapeHTML(a.label)}</span>
        ${a.caption ? `<small>${escapeHTML(a.caption)}</small>` : ''}
      </span>
      <span class="db-quick-action__arrow" aria-hidden="true">-></span>
    </button>
  `).join('');
}

async function createUserNotification(userId, message, type = 'info') {
  const targetUserId = String(userId ?? '').trim();
  if (!targetUserId || !message) return false;

  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: targetUserId,
        message,
        type,
        read: false,
      });

    if (error) {
      console.info('[HR] notification insert skipped:', error.message);
      if (/schema cache|could not find the table|404/i.test(error.message)) {
        setState({ notificationsAvailable: false });
      }
      return false;
    }

    if (String(state.user?.user_id ?? '') === targetUserId || String(state.user?.id ?? '') === targetUserId) {
      await loadAndRenderNotifications();
    }
    return true;
  } catch (error) {
    console.info('[HR] notification insert unavailable:', error);
    return false;
  }
}

function renderLoadingBlock(label = 'Cargando') {
  return `
    <section class="db-section hr-portal-section" aria-busy="true" aria-live="polite">
      <header class="db-section__header hr-portal-section__header">
        <p class="section-label">${escapeHTML(label)}</p>
        <h1 class="db-section__title hr-portal-section__title">Cargando...</h1>
      </header>
      <div class="db-grid hr-grid hr-grid-2 db-grid--2col">
        <article class="db-card hr-card db-skeleton-card">
          <div class="db-card__inner">
            <span class="db-skeleton__line db-skeleton__line--wide"></span>
            <span class="db-skeleton__line db-skeleton__line--mid"></span>
            <span class="db-skeleton__line db-skeleton__line--narrow"></span>
          </div>
        </article>
      </div>
    </section>
  `;
}


/* -- CLIENT: DOWNLOADS -------------------------------------- */
function clientHistoryOperationalUserId() {
  const viewAsUserId = state.viewAs?.active
    ? state.viewAs.profile?.user_id
    : null;
  return String(viewAsUserId ?? state.user?.user_id ?? '').trim();
}

function groupClientDownloadsByMonth(rows = []) {
  const groups = new Map();
  rows.forEach((item, index) => {
    const isMembership = item?.release_mode === 'membership_delivery' || item?.membership_cycle_number !== null && item?.membership_cycle_number !== undefined;
    const cycle = isMembership && Number.isFinite(Number(item.membership_cycle_number)) ? Number(item.membership_cycle_number) : null;
    const key = cycle === null ? 'direct' : `membership-${cycle}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: cycle === null ? 'Descargas directas' : `Mes ${cycle}`,
        subtitle: cycle === null ? 'Contenido disponible' : 'Membresía',
        cycle,
        firstIndex: index,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  });
  return [...groups.values()].sort((a, b) => {
    if (a.cycle !== null && b.cycle !== null) return b.cycle - a.cycle;
    if (a.cycle !== null) return -1;
    if (b.cycle !== null) return 1;
    return a.firstIndex - b.firstIndex;
  });
}

function renderClientDownloadsFolders(folders = []) {
  if (!folders.length) return '<div id="js-downloads-body" class="db-downloads-empty db-empty">Sin descargas disponibles.</div>';
  return `
    <div id="js-downloads-body" class="hr-resource-list db-download-folders" aria-label="Carpetas de descargas">
      ${folders.map((folder) => renderPortalResourceCard({
        kind: 'folder', title: folder.title, meta: folder.subtitle,
        count: `${folder.items.length} ${folder.items.length === 1 ? 'archivo' : 'archivos'}`,
        tag: 'button',
        attributes: `data-action="client-downloads-open-folder" data-folder-key="${escapeAttr(folder.key)}" aria-label="Abrir ${escapeAttr(folder.title)}"`,
      })).join('')}
    </div>
  `;
}

function isClientFolderDownload(item = {}) {
  const href = String(item.storage_path || '').trim();
  return String(item.type || '').toLowerCase() === 'folder' || href.includes('/api/download-folder');
}

function renderClientDownloadItem(item = {}) {
  if (isClientFolderDownload(item)) {
    return renderPortalResourceCard({
      kind: 'folder',
      title: item.name ?? 'Carpeta',
      meta: item.notes ? `Carpeta · ${item.notes}` : 'Carpeta de contenido',
      action: `<button class="hr-btn hr-btn--secondary" type="button" data-action="client-download-folder-open" data-download-reference="${escapeAttr(item.storage_path || '')}" data-download-name="${escapeAttr(item.name || 'Carpeta')}">Abrir carpeta</button>`,
    });
  }

  return renderPortalResourceCard({
    kind: 'file',
    title: item.name ?? '-',
    meta: `${item.type ?? 'Archivo'}${item.notes ? ` · ${item.notes}` : ''}`,
    action: `${renderCloudPreviewAction({
      reference: item.storage_path,
      name: item.name,
      type: item.type,
      title: item.name,
    })}${renderDownloadAction(item)}`,
  });
}

function renderClientDownloadsFolder(folder) {
  return `
    <div id="js-downloads-body" class="hr-resource-browser db-downloads-browser">
      <button class="hr-btn hr-btn--secondary db-btn-secondary db-downloads-browser__back" type="button" data-action="client-downloads-back">
        <i class="ph ph-arrow-left" aria-hidden="true"></i>
        <span>Volver a mis descargas</span>
      </button>
      <div class="hr-resource-browser__heading db-downloads-browser__heading">
        <div>
          <p class="section-label">Biblioteca</p>
          <h2>${escapeHTML(folder.title)}</h2>
          <p>${escapeHTML(folder.subtitle)} · ${folder.items.length} ${folder.items.length === 1 ? 'archivo' : 'archivos'}</p>
        </div>
      </div>
      <div class="hr-resource-list db-download-files" aria-label="Archivos de ${escapeAttr(folder.title)}">
        ${folder.items.map((item) => renderClientDownloadItem(item)).join('')}
      </div>
    </div>
  `;
}

async function listClientDownloadFolder(path) {
  const currentPath = normalizeCloudPath(path);
  const response = await cloudApiFetch(`${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}/api/files?path=${encodeURIComponent(currentPath)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `No se pudo abrir la carpeta (${response.status}).`);
  return {
    path: normalizeCloudPath(body?.path || currentPath),
    folders: Array.isArray(body?.folders) ? body.folders : [],
    files: Array.isArray(body?.files) ? body.files : [],
  };
}

function parentCloudPath(path) {
  const normalized = normalizeCloudPath(path);
  if (normalized === '/') return '/';
  const segments = normalized.slice(1).split('/').filter(Boolean);
  segments.pop();
  return normalizeCloudPath('/' + segments.join('/'));
}

function formatCloudFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return 'Archivo';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = -1;
  do { size /= 1024; unitIndex += 1; } while (size >= 1024 && unitIndex < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

async function renderClientDownloadBrowser(folder, browser) {
  try {
    const listing = await listClientDownloadFolder(browser.path);
    const atRoot = normalizeCloudPath(browser.path) === normalizeCloudPath(browser.rootPath);
    const backLabel = atRoot ? `Volver a ${folder.title}` : 'Subir un nivel';
    const folderCards = listing.folders.map((folderName) => renderPortalResourceCard({
      kind: 'folder',
      title: folderName,
      meta: 'Carpeta',
      action: `<button class="hr-btn hr-btn--secondary" type="button" data-action="client-download-folder-open" data-download-reference="${escapeAttr(buildCloudFolderDownloadUrl(browser.path, folderName))}" data-download-name="${escapeAttr(folderName)}">Abrir</button>`,
    })).join('');
    const fileCards = listing.files.map((file) => renderPortalResourceCard({
      kind: 'file',
      title: file.name,
      meta: `${file.size ? formatCloudFileSize(file.size) : 'Archivo'}${file.modified ? ` · ${formatDateTime(file.modified)}` : ''}`,
      action: `${renderCloudPreviewAction({
        reference: buildCloudDownloadUrl(browser.path, file.name),
        name: file.name,
        type: file.type || 'file',
        title: file.name,
      })}${renderDownloadAction({
          name: file.name,
          type: 'file',
          storage_path: buildCloudDownloadUrl(browser.path, file.name),
        })}`,
    })).join('');
    const cards = folderCards + fileCards;

    return `
      <div id="js-downloads-body" class="hr-resource-browser db-downloads-browser">
        <button class="hr-btn hr-btn--secondary db-btn-secondary db-downloads-browser__back" type="button" data-action="client-download-folder-back" data-parent-path="${escapeAttr(atRoot ? '' : parentCloudPath(browser.path))}">
          <i class="ph ph-arrow-left" aria-hidden="true"></i>
          <span>${escapeHTML(backLabel)}</span>
        </button>
        <div class="hr-resource-browser__heading db-downloads-browser__heading">
          <div>
            <p class="section-label">Carpeta de descarga</p>
            <h2>${escapeHTML(browser.name)}</h2>
            <p>${listing.folders.length + listing.files.length} elementos</p>
          </div>
        </div>
        <div class="hr-resource-list db-download-files" aria-label="Contenido de ${escapeAttr(browser.name)}">
          ${cards || '<p class="db-empty">Esta carpeta no contiene archivos.</p>'}
        </div>
      </div>
    `;
  } catch (error) {
    return `
      <div id="js-downloads-body" class="hr-resource-browser db-downloads-browser">
        <button class="hr-btn hr-btn--secondary db-btn-secondary db-downloads-browser__back" type="button" data-action="client-download-folder-back">
          <i class="ph ph-arrow-left" aria-hidden="true"></i>
          <span>Volver a ${escapeHTML(folder.title)}</span>
        </button>
        <p class="db-empty db-empty--error">${escapeHTML(error?.message || 'No se pudo abrir la carpeta.')}</p>
      </div>
    `;
  }
}

async function renderClientDownloads() {
  const userId = clientHistoryOperationalUserId();
  const { data, error } = await supabase
    .from('downloads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[HR] renderClientDownloads:', error);
    return sectionShell('Cliente', 'Descargas', 'title-downloads', '<p class="db-empty db-empty--error">Error al cargar descargas. Intenta de nuevo.</p>');
  }
  const folders = groupClientDownloadsByMonth(data || []);
  const selectedKey = state.clientDownloads?.selectedFolder;
  const selectedFolder = folders.find((folder) => folder.key === selectedKey) || null;
  const browser = state.clientDownloads?.browser;
  const body = selectedFolder
    ? (browser ? await renderClientDownloadBrowser(selectedFolder, browser) : renderClientDownloadsFolder(selectedFolder))
    : renderClientDownloadsFolders(folders);
  return sectionShell('Cliente', 'Descargas', 'title-downloads', `
    <p class="db-section__intro">Tu biblioteca de contenido</p>
    ${body}
  `, 'db-section--client-downloads');
}
function isCloudDownloadUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(String(value), window.location.origin);
    return url.hostname === 'cloud.hiddenroom.mx';
  } catch {
    return false;
  }
}

function isCloudStoragePath(value) {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  return /^\/(?:files\/)?users\/[^/]+\/.+/i.test(raw)
    || /^\/(?:files\/)?downloads\/.+/i.test(raw);
}

function downloadReleaseLabel(item = {}) {
  return item.release_mode === 'membership_delivery'
    ? 'Membresía - Mes ' + (item.membership_cycle_number ?? '-')
    : 'Directa';
}

function renderDownloadAction(item) {
  const href = String(item?.storage_path || '').trim();
  if (!href) return '-';
  const isCloudFolder = String(item?.type || '').toLowerCase() === 'folder' || href.includes('/api/download-folder');
  const isCloudFile = !isCloudFolder && (isCloudDownloadUrl(href) || isCloudStoragePath(href));
  const isCloud = isCloudFolder || isCloudFile;
  const label = isCloudFolder ? 'Descargar carpeta' : (isCloudFile ? 'Descarga directa' : 'Descargar');
  const dataAttrs = isCloudFolder
    ? 'data-cloud-folder-download data-cloud-reference="' + escapeAttr(href) + '"'
    : (isCloudFile ? 'data-direct-cloud-download="true" data-cloud-reference="' + escapeAttr(href) + '"' : 'target="_blank" rel="noopener noreferrer"');
  return '<a class="btn-primary db-download-action' + (isCloud ? ' db-download-action--cloud' : '') + '" href="' + escapeAttr(href) + '" ' + dataAttrs + ' aria-label="' + escapeAttr(label) + '">' +
    '<svg class="db-download-action__icon" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>' +
    '<span>' + escapeHTML(label) + '</span></a>';
}

function isPreviewableCloudAudio(name, type = '') {
  const mime = String(type || '').toLowerCase().trim();
  if (mime.startsWith('audio/')) return true;
  return CLOUD_PREVIEW_AUDIO_EXTENSIONS.has(fileExtension(name));
}

function renderCloudPreviewAction({ reference = '', name = '', type = '', title = '' } = {}) {
  const safeReference = String(reference || '').trim();
  const safeName = String(name || '').trim();
  let cloudRequest = null;
  try { cloudRequest = cloudDownloadRequestFromHref(safeReference); } catch {}
  const previewName = cloudRequest?.name || safeName;
  if (!safeReference || !safeName || !cloudRequest || !isPreviewableCloudAudio(previewName, type)) return '';
  return '<button class="hr-btn hr-btn--secondary db-preview-action" type="button" data-action="client-download-preview" data-preview-reference="' + escapeAttr(safeReference) + '" data-preview-title="' + escapeAttr(title || safeName) + '" aria-label="Reproducir vista previa de ' + escapeAttr(title || safeName) + '">' +
    '<i class="ph ph-play-circle" aria-hidden="true"></i>' +
    '<span>Vista previa</span></button>';
}

function closeCloudPreviewPlayer() {
  const overlay = document.getElementById('js-cloud-preview-player');
  const audio = overlay?.querySelector('[data-cloud-preview-audio]');
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  if (overlay) {
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
  }
  document.documentElement.classList.remove('hr-cloud-preview-open');
}

function openCloudPreviewPlayer({ src, title, fileName, downloadReference } = {}) {
  if (!src) return;
  let overlay = document.getElementById('js-cloud-preview-player');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'js-cloud-preview-player';
    overlay.className = 'db-preview-player';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'js-cloud-preview-player-title');
    overlay.innerHTML = `
      <div class="db-preview-player__surface">
        <header class="db-preview-player__header">
          <img class="db-preview-player__logo" src="/assets/img/white_logo.webp" alt="Hidden Room" />
          <div>
            <p class="section-label">Vista previa</p>
            <h2 class="db-preview-player__title" id="js-cloud-preview-player-title"></h2>
            <p class="db-preview-player__file" data-cloud-preview-file></p>
          </div>
          <button class="hr-icon-btn db-preview-player__close" type="button" data-cloud-preview-close aria-label="Cerrar reproductor" title="Cerrar reproductor">
            <i class="ph ph-x" aria-hidden="true"></i>
          </button>
        </header>
        <div class="db-preview-player__body">
          <div class="db-preview-player__art" aria-hidden="true"><i class="ph ph-waveform"></i></div>
          <audio data-cloud-preview-audio controls preload="metadata" controlsList="nodownload noplaybackrate"></audio>
        </div>
        <footer class="db-preview-player__footer">
          <span>Contenido protegido · reproducción temporal</span>
          <div class="db-preview-player__actions">
            <button class="hr-btn hr-btn--primary" type="button" data-cloud-preview-download>
              <i class="ph ph-download-simple" aria-hidden="true"></i>
              <span>Descargar</span>
            </button>
            <button class="hr-btn hr-btn--secondary" type="button" data-cloud-preview-close>Cerrar</button>
          </div>
        </footer>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('[data-cloud-preview-close]')) closeCloudPreviewPlayer();
      const downloadButton = event.target.closest('[data-cloud-preview-download]');
      if (downloadButton) downloadCloudFileFromPortal(downloadButton);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) closeCloudPreviewPlayer();
    });
  }

  const audio = overlay.querySelector('[data-cloud-preview-audio]');
  const titleElement = overlay.querySelector('.db-preview-player__title');
  const fileElement = overlay.querySelector('[data-cloud-preview-file]');
  const downloadButton = overlay.querySelector('[data-cloud-preview-download]');
  if (titleElement) titleElement.textContent = title || 'Vista previa';
  if (fileElement) fileElement.textContent = fileName || '';
  if (downloadButton) {
    downloadButton.dataset.cloudReference = downloadReference || '';
    downloadButton.disabled = !downloadReference;
  }
  if (audio) {
    audio.pause();
    audio.src = src;
    audio.load();
  }
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('hr-cloud-preview-open');
  overlay.querySelector('[data-cloud-preview-close]')?.focus();
  audio?.play().catch(() => {});
}

async function playCloudPreviewFromPortal(button) {
  const request = cloudDownloadRequestFromHref(button?.dataset?.previewReference || '');
  if (!request) {
    showToast('El archivo no tiene una ruta Cloud válida.', 'error');
    return;
  }

  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.classList.add('is-loading');
  try {
    const previewEndpoint = `${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}/api/download-link?path=${encodeURIComponent(request.path)}&name=${encodeURIComponent(request.name)}&mode=view`;
    const response = await cloudApiFetch(previewEndpoint);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.url) {
      throw new Error(body?.error || `No se pudo preparar la vista previa (${response.status}).`);
    }

    const previewUrl = new URL(body.url, CLOUD_HIDDENROOM_URL).href;
    openCloudPreviewPlayer({
      src: previewUrl,
      title: button.dataset.previewTitle || request.name,
      fileName: request.name,
      downloadReference: button.dataset.previewReference,
    });
  } catch (error) {
    console.error('[HR] cloud preview:', error);
    showToast(error?.message || 'No se pudo reproducir la vista previa.', 'error');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.classList.remove('is-loading');
  }
}

function cloudDownloadRequestFromHref(href) {
  const raw = String(href || '').trim();
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw, CLOUD_HIDDENROOM_URL);
  } catch {
    return null;
  }

  const isCloudUrl = url.hostname === 'cloud.hiddenroom.mx';
  const queryPath = url.searchParams.get('path');
  const queryName = url.searchParams.get('name');
  let pathValue = queryPath;
  let name = queryName;

  if (!pathValue || !name) {
    if (!isCloudUrl && !isCloudStoragePath(raw)) return null;
    const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
    if (segments[0]?.toLowerCase() === 'files') segments.shift();
    name = name || segments.pop();
    pathValue = pathValue || `/${segments.join('/')}`;
  }

  if (!name) return null;
  let pathSegments = normalizeCloudPath(pathValue).slice(1).split('/').filter(Boolean);
  if (pathSegments[0]?.toLowerCase() === 'files') pathSegments = pathSegments.slice(1);
  // View-as keeps the authenticated Cloud session as admin even when the
  // effective Portal role is the selected client. Preserve /users/... paths
  // in that context so legacy Cloud links resolve against the admin root.
  const cloudSessionCanUseUserRoots = hasRole('admin') || Boolean(state.viewAs?.active);
  if (!cloudSessionCanUseUserRoots && pathSegments[0]?.toLowerCase() === 'users' && pathSegments.length >= 2) {
    pathSegments = pathSegments.slice(2);
  }
  return {
    path: normalizeCloudPath('/' + pathSegments.join('/')),
    name: String(name),
  };
}

async function downloadCloudFolderFromPortal(link) {
  const request = cloudDownloadRequestFromHref(link?.dataset?.cloudReference || link?.href);
  if (!request) return false;
  const apiUrl = buildCloudFolderDownloadUrl(request.path, request.name);
  link.setAttribute('aria-busy', 'true');
  link.classList.add('is-loading');
  try {
    const response = await cloudApiFetch(apiUrl, { headers: { Accept: 'application/zip' } });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(detail || 'No se pudo descargar la carpeta (' + response.status + ')');
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = request.name + '.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    showToast('Descarga de carpeta iniciada.', 'success');
    return true;
  } catch (err) {
    console.error('[HR] direct cloud folder download:', err);
    showToast(err.message || 'No se pudo descargar la carpeta desde Cloud.', 'error');
    return false;
  } finally {
    link.removeAttribute('aria-busy');
    link.classList.remove('is-loading');
  }
}
async function downloadCloudFileFromPortal(link) {
  const request = cloudDownloadRequestFromHref(link?.dataset?.cloudReference || link?.href);
  if (!request) return false;
  const apiUrl = buildCloudDownloadUrl(request.path, request.name);
  link.setAttribute('aria-busy', 'true');
  link.classList.add('is-loading');
  try {
    const response = await cloudApiFetch(apiUrl, { headers: { Accept: 'application/octet-stream' } });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(detail || `No se pudo descargar el archivo (${response.status})`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = request.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    showToast('Descarga iniciada.', 'success');
    return true;
  } catch (err) {
    console.error('[HR] direct cloud download:', err);
    showToast(err.message || 'No se pudo descargar desde Cloud.', 'error');
    return false;
  } finally {
    link.removeAttribute('aria-busy');
    link.classList.remove('is-loading');
  }
}


/* -- CLIENT: SESSIONS --------------------------------------- */
async function renderClientSessions() {
  const userId = clientHistoryOperationalUserId();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('session_date', { ascending: false });

  if (error) {
    console.error('[HR] renderClientSessions:', error);
    return `
      <section class="db-section hr-portal-section" aria-labelledby="title-sessions">
        <header class="db-section__header hr-portal-section__header">
          <p class="section-label">Cliente</p>
          <h1 class="db-section__title hr-portal-section__title" id="title-sessions">Sesiones</h1>
        </header>
        <p class="db-empty db-empty--error">Error al cargar sesiones. Intenta de nuevo.</p>
      </section>
    `;
  }

  let rows;

  if (!data || data.length === 0) {
    rows = `
      <tr class="db-table__empty-row hr-table-empty">
        <td colspan="4" class="db-empty hr-table-empty">Sin sesiones registradas.</td>
      </tr>
    `;
  } else {
    rows = data.map((s) => `
      <tr>
        <td>${escapeHTML(s.concept ?? '-')}</td>
        <td>${s.session_date ? formatDisplayDateOnly(s.session_date) : '-'}</td>
        <td>${escapeHTML(s.cost != null ? `$${s.cost}` : '-')}</td>
        <td>${escapeHTML(s.notes ?? '-')}</td>
      </tr>
    `).join('');
  }

  return `
    <section class="db-section hr-portal-section" aria-labelledby="title-sessions">
      <header class="db-section__header hr-portal-section__header">
        <p class="section-label">Cliente</p>
        <h1 class="db-section__title hr-portal-section__title" id="title-sessions">Sesiones</h1>
      </header>
      <div class="db-table-wrap hr-table-wrap">
        <table class="db-table hr-table hr-table-readable" aria-label="Historial de sesiones">
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col">Fecha</th>
              <th scope="col">Costo</th>
              <th scope="col">Notas</th>
            </tr>
          </thead>
          <tbody id="js-sessions-body">
            ${rows}
          </tbody>
        </table>
      </div>
    </section>
  `;
}


/* -- CLIENT: TRANSACTIONS ----------------------------------- */
async function renderClientTransactions() {
  const userId = clientHistoryOperationalUserId();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('[HR] renderClientTransactions:', error);
    return `
      <section class="db-section hr-portal-section" aria-labelledby="title-txn">
        <header class="db-section__header hr-portal-section__header">
          <p class="section-label">Cliente</p>
          <h1 class="db-section__title hr-portal-section__title" id="title-txn">Transacciones</h1>
        </header>
        <p class="db-empty db-empty--error">Error al cargar transacciones. Intenta de nuevo.</p>
      </section>
    `;
  }

  let rows;

  if (!data || data.length === 0) {
    rows = `
      <tr class="db-table__empty-row hr-table-empty">
        <td colspan="5" class="db-empty hr-table-empty">Sin transacciones registradas.</td>
      </tr>
    `;
  } else {
    rows = data.map((tx) => `
      <tr>
        <td>${escapeHTML(tx.type ?? '-')}</td>
        <td>$${escapeHTML(String(tx.amount ?? 0))}</td>
        <td>${tx.date ? formatDisplayDateOnly(tx.date) : '-'}</td>
        <td>${escapeHTML(tx.via ?? '-')}</td>
      </tr>
    `).join('');
  }

  return `
    <section class="db-section hr-portal-section" aria-labelledby="title-txn">
      <header class="db-section__header hr-portal-section__header">
        <p class="section-label">Cliente</p>
        <h1 class="db-section__title hr-portal-section__title" id="title-txn">Transacciones</h1>
      </header>
      <div class="db-table-wrap hr-table-wrap">
        <table class="db-table hr-table hr-table-readable" aria-label="Historial de transacciones">
          <thead>
            <tr>
              <th scope="col">Tipo</th>
              <th scope="col">Monto</th>
              <th scope="col">Fecha</th>
              <th scope="col">Vía</th>
            </tr>
          </thead>
          <tbody id="js-txn-body">
            ${rows}
          </tbody>
        </table>
      </div>
    </section>
  `;
}


/* -- CLIENT: CONTRACTS -------------------------------------- */
async function renderClientContracts() {
  const userId = clientHistoryOperationalUserId();
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[HR] renderClientContracts:', error);
    return `
      <section class="db-section hr-portal-section" aria-labelledby="title-contracts">
        <header class="db-section__header hr-portal-section__header">
          <p class="section-label">Cliente</p>
          <h1 class="db-section__title hr-portal-section__title" id="title-contracts">Contratos</h1>
        </header>
        <p class="db-empty db-empty--error">Error al cargar contratos. Intenta de nuevo.</p>
      </section>
    `;
  }

  let listHTML;

  if (!data || data.length === 0) {
    listHTML = '<li class="db-empty">Sin contratos disponibles.</li>';
  } else {
    listHTML = data.map((c) => `
      <li class="db-card-list__item hr-list-item">
        <span class="db-card-list__label">Contrato #${escapeHTML(String(c.id))}</span>
        ${c.contract
          ? `<a class="btn-primary" href="${escapeHTML(c.contract)}" target="_blank" rel="noopener noreferrer">Ver contrato</a>`
          : '<span class="db-empty">Sin archivo adjunto.</span>'}
      </li>
    `).join('');
  }

  return `
    <section class="db-section hr-portal-section" aria-labelledby="title-contracts">
      <header class="db-section__header hr-portal-section__header">
        <p class="section-label">Cliente</p>
        <h1 class="db-section__title hr-portal-section__title" id="title-contracts">Contratos</h1>
      </header>
      <ul class="db-card-list hr-resource-list" id="js-contracts-list" role="list">
        ${listHTML}
      </ul>
    </section>
  `;
}

async function renderClientMembership() {
  const userId = clientHistoryOperationalUserId();
  const [membershipsResult, sessionsResult, transactionsResult, materialDeliveriesResult] = await Promise.all([
    supabase
      .from('memberships')
      .select('id, user_id, username, status, start_date, end_date, weekly_price, sessions_per_week, notes')
      .eq('user_id', userId)
      .order('start_date', { ascending: true }),
    supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('session_date', { ascending: true }),
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true }),
    fetchMembershipMaterialDeliveries(userId),
  ]);

  if (membershipsResult.error || sessionsResult.error || transactionsResult.error) {
    console.error('[HR] renderClientMembership:', membershipsResult.error || sessionsResult.error || transactionsResult.error);
    return `
      <section class="db-section hr-portal-section" aria-labelledby="title-membership">
        <header class="db-section__header hr-portal-section__header">
          <p class="section-label">Cliente</p>
          <h1 class="db-section__title hr-portal-section__title" id="title-membership">Membresía</h1>
        </header>
        <p class="db-empty db-empty--error">Error al cargar membresía. Intenta de nuevo.</p>
      </section>
    `;
  }

  const membershipRows = buildMembershipRows(
    membershipsResult.data ?? [],
    sessionsResult.data ?? [],
    transactionsResult.data ?? [],
    materialDeliveriesResult ?? []
  );
  const visibleMembershipRows = sortRowsByColumn(membershipRows, 'fecha_esperada', 'desc');
  const membershipNotices = renderMembershipNotices(membershipRows);
  const membershipSummary = renderMembershipSummary(membershipRows);
  const hasActiveMembership = membershipIsCurrentlyActive(membershipsResult.data ?? []);

  return `
    <section class="db-section hr-portal-section" aria-labelledby="title-membership">
      <header class="db-section__header hr-portal-section__header">
        <p class="section-label">Cliente</p>
        <h1 class="db-section__title hr-portal-section__title" id="title-membership">Membresía</h1>
      </header>
      ${membershipNotices}
      ${membershipSummary}
      ${renderMembershipDashboardTable(visibleMembershipRows)}
      ${renderMembershipSyncFooter(hasActiveMembership)}
    </section>
  `;
}


/* -- CLIENT: TICKETS ---------------------------------------- */
async function renderClientTickets() {
  const userId = clientHistoryOperationalUserId();
  let tickets = [];

  if (userId) {
    const { data, error } = await supabase
      .from('event_tickets')
      .select('id, event_key, folio, qr_payload, status, price, sold_at, used_at, ticket_type, customer_name, customer_email, user_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[HR] renderClientTickets:', error);
      return `
        <section class="db-section hr-portal-section" aria-labelledby="title-tickets">
          <header class="db-section__header hr-portal-section__header">
            <p class="section-label">Cliente</p>
            <h1 class="db-section__title hr-portal-section__title" id="title-tickets">Tickets de Evento</h1>
          </header>
          <p class="db-empty db-empty--error">Error al cargar tickets. Intenta de nuevo.</p>
        </section>
      `;
    }

    tickets = data ?? [];
  }

  const listHTML = tickets.length
    ? tickets.map((ticket) => renderClientTicketCard(ticket)).join('')
    : '<li class="db-empty">Sin tickets adquiridos.</li>';

  return `
    <section class="db-section hr-portal-section" aria-labelledby="title-tickets">
      <header class="db-section__header hr-portal-section__header">
        <p class="section-label">Cliente</p>
        <h1 class="db-section__title hr-portal-section__title" id="title-tickets">Tickets de Evento</h1>
      </header>
      <ul class="db-card-list hr-resource-list" id="js-tickets-list" role="list">
        ${listHTML}
      </ul>
    </section>
  `;
}

function safeDomId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function clientTicketQrPayload(ticket) {
  const folio = String(ticket?.folio ?? '').trim();
  return String(ticket?.qr_payload || `https://hiddenroom.mx/tickets/validate.html?folio=${encodeURIComponent(folio)}`).trim();
}

function clientTicketQrId(ticket) {
  return `client-ticket-qr-${safeDomId(ticket?.folio || ticket?.id)}`;
}

function renderClientTicketCard(ticket) {
  const folio = String(ticket.folio ?? '').trim();
  return `
    <li class="db-client-ticket-card">
      <div class="db-client-ticket-card__qr" id="${escapeAttr(clientTicketQrId(ticket))}" data-ticket-qr="${escapeAttr(clientTicketQrPayload(ticket))}" aria-label="QR del ticket ${escapeAttr(folio)}"></div>
      <div class="db-client-ticket-card__body">
        <span class="section-label">${escapeHTML(ticket.event_key ?? 'Evento')}</span>
        <strong class="db-client-ticket-card__folio">${escapeHTML(folio || '-')}</strong>
        <dl class="db-client-ticket-card__meta">
          <div><dt>Tipo</dt><dd>${escapeHTML(ticket.ticket_type ?? 'TICKET')}</dd></div>
          <div><dt>Estado</dt><dd>${escapeHTML(ticket.status ?? '-')}</dd></div>
          ${ticket.used_at ? `<div><dt>Usado</dt><dd>${escapeHTML(formatDateTime(ticket.used_at))}</dd></div>` : ''}
        </dl>
      </div>
    </li>
  `;
}

function renderClientTicketQrs(root = document) {
  root.querySelectorAll('[data-ticket-qr]').forEach((container) => {
    const payload = container.dataset.ticketQr;
    if (!payload || container.dataset.qrRendered === 'true') return;
    container.dataset.qrRendered = 'true';
    container.textContent = '';

    if (!window.QRCode) {
      container.textContent = 'QR no disponible';
      return;
    }

    new window.QRCode(container, {
      text: payload,
      width: 132,
      height: 132,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.M,
    });
  });
}


/* -- CLIENT: STORE ------------------------------------------ */
function renderClientStore() {
  return `
    <section class="db-section hr-portal-section" aria-labelledby="title-store">
      <header class="db-section__header hr-portal-section__header">
        <p class="section-label">Cliente</p>
        <h1 class="db-section__title hr-portal-section__title" id="title-store">Tienda Online - Pedidos</h1>
      </header>
      <div class="db-table-wrap hr-table-wrap">
        <table class="db-table hr-table hr-table-readable" aria-label="Historial de pedidos">
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Producto</th>
              <th scope="col">Total</th>
              <th scope="col">Estado</th>
              <th scope="col">Fecha</th>
            </tr>
          </thead>
          <tbody id="js-store-body">
            <tr class="db-table__empty-row hr-table-empty">
              <td colspan="5" class="db-empty hr-table-empty">Sin pedidos registrados.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}


/* -- CLIENT: REWARDS ---------------------------------------- */
async function renderClientRewards() {
  const userId = clientHistoryOperationalUserId();
  const [
    { data: scores, error: scoresError },
    { data: rewards, error: rewardsError },
    { data: igContest, error: igContestError },
  ] = await Promise.all([
    supabase
      .from('scores')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('rewards')
      .select('id, concept, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('ig_contest')
      .select('id, concepto, user_id, ig_username, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (scoresError || rewardsError || igContestError) {
    console.error('[HR] renderClientRewards:', scoresError || rewardsError || igContestError);
    return `
      <section class="db-section hr-portal-section" aria-labelledby="title-rewards">
        <header class="db-section__header hr-portal-section__header">
          <p class="section-label">Cliente</p>
          <h1 class="db-section__title hr-portal-section__title" id="title-rewards">Premios</h1>
        </header>
        <p class="db-empty db-empty--error">Error al cargar premios. Intenta de nuevo.</p>
      </section>
    `;
  }

  let scoresHTML;

  if (!scores || scores.length === 0) {
    scoresHTML = '<p class="db-empty">Ingresa <a href="../minijuegos/">MINIJUEGOS</a> para sincronizar tu puntuacion.</p>';
  } else {
    scoresHTML = `
      <ul class="db-card-list hr-resource-list" role="list">
        ${scores.map((s) => `
          <li class="db-card-list__item hr-list-item">
            <span class="db-card-list__label">${escapeHTML(s.game_id ?? '-')}</span>
            <span class="db-card-list__value">${escapeHTML(s.type ?? '')} ${escapeHTML(String(s.amount ?? 0))} pts</span>
          </li>
        `).join('')}
      </ul>
    `;
  }

  const rewardsHTML = rewards?.length
    ? rewards.map((reward) => `
      <li class="db-card-list__item hr-list-item">
        <span class="db-card-list__label">${escapeHTML(reward.concept ?? 'Recompensa')}</span>
      </li>
    `).join('')
    : '<li class="db-empty">Sin recompensas.</li>';

  const igContestHTML = igContest?.length
    ? igContest.map((item) => `
      <li class="db-card-list__item hr-list-item">
        <span class="db-card-list__label">${escapeHTML(item.concepto ?? 'IG CONTEST')}</span>
        <span class="db-card-list__value">${escapeHTML(item.ig_username ? `@${item.ig_username}` : '')}</span>
      </li>
    `).join('')
    : '<li class="db-empty">Sin registros de IG CONTEST.</li>';

  return `
    <section class="db-section hr-portal-section" aria-labelledby="title-rewards">
      <header class="db-section__header hr-portal-section__header">
        <p class="section-label">Cliente</p>
        <h1 class="db-section__title hr-portal-section__title" id="title-rewards">Premios</h1>
        <a class="btn-primary db-section__cta" href="../minijuegos/">MINIJUEGOS</a>
      </header>
      <div class="db-grid hr-grid hr-grid-3 db-grid--3col">
        <article class="db-card hr-card" aria-label="Puntuaciones">
          <header class="db-card__header">
            <span class="section-label">Puntuaciones</span>
          </header>
          <div class="db-card__inner" id="js-rewards-scores">
            ${scoresHTML}
          </div>
        </article>
        <article class="db-card hr-card" aria-label="Cupones">
          <header class="db-card__header">
            <span class="section-label">Cupones Desbloqueados</span>
          </header>
          <ul class="db-coupon-list hr-resource-list" id="js-rewards-coupons" role="list">
            <li class="db-empty">Proximamente.</li>
          </ul>
        </article>
        <article class="db-card hr-card" aria-label="IG CONTEST">
          <header class="db-card__header">
            <span class="section-label">IG CONTEST</span>
          </header>
          <ul class="db-card-list hr-resource-list" id="js-rewards-ig-contest" role="list">
            ${igContestHTML}
          </ul>
        </article>
        <article class="db-card hr-card" aria-label="Tus recompensas">
          <header class="db-card__header">
            <span class="section-label">Tus recompensas</span>
          </header>
          <ul class="db-card-list hr-resource-list" id="js-rewards-inventory" role="list">
            ${rewardsHTML}
          </ul>
        </article>
      </div>
    </section>
  `;
}


/* -- COLLABORATOR ------------------------------------------- */
async function renderCollabDocs() {
  const { data, error } = await fetchPartnerContractsForCurrentUser();

  if (error) {
    console.error('[HR] renderCollabDocs:', error);
    return sectionShell('Colaborador', 'Documentos/Contratos', 'title-collab-docs', `
      <p class="db-empty db-empty--error">Error al cargar documentos/contratos.</p>
    `);
  }

  const rows = (data ?? []).length
    ? data.map((item) => {
      const title = item.title ?? item.name ?? item.contract_name ?? `Contrato #${item.id ?? '-'}`;
      const href = item.file_url ?? item.contract_url ?? item.storage_path ?? item.contract ?? '';
      return `
        <li class="db-card-list__item hr-list-item">
          <span class="db-card-list__label">${escapeHTML(title)}</span>
          <span class="db-card-list__value">${escapeHTML(item.status ?? item.type ?? 'documento')}</span>
          ${href ? `<a class="btn-primary" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">Ver</a>` : '<span class="db-empty">Sin archivo adjunto.</span>'}
        </li>
      `;
    }).join('')
    : '<li class="db-empty">Sin documentos/contratos compartidos.</li>';

  return sectionShell('Colaborador', 'Documentos/Contratos', 'title-collab-docs', `
    <ul class="db-card-list hr-resource-list" id="js-collab-docs-list" role="list">${rows}</ul>
  `);
}

async function renderCollabFinance() {
  await ensureUsersLoaded();
  if (!hasRole('admin') && !hasPermission('events.access')) {
    return sectionShell('Colaborador', 'Financiero', 'title-collab-finance', `
      <p class="db-empty db-empty--error">No tienes permiso para ver finanzas de eventos.</p>
    `);
  }

  const filters = getEventFinanceFilters();
  const events = await ensureCollabFinanceEventsLoaded();
  const paymentMethods = await fetchPaymentMethods();
  if (!events.length) {
    return sectionShell('Colaborador', 'Financiero', 'title-collab-finance', `
      <p class="db-empty">No tienes eventos asignados todavía.</p>
    `);
  }

  const storedCollabEventId = persistedDataValue('collabFinanceEventId', '');
  if (storedCollabEventId && !events.some((event) => String(event.id ?? event.event_id) === String(storedCollabEventId))) {
    setPersistedDataValue('collabFinanceEventId', '');
  }
  const eventId = persistedDataValue('collabFinanceEventId', '') || String(events[0].id ?? events[0].event_id);
  setPersistedDataValue('collabFinanceEventId', eventId);
  const selectedEvent = events.find((event) => String(event.id ?? event.event_id) === String(eventId));
  const permissions = eventAccessFor(selectedEvent);
  const { data, error } = await fetchCollabFinanceTransactions(filters, eventId, events);
  const participants = await fetchParticipantsForEvent(selectedEvent?.id ?? selectedEvent?.event_id ?? eventId);
  const financeEntities = await fetchFinanceEntities();

  if (error) {
    console.error('[HR] renderCollabFinance:', error);
    return sectionShell('Colaborador', 'Financiero', 'title-collab-finance', `
      <p class="db-empty db-empty--error">Error al cargar transacciones relacionadas.</p>
    `);
  }

  state.data.collabFinanceRows = data ?? [];
  state.data.collabFinanceFilters = { ...filters, scope: 'events', eventId };
  state.data.collabFinanceSelectedEvent = selectedEvent ?? null;

  return sectionShell('Colaborador', 'Financiero', 'title-collab-finance', `
    ${renderCollabFinanceEventFilter(events, eventId)}
    ${renderFinanceFilters(filters, { showComparison: false })}
    ${renderEventInfo(selectedEvent)}
    ${renderEventSummaryCards(eventSummaryFor(selectedEvent, data ?? []))}
    ${renderEventRightsChart(selectedEvent, data ?? [])}
    ${permissions.can_add_finance ? renderEventMovementForm(selectedEvent, 'collab-event-movement-create', participants, financeEntities, paymentMethods) : ''}
    ${renderEventFinanceTransactionsTable(data ?? [], { canEdit: permissions.can_edit_finance })}
  `);
}

async function ensureCollabFinanceEventsLoaded() {
  if (Array.isArray(state.data.collabFinanceEvents)) return state.data.collabFinanceEvents;

  state.data.collabFinanceEvents = await fetchAccessibleEventFinanceOptions('collab finance');
  return state.data.collabFinanceEvents;
}

async function fetchCollabFinanceTransactions(filters, eventId, events = []) {
  return fetchHrEventFinanceTransactions(filters, eventId, events);
}

function renderCollabFinanceEventFilter(events = [], selectedEventId = '') {
  return renderHrDisclosure({
    key: 'collab.finance.toolbar.event-scope',
    title: 'Vista y exportación',
    meta: 'Evento',
    className: 'db-finance-toolbar-disclosure',
    body: `<div class="db-toolbar hr-table-toolbar">
        <label class="db-field db-field--compact">
          <span>Eventos</span>
          <select data-action="collab-finance-event" aria-label="Filtrar financiero por evento">
            ${events.map((event) => optionHTML(String(event.id ?? event.event_id), eventLabel(event), selectedEventId)).join('')}
          </select>
        </label>
        <button class="db-btn-secondary" type="button" data-action="export-finance-pdf">Exportar PDF</button>
      </div>`,
  });
}

async function renderCollabTasks(contextLabel = 'Colaborador') {
  if (!hasAnyPermission(['scrum.view', 'scrum.edit'])) {
    return sectionShell(contextLabel, 'SCRUM / Tareas', 'title-tasks', `
      <p class="db-empty db-empty--error">No tienes permiso para ver este modulo.</p>
    `);
  }

  const [{ data: users, error: usersError }, eventsResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, user_id, display_name, username, email, passline_tracking')
      .order('display_name', { ascending: true }),
    fetchScrumEvents(),
  ]);
  const { data: events, error: eventsError } = eventsResult;

  if (usersError || eventsError) {
    console.error('[HR] renderCollabTasks:', usersError || eventsError);
    return sectionShell(contextLabel, 'SCRUM / Tareas', 'title-tasks', `
      <p class="db-empty db-empty--error">Error al cargar tareas. Intenta de nuevo.</p>
    `);
  }

  const scrumEvents = normalizeEventFinanceOptions(events ?? []);
  state.data.users = uniqueUsers(users);
  state.data.scrumEvents = scrumEvents;
  if (state.data.scrumEventId === undefined) {
    state.data.scrumEventId = persistedDataValue('scrumEventId', '');
  }
  if (state.data.scrumEventId && !scrumEvents.some((event) => String(event.id) === String(state.data.scrumEventId))) {
    state.data.scrumEventId = '';
    setPersistedDataValue('scrumEventId', '');
  }
  if (!state.data.scrumEventId && scrumEvents.length) {
    state.data.scrumEventId = String(scrumEvents[0].id);
    setPersistedDataValue('scrumEventId', state.data.scrumEventId);
  }

  const selectedEvent = scrumEvents.find((event) => String(event.id) === String(state.data.scrumEventId));
  if (!selectedEvent || !canViewScrum(selectedEvent)) {
    return sectionShell(contextLabel, 'SCRUM / Tareas', 'title-tasks', `
      <p class="db-empty">No tienes eventos SCRUM asignados.</p>
    `);
  }
  const editable = canEditScrum(selectedEvent);

  let taskQuery = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (state.data.scrumEventId) taskQuery = taskQuery.eq('event_id', state.data.scrumEventId);

  const { data: tasks, error: tasksError } = await taskQuery;
  if (tasksError) {
    console.error('[HR] renderCollabTasks:', tasksError);
    return sectionShell(contextLabel, 'SCRUM / Tareas', 'title-tasks', `
      <p class="db-empty db-empty--error">Error al cargar tareas para el evento seleccionado.</p>
    `);
  }

  state.data.tasks = tasks ?? [];

  const formHTML = editable ? renderTaskForm() : `
    <p class="db-empty">Modo lectura. Solicita scrum.edit para crear o modificar tareas.</p>
  `;

  const colHTML = SCRUM_COLUMNS.map((column) => {
    const columnTasks = (tasks ?? []).filter((task) => (task.status || 'todo') === column.key);
    const list = columnTasks.length
      ? columnTasks.map((task) => renderTaskCard(task, editable)).join('')
      : '<li class="db-empty">Sin tareas.</li>';

    return `
      <div class="db-scrum-col" data-status="${escapeHTML(column.key)}">
        <header class="db-scrum-col__header">
          <span class="db-scrum-col__title">${escapeHTML(column.label)}</span>
          <span class="db-scrum-col__count">${columnTasks.length}</span>
        </header>
        <ul class="db-scrum-col__list" role="list">
          ${list}
        </ul>
      </div>
    `;
  }).join('');

  return `
    <section class="db-section db-section--wide hr-portal-section" aria-labelledby="title-tasks">
      <header class="db-section__header hr-portal-section__header">
        <p class="section-label">${escapeHTML(contextLabel)}</p>
        <h1 class="db-section__title hr-portal-section__title" id="title-tasks">SCRUM / Tareas</h1>
      </header>
      <div class="db-toolbar">
        <label class="db-field db-field--compact">
          <span>Evento</span>
          <select data-action="scrum-event-change" aria-label="Cambiar evento SCRUM">
            ${scrumEvents.map((event) => optionHTML(String(event.id), eventLabel(event), state.data.scrumEventId ?? '')).join('')}
          </select>
        </label>
      </div>
      <div class="db-admin-grid">
        <article class="db-card hr-card">
          <header class="db-card__header">
            <span class="section-label">${editable ? 'Nueva tarea' : 'Permisos'}</span>
          </header>
          <div class="db-card__inner">${formHTML}</div>
        </article>
      </div>
      <div class="db-scrum-board" id="js-scrum-board" aria-label="Tablero SCRUM">
        ${colHTML}
      </div>
    </section>
  `;
}

function renderCollabLog() {
  return `
    <section class="db-section hr-portal-section" aria-labelledby="title-log">
      <header class="db-section__header hr-portal-section__header">
        <p class="section-label">Colaborador</p>
        <h1 class="db-section__title hr-portal-section__title" id="title-log">Log de Actividad</h1>
      </header>
      <ol class="db-activity-log hr-resource-list" id="js-collab-log" aria-label="Historial de actividad" reversed>
        <li class="db-empty">Sin actividad registrada.</li>
      </ol>
    </section>
  `;
}

function renderTaskForm(task = null) {
  const isEdit = Boolean(task);
  return `
    <form class="db-form" data-form="${isEdit ? 'task-update' : 'task-create'}">
      ${isEdit ? `<input type="hidden" name="id" value="${escapeHTML(task.id)}" />` : ''}
      <label class="db-field">
        <span>Titulo</span>
        <input name="title" required maxlength="120" value="${escapeAttr(task?.title ?? '')}" />
      </label>
      <label class="db-field">
        <span>Descripcion</span>
        <textarea name="description" rows="3">${escapeHTML(task?.description ?? '')}</textarea>
      </label>
      <div class="db-form__row">
        <label class="db-field">
          <span>Status</span>
          <select name="status">
            ${SCRUM_COLUMNS.map((col) => optionHTML(col.key, col.label, task?.status ?? 'todo')).join('')}
          </select>
        </label>
        <label class="db-field">
          <span>Prioridad</span>
          <select name="priority">
            ${TASK_PRIORITIES.map((p) => optionHTML(p, p, task?.priority ?? 'medium')).join('')}
          </select>
        </label>
      </div>
      <div class="db-form__row">
        ${renderUserPicker('assignee_id', 'Asignado a', task?.assignee_id ?? '')}
        <label class="db-field">
          <span>Entrega</span>
          <input type="date" name="due_date" value="${escapeAttr(task?.due_date ?? '')}" />
        </label>
      </div>
      <input type="hidden" name="event_id" value="${escapeAttr(task?.event_id ?? state.data.scrumEventId ?? '')}" />
      <div class="db-form__actions">
        <button class="btn-primary" type="submit">${isEdit ? 'Guardar cambios' : 'Crear tarea'}</button>
        ${isEdit ? '<button class="db-btn-secondary" type="button" data-action="task-cancel">Cancelar</button>' : ''}
      </div>
    </form>
  `;
}

function renderTaskCard(task, editable) {
  const currentStatus = task.status || 'todo';
  return `
    <li class="db-task-card" data-task-id="${escapeHTML(task.id)}">
      <div class="db-task-card__title">${escapeHTML(task.title ?? 'Sin titulo')}</div>
      ${task.description ? `<p class="db-task-card__desc">${escapeHTML(task.description)}</p>` : ''}
      <div class="db-task-card__meta">
        <span>${escapeHTML(task.priority ?? 'medium')}</span>
        <span>${escapeHTML(userLabel(task.assignee_id))}</span>
        ${task.due_date ? `<span>${escapeHTML(task.due_date)}</span>` : ''}
      </div>
      ${editable ? `
        <div class="db-task-card__actions">
          <select data-action="task-status" aria-label="Mover tarea">
            ${SCRUM_COLUMNS.map((col) => optionHTML(col.key, col.label, currentStatus)).join('')}
          </select>
          <button class="db-btn-secondary" type="button" data-action="task-edit">Editar</button>
          <button class="db-btn-danger" type="button" data-action="task-delete">Borrar</button>
        </div>
      ` : ''}
    </li>
  `;
}

function renderUserPicker(name, label, value = '', options = {}) {
  const valueField = options.valueField || 'user_id';
  const limit = options.limit ?? USER_PICKER_RENDER_LIMIT;
  const users = uniqueUsers(options.users ?? state.data.users)
    .filter((user) => !options.requiredField || String(user?.[options.requiredField] ?? '').trim());
  const selected = users.find((u) => String(u?.[valueField] ?? '') === String(value));
  const displayValue = selected
    ? (options.displayValue?.(selected) ?? userPickerDisplay(selected, valueField))
    : '';
  const inputId = `user-picker-${escapeAttr(name)}-${Math.random().toString(36).slice(2, 8)}`;
  const selectedUser = selected ? [selected] : [];
  const menuUsers = uniqueUsers([...selectedUser, ...users]).slice(0, limit);
  const clippedNotice = users.length > menuUsers.length
    ? `<div class="db-user-picker__empty" data-user-picker-clipped>Mostrando ${menuUsers.length} usuarios. Escribe mas especifico si no ves a la persona.</div>`
    : '';
  const optionButtons = renderUserPickerOptions(menuUsers, options);

  return `
    <div class="db-field db-user-picker" data-user-value-field="${escapeAttr(valueField)}" data-user-required-field="${escapeAttr(options.requiredField || '')}" data-user-picker-limit="${escapeAttr(String(limit))}">
      <label for="${inputId}">${escapeHTML(label)}</label>
      <input id="${inputId}" data-user-search autocomplete="off" placeholder="${escapeAttr(options.placeholder || 'Buscar usuario')}" value="${escapeAttr(displayValue)}" />
      <input type="hidden" name="${escapeHTML(name)}" value="${escapeAttr(value)}" />
      <div class="db-user-picker__menu" hidden>
        ${optionButtons}
        ${clippedNotice}
        <div class="db-user-picker__empty" data-user-picker-empty hidden>${escapeHTML(options.emptyLabel || 'Sin usuarios encontrados.')}</div>
      </div>
    </div>
  `;
}

function userPickerDisplay(user, valueField = 'user_id') {
  if (valueField === 'email') {
    const name = user.display_name || user.username || 'Usuario';
    return `${user.email ?? ''} · ${name}`;
  }
  return userLabel(user.user_id);
}

function userPickerCaption(user, valueField = 'user_id') {
  if (valueField === 'email') return `${usernameLabel(user)} · ${user.email ?? 'sin email'}`;
  return `${usernameLabel(user)} · ${user.user_id ?? '-'}`;
}

function userPickerSearchText(user) {
  return normalizeSearchText([
    user.display_name,
    user.email,
    user.username,
    user.user_id,
    user.id,
  ].filter((item) => item !== null && item !== undefined).join(' '));
}

function renderUserPickerOptions(users = [], options = {}) {
  const valueField = options.valueField || 'user_id';
  return users.map((user) => {
    const optionValue = String(user?.[valueField] ?? '');
    const optionDisplay = options.displayValue?.(user) ?? userPickerDisplay(user, valueField);
    const searchText = userPickerSearchText(user);

    return `
    <button class="db-user-option" type="button" data-user-id="${escapeAttr(String(user.user_id ?? ''))}" data-user-value="${escapeAttr(optionValue)}" data-user-display="${escapeAttr(optionDisplay)}" data-search-text="${escapeAttr(searchText)}">
      <span>${escapeHTML(user.display_name || user.email || 'Usuario sin nombre')}</span>
      <small>${escapeHTML(options.caption?.(user) ?? userPickerCaption(user, valueField))}</small>
    </button>
  `;
  }).join('');
}

function renderErpUserPicker(name, label) {
  if (!state.data.users) return '';
  return renderUserPicker(name, label, '');
}

function renderUserAutofillFields() {
  return `
    <div class="db-form__row">
      <label class="db-field"><span>User ID</span><input data-user-autofill="user_id" readonly placeholder="Se llena al seleccionar usuario" /></label>
      <label class="db-field"><span>Username</span><input name="username" data-user-autofill="username" readonly placeholder="Se llena al seleccionar usuario" /></label>
    </div>
  `;
}

function renderHalfHourOptions(selectedValue = '') {
  const options = ['<option value="">Seleccionar hora</option>'];
  for (let hour = 0; hour < 24; hour += 1) {
    ['00', '30'].forEach((minute) => {
      const value = `${String(hour).padStart(2, '0')}:${minute}`;
      options.push(optionHTML(value, value, selectedValue));
    });
  }
  return options.join('');
}

function optionHTML(value, label, selectedValue) {
  return `<option value="${escapeAttr(value)}"${String(value) === String(selectedValue) ? ' selected' : ''}>${escapeHTML(String(label ?? ''))}</option>`;
}


/* -- MEDIA -------------------------------------------------- */
/* -- RRPP --------------------------------------------------- */
function renderRrppContacts() {
  return sectionShell('Embajador', 'Boletos vendidos', 'title-rrpp-contacts', `
    <div class="db-table-wrap hr-table-wrap">
      <table class="db-table hr-table hr-table-readable" aria-label="Boletos vendidos">
        <thead><tr>
          <th scope="col">Cliente</th>
          <th scope="col">Canal</th>
          <th scope="col">Evento</th>
          <th scope="col">Boletos</th>
        </tr></thead>
        <tbody><tr class="db-table__empty-row hr-table-empty">
          <td colspan="4" class="db-empty hr-table-empty">Sin boletos vendidos registrados.</td>
        </tr></tbody>
      </table>
    </div>
  `);
}

function renderRrppInvitations() {
  return sectionShell('Embajador', 'Invitaciones', 'title-rrpp-inv', `
    <p class="db-empty">Sin invitaciones registradas.</p>
  `);
}

function renderRrppCampaigns() {
  return sectionShell('Embajador', 'Campañas', 'title-rrpp-camp', `
    <p class="db-empty">Sin campañas activas.</p>
  `);
}

function renderRrppGuestlist() {
  return sectionShell('Embajador', 'Lista de invitados', 'title-rrpp-guest', `
    <p class="db-empty">Sin listas de invitados disponibles.</p>
  `);
}

function renderRrppBenefits() {
  return sectionShell('Embajador', 'Beneficios', 'title-rrpp-benefits', `
    <p class="db-empty">Sin beneficios registrados.</p>
  `);
}


/* -- ERP ---------------------------------------------------- */
async function renderErpFinance() {
  await ensureUsersLoaded();
  const baseFilters = getFinanceFilters();
  const filters = baseFilters.scope === 'events' ? getEventFinanceFilters(baseFilters) : baseFilters;
  const events = await ensureFinanceEventsLoaded();
  if (filters.scope === 'events') {
    if (filters.eventId && !events.some((event) => String(event.id) === String(filters.eventId))) {
      filters.eventId = '';
      setPersistedDataValue('financeEventId', '');
    }
    if (!filters.eventId && events.length) {
      filters.eventId = String(events[0].id);
      setPersistedDataValue('financeEventId', filters.eventId);
    }

    const selectedEvent = events.find((event) => String(event.id) === String(filters.eventId));
    const { data, error } = await fetchFinanceTransactions(filters, events);
    if (error) {
      console.error('[HR] renderErpFinance events:', error);
      return sectionShell('ERP', 'Finanzas', 'title-erp-finance', `
        <p class="db-empty db-empty--error">No se pudo cargar el dashboard financiero de eventos.</p>
      `);
    }

    state.data.erpFinanceRows = data ?? [];
    state.data.erpFinanceFilters = filters;
    await fetchAllEventParticipants();
    await fetchFinanceEntities();

    return sectionShell('ERP', 'Finanzas', 'title-erp-finance', `
      ${renderFinanceScopeFilters(filters, events)}
      ${renderFinanceFilters(filters, { showComparison: filters.scope === 'studio' })}
      ${selectedEvent ? renderEventInfo(selectedEvent) : '<p class="db-empty">Sin eventos disponibles.</p>'}
      ${selectedEvent ? renderEventSummaryCards(selectedEvent) : ''}
      ${selectedEvent ? renderEventRightsChart(selectedEvent, data ?? []) : ''}
      ${selectedEvent ? renderEventInternalInvestors(selectedEvent, data ?? []) : ''}
      ${renderEventFinanceTransactionsTable(data ?? [], { canEdit: true })}
    `);
  }

  if (filters.scope === 'events' && filters.eventId && !events.some((event) => normalizeEventKey(event.event_key) === normalizeEventKey(filters.eventId))) {
    filters.eventId = '';
    setPersistedDataValue('financeEventId', '');
  }
  const [{ data, error }, comparisonRows, sessions, trendRows] = await Promise.all([
    fetchFinanceTransactions(filters, events),
    fetchFinanceComparisonTransactions(filters, events),
    filters.scope === 'studio' ? fetchFinanceSessions(filters) : Promise.resolve([]),
    filters.scope === 'studio' ? fetchFinanceTrendTransactions(filters) : Promise.resolve([]),
  ]);

  if (error) {
    console.error('[HR] renderErpFinance:', error);
    return sectionShell('ERP', 'Finanzas', 'title-erp-finance', `
      <p class="db-empty db-empty--error">No se pudo cargar el dashboard financiero.</p>
    `);
  }

  state.data.erpFinanceRows = data ?? [];
  state.data.erpFinanceFilters = filters;
  state.data.erpFinanceComparisonRows = comparisonRows ?? [];
  state.data.erpFinanceSessions = sessions ?? [];
  state.data.erpFinanceTrendRows = trendRows ?? [];

  return sectionShell('ERP', 'Finanzas', 'title-erp-finance', `
    ${renderFinanceScopeFilters(filters, events)}
    ${renderFinanceFilters(filters, { showComparison: filters.scope === 'studio' })}
    ${filters.scope === 'studio'
      ? renderStudioFinanceDashboard(data ?? [], comparisonRows ?? [], sessions ?? [], filters, trendRows ?? [])
      : renderFinanceMetrics(data ?? [], filters.scope === 'events' ? eventFinanceAmount : transactionAmount, {
        balanceFromAmountWhenNoIncomeExpense: filters.scope === 'events',
      })}
    ${filters.scope === 'events' ? renderEventFinanceTransactionsTable(data ?? []) : `
      ${renderFinanceMovementFilter()}
      ${renderTransactionsTable(filterFinanceMovementRows(data ?? []))}
    `}
  `, 'db-section--erp-finance');
}

async function renderErpInfrastructure() {
  if (!hasRole('admin')) {
    return sectionShell('ERP', 'Servidor Mysauth', 'title-erp-infrastructure', `
      <p class="db-empty db-empty--error">Acceso no autorizado.</p>
    `);
  }

  let serverStatus = null;
  let errorMessage = null;

  try {
    serverStatus = await fetchServerStatus();
  } catch (err) {
    console.error('[HR] renderErpInfrastructure:', err);
    if (isSessionStaleError(err)) markSessionStale(err.message || 'server status fetch');
    errorMessage = err.message || 'No se pudo obtener el estado del servidor.';
  }

  const statusLabel = serverStatus?.online ? 'Online' : 'Offline';
  const hostname = serverStatus?.hostname ?? 'No disponible';
  const tailscaleIp = serverStatus?.tailscaleIp ?? 'No disponible';
  const uptime = serverStatus?.uptime ?? 'Desconocido';
  const platform = serverStatus?.platform ?? 'No disponible';
  const checkedAt = serverStatus?.checkedAt ? formatDateTime(serverStatus.checkedAt) : 'No disponible';
  const cpuPercent = numberOrNull(serverStatus?.cpuPercent);
  const ramPercent = numberOrNull(serverStatus?.memory?.percent ?? serverStatus?.memoryPercent);
  const diskPercent = numberOrNull(serverStatus?.diskUsage?.percent ?? serverStatus?.diskPercent);
  const tempC = numberOrNull(serverStatus?.temperatureCelsius);
  const samples = serverStatus?.samples ?? [];

  return sectionShell('ERP', 'Servidor Mysauth', 'title-erp-infrastructure', `
    <p class="db-section__summary">Estado real del Debian de MysAuth Cloud. Las metricas se leen desde <code>cloud.hiddenroom.mx/api/server-status</code> con sesion admin; no hay SSH ni secretos en el navegador.</p>
    ${errorMessage ? `<p class="db-empty db-empty--error">${escapeHTML(errorMessage)}</p>` : ''}
    <div class="db-grid db-grid--3col db-grid--server-status">
      ${renderServerStatusCard('Estado', statusLabel)}
      ${renderServerStatusCard('Hostname', hostname)}
      ${renderServerStatusCard('IP Tailscale', tailscaleIp)}
      ${renderServerStatusCard('Uptime', uptime)}
      ${renderServerStatusCard('Sistema', platform)}
      ${renderServerStatusCard('Ultima lectura', checkedAt)}
    </div>
    <div class="db-server-metrics" aria-label="Graficas de rendimiento del servidor">
      ${renderServerMetricCard('CPU', serverStatus?.cpu ?? percentDisplay(cpuPercent), cpuPercent, samples.map((sample) => sample.cpu), '%', { chart: 'pie' })}
      ${renderServerMetricCard('RAM', serverStatus?.ram ?? percentDisplay(ramPercent), ramPercent, samples.map((sample) => sample.ram), '%', { chart: 'pie' })}
      ${renderServerMetricCard('Disco', serverStatus?.disk ?? percentDisplay(diskPercent), diskPercent, samples.map((sample) => sample.disk), '%', { chart: 'pie' })}
      ${renderServerMetricCard('Temperatura', serverStatus?.temperature ?? 'Sin sensor', tempC, samples.map((sample) => sample.temperature), 'C', { max: 100, chart: 'line' })}
    </div>
    <p class="db-note">Esta vista solo es visible para administradores. El agente conserva las ultimas 50 muestras; si no hay historial remoto, el navegador usa muestras de la sesion.</p>
  `);
}

async function renderErpCloud() {
  const currentPath = normalizeCloudPath(state.erpCloud.currentPath);
  let cloudFiles = { folders: [], files: [], path: currentPath };
  let errorMessage = '';

  try {
    cloudFiles = await listCloudFiles(currentPath);
  } catch (err) {
    console.error('[HR] renderErpCloud:', err);
    errorMessage = err?.message || 'No se pudieron cargar los archivos.';
  }

  return sectionShell('Infraestructura', 'Cloud Hidden Room', 'title-erp-cloud', `
    <div class="hr-container hr-stack">
      ${errorMessage ? `<p class="db-empty db-empty--error">${escapeHTML(errorMessage)}</p>` : ''}
      <div class="hr-panel hr-card hr-stack">
        <div>
          <p class="hr-eyebrow">Cloud Hidden Room</p>
          <h2 class="hr-title">Administración de archivos y almacenamiento del servidor Mysauth.</h2>
          <p>Estado: Online · Dominio: cloud.hiddenroom.mx</p>
        </div>
        <div class="hr-stack hr-stack-sm">
          <a class="hr-btn hr-btn-primary" href="${escapeHTML(CLOUD_HIDDENROOM_URL)}" target="_blank" rel="noopener noreferrer">Abrir Cloud</a>
          <button class="hr-btn hr-btn-primary" type="button" data-action="copy-cloud-hiddenroom-url" data-url="${escapeHTML(CLOUD_HIDDENROOM_URL)}">Copiar URL</button>
        </div>
      </div>

      <div class="hr-panel hr-card hr-stack">
        <div class="hr-eyebrow">Ruta actual</div>
        ${renderCloudBreadcrumb(currentPath)}
        <div class="hr-stack hr-stack-sm">
          <button class="hr-btn hr-btn-primary" type="button" data-action="cloud-upload-file">Subir archivo</button>
          <button class="hr-btn hr-btn-primary" type="button" data-action="cloud-create-folder">Crear carpeta</button>
        </div>
      <p class="hr-note">Los datos se cargan desde MysAuth Cloud en Debian.</p>

        <div class="hr-panel hr-card hr-stack" style="width:100%;">
          <p class="hr-eyebrow">Archivos</p>
          ${renderCloudFileList(cloudFiles)}
        </div>
      </div>

      <input id="js-cloud-file-input" type="file" hidden />
    </div>
  `);
}

function getIgMentionState() {
  if (!state.data.instagramMentionRank) {
    state.data.instagramMentionRank = {
      accessToken: '',
      apiMode: 'instagram_login',
      media: [],
      analysis: null,
      selectedMedia: null,
      isAnalyzing: false,
      error: ''
    };
  }
  return state.data.instagramMentionRank;
}

function getIgTokenFromDashboard() {
  return document.getElementById('js-ig-access-token')?.value.trim() || getIgMentionState().accessToken || '';
}

function getIgApiModeFromDashboard() {
  return document.getElementById('js-ig-api-mode')?.value || getIgMentionState().apiMode || 'instagram_login';
}

function normalizeIgMentionHandle(value) {
  const handle = String(value || '').replace(/^@+/, '').toLowerCase();
  return handle && /^[a-z0-9._]{1,30}$/i.test(handle) ? '@' + handle : '';
}

function extractIgMentionHandles(text) {
  const matches = String(text || '').match(/(^|[^A-Za-z0-9._])@([A-Za-z0-9._]{1,30})/g) || [];
  return matches
    .map((item) => normalizeIgMentionHandle(item.replace(/^[^@]*/, '')))
    .filter(Boolean);
}

function buildInstagramScraperMentionAnalysis(comments, scraper = {}) {
  const startedAt = scraper.startedAt ? new Date(scraper.startedAt).getTime() : Date.now();
  const finishedAt = Date.now();
  const safeComments = Array.isArray(comments) ? comments : [];
  const mainComments = safeComments.filter((comment) => !comment?.is_reply);
  const mentionCounts = new Map();
  const mentionAuthors = new Map();
  const authorStats = new Map();
  let mentionsCount = 0;
  let commentsWithMentions = 0;

  for (const comment of mainComments) {
    const author = String(comment?.username || 'usuario_desconocido').replace(/^@+/, '').toLowerCase() || 'usuario_desconocido';
    const text = String(comment?.comment_text || '');
    const mentions = extractIgMentionHandles(text);
    const uniqueMentions = [...new Set(mentions)];
    if (!authorStats.has(author)) authorStats.set(author, { author, count: 0, mentions: new Set() });
    const authorRow = authorStats.get(author);
    authorRow.count += 1;
    uniqueMentions.forEach((mention) => authorRow.mentions.add(mention));
    if (mentions.length) commentsWithMentions += 1;
    mentionsCount += mentions.length;

    for (const mention of mentions) mentionCounts.set(mention, (mentionCounts.get(mention) || 0) + 1);
    for (const mention of uniqueMentions) {
      if (!mentionAuthors.has(mention)) mentionAuthors.set(mention, new Set());
      mentionAuthors.get(mention).add(author);
    }
  }

  const rankingTotal = [...mentionCounts.entries()]
    .map(([mention, count]) => ({ mention, count }))
    .sort((a, b) => b.count - a.count || a.mention.localeCompare(b.mention));
  const rankingUniqueAuthors = [...mentionAuthors.entries()]
    .map(([mention, authors]) => ({ mention, count: authors.size, authors: [...authors].sort() }))
    .sort((a, b) => b.count - a.count || a.mention.localeCompare(b.mention));
  const rankingAuthors = [...authorStats.values()]
    .map((row) => ({ author: row.author, count: row.count, mentions: [...row.mentions].sort() }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
  const expectedCount = Number(scraper.expectedCount || safeComments.length || 0);
  const coverage = expectedCount > 0 ? Math.min(100, (safeComments.length / expectedCount) * 100) : 100;

  return {
    api_mode: 'local_playwright',
    media: { id: scraper.mediaId || scraper.sourceUrl || 'scraper-local', permalink: scraper.sourceUrl || '' },
    media_permalink: scraper.sourceUrl || '',
    comments_count: mainComments.length,
    meta_comments_count: expectedCount || safeComments.length,
    replies_count: safeComments.length - mainComments.length,
    mentions_count: mentionsCount,
    unique_mentions_count: mentionCounts.size,
    comments_with_mentions_count: commentsWithMentions,
    coverage_percent: coverage,
    pages_fetched: scraper.pagesFetched || 0,
    elapsed_seconds: Math.max(0, (finishedAt - startedAt) / 1000),
    retry_count: 0,
    completion_reason: scraper.stoppedReason || scraper.source || 'scraper-local',
    incomplete_reasons: coverage < 100 ? ['Instagram no devolvio mas paginas accesibles para esta sesion local.'] : [],
    ranking_total: rankingTotal,
    ranking_unique_authors: rankingUniqueAuthors,
    ranking_authors: rankingAuthors,
    comments_export: mainComments.map((comment) => ({
      username: String(comment?.username || '').replace(/^@+/, ''),
      timestamp: comment?.timestamp || '',
      text: comment?.comment_text || '',
    })),
    source: 'instagram-scraper',
  };
}

function syncInstagramScraperMentionState() {
  const scraper = state.instagramScraper;
  const comments = instagramScraperComments();
  if (!comments.length) return null;
  const analysis = buildInstagramScraperMentionAnalysis(comments, scraper);
  scraper.analysis = analysis;
  const igState = getIgMentionState();
  igState.analysis = analysis;
  igState.selectedMedia = {
    id: scraper.sourceUrl || 'scraper-local',
    permalink: scraper.sourceUrl || '',
    comments_count: scraper.expectedCount || comments.length,
    api_mode: 'local_playwright',
  };
  igState.isAnalyzing = false;
  igState.error = '';
  return analysis;
}

function renderInstagramScraperMentionResults() {
  const scraper = state.instagramScraper;
  if (scraper.isRunning) {
    return `
      <article class="db-card hr-card db-ig-loading-card" aria-live="polite" aria-busy="true">
        <div class="db-card__inner">
          <p class="hr-table-loading">Analizando comentarios</p>
        </div>
      </article>
    `;
  }
  const analysis = syncInstagramScraperMentionState();
  if (!analysis) return '<p class="db-empty">Todavia no hay comentarios extraidos.</p>';
  const media = getIgMentionState().selectedMedia;
  return renderIgAnalysisSummary(analysis, media)
    .replaceAll('data-action="ig-export-pdf"', 'data-action="instagram-scraper-rank-pdf"')
    .replaceAll('data-action="ig-export-comments-markdown"', 'data-action="instagram-scraper-rank-md"')
    .replaceAll('data-action="ig-reset-analysis"', 'data-action="instagram-scraper-reset-analysis"')
    + renderIgRankingTables(analysis);
}

function instagramScraperComments() {
  return Array.isArray(state.instagramScraper.comments) ? state.instagramScraper.comments : [];
}
function readInstagramScraperCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(INSTAGRAM_SCRAPER_STORAGE_KEY) || '{}');
    return {
      comments: Array.isArray(cached.comments) ? cached.comments : [],
      sourceUrl: typeof cached.sourceUrl === 'string' ? cached.sourceUrl : '',
      expectedCount: Number(cached.expectedCount) || null,
      pagesFetched: Number(cached.pagesFetched) || null,
      source: typeof cached.source === 'string' ? cached.source : '',
      stoppedReason: typeof cached.stoppedReason === 'string' ? cached.stoppedReason : '',
    };
  } catch {
    return { comments: [], sourceUrl: '', expectedCount: null, pagesFetched: null, source: '', stoppedReason: '' };
  }
}

function saveInstagramScraperCache() {
  try {
    localStorage.setItem(INSTAGRAM_SCRAPER_STORAGE_KEY, JSON.stringify({
      sourceUrl: state.instagramScraper.sourceUrl || '',
      comments: instagramScraperComments(),
      expectedCount: state.instagramScraper.expectedCount || null,
      pagesFetched: state.instagramScraper.pagesFetched || null,
      source: state.instagramScraper.source || '',
      stoppedReason: state.instagramScraper.stoppedReason || '',
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // Local storage can be unavailable in hardened browsers; UI still works in memory.
  }
}

async function fetchInstagramScraperLastResult() {
  const response = await fetch(`${INSTAGRAM_SCRAPER_URL}/api/results`);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) return null;
  return result;
}

async function loadInstagramScraperLastResult({ silent = false } = {}) {
  if (state.instagramScraper.isHydrating) return;
  state.instagramScraper.isHydrating = true;
  try {
    const result = await fetchInstagramScraperLastResult();
    const comments = Array.isArray(result?.comments) ? result.comments : [];
    if (comments.length) {
      const currentCount = instagramScraperComments().length;
      const shouldReplace = !silent || comments.length >= currentCount;
      if (shouldReplace) {
        state.instagramScraper.comments = comments;
        state.instagramScraper.sourceUrl = result.url || state.instagramScraper.sourceUrl || '';
        state.instagramScraper.expectedCount = Number(result.expected_count) || null;
        state.instagramScraper.pagesFetched = Number(result.pages_fetched) || null;
        state.instagramScraper.source = result.source || '';
        state.instagramScraper.stoppedReason = result.stopped_reason || '';
        state.instagramScraper.error = '';
        saveInstagramScraperCache();
        if (!silent) showToast(comments.length + ' comentarios cargados del scraper local.', 'success');
        renderSection('erp-instagram-scraper');
      }
    } else if (!silent) {
      showToast('El scraper local no tiene resultados guardados todavía.', 'info');
    }
  } catch (error) {
    if (!silent) showToast(error?.message || 'No se pudo cargar el último resultado.', 'error');
  } finally {
    state.instagramScraper.isHydrating = false;
    state.instagramScraper.hasHydrated = true;
  }
}

function scheduleInstagramScraperHydration() {
  if (state.instagramScraper.hasHydrated || state.instagramScraper.isRunning || state.instagramScraper.isHydrating) return;
  window.setTimeout(() => loadInstagramScraperLastResult({ silent: true }), 0);
}
async function handleInstagramScraper(form) {
  const data = new FormData(form);
  const url = String(data.get('url') || '').trim();
  const maxScrolls = Math.min(Math.max(Number(data.get('max_scrolls')) || 500, 1), 2500);
  state.instagramScraper.sourceUrl = url;
  if (state.instagramScraper.isRunning) return;
  state.instagramScraper.isRunning = true;
  state.instagramScraper.error = '';
  renderSection('erp-instagram-scraper');

  try {
    const response = await fetch(`${INSTAGRAM_SCRAPER_URL}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, max_scrolls: maxScrolls }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.error || `El scraper respondio ${response.status}.`);
    let comments = Array.isArray(result.comments) ? result.comments : [];
    if (!comments.length) {
      const lastResult = await fetchInstagramScraperLastResult().catch(() => null);
      comments = Array.isArray(lastResult?.comments) ? lastResult.comments : comments;
    }
    state.instagramScraper.comments = comments;
    state.instagramScraper.expectedCount = Number(result.expected_count) || null;
    state.instagramScraper.pagesFetched = Number(result.pages_fetched) || null;
    state.instagramScraper.source = result.source || '';
    state.instagramScraper.stoppedReason = result.stopped_reason || '';
    saveInstagramScraperCache();
    showToast(state.instagramScraper.comments.length + ' comentarios extraidos.', state.instagramScraper.comments.length ? 'success' : 'info');
  } catch (error) {
    state.instagramScraper.error = error?.message === 'Failed to fetch'
      ? 'No se pudo conectar al scraper local. Ejecuta "npm run instagram:scraper".'
      : (error?.message || 'No se pudo completar el scraping.');
    showToast(state.instagramScraper.error, 'error');
  } finally {
    state.instagramScraper.isRunning = false;
    renderSection('erp-instagram-scraper');
  }
}

function downloadInstagramScraperMarkdown() {
  const comments = instagramScraperComments();
  if (!comments.length) return showToast('No hay comentarios para exportar.', 'error');
  const markdown = [
    '# Comentarios de Instagram',
    '',
    `Fuente: ${state.instagramScraper.sourceUrl || '-'}`,
    '',
    ...comments.flatMap((comment) => [
      `## @${String(comment.username || 'usuario').replace(/^@+/, '')}`,
      '',
      `- Fecha: ${comment.timestamp || 'No disponible'}`,
      `- Likes: ${comment.like_count ?? 'No disponible'}`,
      `- Tipo: ${comment.is_reply ? 'Respuesta' : 'Comentario principal'}`,
      '',
      String(comment.comment_text || '').split(/\r?\n/).map((line) => `> ${line}`).join('\n'),
      '',
    ]),
  ].join('\n');
  const blob = new Blob([`${markdown}\n`], { type: 'text/markdown;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = 'comments.md';
  link.click();
  URL.revokeObjectURL(objectUrl);
}

async function downloadInstagramScraperPdf() {
  const comments = instagramScraperComments();
  if (!comments.length) return showToast('No hay comentarios para exportar.', 'error');
  try {
    await ensurePdfLibraries();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Comentarios de Instagram', 40, 40);
    doc.setFontSize(9);
    doc.text(state.instagramScraper.sourceUrl || '-', 40, 58, { maxWidth: 760 });
    doc.autoTable({
      startY: 76,
      head: [['Usuario', 'Comentario', 'Fecha', 'Likes', 'Tipo']],
      body: comments.map((comment) => [
        `@${String(comment.username || '').replace(/^@+/, '')}`,
        String(comment.comment_text || ''),
        String(comment.timestamp || '-'),
        String(comment.like_count ?? '-'),
        comment.is_reply ? 'Respuesta' : 'Principal',
      ]),
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [32, 32, 32] },
      columnStyles: { 1: { cellWidth: 330 } },
      margin: { left: 40, right: 40 },
    });
    doc.save('comments.pdf');
  } catch (error) {
    showToast(error?.message || 'No se pudo generar el PDF.', 'error');
  }
}

function exportInstagramScraperRankPdf() {
  syncInstagramScraperMentionState();
  exportIgAnalysisPdf();
}

function exportInstagramScraperRankMarkdown() {
  syncInstagramScraperMentionState();
  exportIgCommentsMarkdown();
}

function resetInstagramScraperAnalysis() {
  state.instagramScraper.comments = [];
  state.instagramScraper.analysis = null;
  state.instagramScraper.expectedCount = null;
  state.instagramScraper.pagesFetched = null;
  state.instagramScraper.source = '';
  state.instagramScraper.stoppedReason = '';
  state.instagramScraper.hasHydrated = true;
  const igState = getIgMentionState();
  if (igState.analysis?.source === 'instagram-scraper') {
    igState.analysis = null;
    igState.selectedMedia = null;
    igState.isAnalyzing = false;
  }
  saveInstagramScraperCache();
  renderSection('erp-instagram-scraper');
}

function normalizeIgAuditUsername(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function safePostgrestSearchTerm(value) {
  return String(value || '').trim().replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
}

function mergeRowsById(rows) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = row?.id ?? `${row?.user_id || ''}:${row?.ig_username || ''}:${row?.concepto || ''}:${row?.folio || ''}`;
    if (key) map.set(String(key), row);
  });
  return [...map.values()];
}

async function fetchErpIgBenefitsAudit(query = '') {
  const rawQuery = String(query || '').trim();
  const normalizedIg = normalizeIgAuditUsername(rawQuery);
  const search = safePostgrestSearchTerm(rawQuery.replace(/^@+/, ''));
  const hasSearch = search.length >= 2;
  const contestSelect = 'id, concepto, user_id, ig_username, created_at';
  const userSelect = 'id, user_id, display_name, username, email, whatsapp, ig_username, has_auth';
  const ticketSelect = 'id, event_key, folio, status, ticket_type, customer_name, customer_email, user_id, created_at, used_at, qr_payload';

  let contestQuery = supabase
    .from('ig_contest')
    .select(contestSelect)
    .order('created_at', { ascending: false })
    .limit(hasSearch ? 500 : 200);

  if (hasSearch) {
    contestQuery = contestQuery.or(`ig_username.ilike.%${search}%,concepto.ilike.%${search}%,user_id.ilike.%${search}%`);
  }

  let usersBySearch = [];
  if (hasSearch) {
    const { data, error } = await supabase
      .from('users')
      .select(userSelect)
      .or(`ig_username.ilike.%${search}%,user_id.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%,whatsapp.ilike.%${search}%`)
      .limit(100);
    if (error) throw error;
    usersBySearch = data ?? [];
  }

  const { data: contestData, error: contestError } = await contestQuery;
  if (contestError) throw contestError;

  const extraContest = [];
  const searchedUserIds = [...new Set(usersBySearch.map((user) => user.user_id).filter(Boolean).map(String))];
  const searchedHandles = [...new Set(usersBySearch.map((user) => normalizeIgAuditUsername(user.ig_username)).filter(Boolean))];

  if (searchedUserIds.length) {
    const { data, error } = await supabase.from('ig_contest').select(contestSelect).in('user_id', searchedUserIds).limit(500);
    if (error) throw error;
    extraContest.push(...(data ?? []));
  }

  if (searchedHandles.length) {
    const { data, error } = await supabase.from('ig_contest').select(contestSelect).in('ig_username', searchedHandles).limit(500);
    if (error) throw error;
    extraContest.push(...(data ?? []));
  }

  const contestRows = mergeRowsById([...(contestData ?? []), ...extraContest]);
  const relatedUserIds = new Set(searchedUserIds);
  const relatedHandles = new Set(searchedHandles);

  contestRows.forEach((row) => {
    if (row.user_id) relatedUserIds.add(String(row.user_id));
    const handle = normalizeIgAuditUsername(row.ig_username);
    if (handle) relatedHandles.add(handle);
  });
  if (hasSearch && normalizedIg) relatedHandles.add(normalizedIg);

  const users = [...usersBySearch];
  const userIds = [...relatedUserIds];
  const handles = [...relatedHandles];

  if (userIds.length) {
    const { data, error } = await supabase.from('users').select(userSelect).in('user_id', userIds).limit(500);
    if (error) throw error;
    users.push(...(data ?? []));
  }

  if (handles.length) {
    const { data, error } = await supabase.from('users').select(userSelect).in('ig_username', handles).limit(500);
    if (error) throw error;
    users.push(...(data ?? []));
  }

  const userRows = mergeRowsById(users);
  const ticketQueries = [];
  const ticketUserIds = [...new Set(userRows.map((user) => user.user_id).filter(Boolean).map(String))];

  if (ticketUserIds.length) {
    ticketQueries.push(supabase.from('event_tickets').select(ticketSelect).in('user_id', ticketUserIds).limit(500));
  }

  if (hasSearch) {
    ticketQueries.push(
      supabase
        .from('event_tickets')
        .select(ticketSelect)
        .or(`folio.ilike.%${search}%,event_key.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,user_id.ilike.%${search}%`)
        .limit(200)
    );
  } else {
    ticketQueries.push(
      supabase
        .from('event_tickets')
        .select(ticketSelect)
        .eq('event_key', 'HRCDMX-17-21')
        .order('created_at', { ascending: false })
        .limit(200)
    );
  }

  const ticketResults = await Promise.all(ticketQueries);
  const tickets = [];
  ticketResults.forEach(({ data, error }) => {
    if (error) throw error;
    tickets.push(...(data ?? []));
  });

  return {
    query: rawQuery,
    contestRows,
    userRows,
    ticketRows: mergeRowsById(tickets),
  };
}

function buildErpIgBenefitsAuditRows(result) {
  const usersById = new Map();
  const usersByIg = new Map();
  const contestByIg = new Map();
  const ticketsByUserId = new Map();

  result.userRows.forEach((user) => {
    if (user.user_id) usersById.set(String(user.user_id), user);
    const handle = normalizeIgAuditUsername(user.ig_username);
    if (handle) usersByIg.set(handle, user);
  });

  result.contestRows.forEach((row) => {
    const handle = normalizeIgAuditUsername(row.ig_username) || `user:${row.user_id || row.id}`;
    if (!contestByIg.has(handle)) contestByIg.set(handle, []);
    contestByIg.get(handle).push(row);
  });

  result.ticketRows.forEach((ticket) => {
    const key = String(ticket.user_id || 'sin-user-id');
    if (!ticketsByUserId.has(key)) ticketsByUserId.set(key, []);
    ticketsByUserId.get(key).push(ticket);
  });

  const rowKeys = new Set([...contestByIg.keys()]);
  result.userRows.forEach((user) => {
    const handle = normalizeIgAuditUsername(user.ig_username);
    if (handle) rowKeys.add(handle);
    else if (user.user_id) rowKeys.add(`user:${user.user_id}`);
  });

  result.ticketRows.forEach((ticket) => {
    const user = usersById.get(String(ticket.user_id || ''));
    const handle = normalizeIgAuditUsername(user?.ig_username);
    rowKeys.add(handle || `user:${ticket.user_id || ticket.id}`);
  });

  return [...rowKeys].map((key) => {
    const contestRows = contestByIg.get(key) ?? [];
    const firstContest = contestRows[0];
    const user = usersById.get(String(firstContest?.user_id || '')) || usersByIg.get(key) || result.userRows.find((item) => `user:${item.user_id}` === key) || null;
    const tickets = user?.user_id ? (ticketsByUserId.get(String(user.user_id)) ?? []) : [];
    const concepts = [...new Set(contestRows.map((row) => row.concepto).filter(Boolean))];
    const hasCourtesy = concepts.some((concept) => String(concept).toLowerCase().includes('cortes'));
    const hasAuth = user?.has_auth === true;
    const status = hasAuth ? 'Registrado' : user ? 'Perfil sin auth' : 'No registrado';
    let note = 'OK';

    if (!user) note = 'No hay coincidencia en public.users.';
    else if (firstContest && !firstContest.user_id) note = 'Existe usuario por IG, pero el registro no tiene user_id.';
    else if (hasCourtesy && !tickets.length && hasAuth) note = 'Tiene cortesía en ig_contest, pero no se ve ticket materializado.';
    else if (hasCourtesy && !hasAuth) note = 'La cortesía queda pendiente hasta registro/auth.';

    const lastDates = [
      ...contestRows.map((row) => row.created_at),
      ...tickets.map((ticket) => ticket.created_at),
      ...tickets.map((ticket) => ticket.used_at),
    ].filter(Boolean).sort().reverse();

    return {
      key,
      ig_username: normalizeIgAuditUsername(firstContest?.ig_username || user?.ig_username || ''),
      user,
      status,
      concepts,
      contestRows,
      tickets,
      note,
      lastDate: lastDates[0] || null,
    };
  }).sort((a, b) => {
    const rank = (row) => row.status === 'No registrado' ? 0 : row.note === 'OK' ? 2 : 1;
    return rank(a) - rank(b) || String(a.ig_username || a.user?.display_name || '').localeCompare(String(b.ig_username || b.user?.display_name || ''));
  });
}

function renderErpIgBenefitsAuditTable(rows) {
  if (!rows.length) return '<p class="db-empty">Sin coincidencias para cotejar.</p>';

  return `
    <div class="db-table-wrap hr-table-wrap">
      <table class="db-table hr-table hr-table-readable" aria-label="Cotejo IG Beneficios">
        <thead>
          <tr>
            <th scope="col">Instagram</th>
            <th scope="col">Registro</th>
            <th scope="col">Usuario</th>
            <th scope="col">User ID</th>
            <th scope="col">Recompensas</th>
            <th scope="col">Tickets</th>
            <th scope="col">Último mov.</th>
            <th scope="col">Revisión</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const user = row.user;
            const concepts = row.concepts.length ? row.concepts.join(', ') : '-';
            const ticketLabels = row.tickets.length
              ? row.tickets.map((ticket) => `${ticket.folio || ticket.event_key || 'Ticket'} (${ticket.status || '-'})`).join(', ')
              : '-';
            return `
              <tr>
                <td>${row.ig_username ? `@${escapeHTML(row.ig_username)}` : '-'}</td>
                <td>${escapeHTML(row.status)}</td>
                <td>${escapeHTML(user?.display_name || user?.username || user?.email || '-')}</td>
                <td><code>${escapeHTML(user?.user_id || '-')}</code></td>
                <td>${escapeHTML(concepts)}</td>
                <td>${escapeHTML(ticketLabels)}</td>
                <td>${escapeHTML(formatDateTime(row.lastDate))}</td>
                <td>${escapeHTML(row.note)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderErpIgBenefitsAudit() {
  const query = state.data.erpIgBenefitsAuditQuery || '';
  let result;

  try {
    result = await fetchErpIgBenefitsAudit(query);
  } catch (error) {
    console.error('[HR] renderErpIgBenefitsAudit:', error);
    return sectionShell('ERP', 'IG Beneficios', 'title-erp-ig-benefits-audit', `
      <p class="db-empty db-empty--error">No se pudo cargar el cotejo. Revisa permisos o RLS.</p>
    `);
  }

  const rows = buildErpIgBenefitsAuditRows(result);
  const registeredCount = rows.filter((row) => row.status === 'Registrado').length;
  const historicCount = rows.filter((row) => row.status === 'Perfil sin auth').length;
  const missingCount = rows.filter((row) => row.status === 'No registrado').length;
  const reviewCount = rows.filter((row) => row.note !== 'OK').length;

  return sectionShell('ERP', 'IG Beneficios', 'title-erp-ig-benefits-audit', `
    <p class="db-section__summary">Busca recompensas de IG CONTEST y cortesías HRCDMX-17-21 para cotejar si el usuario ya tiene perfil/auth y ticket vinculado.</p>
    <form class="db-form" data-form="erp-ig-benefits-search">
      <div class="db-form__row">
        <label class="db-field"><span>Buscar</span><input name="query" value="${escapeAttr(query)}" placeholder="@usuario, nombre, email, User ID, concepto o folio" autocomplete="off" /></label>
      </div>
      <div class="db-form__actions">
        <button class="btn-primary" type="submit">Buscar</button>
        <button class="db-btn-secondary" type="submit" name="query" value="" data-operation-action="clear">Limpiar</button>
      </div>
    </form>
    <div class="db-grid db-grid--4col">
      ${renderStatCard('Filas cotejadas', rows.length)}
      ${renderStatCard('Registrados', registeredCount)}
      ${renderStatCard('Perfil sin auth', historicCount)}
      ${renderStatCard('No registrados', missingCount)}
    </div>
    ${reviewCount ? `<p class="db-note">Hay ${escapeHTML(reviewCount)} fila(s) para revisar: registros sin user_id, sin perfil o cortesías sin ticket visible.</p>` : '<p class="db-note">Sin alertas en las coincidencias mostradas.</p>'}
    ${renderErpIgBenefitsAuditTable(rows)}
  `);
}

function handleErpIgBenefitsSearch(form) {
  const action = form.dataset.operationAction;
  const values = formValues(form);
  state.data.erpIgBenefitsAuditQuery = action === 'clear' ? '' : String(values.query || '').trim();
  renderSection('erp-ig-benefits-audit');
}
function renderErpInstagramScraper() {
  const scraper = state.instagramScraper;
  const comments = instagramScraperComments();
  scheduleInstagramScraperHydration();
  return sectionShell('ERP', 'Instagram Comments Scraper', 'title-erp-instagram-scraper', `
    <p class="db-section__summary">Extrae comentarios con Node.js y Playwright usando una sesion local persistente. Las cookies nunca salen de tu equipo.</p>
    ${scraper.error ? `<p class="db-empty db-empty--error">${escapeHTML(scraper.error)}</p>` : ''}
    <div class="db-admin-grid db-admin-grid--single db-ig-rank">
      <article class="db-card hr-card"><div class="db-card__inner">
        <form class="db-form" data-form="instagram-scrape">
          <label class="db-field"><span>URL publica del post o reel</span>
            <input name="url" type="url" required pattern="https://(www\\.)?instagram\\.com/(p|reel)/.+" value="${escapeAttr(scraper.sourceUrl)}" placeholder="https://www.instagram.com/p/..." />
          </label>
          <label class="db-field"><span>Ciclos de carga</span>
            <input name="max_scrolls" type="number" min="1" max="2500" value="500" />
          </label>
          <p class="db-note">Primera vez: ejecuta <code>npm run instagram:login</code>. Cada ciclo trae hasta ~15 comentarios; para 3,500 usa 250-500 ciclos. Puede tardar varios minutos.</p>
          <div class="db-form__actions">
            <button class="btn-primary" type="submit"${scraper.isRunning ? ' disabled' : ''}>${scraper.isRunning ? 'Cargando comentarios...' : 'Extraer comentarios'}</button><button class="db-btn-secondary" type="button" data-action="instagram-scraper-load-last">Cargar último resultado</button>
            ${comments.length ? '<button class="db-btn-secondary" type="button" data-action="instagram-scraper-pdf">Exportar PDF</button><button class="db-btn-secondary" type="button" data-action="instagram-scraper-md">Exportar MD</button>' : ''}
          </div>
        </form>
      </div></article>
      ${renderInstagramScraperMentionResults()}
    </div>
  `);
}

async function renderErpInstagramMentionRank() {
  const igState = getIgMentionState();
  const media = Array.isArray(igState.media) ? igState.media : [];
  const analysis = igState.analysis;
  const isAnalyzing = Boolean(igState.isAnalyzing);
  const apiMode = igState.apiMode || 'instagram_login';

  return sectionShell('ERP', 'Instagram Mention Rank', 'title-erp-ig-mention-rank', `
    <p class="db-section__summary">Analiza comentarios de publicaciones de Instagram con Instagram Login o Facebook Graph API. El token solo vive en memoria durante esta sesion del dashboard.</p>
    ${igState.error ? `<p class="db-empty db-empty--error">${escapeHTML(igState.error)}</p>` : ''}
    <div class="db-admin-grid db-admin-grid--single db-ig-rank">
      <article class="db-card hr-card">
        <div class="db-card__inner">
          <header class="db-card__header"><span class="section-label">Conexion</span></header>
          <form class="db-form" data-form="ig-list-media">
            <label class="db-field">
              <span>Modo API</span>
              <select id="js-ig-api-mode" name="api_mode">
                <option value="instagram_login" ${apiMode === 'instagram_login' ? 'selected' : ''}>Instagram Login / graph.instagram.com</option>
                <option value="facebook_graph" ${apiMode === 'facebook_graph' ? 'selected' : ''}>Facebook Graph / graph.facebook.com</option>
              </select>
            </label>
            <label class="db-field">
              <span>Access Token</span>
              <input id="js-ig-access-token" name="access_token" type="password" autocomplete="off" spellcheck="false" value="${escapeHTML(igState.accessToken || '')}" placeholder="Pega un token para pruebas o deja vacio si el secreto ya esta configurado" />
            </label>
            <p class="db-note">Instagram Login puede listar publicaciones, pero si Meta reporta comentarios y no los entrega, usa Facebook Graph con un token con permisos de paginas e Instagram Business.</p>
            <label class="db-field">
              <span>Enlace de tu publicacion</span>
              <input name="permalink" type="url" inputmode="url" placeholder="https://www.instagram.com/p/.../" />
              <small>Puedes analizar directamente un enlace que pertenezca a la cuenta conectada.</small>
            </label>
            <div class="db-form__row">
              <label class="db-field"><span>Limite</span><input name="limit" type="number" min="1" max="100" value="25" /></label>
            </div>
            <div class="db-form__actions">
              <button class="btn-primary" type="submit" data-operation-action="list">Cargar publicaciones</button>
              <button class="db-btn-secondary" type="submit" data-operation-action="resolve">Analizar enlace</button>
            </div>
            <div class="db-field__hint" data-ig-status aria-live="polite"></div>
          </form>
        </div>
      </article>

      ${isAnalyzing ? `
        <article class="db-card hr-card db-ig-loading-card" aria-live="polite" aria-busy="true">
          <div class="db-card__inner">
            <p class="hr-table-loading">Analizando comentarios</p>
          </div>
        </article>
      ` : analysis ? '' : `
        <article class="db-card hr-card">
          <div class="db-card__inner">
            <header class="db-card__header"><span class="section-label">Publicaciones</span></header>
            ${media.length ? `<div class="db-ig-media-grid">${media.map(renderIgMediaCard).join('')}</div>` : '<p class="db-empty">Carga publicaciones para elegir una y analizar comentarios.</p>'}
          </div>
        </article>
      `}
      ${!isAnalyzing && analysis ? renderIgAnalysisSummary(analysis, igState.selectedMedia) : ''}
      ${!isAnalyzing && analysis ? renderIgRankingTables(analysis) : ''}
    </div>
  `);
}

function renderIgMediaCard(media) {
  const caption = String(media?.caption || '').trim();
  const shortCaption = caption.length > 180 ? `${caption.slice(0, 177)}...` : caption;
  return `
    <article class="db-ig-media-card">
      <div>
        <p class="hr-eyebrow">${escapeHTML(media?.media_type || 'Media')} · ${escapeHTML(formatDateTime(media?.timestamp))} · Comentarios: ${escapeHTML(media?.comments_count ?? 0)}</p>
        <h3>${escapeHTML(shortCaption || 'Publicacion sin caption')}</h3>
        <p><code>${escapeHTML(media?.id || '')}</code></p>
        ${media?.page_name ? `<p class="db-note">Pagina: ${escapeHTML(media.page_name)}</p>` : ''}
      </div>
      <div class="db-ig-media-card__actions">
        ${media?.permalink ? `<a class="db-btn-secondary" href="${escapeHTML(media.permalink)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ''}
        <button class="btn-primary" type="button" data-action="ig-analyze-media" data-media-id="${escapeHTML(media?.id || '')}">Analizar comentarios</button>
      </div>
    </article>
  `;
}
function igCommentScopeSummary(analysis, media = {}) {
  const processed = Number(analysis?.comments_count ?? 0);
  const metaCount = Number(analysis?.meta_comments_count ?? media?.comments_count ?? 0);
  const excludedReplies = Math.max(0, metaCount - processed);
  return {
    processed,
    metaCount,
    excludedReplies,
    processedLabel: processed.toLocaleString('es-MX'),
    metaCountLabel: metaCount.toLocaleString('es-MX'),
    excludedRepliesLabel: excludedReplies.toLocaleString('es-MX'),
  };
}

function renderIgAnalysisSummary(analysis, media) {
  const coverage = Number(analysis.coverage_percent ?? 0);
  const incompleteReasons = Array.isArray(analysis.incomplete_reasons) ? analysis.incomplete_reasons : [];
  const shouldExplain = coverage < 100 && Number(analysis.meta_comments_count || 0) > Number(analysis.comments_count || 0);
  const commentScope = igCommentScopeSummary(analysis, media);
  return `
    <article class="db-card hr-card">
      <div class="db-card__inner">
        <header class="db-card__header"><span class="section-label">Resultado</span></header>
        ${analysis.analysis_warning ? `<p class="db-empty db-empty--error">${escapeHTML(analysis.analysis_warning)}</p>` : ''}
        ${analysis.save_warning ? `<p class="db-empty db-empty--error">${escapeHTML(analysis.save_warning)}</p>` : ''}
        <div class="db-grid hr-grid hr-grid-3 db-grid--3col">
          ${renderStatCard('Comentarios', analysis.comments_count ?? 0)}
          ${renderStatCard('Menciones', analysis.mentions_count ?? 0)}
          ${renderStatCard('Usuarios arrobados', analysis.unique_mentions_count ?? 0)}
        </div>
        <div class="db-ig-audit-summary">
          <p>Comentarios principales procesados: <strong>${escapeHTML(commentScope.processedLabel)}</strong></p>
          <p>Replies excluidas por regla del concurso: <strong>${escapeHTML(commentScope.excludedRepliesLabel)} aprox.</strong></p>
          <p>comments_count Meta: <strong>${escapeHTML(commentScope.metaCountLabel)}</strong></p>
          <p>Nota: <strong>Meta incluye replies en comments_count.</strong></p>
          <p>Cobertura: <strong>${escapeHTML(coverage.toFixed(2))}%</strong></p>
          <p>Paginas recorridas: <strong>${escapeHTML(analysis.pages_fetched ?? 0)}</strong></p>
          <p>Tiempo total: <strong>${escapeHTML(Number(analysis.elapsed_seconds ?? 0).toFixed(2))} s</strong></p>
          <p>Reintentos: <strong>${escapeHTML(analysis.retry_count ?? 0)}</strong></p>
          <p>Fin: <strong>${escapeHTML(analysis.completion_reason || 'Sin paging.next')}</strong></p>
        </div>
        ${shouldExplain ? `
          <div class="db-note">
            <strong>Motivo:</strong>
            <ul>${(incompleteReasons.length ? incompleteReasons : ['Meta no devolvio mas comentarios accesibles.']).map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        <p class="db-note">Este ranking cuenta unicamente comentarios principales. Las respuestas a comentarios no se consideran para la dinamica, aunque Meta las incluya dentro de comments_count.</p>
        <p class="db-note">Media: <code>${escapeHTML(media?.id || '')}</code>${analysis.saved_analysis_id ? ` · Guardado: <code>${escapeHTML(analysis.saved_analysis_id)}</code>` : ''} · Comentarios con @: ${escapeHTML(analysis.comments_with_mentions_count ?? 0)}</p>
        ${Number(analysis.mentions_count ?? 0) === 0 ? renderIgMentionDebug(analysis.mention_debug) : ''}
        <div class="db-form__actions">
          <button class="btn-primary" type="button" data-action="ig-export-pdf">Exportar PDF</button>
          <button class="db-btn-secondary" type="button" data-action="ig-export-comments-markdown">Exportar comentarios Markdown</button>
          <button class="db-btn-secondary" type="button" data-action="ig-reset-analysis">Analizar otra publicacion</button>
        </div>
      </div>
    </article>
  `;
}

function renderIgMentionDebug(debug) {
  const withAt = Array.isArray(debug?.sample_texts_with_at) ? debug.sample_texts_with_at : [];
  const samples = Array.isArray(debug?.sample_texts) ? debug.sample_texts : [];
  const rows = withAt.length ? withAt : samples;
  if (!rows.length) return '<p class="db-note">Meta no devolvio texto de comentarios para diagnosticar menciones.</p>';

  return `
    <div class="db-note">
      <strong>Muestras enmascaradas recibidas por la API:</strong>
      <ul>
        ${rows.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}
      </ul>
    </div>
  `;
}
function renderIgRankingTables(analysis) {
  return `
    <div class="db-grid db-grid--2col db-ig-ranking-grid">
      <article class="db-card hr-card">
        <div class="db-card__inner">
          <header class="db-card__header"><span class="section-label">Mas arrobados total</span></header>
          <button class="db-btn-secondary" type="button" data-action="ig-export-csv" data-ranking="total">Exportar CSV</button>
          ${renderIgRankingChart(analysis.ranking_total, 'Menciones totales')}
          ${renderIgRankingTable(analysis.ranking_total, false)}
        </div>
      </article>
      <article class="db-card hr-card">
        <div class="db-card__inner">
          <header class="db-card__header"><span class="section-label">Mas arrobados por usuarios unicos</span></header>
          <button class="db-btn-secondary" type="button" data-action="ig-export-csv" data-ranking="unique">Exportar CSV</button>
          ${renderIgRankingChart(analysis.ranking_unique_authors, 'Usuarios unicos')}
          ${renderIgRankingTable(analysis.ranking_unique_authors, true)}
        </div>
      </article>
    </div>
    <article class="db-card hr-card db-ig-author-summary">
      <div class="db-card__inner">
        <header class="db-card__header"><span class="section-label">Resumen de autores</span></header>
        <p class="db-note">Usuarios ordenados por cantidad de comentarios principales y artistas etiquetados.</p>
        ${renderIgRankingChart((analysis.ranking_authors || []).map((row) => ({ mention: '@' + row.author, count: row.count })), 'Comentarios')}
        ${renderIgAuthorSummaryTable(analysis.ranking_authors)}
      </div>
    </article>
    <article class="db-card hr-card db-ig-author-summary">
      <div class="db-card__inner">
        <header class="db-card__header"><span class="section-label">Artistas distintos mencionados</span></header>
        <p class="db-note">Usuarios ordenados por la cantidad de artistas diferentes que etiquetaron.</p>
        ${renderIgRankingChart(igDistinctArtistAuthors(analysis.ranking_authors).map((row) => ({ mention: '@' + row.author, count: row.count })), 'Artistas distintos')}
        ${renderIgDistinctAuthorsTable(igDistinctArtistAuthors(analysis.ranking_authors))}
      </div>
    </article>
  `;
}

function igDistinctArtistAuthors(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      author: String(row?.author || ''),
      count: Array.isArray(row?.mentions) ? row.mentions.length : 0,
      mentions: Array.isArray(row?.mentions) ? row.mentions : [],
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
}

function renderIgDistinctAuthorsTable(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return '<p class="db-empty">Ningun autor etiqueto artistas.</p>';
  return `
    <div class="db-table-wrap">
      <table class="db-table">
        <thead><tr><th>#</th><th>Autor</th><th>Artistas distintos</th><th>Artistas etiquetados</th></tr></thead>
        <tbody>
          ${safeRows.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td><code>@${escapeHTML(row.author || '')}</code></td>
              <td>${escapeHTML(row.count ?? 0)}</td>
              <td>${escapeHTML((row.mentions || []).join(', '))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderIgAuthorSummaryTable(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return '<p class="db-empty">Sin autores disponibles.</p>';
  return `
    <div class="db-table-wrap">
      <table class="db-table">
        <thead><tr><th>#</th><th>Autor</th><th>Comentarios</th><th>Artistas etiquetados</th></tr></thead>
        <tbody>
          ${safeRows.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td><code>@${escapeHTML(row.author || '')}</code></td>
              <td>${escapeHTML(row.count ?? 0)}</td>
              <td>${escapeHTML((row.mentions || []).join(', ') || 'Sin etiquetas')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderIgRankingChart(rows, valueLabel) {
  const safeRows = (Array.isArray(rows) ? rows : []).slice(0, 15);
  if (!safeRows.length) return '';
  const maxCount = Math.max(1, ...safeRows.map((row) => Number(row?.count) || 0));
  return `
    <div class="db-ig-chart" role="img" aria-label="Grafica de barras de ${escapeHTML(valueLabel)}">
      <div class="db-ig-chart__header">
        <strong>Top ${safeRows.length}</strong>
        <span>${escapeHTML(valueLabel)}</span>
      </div>
      <div class="db-ig-chart__plot">
        ${safeRows.map((row) => {
          const count = Number(row?.count) || 0;
          const width = Math.max(2, (count / maxCount) * 100);
          return `
            <div class="db-ig-chart__row">
              <code title="${escapeHTML(row?.mention || '')}">${escapeHTML(row?.mention || '')}</code>
              <div class="db-ig-chart__track"><span style="width:${width.toFixed(2)}%"></span></div>
              <strong>${escapeHTML(count.toLocaleString('es-MX'))}</strong>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderIgRankingTable(rows, includeAuthors) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return '<p class="db-empty">Sin menciones detectadas.</p>';
  return `
    <div class="db-table-wrap">
      <table class="db-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Mencion</th>
            <th>Conteo</th>
            ${includeAuthors ? '<th>Autores</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${safeRows.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td><code>${escapeHTML(row.mention || '')}</code></td>
              <td>${escapeHTML(row.count ?? 0)}</td>
              ${includeAuthors ? `<td>${escapeHTML((row.authors || []).join(', '))}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportIgRankingCsv(type) {
  const analysis = getIgMentionState().analysis;
  if (!analysis) {
    showToast('Primero analiza una publicacion.', 'error');
    return;
  }

  if (type === 'unique') {
    const rows = [['mention', 'count', 'authors'], ...(analysis.ranking_unique_authors || []).map((row) => [row.mention, row.count, row.authors || []])];
    downloadCsv('instagram-mention-rank-unique-authors.csv', rows);
    return;
  }

  const rows = [['mention', 'count'], ...(analysis.ranking_total || []).map((row) => [row.mention, row.count])];
  downloadCsv('instagram-mention-rank-total.csv', rows);
}

function exportIgCommentsMarkdown() {
  const igState = getIgMentionState();
  const comments = Array.isArray(igState.analysis?.comments_export) ? igState.analysis.comments_export : [];
  if (!comments.length) {
    showToast('No hay comentarios disponibles para exportar.', 'error');
    return;
  }

  const markdown = comments.map((comment) => {
    const username = String(comment?.username || 'usuario_desconocido').trim();
    const timestamp = String(comment?.timestamp || '').trim();
    const text = String(comment?.text || '').replace(/\r\n?/g, '\n').trim();
    const quotedText = (text || '(Comentario sin texto)')
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    return `### @${username.replace(/^@+/, '')}\n${timestamp ? `\n${timestamp}\n` : ''}\n${quotedText}`;
  }).join('\n\n---\n\n');

  const mediaId = String(igState.selectedMedia?.id || 'publicacion').replace(/[^a-z0-9_-]+/gi, '-');
  const blob = new Blob([markdown + '\n'], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `instagram-comments-${mediaId}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Comentarios exportados en Markdown.', 'success');
}

function igPdfRows(rows, includeAuthors, limit = 100) {
  return (Array.isArray(rows) ? rows : []).slice(0, limit).map((row, index) => {
    const base = [String(index + 1), String(row.mention || ''), String(row.count ?? 0)];
    if (includeAuthors) base.push(Array.isArray(row.authors) ? row.authors.join(', ') : '');
    return base;
  });
}

function igSafePdfFilename(mediaId) {
  const cleanId = String(mediaId || 'publicacion').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'publicacion';
  return 'instagram-mention-rank-' + cleanId + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
}

function drawIgPdfBarChart(doc, rows, title, startY, margin) {
  const safeRows = (Array.isArray(rows) ? rows : []).slice(0, 15);
  if (!safeRows.length) return startY;
  const pageHeight = doc.internal.pageSize.getHeight();
  const chartHeight = 30 + safeRows.length * 18;
  let y = startY;
  if (y + chartHeight > pageHeight - 38) {
    doc.addPage();
    y = 48;
  }

  const maxCount = Math.max(1, ...safeRows.map((row) => Number(row?.count) || 0));
  const labelWidth = 105;
  const valueWidth = 35;
  const chartWidth = doc.internal.pageSize.getWidth() - margin * 2 - labelWidth - valueWidth;
  doc.setFontSize(12);
  doc.text(title, margin, y);
  y += 18;

  safeRows.forEach((row) => {
    const count = Number(row?.count) || 0;
    const barWidth = Math.max(2, (count / maxCount) * chartWidth);
    doc.setFontSize(8);
    doc.setTextColor(45, 45, 45);
    doc.text(String(row?.mention || ''), margin, y + 8, { maxWidth: labelWidth - 8 });
    doc.setFillColor(231, 233, 236);
    doc.rect(margin + labelWidth, y, chartWidth, 10, 'F');
    doc.setFillColor(220, 40, 84);
    doc.rect(margin + labelWidth, y, barWidth, 10, 'F');
    doc.text(count.toLocaleString('es-MX'), margin + labelWidth + chartWidth + 7, y + 8);
    y += 18;
  });
  doc.setTextColor(0, 0, 0);
  return y + 12;
}

async function exportIgAnalysisPdf() {
  const igState = getIgMentionState();
  const analysis = igState.analysis;
  const media = igState.selectedMedia || {};
  if (!analysis) {
    showToast('Primero analiza una publicacion.', 'error');
    return;
  }

  try {
    await ensurePdfLibraries();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const generatedAt = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    const apiModeLabel = analysis.api_mode === 'facebook_graph' || media.api_mode === 'facebook_graph' ? 'Facebook Graph' : 'Instagram Login';
    const commentScope = igCommentScopeSummary(analysis, media);
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;

    doc.setFontSize(18);
    doc.text('Instagram Mention Rank', margin, 42);
    doc.setFontSize(10);
    doc.text('Generado: ' + generatedAt, margin, 62);
    doc.text('Modo API: ' + apiModeLabel, margin, 78);
    doc.text('Media ID: ' + (media.id || analysis.media?.id || '-'), margin, 94);
    if (media.permalink || analysis.media_permalink) {
      const link = String(media.permalink || analysis.media_permalink);
      doc.text('Permalink: ' + link, margin, 110, { maxWidth: pageWidth - margin * 2 });
    }

    doc.autoTable({
      head: [['Metrica', 'Valor']],
      body: [
        ['Comentarios principales procesados', commentScope.processedLabel],
        ['Replies excluidas por regla del concurso', commentScope.excludedRepliesLabel + ' aprox.'],
        ['comments_count Meta', commentScope.metaCountLabel],
        ['Nota', 'Meta incluye replies en comments_count.'],
        ['Menciones detectadas', String(analysis.mentions_count ?? 0)],
        ['Usuarios arrobados', String(analysis.unique_mentions_count ?? 0)],
        ['Paginas leidas', String(analysis.pages_fetched ?? 0)],
        ['Comentarios con @', String(analysis.comments_with_mentions_count ?? 0)],
        ['Guardado Supabase', String(analysis.saved_analysis_id || 'No')],
      ],
      startY: 132,
      styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [32, 32, 32] },
      margin: { left: margin, right: margin },
    });

    let nextY = (doc.lastAutoTable?.finalY || 132) + 28;
    doc.setFontSize(10);
    doc.text('Este ranking cuenta unicamente comentarios principales. Las respuestas a comentarios no se consideran para la dinamica, aunque Meta las incluya dentro de comments_count.', margin, nextY, { maxWidth: pageWidth - margin * 2 });
    nextY += 44;
    if (analysis.analysis_warning) {
      doc.setFontSize(10);
      doc.text('Nota: ' + analysis.analysis_warning, margin, nextY, { maxWidth: pageWidth - margin * 2 });
      nextY += 44;
    }

    doc.setFontSize(12);
    nextY = drawIgPdfBarChart(doc, analysis.ranking_total, 'Grafica: menciones totales', nextY, margin);
    doc.text('Mas arrobados total', margin, nextY - 8);
    const totalRows = igPdfRows(analysis.ranking_total, false);
    doc.autoTable({
      head: [['#', 'Mencion', 'Conteo']],
      body: totalRows.length ? totalRows : [['-', 'Sin menciones detectadas', '0']],
      startY: nextY,
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [32, 32, 32] },
      margin: { left: margin, right: margin },
    });

    nextY = (doc.lastAutoTable?.finalY || nextY) + 32;
    if (nextY > doc.internal.pageSize.getHeight() - 90) {
      doc.addPage();
      nextY = 52;
    }
    doc.setFontSize(12);
    nextY = drawIgPdfBarChart(doc, analysis.ranking_unique_authors, 'Grafica: usuarios unicos', nextY, margin);
    doc.text('Mas arrobados por usuarios unicos', margin, nextY - 8);
    const uniqueRows = igPdfRows(analysis.ranking_unique_authors, true);
    doc.autoTable({
      head: [['#', 'Mencion', 'Usuarios', 'Autores']],
      body: uniqueRows.length ? uniqueRows : [['-', 'Sin menciones detectadas', '0', '']],
      startY: nextY,
      styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [32, 32, 32] },
      columnStyles: { 3: { cellWidth: 260 } },
      margin: { left: margin, right: margin },
    });

    nextY = (doc.lastAutoTable?.finalY || nextY) + 32;
    const authorRanking = Array.isArray(analysis.ranking_authors) ? analysis.ranking_authors : [];
    const authorChartRows = authorRanking.map((row) => ({ mention: '@' + String(row.author || ''), count: row.count }));
    nextY = drawIgPdfBarChart(doc, authorChartRows, 'Grafica: autores con mas comentarios', nextY, margin);
    doc.setFontSize(12);
    doc.text('Resumen de autores', margin, nextY - 8);
    const authorRows = authorRanking.slice(0, 100).map((row, index) => [
      String(index + 1),
      '@' + String(row.author || ''),
      String(row.count ?? 0),
      Array.isArray(row.mentions) && row.mentions.length ? row.mentions.join(', ') : 'Sin etiquetas',
    ]);
    doc.autoTable({
      head: [['#', 'Autor', 'Comentarios', 'Artistas etiquetados']],
      body: authorRows.length ? authorRows : [['-', 'Sin autores disponibles', '0', '']],
      startY: nextY,
      styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [32, 32, 32] },
      columnStyles: { 3: { cellWidth: 260 } },
      margin: { left: margin, right: margin },
    });

    nextY = (doc.lastAutoTable?.finalY || nextY) + 32;
    const distinctAuthorRanking = igDistinctArtistAuthors(authorRanking);
    const distinctChartRows = distinctAuthorRanking.map((row) => ({ mention: '@' + row.author, count: row.count }));
    nextY = drawIgPdfBarChart(doc, distinctChartRows, 'Grafica: artistas distintos mencionados', nextY, margin);
    doc.setFontSize(12);
    doc.text('Artistas distintos mencionados por autor', margin, nextY - 8);
    const distinctRows = distinctAuthorRanking.slice(0, 100).map((row, index) => [
      String(index + 1),
      '@' + row.author,
      String(row.count),
      row.mentions.join(', '),
    ]);
    doc.autoTable({
      head: [['#', 'Autor', 'Artistas distintos', 'Artistas etiquetados']],
      body: distinctRows.length ? distinctRows : [['-', 'Sin autores disponibles', '0', '']],
      startY: nextY,
      styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [32, 32, 32] },
      columnStyles: { 3: { cellWidth: 260 } },
      margin: { left: margin, right: margin },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.text('Hidden Room - Instagram Mention Rank - Pagina ' + page + '/' + pageCount, margin, doc.internal.pageSize.getHeight() - 20);
    }

    doc.save(igSafePdfFilename(media.id || analysis.media?.id));
    showToast('PDF de Instagram Mention Rank generado.', 'success');
  } catch (err) {
    console.error('[HR] Instagram Mention Rank PDF:', err);
    showToast('No se pudo generar el PDF.', 'error');
  }
}

async function handleIgListMedia(form) {
  const status = form.querySelector('[data-ig-status]');
  const submit = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const token = String(formData.get('access_token') || '').trim();
  const apiMode = String(formData.get('api_mode') || 'instagram_login');
  const limit = Number(formData.get('limit') || 25);
  const permalink = String(formData.get('permalink') || '').trim();
  const resolvePermalink = form.dataset.operationAction === 'resolve';
  const igState = getIgMentionState();
  igState.accessToken = token;
  igState.apiMode = apiMode;
  igState.error = '';
  if (resolvePermalink && !permalink) {
    showToast('Pega el enlace de una publicacion de Instagram.', 'error');
    return;
  }
  if (status) status.textContent = resolvePermalink ? 'Buscando publicacion en tu cuenta...' : 'Cargando publicaciones...';
  if (submit) submit.disabled = true;

  try {
    const result = await igFunctionFetch('ig-list-media', {
      access_token: token,
      api_mode: apiMode,
      limit,
      permalink: resolvePermalink ? permalink : '',
    });
    igState.media = Array.isArray(result.media) ? result.media.map((item) => ({ ...item, api_mode: item.api_mode || result.api_mode || apiMode })) : [];
    igState.apiMode = result.api_mode || apiMode;
    console.info('[Instagram Mention Rank] Publicaciones cargadas', {
      mode: igState.apiMode,
      count: igState.media.length,
      media: igState.media.map((item) => ({
        media_id: item.id,
        media_permalink: item.permalink || null,
        comments_count: item.comments_count ?? null,
        api_mode: item.api_mode || igState.apiMode,
      })),
    });
    igState.analysis = null;
    igState.selectedMedia = null;
    igState.isAnalyzing = false;
    if (resolvePermalink) {
      const resolvedMedia = igState.media[0];
      showToast('Publicacion encontrada. Iniciando analisis.', 'success');
      await handleIgAnalyzeMedia(resolvedMedia?.id);
      return;
    }
    showToast('Publicaciones cargadas.', 'success');
    renderSection('erp-ig-mention-rank');
  } catch (err) {
    igState.error = err.message || 'No se pudieron cargar las publicaciones.';
    if (status) status.textContent = igState.error;
    showToast(igState.error, 'error');
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function handleIgAnalyzeMedia(mediaId) {
  const igState = getIgMentionState();
  const token = getIgTokenFromDashboard();
  const media = (igState.media || []).find((item) => String(item.id) === String(mediaId));
  const apiMode = media?.api_mode || getIgApiModeFromDashboard();
  if (!mediaId || !media) {
    showToast('Selecciona una publicacion cargada desde Instagram antes de analizar.', 'error');
    return;
  }

  console.info('[Instagram Mention Rank] Analizando media', {
    media_id: media.id,
    media_permalink: media.permalink || null,
    comments_count: media.comments_count ?? null,
    api_mode: apiMode,
  });

  igState.accessToken = token;
  igState.apiMode = apiMode;
  igState.error = '';
  igState.analysis = null;
  igState.selectedMedia = media;
  igState.isAnalyzing = true;
  showToast(apiMode === 'facebook_graph' ? 'Analizando comentarios con Facebook Graph...' : 'Analizando comentarios de Instagram...', 'info');
  renderSection('erp-ig-mention-rank');

  try {
    const result = await igAnalyzeCommentsStream({
      access_token: token,
      api_mode: apiMode,
      media_id: mediaId,
      media_permalink: media?.permalink || null,
    });
    igState.analysis = result;
    igState.selectedMedia = media || { id: mediaId };
    igState.isAnalyzing = false;
    console.info('[Instagram Mention Rank] Analisis completado', {
      media_id: media.id,
      meta_comments_count: result.meta_comments_count ?? null,
      comments_downloaded: result.comments_count ?? null,
      coverage_percent: result.coverage_percent ?? null,
      pages_fetched: result.pages_fetched ?? null,
      elapsed_seconds: result.elapsed_seconds ?? null,
      incomplete_reasons: result.incomplete_reasons || [],
    });
    showToast('Analisis completado.', 'success');
    renderSection('erp-ig-mention-rank');
  } catch (err) {
    igState.isAnalyzing = false;
    igState.error = err.message || 'No se pudieron analizar los comentarios.';
    showToast(igState.error, 'error');
    renderSection('erp-ig-mention-rank');
  }
}
function canImportPasslineTickets() {
  return hasRole('admin') || hasAnyPermission(['erp.finance.input', 'erp.ops.input']);
}

function passlineImportState() {
  return state.data.passlineImport ?? {
    sourceType: 'passline_tickets',
    sourceLabel: 'Passline Tickets',
    fileName: '',
    rawRows: [],
    rows: [],
    summary: null,
    importSummary: null,
    error: '',
  };
}

async function renderErpCsvUpload() {
  if (!canImportPasslineTickets()) {
    return sectionShell('ERP', 'Subir CSV', 'title-erp-csv-upload', `
      <p class="db-empty db-empty--error">No tienes permiso para importar CSV en ERP.</p>
    `);
  }

  const importState = passlineImportState();
  return sectionShell('ERP', 'Subir CSV', 'title-erp-csv-upload', `
    <div class="db-admin-grid db-admin-grid--single">
      <article class="db-card hr-card">
        <div class="db-card__inner">
          <div class="db-form__row">
            <label class="db-field">
              <span>Tipo de CSV</span>
              <select id="js-passline-source-type" aria-label="Tipo de CSV">
                ${optionHTML('passline_tickets', 'Passline Tickets', importState.sourceType)}
              </select>
            </label>
            <label class="db-field">
              <span>Archivos CSV</span>
              <input id="js-passline-csv-file" type="file" accept=".csv,text/csv" multiple />
            </label>
          </div>
          ${importState.fileName ? `<p class="db-field__hint">${escapeHTML(importState.fileName)}</p>` : ''}
          <div class="db-form__actions">
            <button class="db-btn-secondary" type="button" data-action="passline-preview"${importState.isImporting ? ' disabled' : ''}>Previsualizar</button>
            <button class="btn-primary" type="button" data-action="passline-import"${importState.rows.length && !importState.isImporting ? '' : ' disabled'}>${importState.isImporting ? 'Subiendo...' : 'Importar a Supabase'}</button>
          </div>
          ${importState.error ? `<p class="db-empty db-empty--error">${escapeHTML(importState.error)}</p>` : ''}
        </div>
      </article>
      ${renderPasslineImportSummary(importState.summary, 'Preview')}
      ${renderPasslineImportSummary(importState.importSummary, 'Importacion')}
      ${renderPasslinePreviewTable(importState.rows)}
    </div>
  `);
}

function renderPasslineImportSummary(summary, label) {
  if (!summary) return '';
  return `
    <div class="db-grid db-grid--4col db-finance-summary" aria-label="${escapeAttr(label)} Passline">
      ${renderStatCard('Filas', String(summary.totalRows ?? 0))}
      ${renderStatCard('Tickets nuevos', String(summary.newTickets ?? 0))}
      ${renderStatCard('Actualizados', String(summary.updatedTickets ?? 0))}
      ${renderStatCard('Anulados', String(summary.cancelledTickets ?? 0))}
      ${renderStatCard('Vigentes', String(summary.activeTickets ?? 0))}
      ${renderStatCard('Validados', String(summary.validatedTickets ?? 0))}
      ${renderStatCard('Cortesias', String(summary.courtesyTickets ?? 0))}
      ${renderStatCard('Total vendido', money(summary.totalSold ?? 0))}
    </div>
  `;
}

function renderPasslinePreviewTable(rows = []) {
  const previewRows = rows.slice(0, 20);
  const body = previewRows.length
    ? previewRows.map((row) => `
      <tr>
        <td>${escapeHTML(row.ticket_id ?? '-')}</td>
        <td>${escapeHTML(row.buyer_name ?? '-')}</td>
        <td>${escapeHTML(row.buyer_email ?? '-')}</td>
        <td>${escapeHTML(row.buyer_phone ?? '-')}</td>
        <td>${escapeHTML(row.user_id ?? '-')}</td>
        <td>${escapeHTML(row.event_key ?? '-')}</td>
        <td>${escapeHTML(row.ticket_type ?? '-')}</td>
        <td>${escapeHTML(row.purchase_status ?? '-')}</td>
        <td>${escapeHTML(row.ticket_status ?? '-')}</td>
        <td>${money(row.total ?? 0)}</td>
      </tr>
    `).join('')
    : '<tr class="db-table__empty-row hr-table-empty"><td colspan="10" class="db-empty hr-table-empty">Carga un CSV para ver las primeras 20 filas.</td></tr>';

  return `
    <div class="db-table-wrap hr-table-wrap">
      <table class="db-table hr-table hr-table-readable" aria-label="Preview Passline Tickets">
        <thead>
          <tr>
            <th scope="col">ID ticket</th>
            <th scope="col">Nombre</th>
            <th scope="col">Email</th>
            <th scope="col">Telefono</th>
            <th scope="col">Llave Evento</th>
            <th scope="col">Tipo</th>
            <th scope="col">Estado</th>
            <th scope="col">Estado eticket</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

async function parsePasslineCsv(file) {
  if (!file) throw new Error('Selecciona un archivo CSV.');
  const buffer = await file.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
  const table = parseSemicolonCsv(text);
  if (!table.length) return [];

  const headers = table[0].map((header, index) => normalizePasslineHeader(header, index));
  const seen = new Map();
  const uniqueHeaders = headers.map((header) => {
    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    return count ? `${header}.${count}` : header;
  });

  return table.slice(1)
    .map((cells) => {
      const row = {};
      uniqueHeaders.forEach((header, index) => {
        row[header] = cells[index] ?? '';
      });
      row.__source_file = file.name || '';
      return row;
    })
    .filter((row) => Object.entries(row).some(([key, value]) => key !== '__source_file' && String(value ?? '').trim() !== ''));
}

function parseSemicolonCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ';' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function normalizePasslineHeader(header, index) {
  const value = String(header ?? '').trim().replace(/^\uFEFF/, '');
  return value || `Unnamed${index ? `.${index}` : ''}`;
}

function passlineColumnKey(label) {
  return String(label ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function passlineValue(row, label) {
  const target = passlineColumnKey(label);
  const matches = Object.keys(row ?? {}).filter((key) => {
    const base = String(key).replace(/\.\d+$/, '');
    return passlineColumnKey(base) === target;
  });

  for (const key of matches) {
    const value = String(row[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function passlineNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  let normalized = raw.replace(/[^0-9,.-]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function passlineBoolean(value) {
  const normalized = passlineColumnKey(value);
  if (['si', 's', 'yes', 'true', '1'].includes(normalized)) return true;
  if (['no', 'n', 'false', '0'].includes(normalized)) return false;
  return null;
}

function passlineDateTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePasslineRow(row, fileName = '') {
  const ticketId = passlineValue(row, 'ID ticket');
  const { __source_file: sourceFile, ...rawRow } = row ?? {};
  return {
    event_key: passlineValue(row, 'Llave Evento') || null,
    event_date: passlineDateTime(passlineValue(row, 'Fecha Evento')),
    purchase_id: passlineValue(row, 'ID Compra') || null,
    ticket_id: ticketId,
    buyer_name: passlineValue(row, 'Nombre') || null,
    buyer_email: passlineValue(row, 'Email') || null,
    buyer_phone: passlineValue(row, 'Telefono') || null,
    ticket_type: passlineValue(row, 'Tipo') || null,
    purchase_status: passlineValue(row, 'Estado') || null,
    ticket_status: passlineValue(row, 'Estado del eticket') || null,
    is_courtesy: passlineBoolean(passlineValue(row, 'Cortesia')),
    rrpp: passlineValue(row, 'RRPP') || null,
    rrpp_email: passlineValue(row, 'Email RRPP') || null,
    rrpp_name: passlineValue(row, 'Nombre RRPP') || null,
    total: passlineNumber(passlineValue(row, 'Total')),
    service_fee: passlineNumber(passlineValue(row, 'Cargo por Servicio')),
    discount_code: passlineValue(row, 'Codigo descuento') || null,
    discount_amount: passlineNumber(passlineValue(row, 'Monto descuento')),
    validation_datetime: passlineDateTime(passlineValue(row, 'Fecha/Hora Validacion')),
    activation_code: passlineValue(row, 'Codigo Activacion') || null,
    raw_row: rawRow,
    source_file: fileName || sourceFile || null,
  };
}

async function previewPasslineImport(rows) {
  const importState = passlineImportState();
  await ensureUsersLoaded();
  const trackingIndex = buildPasslineTrackingIndex(state.data.users ?? []);
  const normalizedRows = rows
    .map((row) => normalizePasslineRow(row, row.__source_file || importState.fileName))
    .map((row) => applyPasslineTracking(row, trackingIndex))
    .filter((row) => row.ticket_id);
  const existingIds = await fetchExistingPasslineTicketIds(normalizedRows.map((row) => row.ticket_id));
  const summary = buildPasslineSummary(normalizedRows, existingIds);
  state.data.passlineImport = {
    ...importState,
    rawRows: rows,
    rows: normalizedRows,
    summary,
    importSummary: null,
    error: state.data.passlineSchemaMissing ? 'La tabla passline_tickets todavia no existe en Supabase. Ya puedes revisar el preview; aplica la migracion antes de importar.' : '',
  };
  return state.data.passlineImport;
}

async function fetchExistingPasslineTicketIds(ticketIds = []) {
  const ids = [...new Set(ticketIds.filter(Boolean))];
  const existing = new Set();
  for (let index = 0; index < ids.length; index += 500) {
    const chunk = ids.slice(index, index + 500);
    const { data, error } = await supabase
      .from('passline_tickets')
      .select('ticket_id')
      .in('ticket_id', chunk);
    if (error) {
      if (isMissingSupabaseRelationError(error)) {
        state.data.passlineSchemaMissing = true;
        return existing;
      }
      throw error;
    }
    state.data.passlineSchemaMissing = false;
    (data ?? []).forEach((row) => existing.add(row.ticket_id));
  }
  return existing;
}

function buildPasslineSummary(rows = [], existingIds = new Set()) {
  return rows.reduce((summary, row) => {
    const statusText = passlineColumnKey(`${row.purchase_status ?? ''} ${row.ticket_status ?? ''}`);
    const validated = Boolean(row.validation_datetime) || statusText.includes('validado');
    const cancelled = /anulad|cancel|devuelt|refund/.test(statusText);
    summary.totalRows += 1;
    summary.totalSold += Number(row.total ?? 0);
    if (existingIds.has(row.ticket_id)) summary.updatedTickets += 1;
    else summary.newTickets += 1;
    if (cancelled) summary.cancelledTickets += 1;
    if (!cancelled) summary.activeTickets += 1;
    if (validated) summary.validatedTickets += 1;
    if (row.is_courtesy) summary.courtesyTickets += 1;
    return summary;
  }, {
    totalRows: 0,
    newTickets: 0,
    updatedTickets: 0,
    cancelledTickets: 0,
    activeTickets: 0,
    validatedTickets: 0,
    courtesyTickets: 0,
    totalSold: 0,
  });
}

async function importPasslineTickets(rows) {
  if (!canImportPasslineTickets()) throw new Error('No tienes permiso para importar Passline Tickets.');
  const validRows = rows.filter((row) => row.ticket_id);
  if (!validRows.length) throw new Error('No hay tickets validos para importar.');
  if (state.data.passlineSchemaMissing) throw new Error('Falta aplicar la migracion que crea public.passline_tickets en Supabase.');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Sesion de Supabase no disponible.');

  const existingIds = await fetchExistingPasslineTicketIds(validRows.map((row) => row.ticket_id));
  const summary = buildPasslineSummary(validRows, existingIds);
  const importedAt = new Date().toISOString();
  for (let index = 0; index < validRows.length; index += 500) {
    const chunk = validRows.slice(index, index + 500).map((row) => ({
      ...row,
      imported_by: user.id,
      imported_at: importedAt,
    }));
    const { error } = await supabase
      .from('passline_tickets')
      .upsert(chunk, { onConflict: 'ticket_id' });
    if (error) throw error;
  }

  return summary;
}

async function handlePasslinePreview() {
  const fileInput = document.getElementById('js-passline-csv-file');
  const files = [...(fileInput?.files ?? [])];
  const importState = passlineImportState();
  try {
    if (!files.length) throw new Error('Selecciona al menos un archivo CSV.');
    const parsedFiles = await Promise.all(files.map((file) => parsePasslineCsv(file)));
    const rawRows = parsedFiles.flat();
    const fileLabel = files.length === 1
      ? files[0].name
      : `${files.length} archivos: ${files.map((file) => file.name).join(', ')}`;
    state.data.passlineImport = {
      ...importState,
      fileName: fileLabel,
      rawRows,
      error: '',
    };
    await previewPasslineImport(rawRows);
    showToast('Preview de Passline listo.', 'success');
  } catch (error) {
    console.error('[HR] passline preview:', error);
    state.data.passlineImport = { ...importState, error: error?.message || 'No se pudo leer el CSV.' };
    showToast(state.data.passlineImport.error, 'error');
  }
  renderSection('erp-csv-upload');
}

async function handlePasslineImport() {
  const importState = passlineImportState();
  if (importState.isImporting) return;
  state.data.passlineImport = { ...importState, isImporting: true, error: '' };
  renderSection('erp-csv-upload');

  try {
    const importSummary = await importPasslineTickets(importState.rows ?? []);
    state.data.passlineImport = { ...state.data.passlineImport, importSummary, isImporting: false, error: '' };
    showToast('Tickets Passline importados.', 'success');
  } catch (error) {
    console.error('[HR] passline import:', error);
    state.data.passlineImport = { ...state.data.passlineImport, isImporting: false, error: error?.message || 'No se pudo importar el CSV.' };
    showToast(state.data.passlineImport.error, 'error');
  }
  renderSection('erp-csv-upload');
}
async function renderErpOps() {
  await ensureUsersLoaded();
  const events = await ensureFinanceEventsLoaded();
  const participants = await fetchAllEventParticipants();
  const financeEntities = await fetchFinanceEntities();
  const paymentMethods = await fetchPaymentMethods();
  const services = await fetchServices();
  const memberships = await fetchMembershipOptionsForOps();
  const activeForm = persistedDataValue('erpOpsForm', 'transaction');
  const mergeDuplicateMode = persistedDataValue('mergeDuplicateMode', 'email');
  const opsForms = {
    transaction: {
      label: 'Finanzas',
      html: renderTransactionForm('transaction-create', paymentMethods, services),
    },
    session: {
      label: 'Sesion',
      html: `
        <form class="db-form" data-form="session-create">
          ${renderErpUserPicker('user_id', 'Usuario')}
          ${renderUserAutofillFields()}
          <div class="db-form__row">
            <label class="db-field"><span>Fecha</span><input name="session_date" type="date" required /></label>
          </div>
          <label class="db-field"><span>Concepto</span><input name="concept" data-session-concept required /></label>
          <div class="db-form__row">
            <label class="db-field"><span>Status</span><select name="status">${ERP_STATUS_OPTIONS.map((status) => optionHTML(status, status, 'sin apartado')).join('')}</select></label>
            <label class="db-field"><span>Tipo</span><select name="type" data-session-type required>${renderSessionTypeOptions(services)}</select></label>
          </div>
          <div class="db-form__row">
            <label class="db-field"><span>Hora de inicio</span><select name="hour" data-session-start required>${renderHalfHourOptions()}</select></label>
            <label class="db-field"><span>Hora de final</span><input name="sc_end" data-session-end type="time" readonly /></label>
          </div>
          <div class="db-form__row">
            <label class="db-field"><span>Costo</span><input name="cost" data-session-cost type="number" step="0.01" value="${defaultSessionServiceCost(services)}" readonly /></label>
            <label class="db-field"><span>Promo</span><input name="promo" /></label>
          </div>
          <label class="db-field"><span>Notas</span><textarea name="notes" rows="3"></textarea></label>
          ${renderOperationCreateActions('CREAR')}
        </form>
      `,
    },
    download: {
      label: 'Descarga',
      html: renderDownloadOpsForm(memberships),
    },
    beatSale: {
      label: 'Beat a la venta',
      html: renderBeatSaleOpsForm(),
    },
    contract: {
      label: 'Contrato',
      html: `
        <form class="db-form" data-form="contract-create">
          ${renderErpUserPicker('user_id', 'Usuario')}
          ${renderUserAutofillFields()}
          <label class="db-field"><span>Contrato</span><input name="contract" required placeholder="URL o ruta" /></label>
          ${renderOperationCreateActions('CREAR')}
        </form>
      `,
    },
    user: {
      label: 'Usuario',
      html: `
        <form class="db-form" data-form="user-create">
          <div class="db-form__row">
            <label class="db-field"><span>Nombre</span><input name="display_name" required /></label>
            <label class="db-field"><span>Username</span><input name="username" /></label>
          </div>
          <label class="db-field"><span>User ID</span><input name="user_id" autocomplete="off" /></label>
          <label class="db-field"><span>Email</span><input type="email" name="email" required /></label>
          <div class="db-form__row">
            <label class="db-field"><span>WhatsApp</span><input name="whatsapp" /></label>
            <label class="db-field"><span>Rol</span><select name="roles">${AVAILABLE_ROLES.map((role) => optionHTML(role, role, 'client')).join('')}</select></label>
          </div>
          <button class="btn-primary" type="submit">Crear usuario</button>
          <div class="db-field__hint" data-admin-create-user-result hidden></div>
        </form>
      `,
    },
    event: {
      label: 'Evento',
      html: `
        <form class="db-form" data-form="event-create">
          <div class="db-form__row">
            <label class="db-field"><span>Clave del evento</span><input name="event_key" required /></label>
            <label class="db-field"><span>Nombre</span><input name="name" required /></label>
          </div>
          <div class="db-form__row">
            <label class="db-field"><span>Fecha</span><input name="event_date" type="date" /></label>
            <label class="db-field"><span>Status</span><select name="status">${EVENT_STATUS_OPTIONS.map((status) => optionHTML(status, status, 'closed')).join('')}</select></label>
          </div>
          <div class="db-form__row">
            <label class="db-field"><span>Venue</span><input name="venue" /></label>
            <label class="db-field"><span>Ciudad</span><input name="city" /></label>
          </div>
          <label class="db-field"><span>Notas</span><textarea name="notes" rows="3"></textarea></label>
          <button class="btn-primary" type="submit">Crear evento</button>
        </form>
      `,
    },
    eventMovement: {
      label: 'Nuevo movimiento',
      html: renderEventMovementOpsForm(events, participants, financeEntities, paymentMethods),
    },
    eventParticipant: {
      label: 'Nuevo participante',
      html: renderEventParticipantForm(),
    },
    paymentMethod: {
      label: 'Metodo de pago',
      html: renderPaymentMethodOpsForm(),
    },
    service: {
      label: 'Servicio',
      html: renderServiceOpsForm(),
    },
    financeEntity: {
      label: 'Entidad financiera',
      html: `
        <form class="db-form" data-form="finance-entity-create">
          <div class="db-form__row">
            <label class="db-field"><span>Clave</span><input name="entity_key" placeholder="productora_nombre" required /></label>
            <label class="db-field"><span>Nombre</span><input name="name" required /></label>
          </div>
          <div class="db-form__row">
            <label class="db-field"><span>Tipo</span><select name="entity_type">${[
              ['producer', 'Productora'],
              ['internal', 'Interna'],
              ['partner', 'Socio'],
              ['other', 'Otra'],
            ].map(([value, label]) => optionHTML(value, label, 'producer')).join('')}</select></label>
            <label class="db-field"><span>Status</span><select name="status">${[
              ['active', 'Activo'],
              ['inactive', 'Inactivo'],
            ].map(([value, label]) => optionHTML(value, label, 'active')).join('')}</select></label>
          </div>
          <label class="db-field"><span>Notas</span><textarea name="notes" rows="3"></textarea></label>
          <button class="btn-primary" type="submit">Crear entidad financiera</button>
        </form>
      `,
    },
    membership: {
      label: 'Membresías',
      html: renderMembershipOpsForm(memberships),
    },
    userMerge: {
      label: 'Fusionar usuarios',
      html: `
        <form class="db-form" data-form="user-merge">
          ${renderUserMergeDuplicateAlerts(mergeDuplicateMode)}
          ${renderUserPicker('keep_user_id', 'User ID histórico a conservar', '', {
            valueField: 'user_id',
            placeholder: 'Buscar perfil histórico',
            displayValue: (user) => `${user.display_name || user.username || user.email || 'Usuario'} · ${user.user_id ?? '-'}`,
            caption: (user) => `${usernameLabel(user)} · ${user.email ?? 'sin email'}`,
          })}
          ${renderUserPicker('duplicate_email', 'Email del perfil duplicado', '', {
            valueField: 'email',
            requiredField: 'email',
            placeholder: 'Buscar email duplicado',
            displayValue: (user) => `${user.email ?? ''} · ${user.display_name || user.username || 'Usuario'}`,
            caption: (user) => `${usernameLabel(user)} · ${user.email ?? 'sin email'}`,
            emptyLabel: 'Sin emails encontrados.',
          })}
          <p class="db-empty">La fusión conserva operaciones, sesiones, transacciones, premios, contratos, descargas y puntuaciones del User ID histórico. Del email duplicado solo toma Auth para login.</p>
          <button class="btn-primary" type="submit">Fusionar usuarios</button>
          <div class="db-field__hint" data-admin-merge-user-result hidden></div>
        </form>
      `,
    },
  };

  const selectedForm = opsForms[activeForm] ?? opsForms.session;

  return sectionShell('ERP', 'Operaciones', 'title-erp-ops', `
    <div class="db-toolbar">
      <label class="db-field db-field--compact">
        <span>Formulario</span>
        <select data-action="erp-ops-form" aria-label="Seleccionar formulario operativo">
          ${[
            ['transaction', 'Finanzas'],
            ['session', 'Sesion'],
            ['download', 'Descarga'],
            ['beatSale', 'Beat a la venta'],
            ['contract', 'Contrato'],
            ['user', 'Usuario'],
            ['event', 'Evento'],
            ['eventMovement', 'Nuevo movimiento'],
            ['eventParticipant', 'Nuevo participante'],
            ['financeEntity', 'Entidad financiera'],
            ['paymentMethod', 'Metodo de pago'],
            ['service', 'Servicio'],
            ['membership', 'Membresías'],
            ['userMerge', 'Fusionar usuarios'],
          ].map(([value, label]) => optionHTML(value, label, activeForm)).join('')}
        </select>
      </label>
    </div>
    <div class="db-admin-grid db-admin-grid--single">
      <article class="db-card hr-card">
        <header class="db-card__header"><span class="section-label">${escapeHTML(selectedForm.label)}</span></header>
        <div class="db-card__inner">${selectedForm.html}</div>
      </article>
    </div>
  `);
}

function renderPaymentMethodOpsForm() {
  return `
    <form class="db-form" data-form="payment-method-create">
      <div class="db-form__row">
        <label class="db-field"><span>Clave</span><input name="key" placeholder="NU" required /></label>
        <label class="db-field"><span>Nombre</span><input name="name" placeholder="NU" required /></label>
      </div>
      <div class="db-form__row">
        <label class="db-field"><span>Status</span><select name="status"><option value="active" selected>active</option><option value="inactive">inactive</option></select></label>
        <label class="db-field"><span>Orden</span><input name="sort_order" type="number" step="1" value="100" required /></label>
      </div>
      <button class="btn-primary" type="submit">Crear metodo</button>
    </form>
  `;
}

function renderServiceOpsForm() {
  return `
    <form class="db-form" data-form="service-create">
      <div class="db-form__row">
        <label class="db-field"><span>Clave</span><input name="key" placeholder="GRABACION" required /></label>
        <label class="db-field"><span>Nombre</span><input name="name" placeholder="GRABACIÓN" required /></label>
      </div>
      <div class="db-form__row">
        <label class="db-field"><span>Status</span><select name="status"><option value="active" selected>active</option><option value="inactive">inactive</option></select></label>
        <label class="db-field"><span>Orden</span><input name="sort_order" type="number" step="1" value="100" required /></label>
      </div>
      <div class="db-form__row">
        <label class="db-check"><input name="show_in_finance" type="checkbox" value="true" checked /> <span>Mostrar en finanzas</span></label>
        <label class="db-check"><input name="show_in_session" type="checkbox" value="true" /> <span>Mostrar en sesión</span></label>
      </div>
      <div class="db-form__row">
        <label class="db-field"><span>Costo sesión</span><input name="session_cost" type="number" step="0.01" min="0" /></label>
        <label class="db-field"><span>Minutos sesión</span><input name="session_minutes" type="number" step="1" min="1" /></label>
      </div>
      <button class="btn-primary" type="submit">Crear servicio</button>
    </form>
  `;
}

function renderEventParticipantForm() {
  return `
    <form class="db-form" data-form="event-participant-create">
      ${renderErpUserPicker('user_id', 'Usuario / participante')}
      ${renderUserAutofillFields()}
      <label class="db-field"><span>Rol general</span><input name="role" placeholder="Inversor, proveedor, venue..." /></label>
      <label class="db-field"><span>Status</span><select name="status">${['active', 'inactive'].map((status) => optionHTML(status, status, 'active')).join('')}</select></label>
      <label class="db-field"><span>Notas</span><textarea name="notes" rows="3"></textarea></label>
      <button class="btn-primary" type="submit">Crear participante</button>
    </form>
  `;
}

async function fetchMembershipOptionsForOps() {
  try {
    const memberships = await fetchAllTableEditorRows(
      'memberships',
      'id, user_id, username, status, start_date, end_date, weekly_price, sessions_per_week, notes',
      { field: 'start_date', direction: 'desc' }
    );
    state.data.membershipOpsOptions = memberships;
    return memberships;
  } catch (error) {
    console.info('[HR] memberships options unavailable:', error?.message ?? error);
    state.data.membershipOpsOptions = [];
    return [];
  }
}

function membershipOptionLabel(membership) {
  const user = (state.data.users ?? []).find((item) => String(item.user_id) === String(membership.user_id));
  const label = user ? userLabel(user.user_id) : (membership.username || membership.user_id || 'Usuario');
  const dates = `${formatDisplayDateOnly(membership.start_date)}${membership.end_date ? ` a ${formatDisplayDateOnly(membership.end_date)}` : ''}`;
  return `${label} · ${String(membership.status ?? 'active').toUpperCase()} · ${dates}`;
}

function renderDownloadOpsForm(memberships = []) {
  return `
    <form class="db-form" data-form="download-create">
      ${renderErpUserPicker('user_id', 'Usuario')}
      ${renderUserAutofillFields()}
      <label class="db-field">
        <span>¿Corresponde a una membresía?</span>
        <select name="release_mode" data-download-release-mode>
          <option value="immediate">No, liberar inmediatamente</option>
          <option value="membership_delivery">Sí, liberar con un entregable</option>
        </select>
      </label>
      <div class="db-form__row" data-download-membership-fields hidden>
        <label class="db-field">
          <span>Membresía</span>
          <select name="membership_id" data-download-membership-id>
            <option value="">Seleccionar membresía</option>
            ${memberships.map((membership) => `
              <option value="${escapeAttr(membership.id)}" data-membership-user-id="${escapeAttr(membership.user_id ?? '')}">
                ${escapeHTML(membershipOptionLabel(membership))}
              </option>
            `).join('')}
          </select>
        </label>
        <label class="db-field">
          <span>Entregable / ciclo</span>
          <select name="membership_cycle_number" data-download-cycle-number>
            <option value="">Seleccionar ciclo</option>
            ${renderMembershipCycleOptions()}
          </select>
        </label>
      </div>
      <label class="db-field"><span>Nombre</span><input name="name" required /></label>
      <label class="db-field">
        <span>Origen</span>
        <select name="source_type" data-download-source-type>
          <option value="link">Subir link</option>
          <option value="file">Subir archivo a Cloud</option>
        </select>
      </label>
      <label class="db-field" data-download-link-field><span>Ruta / link</span><input name="storage_path" data-download-storage-path required /></label>
      <label class="db-field" data-download-file-field hidden>
        <span>Archivo o carpeta</span>
        <div class="db-form__actions db-download-source-actions">
          <input type="file" data-download-file hidden />
          <input type="file" data-download-folder webkitdirectory directory multiple hidden />
          <button type="button" class="db-btn-secondary" data-action="download-select-file">Seleccionar archivo</button>
          <button type="button" class="db-btn-secondary" data-action="download-select-folder">Seleccionar carpeta</button>
          <button type="button" class="db-btn-secondary" data-download-cloud>Seleccionar desde Cloud</button>
        </div>
        <small class="db-field__hint" data-download-source>La carpeta se guardara como carpeta real; sus archivos conservaran su estructura.</small>
      </label>
      <label class="db-field"><span>Notas</span><textarea name="notes" rows="3"></textarea></label>
      <div class="db-upload-progress" data-download-upload-progress hidden>
        <div class="db-upload-progress__head">
          <span data-download-upload-progress-label>Esperando archivo</span>
          <strong data-download-upload-progress-value>0%</strong>
        </div>
        <div class="db-upload-progress__track" aria-hidden="true">
          <span data-download-upload-progress-bar style="width:0%"></span>
        </div>
      </div>
      ${renderOperationCreateActions('CREAR')}
    </form>
  `;
}

function renderMembershipCycleOptions(totalCycles = 24) {
  return Array.from({ length: totalCycles }, (_, index) => {
    const cycle = index + 1;
    const firstWeek = index * 4 + 1;
    const lastWeek = firstWeek + 3;
    return optionHTML(String(cycle), `Mes ${cycle} · Semanas ${firstWeek}-${lastWeek}`, '');
  }).join('');
}

function renderMembershipOpsForm(memberships = []) {
  const today = todayDateInputValue();
  const cancellable = (memberships ?? [])
    .filter((membership) => !['cancelled', 'expired'].includes(String(membership.status ?? '').toLowerCase()));

  return `
    <div class="db-membership-ops">
      <section class="db-membership-ops__block">
        <h2 class="db-membership-ops__title">Crear membresía</h2>
          <form class="db-form" data-form="membership-create">
            ${renderErpUserPicker('user_id', 'Usuario')}
            ${renderUserAutofillFields()}
            <div class="db-form__row">
              <label class="db-field"><span>Inicio</span><input name="start_date" type="date" value="${escapeAttr(today)}" required /></label>
              <label class="db-field"><span>Término</span><input name="end_date" type="date" /></label>
            </div>
            <div class="db-form__row">
              <label class="db-field"><span>Precio semanal</span><input name="weekly_price" type="number" step="0.01" value="${MEMBERSHIP_WEEKLY_COST}" required /></label>
              <label class="db-field"><span>Sesiones por semana</span><input name="sessions_per_week" type="number" step="1" min="1" value="1" required /></label>
            </div>
            <label class="db-field"><span>Status</span><select name="status">${['active', 'paused', 'cancelled', 'expired'].map((status) => optionHTML(status, status, 'active')).join('')}</select></label>
            <label class="db-field"><span>Notas</span><textarea name="notes" rows="3"></textarea></label>
            <button class="btn-primary" type="submit">Crear membresía</button>
          </form>
      </section>
      <section class="db-membership-ops__block">
        <h2 class="db-membership-ops__title">Entrega de material</h2>
          <form class="db-form" data-form="membership-delivery">
            <input type="hidden" name="note_scope" value="delivery" />
            <label class="db-field">
              <span>Membresía</span>
              <select name="membership_id">
                <option value="">Sin public.memberships / legacy</option>
                ${memberships.map((membership) => optionHTML(membership.id, membershipOptionLabel(membership), '')).join('')}
              </select>
            </label>
            ${renderErpUserPicker('user_id', 'Usuario')}
            ${renderUserAutofillFields()}
            <div class="db-form__row">
              <label class="db-field"><span>Ciclo</span><input name="cycle_number" type="number" step="1" min="1" value="1" required /></label>
              <label class="db-field"><span>Fecha de entrega</span><input name="delivered_at" type="date" value="${escapeAttr(today)}" required /></label>
            </div>
            <label class="db-field"><span>Notas de entrega</span><textarea name="notes" rows="3"></textarea></label>
            <button class="btn-primary" type="submit">Registrar entrega</button>
          </form>
      </section>
      <section class="db-membership-ops__block">
        <h2 class="db-membership-ops__title">Cancelar membresía</h2>
          <form class="db-form" data-form="membership-cancel">
            <label class="db-field">
              <span>Membresía</span>
              <select name="membership_id" required>
                <option value="">Seleccionar membresía</option>
                ${cancellable.map((membership) => optionHTML(membership.id, membershipOptionLabel(membership), '')).join('')}
              </select>
            </label>
            <label class="db-field"><span>Fecha de término</span><input name="end_date" type="date" value="${escapeAttr(today)}" required /></label>
            <label class="db-field"><span>Notas de cancelación</span><textarea name="notes" rows="3"></textarea></label>
            <button class="db-btn-danger" type="submit">Cancelar membresía</button>
          </form>
      </section>
    </div>
  `;
}

function renderBeatSaleOpsForm() {
  return `
    <form class="db-form" data-form="beat-sale-create">
      <div class="db-form__row">
        <label class="db-field"><span>Nombre del beat</span><input name="name" required /></label>
        <label class="db-field"><span>Slug</span><input name="slug" placeholder="se genera si lo dejas vacio" /></label>
      </div>
      <div class="db-form__row">
        <label class="db-field"><span>Precio MXN</span><input name="price" type="number" min="0" step="0.01" required /></label>
        <label class="db-field"><span>Stock</span><input name="stock" type="number" min="0" step="1" placeholder="vacio = ilimitado" /></label>
      </div>
      <label class="db-field"><span>Archivo de audio</span><input name="beat_file" type="file" accept="${escapeAttr(BEAT_AUDIO_ACCEPT)}" required /><button type="button" class="db-btn-secondary" data-beat-sale-cloud>Seleccionar desde Cloud</button><small class="db-field__hint" data-beat-sale-source>Selecciona un archivo de audio.</small></label>
      <label class="db-field"><span>Descripcion</span><textarea name="description" rows="3" placeholder="Licencia, mood, BPM o notas"></textarea></label>
      <div class="db-form__row">
        <label class="db-check"><input name="featured" type="checkbox" /> <span>Featured</span></label>
        <label class="db-check"><input name="is_active" type="checkbox" checked /> <span>Activo en tienda</span></label>
      </div>
      <div class="db-upload-progress" data-beat-upload-progress hidden>
        <div class="db-upload-progress__head">
          <span data-beat-upload-progress-label>Esperando archivo</span>
          <strong data-beat-upload-progress-value>0%</strong>
        </div>
        <div class="db-upload-progress__track" aria-hidden="true">
          <span data-beat-upload-progress-bar style="width:0%"></span>
        </div>
      </div>
      <button class="btn-primary" type="submit">Subir beat y publicar</button>
    </form>
  `;
}

function renderOperationCreateActions(createLabel = 'CREAR') {
  return `
    <div class="db-form__actions">
      <button class="btn-primary" type="submit" data-operation-action="create-share">CREAR y COMPARTIR COMPROBANTE</button>
      <button class="db-btn-secondary" type="submit" data-operation-action="create">${escapeHTML(createLabel)}</button>
    </div>
  `;
}

function renderTransactionForm(formName, paymentMethods = state.data.paymentMethods ?? [], services = state.data.services ?? []) {
  const today = todayDateInputValue();
  return `
    <form class="db-form" data-form="${escapeAttr(formName)}">
      ${renderErpUserPicker('user_id', 'Usuario')}
      ${renderUserAutofillFields()}
      <div class="db-form__row">
        <label class="db-field"><span>Tipo</span><select name="type" required>${ERP_TYPE_OPTIONS.map((type) => optionHTML(type, type, '')).join('')}</select></label>
        <label class="db-field"><span>Servicio</span><select name="service" data-transaction-service required>${renderServiceOptions(services)}</select></label>
      </div>
      <div class="db-form__row">
        <label class="db-field"><span>Monto</span><input name="amount" type="number" step="0.01" required /></label>
        <label class="db-field"><span>Concepto</span><select name="concept" data-transaction-concept required>${TRANSACTION_CONCEPT_OPTIONS.map((concept) => optionHTML(concept, concept, '')).join('')}</select></label>
      </div>
      <label class="db-field" data-custom-concept-wrap hidden><span>Concepto personalizado</span><input name="concept_custom" data-custom-concept /></label>
      <label class="db-field"><span>Fecha</span><input name="date" type="date" value="${escapeAttr(today)}" required /></label>
      <div class="db-form__row">
        <label class="db-field"><span>Via</span><select name="via">${renderPaymentMethodOptions(paymentMethods)}</select></label>
        <label class="db-field"><span>ID transaccion</span><input name="id_trans" /></label>
      </div>
      <label class="db-field"><span>Notas</span><textarea name="notes" rows="3"></textarea></label>
      ${renderOperationCreateActions('CREAR')}
    </form>
  `;
}

function getFinanceFilters() {
  const now = new Date();
  return {
    month: persistedDataValue('financeMonth', ''),
    year: persistedDataValue('financeYear', String(now.getFullYear())),
    type: persistedDataValue('financeType', 'ambos'),
    comparison: persistedDataValue('financeComparison', 'previous-period'),
    scope: persistedDataValue('financeScope', 'studio'),
    studio: persistedDataValue('financeStudio', 'IXT'),
    eventId: persistedDataValue('financeEventId', ''),
  };
}

function getEventFinanceFilters(filters = getFinanceFilters()) {
  return {
    ...filters,
    month: persistedDataValue('financeMonth', ''),
    year: persistedDataValue('financeYear', ''),
  };
}

async function fetchTransactions(filters, userId = null) {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  query = applyFinanceDateRange(query, filters);

  if (filters.type === 'ingresos') query = query.in('type', ['INGRESO', 'income', 'ingresos']);
  if (filters.type === 'egresos') query = query.in('type', ['EGRESO', 'expense', 'egresos']);
  if (userId) query = query.eq('user_id', userId);

  return query;
}

async function ensureFinanceEventsLoaded() {
  if (Array.isArray(state.data.financeEvents)) return state.data.financeEvents;

  state.data.financeEvents = await fetchAdminEventFinanceOptions('erp finance');
  return state.data.financeEvents;
}

async function fetchFinanceTransactions(filters, events = []) {
  if (filters.scope === 'studio') {
    return buildFinanceTransactionQuery('transactions', filters).eq('studio', filters.studio);
  }

  return fetchHrEventFinanceTransactions(filters, filters.eventId, events);
}

async function fetchFinanceComparisonTransactions(filters, events = []) {
  const comparisonFilters = getFinanceComparisonFilters(filters);
  if (!comparisonFilters) return [];

  const result = await fetchFinanceTransactions(comparisonFilters, events);
  if (result?.error) {
    console.info('[HR] finance comparison unavailable:', result.error.message);
    return [];
  }
  return result?.data ?? [];
}

async function fetchFinanceTrendTransactions(filters) {
  if (filters?.scope !== 'studio' || !filters.studio) return [];

  const anchor = financeTrendAnchor(filters);
  const start = new Date(anchor.getFullYear(), anchor.getMonth() - 11, 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  const startValue = start.toISOString().slice(0, 10);
  const endValue = end.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('studio', filters.studio)
    .gte('date', startValue)
    .lt('date', endValue)
    .order('date', { ascending: true });

  if (error) {
    console.info('[HR] finance trend unavailable:', error.message);
    return [];
  }
  return data ?? [];
}

async function fetchFinanceSessions(filters) {
  let query = supabase
    .from('sessions')
    .select('id, session_date, user_id, username, status, type, hour, start, end, sc_end, cost')
    .order('session_date', { ascending: false });

  query = applyFinanceDateRange(query, filters, 'session_date');
  const { data, error } = await query;
  if (error) {
    console.info('[HR] finance sessions unavailable:', error.message);
    return [];
  }
  return data ?? [];
}

function getFinanceComparisonFilters(filters) {
  if (!filters?.year) return null;

  const comparison = filters.comparison || 'previous-period';
  const currentYear = Number(filters.year);
  const currentMonth = filters.month ? Number(filters.month) : null;
  if (!Number.isFinite(currentYear)) return null;

  if (currentMonth && Number.isFinite(currentMonth)) {
    const offset = comparison === 'same-period-last-year' ? 12 : 1;
    const date = new Date(currentYear, currentMonth - 1 - offset, 1);
    return {
      ...filters,
      year: String(date.getFullYear()),
      month: String(date.getMonth() + 1).padStart(2, '0'),
    };
  }

  return {
    ...filters,
    year: String(currentYear - (comparison === 'same-period-last-year' ? 1 : 1)),
    month: '',
  };
}

function buildFinanceTransactionQuery(tableName, filters) {
  let query = supabase
    .from(tableName)
    .select('*')
    .order(tableName === 'hr_transactions' ? 'movement_date' : 'date', { ascending: false });

  query = applyFinanceDateRange(query, filters, tableName === 'hr_transactions' ? 'movement_date' : 'date');

  if (tableName === 'hr_transactions') {
    if (filters.type === 'ingresos') query = query.eq('movement_type', 'income');
    if (filters.type === 'egresos') query = query.eq('movement_type', 'expense');
  } else {
    if (filters.type === 'ingresos') query = query.in('type', ['INGRESO', 'income', 'ingresos']);
    if (filters.type === 'egresos') query = query.in('type', ['EGRESO', 'expense', 'egresos']);
  }

  return query;
}

async function fetchHrEventFinanceTransactions(filters, eventId, events = []) {
  const selectedEvent = events.find((event) => String(event.id ?? event.event_id) === String(eventId));
  let query = buildFinanceTransactionQuery('hr_transactions', filters);

  if (selectedEvent?.id || selectedEvent?.event_id) {
    query = query.eq('event_id', selectedEvent.id ?? selectedEvent.event_id);
  } else if (selectedEvent?.event_key || eventId) {
    query = query.eq('event_key', selectedEvent?.event_key ?? eventId);
  }

  return query;
}

function normalizeEventKey(value) {
  return String(value ?? '').trim().toUpperCase();
}

function applyFinanceDateRange(query, filters, dateField = 'date') {
  if (filters.year && filters.month) {
    const start = `${filters.year}-${filters.month}-01`;
    const endDate = new Date(Number(filters.year), Number(filters.month), 1);
    const end = endDate.toISOString().slice(0, 10);
    return query.gte(dateField, start).lt(dateField, end);
  }

  if (filters.year) {
    return query.gte(dateField, `${filters.year}-01-01`).lt(dateField, `${Number(filters.year) + 1}-01-01`);
  }

  return query;
}

function financePeriodLabel(filters) {
  if (filters.year && filters.month) return `${filters.month}/${filters.year}`;
  if (filters.year) return `Todos los meses de ${filters.year}`;
  return 'Historico completo';
}

function renderFinanceScopeFilters(filters, events = []) {
  const keyedEvents = events.filter((event) => event.id || event.event_id || event.event_key);
  const secondaryOptions = filters.scope === 'events'
    ? (keyedEvents.length
      ? keyedEvents.map((event) => [String(event.id ?? event.event_id ?? event.event_key), eventLabel(event)])
      : [['', 'Sin eventos disponibles']])
    : FINANCE_STUDIO_SOURCES.map((item) => [item.value, item.label]);

  const secondaryKey = filters.scope === 'events' ? 'financeEventId' : 'financeStudio';
  const secondaryValue = filters.scope === 'events' ? filters.eventId : filters.studio;
  const secondaryLabel = filters.scope === 'events' ? 'Evento' : 'Estudio';

  return renderHrDisclosure({
    key: 'finance.toolbar.scope',
    title: 'Origen y exportación',
    meta: secondaryLabel,
    className: 'db-finance-toolbar-disclosure',
    defaultOpen: financeToolbarIsOpen('scope'),
    body: `<div class="db-toolbar hr-table-toolbar">
        <label class="db-field db-field--compact">
          <span>Origen</span>
          <select data-action="finance-filter" data-filter-key="financeScope">
            ${optionHTML('studio', 'Estudio', filters.scope)}
            ${optionHTML('events', 'Eventos', filters.scope)}
          </select>
        </label>
        <label class="db-field db-field--compact">
          <span>${escapeHTML(secondaryLabel)}</span>
          <select data-action="finance-filter" data-filter-key="${escapeAttr(secondaryKey)}">
            ${secondaryOptions.map(([value, label]) => optionHTML(value, label, secondaryValue)).join('')}
          </select>
        </label>
        <button class="db-btn-secondary" type="button" data-action="export-finance-pdf">Exportar PDF</button>
      </div>`,
  });
}

function renderFinanceFilters(filters, options = {}) {
  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const comparisonField = options.showComparison === false ? '' : `
      <label class="db-field db-field--compact"><span>Comparar con</span><select data-action="finance-filter" data-filter-key="financeComparison">${[
        ['previous-period', filters.month ? 'Periodo anterior' : 'Año anterior'],
        ['same-period-last-year', filters.month ? 'Mismo mes del año anterior' : 'Mismo periodo del año anterior'],
      ].map(([value, label]) => optionHTML(value, label, filters.comparison)).join('')}</select></label>`;
  return renderHrDisclosure({
    key: 'finance.toolbar.period',
    title: 'Periodo y comparación',
    meta: financePeriodLabel(filters),
    className: 'db-finance-toolbar-disclosure',
    defaultOpen: financeToolbarIsOpen('period'),
    body: `<div class="db-toolbar hr-table-toolbar">
        <label class="db-field db-field--compact"><span>Mes</span><select data-action="finance-filter" data-filter-key="financeMonth">${optionHTML('', 'Todos los meses', filters.month)}${months.map((month) => optionHTML(month, month, filters.month)).join('')}</select></label>
        <label class="db-field db-field--compact"><span>Año</span><select data-action="finance-filter" data-filter-key="financeYear">${optionHTML('', 'Todos los años', filters.year)}${years.map((year) => optionHTML(year, year, filters.year)).join('')}</select></label>
        <label class="db-field db-field--compact"><span>Tipo</span><select data-action="finance-filter" data-filter-key="financeType">${[
          ['ambos', 'Ingresos y egresos'],
          ['ingresos', 'Ingresos'],
          ['egresos', 'Egresos'],
        ].map(([value, label]) => optionHTML(value, label, filters.type)).join('')}</select></label>
        ${comparisonField}
      </div>`,
  });
}

function financeToolbarIsOpen(key) {
  const sharedState = getHrDisclosureState(`finance.toolbar.${key}`);
  if (sharedState !== null) return sharedState;
  const stored = persistedDataValue(`financeToolbar:${key}`, null);
  return stored === null ? false : Boolean(stored);
}

function renderFinanceMetrics(transactions, amountGetter = transactionAmount, options = {}) {
  const totals = financeTotals(transactions, amountGetter, options);
  const { ingresos, egresos, balance, hasExplicitIncomeExpense } = totals;
  const showIncomeExpenseAsNE = options.balanceFromAmountWhenNoIncomeExpense && !hasExplicitIncomeExpense;
  const max = Math.max(Math.abs(ingresos), Math.abs(egresos), Math.abs(balance), 1);
  const clients = topClients(transactions, amountGetter);

  return `
    <div class="db-grid db-grid--3col db-finance-summary">
      ${renderStatCard('Total ingresos', showIncomeExpenseAsNE ? 'NE' : money(ingresos))}
      ${renderStatCard('Total egresos', showIncomeExpenseAsNE ? 'NE' : money(egresos))}
      ${renderStatCard('Balance', money(balance))}
    </div>
    <div class="db-grid db-grid--2col db-finance-dashboard">
      <article class="db-card hr-card">
        <header class="db-card__header"><span class="section-label">Ingresos vs egresos</span></header>
        <div class="db-card__inner">
          <div class="db-bar-chart">
            <div class="db-finance-bar--income"><span>Ingresos</span><i style="--bar:${showIncomeExpenseAsNE ? 0 : Math.round((ingresos / max) * 100)}%"></i><strong>${showIncomeExpenseAsNE ? 'NE' : money(ingresos)}</strong></div>
            <div class="db-finance-bar--expense"><span>Egresos</span><i style="--bar:${showIncomeExpenseAsNE ? 0 : Math.round((egresos / max) * 100)}%"></i><strong>${showIncomeExpenseAsNE ? 'NE' : money(egresos)}</strong></div>
          </div>
        </div>
      </article>
      <article class="db-card hr-card">
        <header class="db-card__header"><span class="section-label">Top clientes</span></header>
        <ul class="db-card-list hr-resource-list" role="list">
          ${clients.length ? clients.map((client) => `<li class="db-card-list__item hr-list-item"><span class="db-card-list__label">${escapeHTML(client.label)}</span><span class="db-card-list__value">${money(client.total)}</span></li>`).join('') : '<li class="db-empty">Sin clientes en el periodo.</li>'}
        </ul>
      </article>
    </div>
  `;
}

function renderStudioFinanceDashboard(transactions, comparisonRows, sessions, filters, trendRows = []) {
  const totals = financeTotals(transactions, transactionAmount);
  const goals = financeGoalsForStudio(filters.studio);
  const sources = financeSourceBreakdown(transactions);
  const buyers = financeBuyerBreakdown(transactions);
  const usage = financeUsageMetrics(transactions, sessions);
  const studioLabel = FINANCE_STUDIO_SOURCES.find((item) => item.value === filters.studio)?.label ?? filters.studio;
  const incomeGoal = Number(goals.income || 0);
  const incomeProgress = financeGoalProgress(totals.ingresos, incomeGoal);
  const goalText = incomeGoal > 0
    ? `Llevas ${incomeProgress}% de la meta de ingresos.`
    : 'Define una meta de ingresos cobrados para medir el avance.';
  const weeklyNeed = incomeGoal > 0 ? Math.max(0, incomeGoal - totals.ingresos) / financeWeeksRemaining(filters) : 0;

  return `
    <div class="db-finance-dashboard db-finance-dashboard--studio" data-finance-studio="${escapeAttr(filters.studio)}">
      <div class="db-grid db-grid--4col db-finance-summary db-finance-kpis" aria-label="Resumen financiero de ${escapeAttr(studioLabel)}">
        ${renderFinanceKpiCard('Ingresos cobrados', money(totals.ingresos), 'Entradas registradas en el periodo', 'income')}
        ${renderFinanceKpiCard('Egresos pagados', money(totals.egresos), 'Costos registrados en el periodo', 'expense')}
        ${renderFinanceKpiCard('Flujo neto del periodo', money(totals.balance), 'Ingresos cobrados menos egresos pagados', totals.balance >= 0 ? 'net' : 'negative')}
        <article class="db-card hr-card db-finance-kpi db-finance-kpi--goal">
          <div class="db-card__inner">
            <span class="section-label">Avance de meta</span>
            <strong>${incomeGoal > 0 ? `${incomeProgress}%` : 'Sin meta'}</strong>
            <span class="db-finance-kpi__note">${escapeHTML(goalText)}</span>
            ${incomeGoal > 0 ? `<span class="db-finance-kpi__sub">${money(totals.ingresos)} de ${money(incomeGoal)}</span>` : ''}
          </div>
        </article>
      </div>

      <div class="db-finance-layout">
        ${renderHrDisclosure({
          key: 'finance.goals',
          className: 'db-finance-panel db-finance-panel-disclosure db-finance-mobile-disclosure db-finance-goals-panel',
          defaultOpen: true,
          responsiveOnly: true,
          summary: '<span class="db-finance-disclosure-heading"><span class="section-label">Metas del estudio</span><strong>Qué falta para llegar</strong></span><small class="db-finance-panel__badge">Solo en este navegador</small>',
          body: `<div class="db-card__inner">
            <p class="db-finance-copy">Las metas se guardan como preferencia local. La meta de utilidad no se interpreta como utilidad contable mientras falten egresos.</p>
            ${incomeGoal > 0
              ? `<div class="db-finance-goal-callout"><strong>${money(Math.max(0, incomeGoal - totals.ingresos))}</strong><span>restante para ingresos cobrados</span><small>${money(weeklyNeed)} por semana al ritmo necesario</small></div>`
              : '<div class="db-finance-goal-callout db-finance-goal-callout--empty"><strong>Configura tus metas</strong><span>ingresos cobrados, utilidad y horas vendidas</span></div>'}
            <div class="db-finance-goal-notes">
              <span>Meta de utilidad: ${Number(goals.profit || 0) > 0 ? money(goals.profit) : 'sin definir'} <small>(referencia, no utilidad contable)</small></span>
              <span>Meta de horas vendidas: ${Number(goals.hours || 0) > 0 ? `${Number(goals.hours)} h` : 'sin definir'}</span>
            </div>
            <details class="db-finance-goals-editor">
              <summary>Editar metas</summary>
              <form class="db-form" data-form="finance-goals">
                <div class="db-form__row">
                  <label class="db-field"><span>Ingresos cobrados (MXN)</span><input name="income" type="number" min="0" step="100" value="${escapeAttr(incomeGoal || '')}" placeholder="Ej. 30000" /></label>
                  <label class="db-field"><span>Utilidad objetivo (MXN)</span><input name="profit" type="number" min="0" step="100" value="${escapeAttr(Number(goals.profit || 0) || '')}" placeholder="Se habilita con egresos completos" /></label>
                </div>
                <label class="db-field"><span>Horas vendidas</span><input name="hours" type="number" min="0" step="1" value="${escapeAttr(Number(goals.hours || 0) || '')}" placeholder="Ej. 80" /></label>
                <button class="db-btn-secondary" type="submit">Guardar metas locales</button>
              </form>
            </details>
          </div>`,
        })}

        ${renderHrDisclosure({
          key: 'finance.services',
          className: 'db-finance-panel db-finance-panel-disclosure db-finance-mobile-disclosure',
          defaultOpen: true,
          responsiveOnly: true,
          summary: '<span class="db-finance-disclosure-heading"><span class="section-label">De dónde viene el dinero</span><strong>Servicios y categorías</strong></span>',
          body: `<div class="db-card__inner db-finance-breakdown">
            ${sources.length ? sources.map((source) => `
              <div class="db-finance-breakdown__row">
                <div><strong>${escapeHTML(source.label)}</strong><span>${source.share}% de ingresos</span></div>
                <i style="--bar:${source.share}%" aria-hidden="true"></i>
                <b>${money(source.total)}</b>
              </div>
            `).join('') : '<p class="db-empty">Sin ingresos categorizados en el periodo.</p>'}
          </div>`,
        })}
      </div>

      <div class="db-finance-layout">
        ${renderFinanceComparisonPanel(transactions, comparisonRows, filters)}
        ${renderHrDisclosure({
          key: 'finance.usage',
          className: 'db-finance-panel db-finance-panel-disclosure db-finance-mobile-disclosure db-finance-usage',
          defaultOpen: true,
          responsiveOnly: true,
          summary: '<span class="db-finance-disclosure-heading"><span class="section-label">Uso del estudio</span><strong>Capacidad y sesiones</strong></span>',
          body: `<div class="db-card__inner db-finance-usage__grid">
            ${renderFinanceUsageMetric('Sesiones registradas', usage.sessions ? String(usage.sessions) : 'Sin datos', 'con fecha en el periodo')}
            ${renderFinanceUsageMetric('Horas con horario', usage.hours !== null ? `${usage.hours} h${Number(goals.hours || 0) > 0 ? ` / ${Number(goals.hours)} h` : ''}` : 'Sin datos', usage.hours !== null && Number(goals.hours || 0) > 0 ? `${financeGoalProgress(usage.hours, goals.hours)}% de meta de horas` : usage.hours !== null ? 'a partir de inicio y fin' : 'faltan horarios capturados')}
            ${renderFinanceUsageMetric('Ingreso promedio', usage.averageIncome ? money(usage.averageIncome) : 'Sin datos', 'por movimiento de ingreso')}
            ${renderFinanceUsageMetric('Ocupación', 'Sin datos', 'captura disponibilidad para medirla')}
          </div>`,
        })}
      </div>

      <div class="db-finance-layout db-finance-layout--extended">
        ${renderHrDisclosure({
          key: 'finance.buyers',
          className: 'db-finance-panel db-finance-panel-disclosure db-finance-mobile-disclosure db-finance-buyers',
          defaultOpen: true,
          responsiveOnly: true,
          summary: '<span class="db-finance-disclosure-heading"><span class="section-label">Clientes</span><strong>Usuarios que hicieron compras</strong></span>',
          body: `<div class="db-card__inner db-finance-buyers__inner">
            ${buyers.length ? `<ol class="db-finance-buyers__list">${buyers.map((buyer, index) => `
              <li class="db-finance-buyers__row">
                <span class="db-finance-buyers__rank">${index + 1}</span>
                <span class="db-finance-buyers__name">${escapeHTML(buyer.label)}</span>
                <strong>${money(buyer.total)}</strong>
              </li>
            `).join('')}</ol>` : '<p class="db-empty">Sin compras identificadas en el periodo.</p>'}
          </div>`,
        })}

        ${renderFinanceTrendPanel(trendRows)}
      </div>
    </div>
  `;
}

function renderFinanceKpiCard(label, value, note, tone = 'neutral') {
  return `
    <article class="db-card hr-card db-finance-kpi db-finance-kpi--${escapeAttr(tone)}">
      <div class="db-card__inner">
        <span class="section-label">${escapeHTML(label)}</span>
        <strong>${escapeHTML(value)}</strong>
        <span class="db-finance-kpi__note">${escapeHTML(note)}</span>
      </div>
    </article>
  `;
}

function renderFinanceComparisonPanel(currentRows, comparisonRows, filters) {
  const current = financeTotals(currentRows);
  const comparison = financeTotals(comparisonRows);
  const comparisonFilters = getFinanceComparisonFilters(filters);
  const label = comparisonFilters ? financePeriodLabel(comparisonFilters) : 'periodo comparable';
  const hasComparison = comparisonRows.length > 0;
  const metrics = [
    ['Ingresos cobrados', current.ingresos, comparison.ingresos],
    ['Egresos pagados', current.egresos, comparison.egresos],
    ['Flujo neto', current.balance, comparison.balance],
  ];

  return renderHrDisclosure({
    key: 'finance.comparison',
    className: 'db-finance-panel db-finance-panel-disclosure db-finance-mobile-disclosure db-finance-comparison',
    defaultOpen: true,
    responsiveOnly: true,
    summary: `<span class="db-finance-disclosure-heading"><span class="section-label">Comparación</span><strong>Contra ${escapeHTML(label)}</strong></span>`,
    body: `<div class="db-card__inner">
        ${hasComparison ? metrics.map(([metric, value, base]) => {
          const delta = financeDelta(value, base);
          return `<div class="db-finance-comparison__row"><span>${escapeHTML(metric)}</span><strong>${money(value)}</strong><em class="db-finance-delta db-finance-delta--${escapeAttr(delta.tone)}">${escapeHTML(delta.label)}</em></div>`;
        }).join('') : '<p class="db-empty">No hay datos suficientes para comparar este periodo.</p>'}
        <small class="db-finance-footnote">La comparación usa los mismos filtros de estudio y tipo.</small>
      </div>`,
  });
}

function renderFinanceTrendPanel(trendRows, filters = state.data.erpFinanceFilters ?? {}) {
  const model = financeTrendModel(trendRows, filters);
  return renderHrDisclosure({
    key: 'finance.trend',
    className: 'db-finance-panel db-finance-panel-disclosure db-finance-mobile-disclosure db-finance-trend',
    defaultOpen: true,
    responsiveOnly: true,
    summary: '<span class="db-finance-disclosure-heading"><span class="section-label">Tendencia</span><strong>Últimos 12 meses</strong></span>',
    body: `<div class="db-card__inner db-finance-trend__inner">
      ${model.hasData ? renderFinanceTrendChart(model) : '<p class="db-empty">Sin movimientos suficientes para construir la tendencia.</p>'}
      <small class="db-finance-footnote">La base actual registra la venta total como ingresos; la utilidad es ingresos menos egresos. Las líneas adicionales corresponden a servicios y categorías.</small>
    </div>`,
  });
}

function financeBuyerBreakdown(transactions) {
  const totals = new Map();
  transactions
    .filter((tx) => normalizeTransactionType(tx.type) === 'INGRESO')
    .forEach((tx) => {
      const label = clientLabelForTransaction(tx);
      totals.set(label, (totals.get(label) || 0) + transactionAmount(tx));
    });

  return [...totals.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

function financeTrendAnchor(filters = {}) {
  const now = new Date();
  if (filters.year && filters.month) {
    return new Date(Number(filters.year), Number(filters.month) - 1, 1);
  }
  if (filters.year) return new Date(Number(filters.year), 11, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function financeTrendModel(rows = [], filters = {}) {
  const anchor = financeTrendAnchor(filters);
  const months = Array.from({ length: 12 }, (_, index) => new Date(anchor.getFullYear(), anchor.getMonth() - 11 + index, 1));
  const keys = months.map((month) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`);
  const totalsByMonth = new Map(keys.map((key) => [key, { income: 0, expense: 0, categories: new Map() }]));

  (rows ?? []).forEach((tx) => {
    const key = String(tx?.date ?? '').slice(0, 7);
    const month = totalsByMonth.get(key);
    if (!month) return;
    const amount = transactionAmount(tx);
    const type = normalizeTransactionType(tx.type);
    if (type === 'EGRESO') {
      month.expense += amount;
      return;
    }
    if (type !== 'INGRESO') return;
    month.income += amount;
    const service = String(tx.service ?? '').trim();
    if (!service) return;
    month.categories.set(service, (month.categories.get(service) || 0) + amount);
  });

  const income = keys.map((key) => totalsByMonth.get(key).income);
  const expense = keys.map((key) => totalsByMonth.get(key).expense);
  const categories = [...new Set(keys.flatMap((key) => [...totalsByMonth.get(key).categories.keys()]))]
    .sort((a, b) => {
      const totalA = keys.reduce((sum, key) => sum + (totalsByMonth.get(key).categories.get(a) || 0), 0);
      const totalB = keys.reduce((sum, key) => sum + (totalsByMonth.get(key).categories.get(b) || 0), 0);
      return totalB - totalA;
    });
  const series = [
    { label: 'Venta total', values: income, color: '#f0ece4' },
    { label: 'Utilidad', values: income.map((value, index) => value - expense[index]), color: '#ff4fa3' },
    { label: 'Ingresos', values: income, color: '#00f397' },
    { label: 'Egresos', values: expense, color: '#ff304f' },
    ...categories.map((category, index) => ({
      label: category,
      values: keys.map((key) => totalsByMonth.get(key).categories.get(category) || 0),
      color: ['#53c7ff', '#ffc247', '#b992ff', '#ff8f5a', '#7ee787', '#d7a9ff', '#70e1c8'][index % 7],
    })),
  ];
  const allValues = series.flatMap((item) => item.values).filter((value) => Number.isFinite(value));
  return {
    labels: months.map((month) => month.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }).replace('.', '')),
    series,
    min: Math.min(0, ...allValues),
    max: Math.max(1, ...allValues),
    hasData: allValues.some((value) => value !== 0),
  };
}

function renderFinanceTrendChart(model) {
  const width = 720;
  const height = 280;
  const left = 54;
  const right = 14;
  const top = 16;
  const bottom = 48;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const range = Math.max(1, model.max - model.min);
  const xFor = (index) => left + (chartWidth * index / Math.max(1, model.labels.length - 1));
  const yFor = (value) => top + ((model.max - value) / range) * chartHeight;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = model.max - ((model.max - model.min) * index / 4);
    const y = yFor(value);
    return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}" class="db-finance-trend__grid-line" /><text x="${left - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="db-finance-trend__axis-label">${escapeHTML(money(value))}</text>`;
  }).join('');
  const labels = model.labels.map((label, index) => `<text x="${xFor(index).toFixed(1)}" y="${height - 18}" text-anchor="middle" class="db-finance-trend__axis-label">${escapeHTML(label)}</text>`).join('');
  const lines = model.series.map((series, index) => {
    const points = series.values.map((value, index) => `${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`).join(' ');
    return `<polyline points="${points}" fill="none" stroke="${series.color}" class="db-finance-trend__line" data-finance-trend-line="${index}" />`;
  }).join('');
  const legend = model.series.map((series, index) => `<button class="db-finance-trend__legend-item" type="button" data-finance-trend-series="${index}" aria-pressed="false"><i style="--trend-color:${series.color}" aria-hidden="true"></i><span>${escapeHTML(series.label)}</span></button>`).join('');

  return `<div class="db-finance-trend__chart-wrap" data-finance-trend>
    <svg class="db-finance-trend__chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfica lineal de ventas, utilidad, ingresos, egresos y categorías de los últimos 12 meses">
      ${grid}${labels}${lines}
    </svg>
    <div class="db-finance-trend__legend" aria-label="Leyenda de la gráfica">${legend}</div>
  </div>`;
}

function renderFinanceUsageMetric(label, value, note) {
  return `<div class="db-finance-usage__metric"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></div>`;
}

function financeGoalsForStudio(studio) {
  const allGoals = persistedDataValue('financeGoalsByStudio', {});
  const stored = allGoals && typeof allGoals === 'object' ? allGoals[studio] : null;
  return { ...FINANCE_GOAL_DEFAULTS, ...(stored || {}) };
}

function financeGoalProgress(value, target) {
  if (!(Number(target) > 0)) return 0;
  return Math.round(Math.max(0, Math.min(100, (Number(value || 0) / Number(target)) * 100)));
}

function financeWeeksRemaining(filters) {
  const now = new Date();
  const year = Number(filters.year);
  const month = filters.month ? Number(filters.month) - 1 : now.getMonth();
  if (year !== now.getFullYear() || (filters.month && month !== now.getMonth())) return 1;
  const end = filters.month ? new Date(year, month + 1, 0) : new Date(year, 11, 31);
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}

function financeSourceBreakdown(transactions) {
  const totals = new Map();
  transactions
    .filter((tx) => normalizeTransactionType(tx.type) === 'INGRESO')
    .forEach((tx) => {
      const label = String(tx.service || tx.concept || 'Sin categoría').trim() || 'Sin categoría';
      totals.set(label, (totals.get(label) || 0) + transactionAmount(tx));
    });
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .map(([label, value]) => ({ label, total: value, share: total > 0 ? Math.round((value / total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

function financeUsageMetrics(transactions, sessions = []) {
  const incomeRows = transactions.filter((tx) => normalizeTransactionType(tx.type) === 'INGRESO');
  const validSessions = (sessions ?? []).filter((session) => !/cancel|cancelad/i.test(String(session.status || '')));
  const durations = validSessions.map(sessionDurationHours).filter((value) => value !== null);
  return {
    sessions: validSessions.length,
    hours: durations.length ? Number(durations.reduce((sum, value) => sum + value, 0).toFixed(1)) : null,
    averageIncome: incomeRows.length ? incomeRows.reduce((sum, tx) => sum + transactionAmount(tx), 0) / incomeRows.length : 0,
  };
}

function sessionDurationHours(session) {
  const start = timeToMinutes(session?.start || session?.hour);
  const end = timeToMinutes(session?.end || session?.sc_end);
  if (start === null || end === null || end <= start) return null;
  return (end - start) / 60;
}

function timeToMinutes(value) {
  const match = String(value ?? '').match(/(\d{1,2}):?(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function financeDelta(value, base) {
  if (!Number(base)) return { label: 'Sin base comparable', tone: 'neutral' };
  const percent = Math.round(((Number(value) - Number(base)) / Math.abs(Number(base))) * 100);
  return { label: `${percent >= 0 ? '+' : ''}${percent}%`, tone: percent >= 0 ? 'positive' : 'negative' };
}

function eventAccessFor(event, adminDefault = hasRole('admin')) {
  return {
    can_view: adminDefault || Boolean(event?.can_view),
    can_add_finance: adminDefault || Boolean(event?.can_add_finance),
    can_edit_finance: adminDefault,
    can_view_scrum: adminDefault || Boolean(event?.can_view_scrum),
    can_edit_scrum: adminDefault || Boolean(event?.can_edit_scrum),
  };
}

const participantLabel = (participant) => {
  if (!participant) return '-';
  const role = participant.role ? ` · ${participant.role}` : '';
  return `${userLabel(participant.user_id)}${role}`;
};

function renderParticipantOptions(participants = [], selectedValue = '', placeholder = 'Seleccionar') {
  return [
    optionHTML('', placeholder, selectedValue),
    ...participants.map((participant) => optionHTML(String(participant.user_id), participantLabel(participant), selectedValue)),
  ].join('');
}

function participantName(userId) {
  if (!userId) return '-';
  const participant = (state.data.eventParticipantsAll ?? []).find((item) => String(item.user_id) === String(userId));
  return participant ? participantLabel(participant) : userLabel(userId);
}

async function fetchFinanceEntities() {
  if (Array.isArray(state.data.financeEntities)) return state.data.financeEntities;

  const { data, error } = await supabase
    .from('finance_entities')
    .select('id, entity_key, name, entity_type, status, notes')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) {
    console.info('[HR] finance entities unavailable:', error.message);
    state.data.financeEntities = [];
    return [];
  }

  state.data.financeEntities = data ?? [];
  return state.data.financeEntities;
}
async function fetchPaymentMethods() {
  if (Array.isArray(state.data.paymentMethods)) return state.data.paymentMethods;

  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, key, name, status, sort_order')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.info('[HR] payment methods unavailable:', error.message);
    state.data.paymentMethods = [];
    return [];
  }

  state.data.paymentMethods = data ?? [];
  return state.data.paymentMethods;
}

async function fetchServices() {
  if (Array.isArray(state.data.services)) return state.data.services;

  const { data, error } = await supabase
    .from('services')
    .select('id, key, name, status, sort_order, show_in_finance, show_in_session, session_cost, session_minutes')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.info('[HR] services unavailable:', error.message);
    state.data.services = [];
    return [];
  }

  state.data.services = data ?? [];
  return state.data.services;
}

function financeEntityLabel(entity) {
  if (!entity) return '-';
  const type = entity.entity_type ? ` · ${entity.entity_type}` : '';
  return `${entity.name ?? entity.entity_key ?? 'Entidad'}${type}`;
}

function renderFinanceEntityOptions(entities = [], selectedValue = '', placeholder = 'Sin asignar') {
  return [
    optionHTML('', placeholder, selectedValue),
    ...entities.map((entity) => optionHTML(String(entity.id), financeEntityLabel(entity), selectedValue)),
  ].join('');
}

function renderPaymentMethodOptions(methods = [], selectedValue = '') {
  const normalizedSelected = String(selectedValue ?? '');
  const activeOptions = (methods ?? []).map((method) => optionHTML(method.name, method.name, normalizedSelected));
  if (normalizedSelected && !(methods ?? []).some((method) => String(method.name) === normalizedSelected)) {
    activeOptions.unshift(optionHTML(normalizedSelected, `${normalizedSelected} (existente)`, normalizedSelected));
  }
  return [optionHTML('', 'Seleccionar', normalizedSelected), ...activeOptions].join('');
}

function visibleFinanceServices(services = []) {
  return (services ?? []).filter((service) => service.show_in_finance !== false);
}

function visibleSessionServices(services = []) {
  return (services ?? []).filter((service) => service.show_in_session === true);
}

function renderServiceOptions(services = [], selectedValue = '') {
  const normalizedSelected = String(selectedValue ?? '');
  const financeServices = visibleFinanceServices(services);
  const source = financeServices.length
    ? financeServices.map((service) => service.name)
    : SERVICE_OPTIONS;
  const activeOptions = source.map((serviceName) => optionHTML(serviceName, serviceName, normalizedSelected));
  if (normalizedSelected && !source.some((serviceName) => String(serviceName) === normalizedSelected)) {
    activeOptions.unshift(optionHTML(normalizedSelected, `${normalizedSelected} (existente)`, normalizedSelected));
  }
  return [optionHTML('', 'Seleccionar', normalizedSelected), ...activeOptions].join('');
}

function renderSessionTypeOptions(services = [], selectedValue = '') {
  const normalizedSelected = String(selectedValue ?? '');
  const sessionServices = visibleSessionServices(services);
  const source = sessionServices.length
    ? sessionServices.map((service) => service.name)
    : SESSION_TYPE_OPTIONS.map((item) => item.value);
  const activeOptions = source.map((serviceName) => optionHTML(serviceName, serviceName, normalizedSelected));
  if (normalizedSelected && !source.some((serviceName) => String(serviceName) === normalizedSelected)) {
    activeOptions.unshift(optionHTML(normalizedSelected, `${normalizedSelected} (existente)`, normalizedSelected));
  }
  return activeOptions.join('');
}

function serviceSessionConfig(service) {
  return {
    value: service?.name ?? '',
    label: service?.name ?? '',
    minutes: Number(service?.session_minutes || 0),
    cost: Number(service?.session_cost || 0),
  };
}

function defaultSessionServiceCost(services = []) {
  const first = visibleSessionServices(services)[0];
  return first ? serviceSessionConfig(first).cost : SESSION_TYPE_OPTIONS[0].cost;
}

function eventConceptOptionFor(value = '') {
  const concept = String(value ?? '').trim();
  return EVENT_FINANCE_CONCEPT_OPTIONS.includes(concept) && concept !== 'OTRO' ? concept : 'OTRO';
}

function renderEventConceptControl(selectedConcept = '', formId = '') {
  const selectedOption = eventConceptOptionFor(selectedConcept);
  const customValue = selectedOption === 'OTRO' ? selectedConcept : '';
  const formAttr = formId ? ` form="${escapeAttr(formId)}"` : '';
  return `
    <div data-event-concept-scope>
      <label class="db-field"><span>Concept</span><select name="concept_option" data-event-concept required${formAttr}>${EVENT_FINANCE_CONCEPT_OPTIONS.map((concept) => optionHTML(concept, concept, selectedOption)).join('')}</select></label>
      <label class="db-field" data-event-concept-custom-wrap ${selectedOption === 'OTRO' ? '' : 'hidden'}><span>Concepto personalizado</span><input name="concept_custom" data-event-concept-custom value="${escapeAttr(customValue)}" ${selectedOption === 'OTRO' ? 'required' : 'disabled'}${formAttr} /></label>
    </div>
  `;
}

function renderAllocationRows(entities = [], allocations = [], formId = '') {
  if (!entities.length) return '<p class="db-empty">Sin entidades financieras activas.</p>';
  const formAttr = formId ? ` form="${escapeAttr(formId)}"` : '';
  const rowFormAttr = formId ? ` data-allocation-form="${escapeAttr(formId)}"` : '';
  const byEntity = new Map((allocations ?? []).map((allocation) => [String(allocation.entity_id), allocation]));

  return `
    <div class="db-table-wrap hr-table-wrap">
      <table class="db-table hr-table hr-table-readable" aria-label="Allocations del movimiento">
        <thead><tr><th scope="col">Entidad</th><th scope="col">Usar</th><th scope="col">Monto</th><th scope="col">%</th></tr></thead>
        <tbody>
          ${entities.map((entity) => {
            const allocation = byEntity.get(String(entity.id));
            return `
              <tr data-allocation-row${rowFormAttr}>
                <td>${escapeHTML(financeEntityLabel(entity))}<input type="hidden" data-allocation-entity value="${escapeAttr(entity.id)}"${formAttr} /></td>
                <td><input type="checkbox" data-allocation-enabled ${allocation ? 'checked' : ''}${formAttr} aria-label="Asignar ${escapeAttr(financeEntityLabel(entity))}" /></td>
                <td><input class="db-table-input hr-input" data-allocation-amount type="number" step="0.01" min="0" value="${escapeAttr(allocation?.amount ?? '')}"${formAttr} /></td>
                <td><input class="db-table-input hr-input" data-allocation-percentage type="number" step="0.01" min="0" max="100" value="${escapeAttr(allocation?.percentage ?? '')}"${formAttr} /></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAllocationFieldset(entities = [], allocations = [], formId = '') {
  return `
    <fieldset class="db-field" data-allocation-fieldset>
      <span>CORRESPONDE A</span>
      ${renderAllocationRows(entities, allocations, formId)}
      <small class="db-field__hint">Selecciona una o varias entidades. Usa montos que sumen el total del movimiento o porcentajes que sumen 100%.</small>
    </fieldset>
  `;
}
function financeEntityName(entityId, legacyUserId = null) {
  if (entityId) {
    const entity = (state.data.financeEntities ?? []).find((item) => String(item.id) === String(entityId));
    if (entity) return financeEntityLabel(entity);
  }
  return legacyUserId ? participantName(legacyUserId) : '-';
}

function eventRightsTotals(event, transactions = []) {
  const expenseTransactions = (transactions ?? []).filter((tx) => {
    const amount = Number(tx.amount ?? 0);
    return tx.movement_type === 'expense' || amount < 0;
  });

  const totalCost = expenseTransactions.length
    ? expenseTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount ?? 0)), 0)
    : Number(event?.rights_total_cost ?? event?.egresos ?? 0);

  const hiddenRoom = expenseTransactions.length
    ? expenseTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.hidden_room_share ?? 0)), 0)
    : Number(event?.rights_hidden_room_acquired ?? Math.abs(Number(event?.hidden_room_share_total ?? 0)));

  const counterparty = Math.max(totalCost - hiddenRoom, 0);
  const hiddenRoomPercent = totalCost > 0 ? (hiddenRoom / totalCost) * 100 : 0;
  const counterpartyPercent = totalCost > 0 ? (counterparty / totalCost) * 100 : 0;

  return { totalCost, hiddenRoom, counterparty, hiddenRoomPercent, counterpartyPercent };
}

function renderEventRightsChart(event, transactions = []) {
  const totals = eventRightsTotals(event, transactions);
  const hiddenRoomDeg = totals.totalCost > 0 ? Math.max(0, Math.min(360, totals.hiddenRoomPercent * 3.6)) : 0;

  return `
    <div class="db-grid db-grid--2col db-event-rights">
      <article class="db-card hr-card">
        <header class="db-card__header"><span class="section-label">Derechos Adquiridos</span></header>
        <div class="db-card__inner db-event-rights__inner">
          <div class="db-pie-chart" style="--hr-deg:${hiddenRoomDeg}deg" aria-label="Derechos adquiridos"></div>
          <div class="db-event-rights__legend">
            <span><i class="db-event-rights__swatch db-event-rights__swatch--hr"></i>Hidden Room ${totals.hiddenRoomPercent.toFixed(2)}%</span>
            <span><i class="db-event-rights__swatch db-event-rights__swatch--counterparty"></i>Contraparte ${totals.counterpartyPercent.toFixed(2)}%</span>
          </div>
        </div>
      </article>
      <div class="db-grid db-grid--1col db-finance-summary">
        ${renderStatCard('Costo Total Evento', money(totals.totalCost))}
        ${renderStatCard('Hidden Room Adquirido', money(totals.hiddenRoom))}
        ${renderStatCard('Contraparte Adquirido', money(totals.counterparty))}
      </div>
    </div>
  `;
}

function internalInvestorRows(transactions = [], totalCost = 0) {
  const totals = new Map();

  (transactions ?? [])
    .filter((tx) => tx.movement_type === 'investment_in')
    .forEach((tx) => {
      const investorId = tx.from_user_id ? String(tx.from_user_id) : 'sin_inversor';
      const current = totals.get(investorId) ?? { id: investorId, label: tx.from_user_id ? participantName(tx.from_user_id) : 'Sin inversor asignado', total: 0 };
      current.total += Math.abs(Number(tx.amount ?? 0));
      totals.set(investorId, current);
    });

  return [...totals.values()]
    .map((item) => ({
      ...item,
      percent: Number(totalCost) > 0 ? (item.total / Number(totalCost)) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function investorPieGradient(investors = []) {
  const colors = ['var(--red)', 'var(--teal)', '#f0ece4', '#9b5cff', '#f4b860', '#55a6ff', '#6ddf8d'];
  if (!investors.length) return 'rgba(240, 236, 228, 0.08) 0 360deg';

  let cursor = 0;
  return investors.map((investor, index) => {
    const start = cursor;
    const end = index === investors.length - 1 ? 360 : cursor + ((investor.percent / 100) * 360);
    cursor = end;
    return `${colors[index % colors.length]} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  }).join(', ');
}

function renderEventInternalInvestors(event, transactions = []) {
  const rightsTotals = eventRightsTotals(event, transactions);
  const investors = internalInvestorRows(transactions, rightsTotals.totalCost);
  const total = investors.reduce((sum, investor) => sum + investor.total, 0);
  const colors = ['var(--red)', 'var(--teal)', '#f0ece4', '#9b5cff', '#f4b860', '#55a6ff', '#6ddf8d'];
  const pieGradient = investorPieGradient(investors);
  const legend = investors.length
    ? investors.map((investor, index) => `
      <span><i style="background:${colors[index % colors.length]}"></i>${escapeHTML(investor.label)} ${investor.percent.toFixed(2)}%</span>
    `).join('')
    : '<span><i></i>Sin inversiones internas</span>';

  const rows = investors.length
    ? investors.map((investor) => `
      <tr>
        <td>${escapeHTML(investor.label)}</td>
        <td>${money(investor.total)}</td>
        <td>${investor.percent.toFixed(2)}%</td>
        <td><div class="db-investor-share"><i style="--bar:${Math.max(2, investor.percent)}%"></i></div></td>
      </tr>
    `).join('')
    : '<tr class="db-table__empty-row hr-table-empty"><td colspan="4" class="db-empty hr-table-empty">Sin inversiones internas registradas.</td></tr>';

  return `
    <article class="db-card hr-card db-event-investors">
      <header class="db-card__header"><span class="section-label">Inversores internos sobre costo total</span></header>
      <div class="db-card__inner">
        <div class="db-event-investors__summary">
          <div class="db-pie-chart db-investor-pie" style="background:conic-gradient(${pieGradient})" aria-label="Distribucion de inversion interna"></div>
          <div class="db-event-investors__legend">${legend}</div>
          ${renderStatCard('Inversión interna total', money(total))}
          ${renderStatCard('Costo total del evento', money(rightsTotals.totalCost))}
        </div>
        <div class="db-table-wrap hr-table-wrap">
          <table class="db-table hr-table hr-table-readable" aria-label="Porcentaje de inversión sobre costo total por participante">
            <thead>
              <tr>
                <th scope="col">Participante</th>
                <th scope="col">Inversión</th>
                <th scope="col">% costo total</th>
                <th scope="col">Cobertura</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </article>
  `;
}

function renderEventInfo(event) {
  if (!event) return '';
  return `
    <div class="db-grid hr-grid hr-grid-3 db-grid--3col">
      ${renderStatCard('Evento', event.name ?? event.event_key ?? '-')}
      ${renderStatCard('Clave', event.event_key ?? '-')}
      ${renderStatCard('Fecha / status', `${formatDisplayDateOnly(event.event_date)} · ${event.status ?? '-'}`)}
    </div>
  `;
}

function renderEventSummaryCards(event) {
  const metrics = [
    ['Ingresos', event?.ingresos],
    ['Egresos', event?.egresos],
    ['Inversión ingresada', event?.inversion_ingresada],
    ['Utilidad devuelta', event?.utilidad_devuelta],
    ['Entregas a favor', event?.entregas_a_favor],
    ['M.A.I.', event?.mai],
    ['M.A.I. acumulado', event?.hidden_room_share_total],
    ['Balance evento', event?.balance_evento],
  ];

  return `
    <div class="db-grid db-grid--4col db-finance-summary">
      ${metrics.map(([label, value]) => renderStatCard(label, money(value ?? 0))).join('')}
    </div>
  `;
}

function eventSummaryFor(event, transactions = []) {
  const hasViewSummary = [
    'ingresos',
    'egresos',
    'inversion_ingresada',
    'utilidad_devuelta',
    'entregas_a_favor',
    'mai',
    'hidden_room_share_total',
    'balance_evento',
  ].some((key) => event?.[key] !== undefined && event?.[key] !== null);

  if (hasViewSummary) return event;

  const amountByType = (type) => transactions
    .filter((tx) => tx.movement_type === type)
    .reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);
  const hiddenRoomShareTotal = transactions.reduce((sum, tx) => sum + Number(tx.hidden_room_share ?? eventFinanceAmount(tx) ?? 0), 0);
  const amountTotal = transactions.reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);

  return {
    ...(event ?? {}),
    ingresos: amountByType('income'),
    egresos: Math.abs(amountByType('expense')),
    inversion_ingresada: amountByType('investment_in'),
    utilidad_devuelta: Math.abs(amountByType('investment_return')),
    entregas_a_favor: amountByType('counterparty_transfer'),
    mai: hiddenRoomShareTotal,
    hidden_room_share_total: hiddenRoomShareTotal,
    balance_evento: amountTotal + hiddenRoomShareTotal,
  };
}

function renderEventMovementForm(event, formName, participants = [], financeEntities = [], paymentMethods = state.data.paymentMethods ?? []) {
  const today = todayDateInputValue();
  return `
    <article class="db-card hr-card">
      <header class="db-card__header"><span class="section-label">Nuevo movimiento</span></header>
      <div class="db-card__inner">
        <form class="db-form" data-form="${escapeAttr(formName)}">
          <input type="hidden" name="event_id" value="${escapeAttr(event?.id ?? event?.event_id ?? '')}" />
          <input type="hidden" name="event_key" value="${escapeAttr(event?.event_key ?? '')}" />
          <label class="db-field"><span>Event</span><input value="${escapeAttr(eventLabel(event ?? {}))}" readonly /></label>
          <div class="db-form__row">
            <label class="db-field"><span>Movement Type</span><select name="movement_type" required>${EVENT_MOVEMENT_TYPES.map((item) => optionHTML(item.value, item.label, '')).join('')}</select></label>
            <label class="db-field"><span>Amount</span><input name="amount" type="number" step="0.01" required /></label>
          </div>
          ${renderEventConceptControl()}
          <div class="db-form__row">
            <label class="db-field"><span>FROM</span><select name="from_user_id">${renderParticipantOptions(participants, '', 'Sin origen')}</select></label>
            <label class="db-field"><span>TO</span><select name="to_user_id">${renderParticipantOptions(participants, '', 'Sin destino')}</select></label>
          </div>
          ${renderAllocationFieldset(financeEntities)}
          <div class="db-form__row">
            <label class="db-field"><span>Monto Absorbido Internamente (M.A.I.)</span><input name="hidden_room_share" type="number" step="0.01" value="0" /></label>
            <label class="db-field"><span>Payment Method</span><select name="payment_method">${renderPaymentMethodOptions(paymentMethods)}</select></label>
          </div>
          <label class="db-field"><span>Date</span><input name="movement_date" type="date" value="${escapeAttr(today)}" required /></label>
          <label class="db-field"><span>Notes</span><textarea name="notes" rows="3"></textarea></label>
          <button class="btn-primary" type="submit">Guardar movimiento</button>
        </form>
      </div>
    </article>
  `;
}

function renderEventMovementOpsForm(events = [], participants = [], financeEntities = [], paymentMethods = state.data.paymentMethods ?? []) {
  const today = todayDateInputValue();
  const availableEvents = events.filter((event) => event.id || event.event_id);

  if (!availableEvents.length) {
    return '<p class="db-empty">Sin eventos disponibles para capturar movimientos.</p>';
  }

  return `
    <form class="db-form" data-form="admin-event-movement-create">
      <label class="db-field">
        <span>Evento</span>
        <select name="event_id" required>
          ${availableEvents.map((event) => optionHTML(String(event.id ?? event.event_id), eventLabel(event), '')).join('')}
        </select>
      </label>
      <div class="db-form__row">
        <label class="db-field"><span>Movement Type</span><select name="movement_type" required>${EVENT_MOVEMENT_TYPES.map((item) => optionHTML(item.value, item.label, '')).join('')}</select></label>
        <label class="db-field"><span>Amount</span><input name="amount" type="number" step="0.01" required /></label>
      </div>
      ${renderEventConceptControl()}
      <div class="db-form__row">
        <label class="db-field"><span>FROM</span><select name="from_user_id">${renderParticipantOptions(participants, '', 'Sin origen')}</select></label>
        <label class="db-field"><span>TO</span><select name="to_user_id">${renderParticipantOptions(participants, '', 'Sin destino')}</select></label>
      </div>
      ${renderAllocationFieldset(financeEntities)}
      <div class="db-form__row">
        <label class="db-field"><span>Monto Absorbido Internamente (M.A.I.)</span><input name="hidden_room_share" type="number" step="0.01" value="0" /></label>
        <label class="db-field"><span>Payment Method</span><select name="payment_method">${renderPaymentMethodOptions(paymentMethods)}</select></label>
      </div>
      <label class="db-field"><span>Date</span><input name="movement_date" type="date" value="${escapeAttr(today)}" required /></label>
      <label class="db-field"><span>Notes</span><textarea name="notes" rows="3"></textarea></label>
      <button class="btn-primary" type="submit">Guardar movimiento</button>
    </form>
  `;
}

function financeMovementView() {
  const value = persistedDataValue('financeMovementView', 'ingresos');
  return value === 'egresos' ? 'egresos' : 'ingresos';
}

function filterFinanceMovementRows(transactions) {
  const type = financeMovementView() === 'egresos' ? 'EGRESO' : 'INGRESO';
  return (transactions ?? []).filter((tx) => normalizeTransactionType(tx.type) === type);
}

function renderFinanceMovementFilter() {
  const selected = financeMovementView();
  return `<div class="db-finance-movement-filter db-toolbar hr-table-toolbar">
    <label class="db-field db-field--compact">
      <span>Desglose de movimientos</span>
      <select data-action="finance-movement-view" aria-label="Mostrar ingresos o egresos">
        ${optionHTML('ingresos', 'Ingresos', selected)}
        ${optionHTML('egresos', 'Egresos', selected)}
      </select>
    </label>
  </div>`;
}

function renderTransactionsTable(transactions) {
  const tableId = `transactions-${state.activeSection}`;
  const activeSort = getTableSort(tableId, 'date', 'desc');
  const sortedTransactions = sortRowsByColumn(transactions, activeSort.field, activeSort.direction);
  const headers = [
    ['concept', 'Concepto'],
    ['service', 'Servicio'],
    ['type', 'Tipo'],
    ['amount', 'Monto'],
    ['date', 'Fecha'],
    ['status', 'Status'],
    ['user_id', 'Cliente'],
  ];
  const rows = sortedTransactions.length
    ? sortedTransactions.map((tx) => `
      <tr class="db-finance-movement-row db-finance-movement-row--${normalizeTransactionType(tx.type) === 'EGRESO' ? 'expense' : 'income'}">
        <td data-label="Concepto">${escapeHTML(tx.concept ?? 'Sin concepto')}</td>
        <td data-label="Servicio">${escapeHTML(tx.service ?? 'Sin categoría')}</td>
        <td data-label="Tipo"><span class="db-finance-type db-finance-type--${normalizeTransactionType(tx.type) === 'EGRESO' ? 'expense' : 'income'}">${escapeHTML(transactionTypeLabel(tx.type))}</span></td>
        <td data-label="Monto">${money(Number(tx.amount ?? 0))}</td>
        <td data-label="Fecha">${escapeHTML(formatDisplayDateOnly(tx.date))}</td>
        <td data-label="Estado">${escapeHTML(transactionStatusLabel(tx))}</td>
        <td data-label="Cliente">${escapeHTML(clientLabelForTransaction(tx))}</td>
      </tr>
    `).join('')
    : `<tr class="db-table__empty-row hr-table-empty"><td colspan="${headers.length}" class="db-empty hr-table-empty">Sin movimientos en el periodo.</td></tr>`;

  return `
    <div class="db-table-wrap hr-table-wrap">
      <table class="db-table hr-table hr-table-readable db-finance-movement-table" aria-label="Movimientos financieros del estudio">
        <thead><tr>
          ${headers.map(([field, label]) => renderSortableHeader(tableId, field, label, activeSort)).join('')}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderEventFinanceTransactionsTable(transactions, options = {}) {
  const tableId = `event-transactions-${state.activeSection}`;
  const activeSort = getTableSort(tableId, 'movement_date', 'desc');
  const sortedTransactions = sortRowsByColumn(transactions, activeSort.field, activeSort.direction);
  const headers = [
    ['concept', 'Concepto'],
    ['movement_type', 'Tipo'],
    ['amount', 'Monto'],
    ['hidden_room_share', 'M.A.I.'],
    ['from_user_id', 'FROM'],
    ['to_user_id', 'TO'],
    ['allocations', 'Corresponde a'],
    ['movement_date', 'Fecha'],
    ['payment_method', 'Metodo'],
    ['created_by_user_id', 'Creado por'],
    ['notes', 'Notas'],
  ];
  const canEdit = Boolean(options.canEdit && hasRole('admin'));
  const rows = sortedTransactions.length
    ? sortedTransactions.map((tx, index) => canEdit
      ? renderEventFinanceTransactionEditorRow(tx, index, headers)
      : renderEventFinanceTransactionReadableRow(tx)).join('')
    : `<tr class="db-table__empty-row hr-table-empty"><td colspan="${headers.length + (canEdit ? 1 : 0)}" class="db-empty hr-table-empty">Sin transacciones en el periodo.</td></tr>`;
  const tableClass = canEdit
    ? 'db-table hr-table hr-table-editable db-table--editor'
    : 'db-table hr-table hr-table-readable';

  return `
    <div class="db-table-wrap hr-table-wrap">
      <table class="${tableClass}" aria-label="Desglose financiero de eventos">
        <thead><tr>
          ${headers.map(([field, label]) => renderSortableHeader(tableId, field, label, activeSort)).join('')}
          ${canEdit ? '<th scope="col">Acciones</th>' : ''}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderEventFinanceTransactionReadableRow(tx) {
  return `
    <tr>
      <td>${escapeHTML(tx.concept ?? '-')}</td>
      <td>${escapeHTML(movementTypeLabel(tx.movement_type) || tx.type || '-')}</td>
      <td>${money(Number(tx.amount ?? 0))}</td>
      <td>${money(Number(tx.hidden_room_share ?? eventFinanceAmount(tx) ?? 0))}</td>
      <td>${escapeHTML(participantName(tx.from_user_id))}</td>
      <td>${escapeHTML(participantName(tx.to_user_id))}</td>
      <td>${escapeHTML(transactionAllocationSummary(tx))}</td>
      <td>${escapeHTML(formatDisplayDateOnly(tx.movement_date ?? tx.date))}</td>
      <td>${escapeHTML(tx.payment_method ?? tx.via ?? '-')}</td>
      <td>${escapeHTML(tx.created_by_user_id ?? '-')}</td>
      <td>${escapeHTML(tx.notes ?? '-')}</td>
    </tr>
  `;
}

function renderEventFinanceTransactionEditorRow(tx, index, headers) {
  const config = TABLE_EDITOR_CONFIG.hr_transactions;
  const original = encodeURIComponent(JSON.stringify(tx));
  const formId = `event-finance-table-form-${index}`;
  const paymentMethods = state.data.paymentMethods ?? [];
  const financeEntities = state.data.financeEntities ?? [];

  return `
    <tr>
      ${headers.map(([field]) => {
        const value = eventFinanceEditorCellValue(field, tx);
        if (field === 'concept') {
          return `<td class="db-table-cell--editable hr-cell-editable">${renderEventConceptControl(value, formId)}</td>`;
        }
        if (field === 'payment_method') {
          return `<td class="db-table-cell--editable hr-cell-editable"><select class="db-table-input hr-input" form="${escapeAttr(formId)}" name="payment_method">${renderPaymentMethodOptions(paymentMethods, value)}</select></td>`;
        }
        if (field === 'allocations') {
          return `<td class="db-table-cell--editable hr-cell-editable">${renderAllocationFieldset(financeEntities, transactionAllocations(tx), formId)}</td>`;
        }

        const isEditable = config.editableFields.includes(field);
        if (!isEditable) {
          return `<td class="db-table-cell--readonly"><code>${escapeHTML(String(value || '-'))}</code></td>`;
        }

        return `
          <td class="db-table-cell--editable hr-cell-editable">
            <input
              class="db-table-input hr-input"
              form="${escapeAttr(formId)}"
              name="${escapeAttr(field)}"
              value="${escapeAttr(value)}"
            />
          </td>
        `;
      }).join('')}
      <td class="db-table-cell--actions">
        <form class="db-inline-form" id="${escapeAttr(formId)}" data-form="event-finance-table-update">
          <input type="hidden" name="table_name" value="hr_transactions" />
          <input type="hidden" name="original" value="${escapeAttr(original)}" />
          <button class="db-btn-secondary" type="submit">Guardar</button>
        </form>
      </td>
    </tr>
  `;
}

function eventFinanceEditorCellValue(field, tx) {
  if (field === 'movement_type') return tx.movement_type ?? tx.type ?? '';
  if (field === 'hidden_room_share') return tx.hidden_room_share ?? eventFinanceAmount(tx) ?? '';
  if (field === 'movement_date') return tx.movement_date ?? tx.date ?? '';
  if (field === 'payment_method') return tx.payment_method ?? tx.via ?? '';
  return tx[field] ?? '';
}
function transactionAllocations(tx = {}) {
  return Array.isArray(tx.hr_transaction_allocations) ? tx.hr_transaction_allocations : [];
}

function transactionAllocationSummary(tx = {}) {
  const allocations = transactionAllocations(tx);
  if (!allocations.length) return financeEntityName(tx.owner_entity_id, tx.owner_user_id);
  return allocations.map((allocation) => {
    const label = financeEntityName(allocation.entity_id);
    if (allocation.percentage !== null && allocation.percentage !== undefined) return `${label} ${Number(allocation.percentage).toFixed(2).replace(/\.00$/, '')}%`;
    if (allocation.amount !== null && allocation.amount !== undefined) return `${label} ${money(allocation.amount)}`;
    return label;
  }).join(' · ');
}

async function renderErpPermissions() {
  if (!hasRole('admin')) {
    return sectionShell('ERP', 'Permisos', 'title-erp-permissions', `
      <p class="db-empty db-empty--error">Acceso no autorizado.</p>
    `);
  }

  const [
    { data: users, error: usersError },
    { data: permissions, error: permissionsError },
    { data: events, error: eventsError },
    { data: eventPermissions, error: eventPermissionsError },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, user_id, display_name, username, email, roles')
      .order('display_name', { ascending: true }),
    supabase
      .from('user_permissions')
      .select('id, user_id, permission_key')
      .order('permission_key', { ascending: true }),
    supabase
      .from('events')
      .select('id, event_key, name, event_date, status')
      .order('event_date', { ascending: false }),
    supabase
      .from('event_user_permissions')
      .select('id, event_id, user_id, can_view, can_add_finance, can_edit_finance, can_view_scrum, can_edit_scrum'),
  ]);

  if (usersError || permissionsError || eventsError || eventPermissionsError) {
    const error = usersError || permissionsError || eventsError || eventPermissionsError;
    console.error('[HR] renderErpPermissions:', error);
    if (isSessionStaleError(error)) markSessionStale(error.message || 'permissions fetch');
    return sectionShell('ERP', 'Permisos', 'title-erp-permissions', `
      <p class="db-empty db-empty--error">Error al cargar usuarios y permisos.</p>
    `);
  }

  state.data.permissionUsers = users ?? [];
  state.data.userPermissions = permissions ?? [];
  state.data.permissionEvents = events ?? [];
  state.data.eventUserPermissions = eventPermissions ?? [];

  const suspiciousAdminEmpty = hasRole('admin') && (users ?? []).length === 0;
  if (suspiciousAdminEmpty) markSessionStale('erp permissions users returned 0 rows');

  const rows = (users ?? []).length
    ? users.map(renderPermissionUserRow).join('')
    : `<tr class="db-table__empty-row hr-table-empty"><td colspan="6" class="db-empty hr-table-empty">${suspiciousAdminEmpty ? 'No se pudieron validar tus permisos. Actualiza sesión.' : 'Sin usuarios registrados.'}</td></tr>`;
  const permissionSearch = tableSearchFor('js-permissions-table-body');

  return sectionShell('ERP', 'Permisos', 'title-erp-permissions', `
    <div class="db-toolbar hr-table-toolbar">
      <label class="db-field db-field--compact db-field--search">
        <span>Buscar</span>
        <input data-table-search data-table-target="js-permissions-table-body" data-table-count="js-permissions-table-count" placeholder="Buscar por nombre, usuario, rol o permiso" value="${escapeAttr(permissionSearch)}" />
        <small id="js-permissions-table-count" class="db-field__hint">${(users ?? []).length} filas visibles</small>
      </label>
    </div>
    <div class="db-table-wrap hr-table-wrap">
      <table class="db-table hr-table hr-table-editable db-table--permissions" aria-label="Administracion de roles y permisos">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Username</th>
            <th scope="col">User ID</th>
            <th scope="col">Rol</th>
            <th scope="col">Permisos</th>
            <th scope="col">Agregar</th>
          </tr>
        </thead>
        <tbody id="js-permissions-table-body">${rows}</tbody>
      </table>
    </div>
  `);
}

async function renderErpAuthAudit() {
  if (!hasRole('admin')) {
    return sectionShell('ERP', 'Auth / Registros', 'title-erp-auth-audit', `
      <p class="db-empty db-empty--error">Acceso no autorizado.</p>
    `);
  }

  let audit;
  try {
    const { data, error } = await supabase.functions.invoke('admin-auth-audit', {
      body: { limit: 25 },
    });

    if (error || data?.success === false) {
      throw error || new Error(data?.error || 'No se pudo cargar Auth.');
    }

    audit = data;
  } catch (err) {
    console.error('[HR] renderErpAuthAudit:', err);
    return sectionShell('ERP', 'Auth / Registros', 'title-erp-auth-audit', `
      <p class="db-empty db-empty--error">No se pudo cargar la auditoría de Auth. Revisa que la Edge Function admin-auth-audit esté desplegada.</p>
    `);
  }

  const totals = audit?.totals ?? {};
  const generatedAt = audit?.generated_at ? formatDateTime(audit.generated_at) : '-';
  const alerts =
    Number(totals.auth_without_public_profile ?? 0)
    + Number(totals.public_profiles_without_auth ?? 0)
    + Number(totals.duplicate_emails ?? 0)
    + Number(totals.duplicate_user_ids ?? 0);

  return sectionShell('ERP', 'Auth / Registros', 'title-erp-auth-audit', `
    ${renderAuthAuditFilterBar(persistedDataValue('authAuditFilter', 'all'))}
    <div class="db-grid hr-grid hr-grid-3 db-grid--3col">
      ${renderStatCard('Auth users', String(totals.auth_users ?? 0))}
      ${renderStatCard('Perfiles public.users', String(totals.public_profiles ?? 0))}
      ${renderStatCard('Alertas de fusión', String(alerts))}
    </div>
    <p class="db-empty">Generado: ${escapeHTML(generatedAt)}</p>
    ${renderAuthUsersTable('Últimos usuarios logueados', audit?.recent_logins ?? [], 'last_sign_in_at', ['auth'], 'js-auth-logins')}
    ${renderAuthUsersTable('Últimos usuarios creados en Auth', audit?.recent_created ?? [], 'created_at', ['auth'], 'js-auth-created')}
    ${renderAuthUsersTable('Auth sin perfil public.users', audit?.possible_merges?.auth_without_public_profile ?? [], 'created_at', ['auth', 'alerts', 'missing-profile'], 'js-auth-missing-profile')}
    ${renderPublicProfilesTable('public.users sin Auth', audit?.possible_merges?.public_profiles_without_auth ?? [], ['public', 'alerts'], 'js-public-without-auth')}
    ${renderDuplicateEmailAudit(audit?.possible_merges?.duplicate_emails ?? [], ['alerts'], 'js-duplicate-emails')}
    ${renderDuplicateUserIdAudit(audit?.possible_merges?.duplicate_user_ids ?? [], ['alerts'], 'js-duplicate-user-ids')}
  `);
}

function renderAuthAuditFilterBar(activeFilter = 'all') {
  return `
    <div class="db-toolbar hr-table-toolbar">
      <label class="db-field db-field--compact">
        <span>Filtro</span>
        <select data-action="auth-audit-filter" aria-label="Filtrar auditoría de Auth">
          ${[
            ['all', 'Todos'],
            ['auth', 'Auth users'],
            ['public', 'Perfiles public.users'],
            ['alerts', 'Alertas de fusión'],
            ['missing-profile', 'Sin perfil'],
          ].map(([value, label]) => optionHTML(value, label, activeFilter)).join('')}
        </select>
      </label>
    </div>
  `;
}

function authAuditBlockAttrs(groups = []) {
  const groupText = groups.join(' ');
  const activeFilter = persistedDataValue('authAuditFilter', 'all');
  const hidden = activeFilter !== 'all' && !groups.includes(activeFilter);
  return `data-auth-audit-groups="${escapeAttr(groupText)}"${hidden ? ' hidden' : ''}`;
}

function renderAuditTableSearch(tableId, rowCount, label = 'Buscar') {
  const searchQuery = tableSearchFor(tableId);
  return `
    <label class="db-field db-field--compact db-field--search">
      <span>${escapeHTML(label)}</span>
      <input data-table-search data-table-target="${escapeAttr(tableId)}" data-table-count="${escapeAttr(`${tableId}-count`)}" placeholder="Buscar por email, User ID, perfil o estado" value="${escapeAttr(searchQuery)}" />
      <small id="${escapeAttr(`${tableId}-count`)}" class="db-field__hint">${rowCount} filas visibles</small>
    </label>
  `;
}

function renderAuthUsersTable(title, users = [], dateField = 'created_at', groups = ['auth'], tableId = 'js-auth-users') {
  const rows = users.length
    ? users.map((user) => {
      const profile = user.profile ?? {};
      const searchText = [
        user?.[dateField],
        user.email,
        user.id,
        profile.user_id,
        profile.display_name,
        profile.username,
        user.needs_profile_merge ? 'Sin perfil' : 'OK',
      ].filter(Boolean).join(' ');
      return `
        <tr data-search-row data-search-text="${escapeAttr(searchText)}">
          <td>${escapeHTML(formatDateTime(user?.[dateField]))}</td>
          <td>${escapeHTML(user.email ?? '-')}</td>
          <td><code>${escapeHTML(user.id ?? '-')}</code></td>
          <td>${escapeHTML(profile.user_id ?? '-')}</td>
          <td>${escapeHTML(profile.display_name ?? profile.username ?? '-')}</td>
          <td>${user.needs_profile_merge ? '<span class="db-auth-audit__flag">Sin perfil</span>' : '<span class="db-auth-audit__ok">OK</span>'}</td>
        </tr>
      `;
    }).join('')
    : '<tr class="db-table__empty-row hr-table-empty"><td colspan="6" class="db-empty hr-table-empty">Sin registros.</td></tr>';

  return `
    <article class="db-auth-audit-block" ${authAuditBlockAttrs(groups)}>
      <h2 class="db-auth-audit-block__title">${escapeHTML(title)}</h2>
      ${renderAuditTableSearch(tableId, users.length)}
      <div class="db-table-wrap hr-table-wrap">
        <table class="db-table hr-table hr-table-readable" aria-label="${escapeAttr(title)}">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Email Auth</th>
              <th scope="col">Auth ID</th>
              <th scope="col">User ID</th>
              <th scope="col">Perfil</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody id="${escapeAttr(tableId)}">${rows}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderPublicProfilesTable(title, profiles = [], groups = ['public'], tableId = 'js-public-profiles') {
  const rows = profiles.length
    ? profiles.map((profile) => {
      const searchText = [
        profile.email,
        profile.id,
        profile.user_id,
        profile.display_name,
        profile.username,
        profile.roles,
      ].filter(Boolean).join(' ');
      return `
        <tr data-search-row data-search-text="${escapeAttr(searchText)}">
          <td>${escapeHTML(profile.email ?? '-')}</td>
          <td><code>${escapeHTML(profile.id ?? '-')}</code></td>
          <td>${escapeHTML(profile.user_id ?? '-')}</td>
          <td>${escapeHTML(profile.display_name ?? profile.username ?? '-')}</td>
          <td>${escapeHTML(profile.roles ?? '-')}</td>
        </tr>
      `;
    }).join('')
    : '<tr class="db-table__empty-row hr-table-empty"><td colspan="5" class="db-empty hr-table-empty">Sin registros.</td></tr>';

  return `
    <article class="db-auth-audit-block" ${authAuditBlockAttrs(groups)}>
      <h2 class="db-auth-audit-block__title">${escapeHTML(title)}</h2>
      ${renderAuditTableSearch(tableId, profiles.length)}
      <div class="db-table-wrap hr-table-wrap">
        <table class="db-table hr-table hr-table-readable" aria-label="${escapeAttr(title)}">
          <thead>
            <tr>
              <th scope="col">Email public.users</th>
              <th scope="col">Public ID</th>
              <th scope="col">User ID</th>
              <th scope="col">Perfil</th>
              <th scope="col">Rol</th>
            </tr>
          </thead>
          <tbody id="${escapeAttr(tableId)}">${rows}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderDuplicateEmailAudit(emailGroups = [], groups = ['alerts'], tableId = 'js-duplicate-emails') {
  const rows = emailGroups.length
    ? emailGroups.map((group) => {
      const possibleProfiles = (group.public_profiles ?? []).map((profile) => profile.user_id || profile.display_name || profile.id).join(', ') || '-';
      const searchText = [
        group.email,
        possibleProfiles,
        ...(group.auth_users ?? []).map((user) => user.email || user.id),
      ].filter(Boolean).join(' ');
      return `
        <tr data-search-row data-search-text="${escapeAttr(searchText)}">
          <td>${escapeHTML(group.email ?? '-')}</td>
          <td>${escapeHTML(String(group.auth_users?.length ?? 0))}</td>
          <td>${escapeHTML(String(group.public_profiles?.length ?? 0))}</td>
          <td>${escapeHTML(possibleProfiles)}</td>
        </tr>
      `;
    }).join('')
    : '<tr class="db-table__empty-row hr-table-empty"><td colspan="4" class="db-empty hr-table-empty">Sin emails duplicados.</td></tr>';

  return `
    <article class="db-auth-audit-block" ${authAuditBlockAttrs(groups)}>
      <h2 class="db-auth-audit-block__title">Emails duplicados</h2>
      ${renderAuditTableSearch(tableId, emailGroups.length)}
      <div class="db-table-wrap hr-table-wrap">
        <table class="db-table hr-table hr-table-readable" aria-label="Emails duplicados">
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Auth</th>
              <th scope="col">public.users</th>
              <th scope="col">Perfiles posibles</th>
            </tr>
          </thead>
          <tbody id="${escapeAttr(tableId)}">${rows}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderDuplicateUserIdAudit(userIdGroups = [], groups = ['alerts'], tableId = 'js-duplicate-user-ids') {
  const rows = userIdGroups.length
    ? userIdGroups.map((group) => {
      const possibleEmails = (group.public_profiles ?? []).map((profile) => profile.email || profile.display_name || profile.id).join(', ') || '-';
      const searchText = [
        group.user_id,
        possibleEmails,
      ].filter(Boolean).join(' ');
      return `
        <tr data-search-row data-search-text="${escapeAttr(searchText)}">
          <td>${escapeHTML(group.user_id ?? '-')}</td>
          <td>${escapeHTML(String(group.public_profiles?.length ?? 0))}</td>
          <td>${escapeHTML(possibleEmails)}</td>
        </tr>
      `;
    }).join('')
    : '<tr class="db-table__empty-row hr-table-empty"><td colspan="3" class="db-empty hr-table-empty">Sin User ID duplicados.</td></tr>';

  return `
    <article class="db-auth-audit-block" ${authAuditBlockAttrs(groups)}>
      <h2 class="db-auth-audit-block__title">User ID duplicados</h2>
      ${renderAuditTableSearch(tableId, userIdGroups.length)}
      <div class="db-table-wrap hr-table-wrap">
        <table class="db-table hr-table hr-table-readable" aria-label="User ID duplicados">
          <thead>
            <tr>
              <th scope="col">User ID</th>
              <th scope="col">Perfiles</th>
              <th scope="col">Emails posibles</th>
            </tr>
          </thead>
          <tbody id="${escapeAttr(tableId)}">${rows}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderPermissionUserRow(user) {
  const permissions = (state.data.userPermissions ?? [])
    .filter((permission) => String(permission.user_id) === String(user.id));

  const permissionList = permissions.length
    ? permissions.map((permission) => `
      <span class="db-permission-chip">
        ${escapeHTML(permission.permission_key)}
        <button type="button" data-action="permission-remove" data-permission-id="${escapeHTML(String(permission.id))}" aria-label="Quitar ${escapeAttr(permission.permission_key)}">x</button>
      </span>
    `).join('')
    : '<span class="db-empty">Sin permisos.</span>';
  const searchText = [
    user.display_name,
    user.email,
    user.username,
    user.user_id,
    user.roles,
    ...permissions.map((permission) => permission.permission_key),
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase();

  return `
    <tr data-search-row data-search-text="${escapeAttr(searchText)}" data-user-uuid="${escapeHTML(String(user.id))}">
      <td>${escapeHTML(user.display_name ?? user.email ?? 'Sin nombre')}</td>
      <td>${escapeHTML(usernameLabel(user))}</td>
      <td>${escapeHTML(String(user.user_id ?? ''))}</td>
      <td>
        <select data-action="role-change" data-user-uuid="${escapeHTML(String(user.id))}" aria-label="Cambiar rol de ${escapeAttr(user.display_name ?? user.email ?? user.user_id ?? 'usuario')}">
          ${AVAILABLE_ROLES.map((role) => optionHTML(role, role, user.roles ?? 'client')).join('')}
        </select>
      </td>
      <td><div class="db-permission-list">${permissionList}</div></td>
      <td>
        <form class="db-inline-form" data-form="permission-add">
          <input type="hidden" name="user_uuid" value="${escapeAttr(user.id)}" />
          <select name="permission_key" aria-label="Agregar permiso">
            ${SUGGESTED_PERMISSIONS.map((permission) => optionHTML(permission, permission, '')).join('')}
          </select>
          <button class="db-btn-secondary" type="submit">Agregar</button>
        </form>
        <button class="db-btn-secondary" type="button" style="margin-top:4px" data-action="admin-user-edit" data-user-uuid="${escapeHTML(String(user.id))}">Editar usuario</button>
      </td>
    </tr>
  `;
}

async function renderAdminTableEditor() {
  if (!hasRole('admin')) {
    return sectionShell('ERP', 'BB.DD', 'title-admin-table-editor', `
      <p class="db-empty db-empty--error">Acceso no autorizado.</p>
    `);
  }

  const tableName = state.data.adminTableName || setAdminTableName(readStoredAdminTableName());
  const config = TABLE_EDITOR_CONFIG[tableName] || TABLE_EDITOR_CONFIG.users;
  let data = [];
  let searchQuery = adminTableSearchFor(tableName);

  try {
    data = tableName === 'membership_dashboard'
      ? await fetchComputedMembershipDashboardRows(searchQuery)
      : await fetchAllTableEditorRows(tableName, config.select, config.defaultSort, {
        maxRows: ADMIN_TABLE_INITIAL_ROW_LIMIT,
        searchQuery,
        config,
      });
    if (tableName === 'membership_dashboard') {
      const selectedUserId = state.data.membershipDashboardSelectedUserId ?? '';
      if (selectedUserId !== searchQuery) {
        searchQuery = selectedUserId;
        setAdminTableSearch(tableName, selectedUserId);
      }
    }
  } catch (error) {
    console.error('[HR] renderAdminTableEditor:', error);
    if (isSessionStaleError(error)) markSessionStale(error.message || 'admin table fetch');
    return sectionShell('ERP', 'BB.DD', 'title-admin-table-editor', `
      <p class="db-empty db-empty--error">No se pudo cargar ${escapeHTML(config.label)}. Revisa RLS/permisos.</p>
    `);
  }

  if (typeof config.rowFilter === 'function') {
    data = (data ?? []).filter(config.rowFilter);
  }

  state.data.adminTableRows = data ?? [];

  const columns = [...config.lockedFields, ...config.editableFields]
    .filter((field, index, arr) => arr.indexOf(field) === index);
  const visibleColumns = columns.filter((field) => !(config.hiddenColumns ?? []).includes(field));
  const showAllColumns = persistedDataValue(`adminTableShowAll:${tableName}`, '0') === '1';
  const summaryColumns = getAdminTableSummaryColumns(visibleColumns, config);
  const displayedColumns = showAllColumns ? visibleColumns : summaryColumns;
  const canToggleColumns = tableName !== 'membership_dashboard' && visibleColumns.length > summaryColumns.length;
  const tableId = `admin-${tableName}`;
  const defaultSort = config.defaultSort ?? { field: '', direction: 'asc' };
  const activeSort = getTableSort(tableId, defaultSort.field, defaultSort.direction);
  const sortField = visibleColumns.includes(activeSort.field) ? activeSort.field : '';
  const sortedData = sortRowsByColumn(data ?? [], sortField, activeSort.direction);
  const visibleData = sortedData.filter((row) => rowMatchesSearch(row, columns, searchQuery));
  const membershipDashboardContext = tableName === 'membership_dashboard'
    ? renderAdminMembershipDashboardContext(visibleData, searchQuery)
    : '';
  const isMembershipDashboard = tableName === 'membership_dashboard';
  const membershipDashboardHasUser = isMembershipDashboard && Boolean(searchQuery);
  const isDownloadsUserView = tableName === 'downloads';
  const searchControl = isMembershipDashboard
    ? renderMembershipDashboardUserPicker(searchQuery)
    : `
      <label class="db-field db-field--compact db-field--search">
        <span>Buscar</span>
        <input data-table-search data-admin-table-name="${escapeAttr(tableName)}" data-table-target="js-admin-table-body" data-table-count="js-admin-table-count" placeholder="Buscar por nombre, email, user_id..." value="${escapeAttr(searchQuery)}" />
        <small id="js-admin-table-count" class="db-field__hint">${searchQuery ? `${visibleData.length} resultado${visibleData.length === 1 ? '' : 's'}` : `${visibleData.length} filas cargadas`}</small>
      </label>
    `;

  const suspiciousAdminEmpty = hasRole('admin') && tableName === 'users' && !searchQuery && (data ?? []).length === 0;
  if (suspiciousAdminEmpty) markSessionStale('admin users table returned 0 rows');

  const rowsToRender = (searchQuery ? visibleData : sortedData).slice(0, ADMIN_TABLE_RENDER_LIMIT);
  const rows = rowsToRender.length
    ? rowsToRender.map((row, index) => renderAdminTableEditorRow(tableName, config, row, index, {
      hidden: false,
      visibleColumns: displayedColumns,
    })).join('')
    : `<tr class="db-table__empty-row hr-table-empty"><td colspan="99" class="db-empty hr-table-empty">${suspiciousAdminEmpty ? 'No se pudieron validar tus permisos. Actualiza sesión.' : 'Sin filas disponibles.'}</td></tr>`;
  const membershipDashboardTable = isMembershipDashboard
    ? renderMembershipDashboardTable(visibleData, { canEditMaterialDelivery: true, showScheduledDelivery: true })
    : '';
  const downloadsUserTable = isDownloadsUserView
    ? renderAdminDownloadsUserViewTable(rowsToRender)
    : '';

  return sectionShell('ERP', 'BB.DD', 'title-admin-table-editor', `
    <div class="db-toolbar hr-table-toolbar">
      <label class="db-field db-field--compact">
        <span>Tabla</span>
        <select data-action="table-editor-table" aria-label="Seleccionar tabla">
          ${Object.entries(TABLE_EDITOR_CONFIG).filter(([, item]) => !item.hidden).map(([key, item]) => optionHTML(key, item.label, tableName)).join('')}
        </select>
      </label>
      ${searchControl}
      ${canToggleColumns ? `
      <label class="db-column-toggle">
        <input type="checkbox" data-action="admin-table-toggle-columns" data-table-name="${escapeAttr(tableName)}" ${showAllColumns ? 'checked' : ''} />
        <span>${showAllColumns ? 'Ocultar columnas' : 'Mostrar todas las columnas'}</span>
      </label>
      ` : ''}
      ${config.readOnly && !isMembershipDashboard ? '' : '<button class="db-btn-secondary" type="button" data-action="admin-table-save-all">GUARDAR</button>'}
      ${isMembershipDashboard ? '' : `<button class="db-btn-secondary" type="button" data-action="export-admin-pdf" data-table-label="${escapeAttr(config.label)}">Exportar PDF</button>`}
    </div>
    ${tableName === 'users' ? '<p class="db-empty">El campo email se guarda a través de Auth (Edge Function). El cambio se aplica al confirmar el correo.</p>' : ''}
    ${membershipDashboardContext}
    ${isMembershipDashboard && !membershipDashboardHasUser ? '<p class="db-empty">Selecciona un usuario para consultar su dashboard de membresía.</p>' : `
    ${isMembershipDashboard ? membershipDashboardTable : isDownloadsUserView ? downloadsUserTable : `
    <div class="db-table-wrap hr-table-wrap">
      <table class="db-table hr-table hr-table-editable db-table--editor" aria-label="Editor de ${escapeAttr(config.label)}">
        <thead>
          <tr>
            ${displayedColumns.map((field) => renderSortableHeader(tableId, field, adminFieldLabel(config, field), activeSort)).join('')}
            ${config.readOnly ? '' : '<th scope="col">Acciones</th>'}
          </tr>
        </thead>
        <tbody id="js-admin-table-body">${rows}</tbody>
      </table>
    </div>
    `}
    ${isMembershipDashboard ? renderMembershipSyncFooter() : ''}
    `}
  `);
}

function renderAdminDownloadsUserViewTable(rows = []) {
  const body = rows.length
    ? rows.map((item) => {
      const original = encodeURIComponent(JSON.stringify(item));
      const cells = [
        escapeHTML(item.user_id ?? '-'),
        escapeHTML(item.name ?? '-'),
        escapeHTML(item.type ?? '-'),
        escapeHTML(downloadReleaseLabel(item)),
        escapeHTML(item.notes ?? '-'),
        renderDownloadAction(item),
        '<button class="db-btn-danger db-download-admin-remove" type="button" data-action="admin-table-delete" data-table-name="downloads" data-row-original="' + escapeAttr(original) + '" title="Desasigna esta descarga del usuario; el archivo en Cloud se conserva">Quitar descarga</button>',
      ];
      return '<tr>' + cells.map((cell) => '<td>' + cell + '</td>').join('') + '</tr>';
    }).join('')
    : '<tr class="db-table__empty-row hr-table-empty"><td colspan="7" class="db-empty hr-table-empty">Sin descargas disponibles.</td></tr>';

  return '<div class="db-table-wrap hr-table-wrap">' +
    '<table class="db-table hr-table hr-table-readable" aria-label="Descargas como las ve el usuario">' +
    '<thead><tr>' +
    '<th scope="col">Usuario</th>' +
    '<th scope="col">Producto</th>' +
    '<th scope="col">Formato</th>' +
    '<th scope="col">Origen</th>' +
    '<th scope="col">Notas</th>' +
    '<th scope="col">Descarga</th>' +
    '<th scope="col">Acciones</th>' +
    '</tr></thead>' +
    '<tbody id="js-admin-table-body">' + body + '</tbody>' +
    '</table></div>';
}
function renderAdminMembershipDashboardContext(rows = [], searchQuery = '') {
  if (!searchQuery || !rows.length) return '';

  const users = new Set(rows.map((row) => String(row.user_id ?? '')).filter(Boolean));
  if (users.size !== 1) {
    return `<p class="db-empty">Filtra hasta un solo usuario para ver los avisos de su membresía.</p>`;
  }

  return `
    ${renderMembershipNotices(rows)}
    ${renderMembershipSummary(rows)}
  `;
}

function renderMembershipDashboardUserPicker(selectedUserId = '') {
  const users = uniqueUsers(state.data.membershipDashboardUsers ?? []);





  const picker = renderUserPicker('membership_user_id', 'Buscar usuario', selectedUserId, {
    placeholder: 'Buscar usuario',
    users,
    emptyLabel: 'Sin usuarios encontrados.',
  }).replace('class="db-field db-user-picker"', 'class="db-field db-field--compact db-field--search db-user-picker" data-membership-user-picker="true"');


  return picker;
}

function getAdminTableSummaryColumns(visibleColumns = [], config = {}) {
  if (Array.isArray(config.summaryFields) && config.summaryFields.length) {
    return config.summaryFields.filter((field) => visibleColumns.includes(field));
  }

  const selected = [];
  const available = new Set(visibleColumns);

  ADMIN_TABLE_SUMMARY_COLUMN_GROUPS.forEach((group) => {
    group.forEach((field) => {
      if (available.has(field) && !selected.includes(field)) selected.push(field);
    });
  });

  return selected.length ? selected : visibleColumns.slice(0, 5);
}

function isAdminTableBooleanField(tableName, field) {
  return tableName === 'services' && ['show_in_finance', 'show_in_session'].includes(field);
}

function renderAdminTableBooleanCell(tableName, field, value, formId, cellToneClass = '') {
  const checked = parseBooleanField(value);
  const label = field === 'show_in_finance' ? 'Finanzas' : 'Sesión';

  return `
    <td class="db-table-cell--editable hr-cell-editable${escapeAttr(cellToneClass)}">
      <input type="hidden" form="${escapeAttr(formId)}" name="${escapeAttr(field)}" value="false" />
      <label class="db-check db-check--compact">
        <input form="${escapeAttr(formId)}" name="${escapeAttr(field)}" type="checkbox" value="true" ${checked ? 'checked' : ''} />
        <span>${escapeHTML(label)}</span>
      </label>
    </td>
  `;
}

function renderAdminTableEditorRow(tableName, config, row, index, options = {}) {
  const columns = [...config.lockedFields, ...config.editableFields]
    .filter((field, fieldIndex, arr) => arr.indexOf(field) === fieldIndex);
  const visibleColumns = options.visibleColumns
    ?? columns.filter((field) => !(config.hiddenColumns ?? []).includes(field));

  const original = encodeURIComponent(JSON.stringify(row));
  const searchText = columns
    .map((field) => row[field])
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase();

  const rowClass = tableName === 'membership_dashboard'
    ? ` class="db-membership-row db-membership-row--${escapeAttr(membershipRowTone(row))}"`
    : '';

  return `
    <tr${rowClass} data-search-row data-search-text="${escapeAttr(searchText)}"${options.hidden ? ' hidden' : ''}>
      ${visibleColumns.map((field) => {
        const value = adminTableCellValue(tableName, field, row);
        const isEditable = config.editableFields.includes(field);
        const cellToneClass = tableName === 'membership_dashboard' ? membershipCellClass(field, row) : '';
        if (config.lockedFields.includes(field) && !isEditable) {
          return `<td class="db-table-cell--readonly${escapeAttr(cellToneClass)}"><code class="${field === 'temp_password' ? 'db-readonly-secret' : ''}">${escapeHTML(String(value))}</code></td>`;
        }

        const formId = `admin-table-form-${index}`;
        if (isAdminTableBooleanField(tableName, field)) {
          return renderAdminTableBooleanCell(tableName, field, value, formId, cellToneClass);
        }

        return `
          <td class="db-table-cell--editable hr-cell-editable${escapeAttr(cellToneClass)}">
            <input
              class="db-table-input hr-input"
              form="${escapeAttr(formId)}"
              name="${escapeAttr(field)}"
              value="${escapeAttr(value)}"
            />
          </td>
        `;
      }).join('')}
      ${config.readOnly ? '' : `
      <td class="db-table-cell--actions">
        <form class="db-inline-form" id="admin-table-form-${index}" data-form="admin-table-update">
          <input type="hidden" name="table_name" value="${escapeAttr(tableName)}" />
          <input type="hidden" name="original" value="${escapeAttr(original)}" />
          <button class="db-btn-secondary" type="submit">Guardar</button>
        </form>
        ${renderAdminTableRowExtraActions(tableName, row, original)}
        <button class="db-btn-danger" type="button" data-action="admin-table-delete" data-table-name="${escapeAttr(tableName)}" data-row-original="${escapeAttr(original)}">Eliminar</button>
        ${tableName === 'users' && row.temp_password ? `<button class="db-btn-secondary" type="button" data-action="share-login" data-user-row="${escapeAttr(original)}">Compartir</button>` : ''}
      </td>
      `}
    </tr>
  `;
}

function renderAdminTableRowExtraActions(tableName, row, original) {
  const actions = [];

  if (adminTableRowSupportsReceipt(tableName)) {
    actions.push('<button class="db-btn-secondary" type="button" data-action="admin-operation-receipt-share" data-table-name="' + escapeAttr(tableName) + '" data-row-original="' + escapeAttr(original) + '">Compartir PDF</button>');
  }

  if (tableName === 'memberships') {
    const status = String(row?.status ?? '').toLowerCase();
    const canCancel = !['cancelled', 'expired'].includes(status);
    const canFinish = status !== 'expired';

    if (canCancel) {
      actions.push('<button class="db-btn-secondary" type="button" data-action="membership-cancel-row" data-row-original="' + escapeAttr(original) + '">Cancelar</button>');
    }
    if (canFinish) {
      actions.push('<button class="db-btn-secondary" type="button" data-action="membership-finish-row" data-row-original="' + escapeAttr(original) + '">Finalizar</button>');
    }
  }

  return actions.join('');
}

function adminTableRowSupportsReceipt(tableName) {
  return ['transactions', 'sessions', 'downloads', 'contracts'].includes(tableName);
}
function adminTableCellValue(tableName, field, row) {
  if (tableName === 'membership_dashboard') {
    if (field === 'saldo') return formatMembershipRowBalance(row);
    if (field === 'fecha_esperada' || field === 'fecha_de_sesion' || field === 'fecha_de_saldo') return formatDisplayDateOnly(row[field]);
    if (field === 'sesiones_usadas') return formatMembershipSessionDates(row) || '-';
    if (field === 'periodo') return row.periodo || '-';
  }

  if (tableName === 'users' && field === 'occupations') return displayOccupationsValue(row[field]);
  if (tableName === 'users' && field === 'passline_tracking') return displayPasslineTrackingValue(row[field]);

  return row[field] ?? '';
}

function membershipRowTone(row) {
  const saldo = Number(row?.saldo ?? 0);
  if (row?.saldo_tipo === 'pendiente') return 'neutral';
  if (saldo < 0 || (row?.estado === 'ATRASADO' && !row?.fecha_de_saldo)) return 'debt';
  if (saldo > 0) return 'credit';
  return 'neutral';
}

function membershipFieldTone(field, row) {
  const value = String(row?.[field] ?? '').toUpperCase();
  if (field === 'estado') {
    if (value === 'ATRASADO') return 'danger';
    if (value === 'ADELANTADO' || value === 'CORRIENTE') return 'success';
    if (value === 'PENDIENTE') return 'warning';
  }
  if (field === 'estado_operativo') {
    if (value === 'ACTIVE') return 'success';
    if (value === 'PAUSED') return 'warning';
    if (value === 'CANCELLED' || value === 'EXPIRED') return 'danger';
  }
  if (field === 'saldo') {
    const saldo = Number(row?.saldo ?? 0);
    if (row?.saldo_tipo === 'pendiente') return 'warning';
    if (saldo < 0) return 'danger';
    if (saldo > 0) return 'success';
  }
  return 'neutral';
}

function membershipCellClass(field, row) {
  const tone = membershipFieldTone(field, row);
  return tone === 'neutral' ? '' : ` db-membership-cell--${tone}`;
}

function renderMembershipDashboardTable(rows = [], options = {}) {
  const deliveryByWeek = membershipDeliveryByWeek(rows);
  const showScheduledDelivery = Boolean(options.showScheduledDelivery);
  const body = rows.length
    ? rows.map((row) => renderMembershipDashboardRow(row, deliveryByWeek.get(Number(row.semana ?? 0)), options)).join('')
    : `
      <tr class="db-table__empty-row hr-table-empty">
        <td colspan="${showScheduledDelivery ? '8' : '7'}" class="db-empty hr-table-empty">Sin datos de membresía.</td>
      </tr>
    `;

  return `
    <div class="db-table-wrap hr-table-wrap db-table-wrap--membership">
      <table class="db-table hr-table hr-table-editable" aria-label="Membresía">
        <thead>
          <tr>
            <th scope="col">Semana</th>
            <th scope="col">Fecha de sesión</th>
            <th scope="col">Estado</th>
            <th scope="col">Saldo</th>
            <th scope="col">Fecha de saldo</th>
            ${showScheduledDelivery ? '<th scope="col">Fecha de entrega programada</th>' : ''}
            <th scope="col">Fecha de entrega</th>
            <th scope="col">Notas</th>
          </tr>
        </thead>
        <tbody id="js-admin-table-body">${body}</tbody>
      </table>
    </div>
  `;
}

function formatMembershipSessionDates(row) {
  if (Array.isArray(row?.sesiones_usadas_lista) && row.sesiones_usadas_lista.length) {
    return formatDisplayDateList(row.sesiones_usadas_lista);
  }

  return formatDisplayDateList(
    String(row?.sesiones_usadas ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  , 'db-section--client-downloads');
}

function renderMembershipDashboardRow(row, delivery = null, options = {}) {
  const sessionDates = formatMembershipSessionDates(row);
  const displayNotes = row.notas && row.notas !== '-' ? row.notas : '-';
  const deliveryFormId = membershipDeliveryFormId(row);
  const sessionNotesFormId = membershipSessionNotesFormId(row);
  const cycleNumber = Math.floor((Number(row.semana ?? 1) - 1) / 4) + 1;
  const computedDelivery = delivery ?? (row.material_estimated_delivery ? {
    estimatedDelivery: row.material_estimated_delivery,
    deliveryDelayWeeks: row.material_delivery_delay_weeks,
    delayApplied: row.material_delivery_delay_label,
    deliveredAt: row.material_delivered_at,
  } : null);
  const deliveredAtText = computedDelivery?.deliveredAt
    ? formatDisplayDateOnly(computedDelivery.deliveredAt)
    : 'No entregado';

  return `
    <tr class="db-membership-row db-membership-row--${escapeAttr(membershipRowTone(row))}">
      <td>${escapeHTML(String(row.semana ?? '-'))}</td>
      <td>${escapeHTML(sessionDates || 'Sin sesión registrada')}</td>
      <td class="${escapeAttr(membershipCellClass('estado', row).trim())}">${escapeHTML(row.estado ?? '-')}</td>
      <td class="${escapeAttr(membershipCellClass('saldo', row).trim())}">${formatMembershipRowBalance(row)}</td>
      <td>${escapeHTML(formatDisplayDateOnly(row.fecha_de_saldo))}</td>
      ${options.showScheduledDelivery ? `<td>${escapeHTML(formatDisplayDateOnly(computedDelivery?.estimatedDelivery))}</td>` : ''}
      <td class="${computedDelivery?.deliveredAt ? "db-membership-delivery-date--delivered" : ""}">${options.canEditMaterialDelivery ? renderMembershipDeliveryDateInput(row, computedDelivery, deliveryFormId, cycleNumber, deliveredAtText) : escapeHTML(deliveredAtText)}</td>
      <td>${options.canEditMaterialDelivery ? renderMembershipSessionNotesInput(row, sessionNotesFormId) : escapeHTML(displayNotes || '-')}</td>
    </tr>
  `;
}

function membershipDeliveryFormId(row) {
  return [
    'membership-delivery',
    row.membership_id ?? 'legacy',
    row.user_id ?? 'user',
    row.semana ?? '0',
  ]
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]/g, '-'))
    .join('-');
}

function membershipSessionNotesFormId(row) {
  return [
    'membership-session-notes',
    row.session_id ?? 'none',
    row.membership_id ?? 'legacy',
    row.semana ?? '0',
  ]
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]/g, '-'))
    .join('-');
}

function renderMembershipDeliveryDateInput(row, delivery, formId, cycleNumber, deliveredAtText) {
  const isDelivered = Boolean(delivery?.deliveredAt);
  return `
    <form class="db-membership-delivery-form" id="${formId}" data-form="membership-delivery" data-stay-section="admin-table-editor">
      <input type="hidden" name="membership_id" value="${escapeAttr(row.membership_id ?? '')}" />
      <input type="hidden" name="user_id" value="${escapeAttr(row.user_id ?? '')}" />
      <input type="hidden" name="cycle_number" value="${escapeAttr(String(cycleNumber))}" />
      <input type="hidden" name="delivered_at_original" value="${escapeAttr(delivery?.deliveredAt ?? '')}" />
      <span class="db-membership-delivery-status db-membership-delivery-status--${isDelivered ? 'done' : 'pending'}">${escapeHTML(deliveredAtText)}</span>
      <input class="db-table-input hr-input hr-cell-editable db-table-input--compact db-membership-editable-cell" name="delivered_at" type="date" value="${escapeAttr(delivery?.deliveredAt ?? '')}" aria-label="Fecha real de entrega" />
    </form>
  `;
}

function renderMembershipSessionNotesInput(row, formId) {
  const sessionId = row.session_id ? String(row.session_id) : '';
  const notes = row.session_notes ?? '';
  if (!sessionId) return '-';

  return `
    <div class="db-membership-delivery-edit">
      <form id="${formId}" data-form="membership-session-notes" data-stay-section="admin-table-editor">
        <input type="hidden" name="session_id" value="${escapeAttr(sessionId)}" />
        <input type="hidden" name="notes_original" value="${escapeAttr(notes || '')}" />
        <textarea class="db-table-input hr-input hr-cell-editable db-table-input--notes db-membership-editable-cell" name="notes" rows="3" aria-label="Notas de sesión">${escapeHTML(notes || '')}</textarea>
      </form>
    </div>
  `;
}

/* -- RENDER HELPER ------------------------------------------ */
/**
 * Generic section shell to reduce boilerplate.
 * @param {string} label
 * @param {string} title
 * @param {string} titleId
 * @param {string} bodyHTML
 */
function renderPortalSectionHeader(label, title, titleId, summary = '') {
  return `
    <header class="db-section__header hr-portal-section__header">
      <p class="section-label">${escapeHTML(label)}</p>
      <h1 class="db-section__title hr-portal-section__title" id="${escapeHTML(titleId)}">${escapeHTML(title)}</h1>
      ${summary ? `<p class="db-section__summary hr-portal-section__summary">${escapeHTML(summary)}</p>` : ''}
    </header>
  `;
}

function sectionShell(label, title, titleId, bodyHTML, modifier = '') {
  return `
    <section class="db-section hr-portal-section ${escapeAttr(modifier)}" aria-labelledby="${escapeHTML(titleId)}">
      ${renderPortalSectionHeader(label, title, titleId)}
      ${bodyHTML}
    </section>
  `;
}
async function ensureUsersLoaded() {
  if (state.data.users?.length) return state.data.users;

  try {
    const users = await fetchAllTableEditorRows(
      'users',
      'id, user_id, display_name, username, email, passline_tracking',
      { field: 'display_name', direction: 'asc' }
    );
    state.data.users = uniqueUsers(users);
    return state.data.users;
  } catch (error) {
    console.error('[HR] ensureUsersLoaded:', error);
    showToast('No se pudieron cargar usuarios.', 'error');
    state.data.users = [];
    return [];
  }
}

async function handleViewAsSubmit(form) {
  if (state.viewAs?.active || !hasRole('admin')) {
    showToast('Regresa a tu vista de administrador para cambiar de usuario.', 'error');
    return;
  }

  const userId = form.querySelector('input[type="hidden"][name="view_as_user_id"]')?.value || '';
  if (!userId) {
    showToast('Selecciona un usuario.', 'error');
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Cargando vista...';
  }

  try {
    await window.HiddenRoomViewAs?.activate?.(userId);
    if (submit) {
      submit.textContent = 'Vista cargada';
      submit.dataset.state = 'success';
      submit.setAttribute('aria-live', 'polite');
    }
    try {
      sessionStorage.removeItem('hr_view_as_return');
    } catch (error) {
      console.info('[HR] view-as return path unavailable:', error?.message || error);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    window.location.href = '/';
  } catch (error) {
    console.error('[HR] view-as activate:', error);
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Cargar vista';
    }
    showToast(error?.message || 'No se pudo cargar la vista del usuario.', 'error');
  }
}

function parseBooleanField(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'si', 'sí', 'on', 'active'].includes(normalized);
}

function formValues(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  for (const key of Object.keys(values)) {
    if (values[key] === '') values[key] = null;
  }
  return values;
}

function withTargetUsername(payload) {
  const user = (state.data.users ?? []).find((u) => String(u.user_id) === String(payload.user_id));
  return {
    ...payload,
    username: user?.username ?? user?.display_name ?? user?.email ?? null,
  };
}

function buildWhatsAppLink(phone, message) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function money(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function todayDateInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function sessionTypeConfig(value) {
  const rawValue = String(value ?? '').trim();
  const services = visibleSessionServices(state.data.services ?? []);
  const exactService = services.find((service) => String(service.name) === rawValue);
  if (exactService) return serviceSessionConfig(exactService);

  const canonicalValue = canonicalSessionTypeValue(value);
  const canonicalService = services.find((service) => canonicalSessionTypeValue(service.name) === canonicalValue || String(service.name) === canonicalValue);
  if (canonicalService) return serviceSessionConfig(canonicalService);

  return SESSION_TYPE_OPTIONS.find((item) => item.value === canonicalValue) ?? SESSION_TYPE_OPTIONS[0];
}

function addMinutesToTime(time, minutes) {
  if (!time || !Number.isFinite(minutes)) return '';
  const [hours, mins] = String(time).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return '';
  const total = ((hours * 60 + mins + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function updateSessionDerivedFields(form) {
  if (!form || form.dataset.form !== 'session-create') return;

  const typeSelect = form.querySelector('[data-session-type]');
  const startInput = form.querySelector('[data-session-start]');
  const endInput = form.querySelector('[data-session-end]');
  const costInput = form.querySelector('[data-session-cost]');
  const conceptInput = form.querySelector('[data-session-concept]');
  const config = sessionTypeConfig(typeSelect?.value);
  const isMembership = isMembershipValue(typeSelect?.value);

  if (costInput) costInput.value = config?.cost ?? '';
  if (endInput) endInput.value = addMinutesToTime(startInput?.value, config?.minutes);
  if (conceptInput && isMembership) {
    conceptInput.value = MEMBERSHIP_CANONICAL;
    conceptInput.readOnly = true;
  } else if (conceptInput) {
    conceptInput.readOnly = false;
  }
}

function updateTransactionConceptFields(form) {
  if (!form || form.dataset.form !== 'transaction-create') return;

  const serviceSelect = form.querySelector('[data-transaction-service]');
  const conceptSelect = form.querySelector('[data-transaction-concept]');
  const customWrap = form.querySelector('[data-custom-concept-wrap]');
  const customInput = form.querySelector('[data-custom-concept]');

  if (serviceSelect && isMembershipValue(serviceSelect.value)) {
    serviceSelect.value = MEMBERSHIP_CANONICAL;
    if (conceptSelect && (!conceptSelect.value || conceptSelect.value === 'PERSONALIZADO')) {
      conceptSelect.value = MEMBERSHIP_CANONICAL;
    }
  }

  const custom = conceptSelect?.value === 'PERSONALIZADO';
  if (customWrap) customWrap.hidden = !custom;
  if (customInput) {
    customInput.disabled = !custom;
    customInput.required = custom;
    if (!custom) customInput.value = '';
  }
}

const downloadCloudPickerRecords = new Set();

function getDownloadCloudPicker(form) {
  if (!form) return null;
  for (const record of [...downloadCloudPickerRecords]) {
    if (!document.body.contains(record.form)) {
      record.picker.destroy();
      downloadCloudPickerRecords.delete(record);
    }
    if (record.form === form) return record.picker;
  }
  const button = form.querySelector('[data-download-cloud]');
  if (!button) return null;
  const picker = createCloudSourcePicker({
    button,
    supabase,
    cloudOrigin: CLOUD_HIDDENROOM_URL,
    allowFolders: true,
    title: 'Seleccionar entrega desde Cloud',
    onSelect: ({ sourceFile, source }) => {
      form.__hrCloudSource = source;
      form.__hrCloudFile = sourceFile || null;
      form.__hrDownloadFiles = [];
      form.__hrDownloadFolderName = '';
      const input = form.querySelector('[data-download-file]');
      const folderInput = form.querySelector('[data-download-folder]');
      if (sourceFile && input) {
        const transfer = new DataTransfer();
        transfer.items.add(sourceFile);
        input.files = transfer.files;
      } else if (input) {
        input.value = '';
      }
      if (folderInput) folderInput.value = '';
      const label = form.querySelector('[data-download-source]');
      if (label) label.textContent = (source.kind === 'folder' ? 'Carpeta' : 'Archivo') + ' seleccionado desde Cloud: ' + source.name;
      updateDownloadMembershipFields(form);
    },
    onError: (error) => showToast(error?.message || 'No se pudo seleccionar contenido de Cloud.', 'error'),
  });
  if (picker) downloadCloudPickerRecords.add({ form, picker });
  return picker;
}
const beatSaleCloudPickerRecords = new Set();

function getBeatSaleCloudPicker(form) {
  if (!form) return null;
  for (const record of [...beatSaleCloudPickerRecords]) {
    if (!document.body.contains(record.form)) {
      record.picker.destroy();
      beatSaleCloudPickerRecords.delete(record);
    }
    if (record.form === form) return record.picker;
  }
  const button = form.querySelector('[data-beat-sale-cloud]');
  if (!button) return null;
  const picker = createCloudSourcePicker({
    button,
    supabase,
    cloudOrigin: CLOUD_HIDDENROOM_URL,
    allowFolders: false,
    title: 'Seleccionar beat desde Cloud',
    onSelect: ({ sourceFile, source }) => {
      if (!sourceFile) throw new Error('Beat Store solo permite archivos individuales.');
      form.__hrCloudSource = source;
      form.__hrCloudFile = sourceFile;
      const input = form.querySelector('[name="beat_file"]');
      if (input) {
        const transfer = new DataTransfer();
        transfer.items.add(sourceFile);
        input.files = transfer.files;
      }
      const label = form.querySelector('[data-beat-sale-source]');
      if (label) label.textContent = 'Seleccionado desde Cloud: ' + source.name;
    },
    onError: (error) => showToast(error?.message || 'No se pudo seleccionar el beat desde Cloud.', 'error'),
  });
  if (picker) beatSaleCloudPickerRecords.add({ form, picker });
  return picker;
}
function updateDownloadMembershipFields(form) {
  if (!form || form.dataset.form !== 'download-create') return;
  const releaseMode = form.querySelector('[data-download-release-mode]')?.value || 'immediate';
  const sourceType = form.querySelector('[data-download-source-type]')?.value || 'link';
  const linkField = form.querySelector('[data-download-link-field]');
  const fileField = form.querySelector('[data-download-file-field]');
  const storageInput = form.querySelector('[data-download-storage-path]');
  const fileInput = form.querySelector('[data-download-file]');
  const membershipFields = form.querySelector('[data-download-membership-fields]');
  const membershipInput = form.querySelector('[data-download-membership-id]');
  const cycleInput = form.querySelector('[data-download-cycle-number]');
  const linked = releaseMode === 'membership_delivery';
  const fileMode = sourceType === 'file';

  if (linkField) linkField.hidden = fileMode;
  if (fileField) fileField.hidden = !fileMode;
  if (storageInput) {
    storageInput.required = !fileMode;
    if (fileMode) storageInput.value = '';
  }
  if (fileInput) fileInput.required = fileMode && !form.__hrCloudSource && !selectedDownloadFolderFiles(form).length;

  if (membershipFields) membershipFields.hidden = !linked;
  if (membershipInput) {
    membershipInput.required = linked;
    if (!linked) membershipInput.value = '';
  }
  if (cycleInput) {
    cycleInput.required = linked;
    if (!linked) cycleInput.value = '';
  }

  if (linked) {
    const userId = form.querySelector('.db-user-picker input[type="hidden"][name="user_id"]')?.value || '';
    updateDownloadMembershipOptions(form, userId);
  }
}

function resolveOperationalUserId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const user = (state.data.users ?? []).find((item) => (
    String(item.user_id ?? "") === raw
    || String(item.id ?? "") === raw
  ));
  if (user) return String(user.user_id ?? "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) return "";
  return raw;
}

function getUserDownloadCloudPath(userId) {
  const operationalUserId = resolveOperationalUserId(userId);
  if (!operationalUserId) return "";
  const user = (state.data.users ?? []).find((item) => String(item.user_id) === operationalUserId);
  const slugSource = user?.username || user?.display_name || user?.email || operationalUserId;
  return `/users/${sanitizeCloudSegment(operationalUserId)}__${sanitizeCloudSegment(slugSource)}/downloads`;
}

function sanitizeCloudSegment(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'user';
}

function slugifyStoreValue(value) {
  return sanitizeCloudSegment(value).replace(/_+/g, '-');
}

function fileBaseName(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/, '');
}

function selectedDownloadFolderFiles(form) {
  return Array.isArray(form?.__hrDownloadFiles)
    ? form.__hrDownloadFiles.filter((file) => file && Number.isFinite(file.size) && file.size > 0)
    : [];
}

function selectedDownloadFolderName(files = []) {
  const relativePath = String(files[0]?.webkitRelativePath || '').replace(/\\/g, '/').trim();
  const rootName = relativePath.split('/').filter(Boolean)[0] || '';
  return rootName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

function selectedDownloadRelativePath(file, rootName) {
  const relativePath = String(file?.webkitRelativePath || '').replace(/\\/g, '/').trim();
  const segments = relativePath.split('/').filter(Boolean);
  if (!segments.length || segments[0] !== rootName) {
    throw new Error('No se pudo leer la estructura de la carpeta seleccionada.');
  }
  const relativeSegments = segments.slice(1);
  if (!relativeSegments.length || relativeSegments.some((segment) => (
    segment === '.'
    || segment === '..'
    || /[\u0000-\u001f\u007f]/.test(segment)
  ))) {
    throw new Error('La carpeta contiene una ruta de archivo no válida.');
  }
  return relativeSegments.join('/');
}

function fileExtension(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function isAllowedBeatAudioFile(file) {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('audio/')) return true;
  return BEAT_AUDIO_EXTENSIONS.has(fileExtension(file?.name));
}

function setUploadProgress(form, scope, percent, label) {
  const progress = form.querySelector(`[data-${scope}-upload-progress]`);
  const bar = form.querySelector(`[data-${scope}-upload-progress-bar]`);
  const labelEl = form.querySelector(`[data-${scope}-upload-progress-label]`);
  const valueEl = form.querySelector(`[data-${scope}-upload-progress-value]`);
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  if (progress) progress.hidden = false;
  if (bar) bar.style.width = `${safePercent}%`;
  if (labelEl) labelEl.textContent = label;
  if (valueEl) valueEl.textContent = `${Math.round(safePercent)}%`;
}

function resetUploadProgress(form, scope, label = 'Esperando archivo') {
  setUploadProgress(form, scope, 0, label);
  const progress = form.querySelector(`[data-${scope}-upload-progress]`);
  if (progress) progress.hidden = true;
}

function setOperationFormPending(form, pending, label = 'Procesando...') {
  const submitButtons = [...form.querySelectorAll('button[type="submit"]')];
  submitButtons.forEach((button) => {
    if (pending) {
      button.dataset.originalText = button.dataset.originalText || button.textContent || '';
      button.disabled = true;
      button.textContent = label;
    } else {
      button.disabled = false;
      if (button.dataset.originalText) button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  });
}

function setBeatUploadProgress(form, percent, label) {
  setUploadProgress(form, 'beat', percent, label);
}

function resetBeatUploadProgress(form) {
  resetUploadProgress(form, 'beat', 'Esperando archivo');
}

function setDownloadUploadProgress(form, percent, label) {
  setUploadProgress(form, 'download', percent, label);
}

function resetDownloadUploadProgress(form) {
  resetUploadProgress(form, 'download', 'Esperando archivo');
}

function slugWithAttempt(slug, attempt) {
  return attempt <= 1 ? slug : `${slug}-${attempt}`;
}

function isDuplicateSlugError(error) {
  return error?.code === '23505'
    && String(error?.message || error?.details || '').includes('store_products_slug_key');
}

async function insertBeatStoreProductWithUniqueSlug(payload) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const candidate = {
      ...payload,
      slug: slugWithAttempt(payload.slug, attempt),
    };
    const { data, error } = await supabase
      .from('store_products')
      .insert(candidate)
      .select('id, slug')
      .maybeSingle();

    if (!error) {
      showToast(
        candidate.slug === payload.slug
          ? 'Beat publicado en tienda.'
          : `Beat publicado como ${candidate.slug}.`,
        'success'
      );
      return { ok: true, data, slug: candidate.slug };
    }

    if (!isDuplicateSlugError(error)) {
      console.error('[HR] store_products insert:', error);
      showToast('No se pudo guardar. Revisa permisos/RLS.', 'error');
      return { ok: false, data: null, error };
    }
  }

  showToast('No se pudo generar un slug disponible para el beat.', 'error');
  return { ok: false, data: null };
}

async function handleBeatSaleCreate(form, values) {
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton?.textContent ?? '';
  const file = form.querySelector('input[name="beat_file"]')?.files?.[0] || form.__hrCloudFile || null;
  if (!file) {
    showToast('Selecciona un archivo de audio.', 'error');
    return;
  }
  if (!isAllowedBeatAudioFile(file)) {
    showToast('El archivo debe ser audio: mp3, wav, m4a, aac, ogg, flac, aif o aiff.', 'error');
    return;
  }

  const name = String(values.name || fileBaseName(file.name) || 'Beat').trim();
  const slug = slugifyStoreValue(values.slug || fileBaseName(file.name) || name);
  const price = Number(values.price || 0);
  if (!name || !slug || !Number.isFinite(price) || price < 0) {
    showToast('Nombre, slug o precio invalido.', 'error');
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Subiendo...';
  }

  try {
    setBeatUploadProgress(form, 8, 'Validando audio');
    showToast('Subiendo beat a Cloud...', 'info');
    setBeatUploadProgress(form, 18, 'Preparando carpeta');
    await ensureCloudFolderPath(BEAT_STORE_CLOUD_PATH);
    setBeatUploadProgress(form, 38, 'Subiendo audio');
    const upload = await uploadCloudFileToPath(file, BEAT_STORE_CLOUD_PATH);
    setBeatUploadProgress(form, 78, 'Publicando producto');
    const payload = {
      slug,
      name,
      description: String(values.description || '').trim() || null,
      category: 'beats',
      price,
      currency: 'MXN',
      file_url: upload?.url || buildCloudFileFallbackUrl(BEAT_STORE_CLOUD_PATH, file.name),
      stock: values.stock !== null && values.stock !== undefined && values.stock !== '' ? Number(values.stock) : null,
      is_digital: true,
      is_active: values.is_active === 'on',
      featured: values.featured === 'on',
    };

    const result = await insertBeatStoreProductWithUniqueSlug(payload);
    if (result.ok) {
      setBeatUploadProgress(form, 100, 'Publicado');
      form.reset();
      form.__hrCloudSource = null;
      form.__hrCloudFile = null;
      setTimeout(() => resetBeatUploadProgress(form), 1200);
    }
  } catch (err) {
    console.error('[HR] beat sale upload:', err);
    setBeatUploadProgress(form, 100, 'Error al subir');
    showToast(err?.message || 'No se pudo subir el beat.', 'error');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText || 'Subir beat y publicar';
    }
  }
}

function updateDownloadMembershipOptions(form, userId = '') {
  const membershipInput = form?.querySelector('[data-download-membership-id]');
  if (!membershipInput) return;

  const options = [...membershipInput.options].filter((option) => option.value);
  const matching = [];
  options.forEach((option) => {
    const matches = !userId || String(option.dataset.membershipUserId ?? '') === String(userId);
    option.hidden = !matches;
    option.disabled = !matches;
    if (matches) matching.push(option);
  });

  const selected = membershipInput.selectedOptions?.[0];
  if (selected?.disabled) membershipInput.value = '';
  if (userId && matching.length === 1) membershipInput.value = matching[0].value;
}

function formatDateOnly(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function formatDisplayDateOnly(value) {
  const raw = formatDateOnly(value);
  if (!raw || raw === '-') return '-';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function formatDisplayDateList(values = []) {
  return values
    .map((value) => formatDisplayDateOnly(value))
    .filter((value) => value && value !== '-')
    .join(', ');
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDisplayDateOnly(value);
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function normalizeCatalogValue(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function isMembershipValue(value) {
  const normalized = normalizeCatalogValue(value).replace(/[^A-Z0-9]/g, '');
  return normalized.includes('MEMBRESIA') || normalized.includes('MEMBRES');
}

function canonicalServiceValue(value) {
  return isMembershipValue(value) ? MEMBERSHIP_CANONICAL : String(value ?? '').trim();
}

function canonicalSessionTypeValue(value) {
  const normalized = normalizeCatalogValue(value);
  if (isMembershipValue(normalized)) return MEMBERSHIP_CANONICAL;
  if (normalized.includes('BASICA') || normalized.includes('BÁSICA')) return 'SESIÓN BÁSICA';
  if (normalized.includes('PREMIUM')) return 'SESIÓN PREMIUM';
  if (normalized.includes('GRABACION') || normalized.includes('GRABACIÓN')) return 'GRABACIÓN';
  return String(value ?? '').trim();
}

function compareDateOnly(a, b) {
  return String(formatDateOnly(a)).localeCompare(String(formatDateOnly(b)));
}

function dateOnlyToLocalDate(value) {
  const raw = formatDateOnly(value);
  if (!raw || raw === '-') return null;
  const [year, month, day] = raw.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day);
}

function addDaysToDateOnly(value, days) {
  const date = dateOnlyToLocalDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function getWeekStartMonday(value) {
  const date = dateOnlyToLocalDate(value);
  if (!date) return null;
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function getWeekEndSunday(value) {
  const start = getWeekStartMonday(value);
  return start ? addDaysToDateOnly(start, 6) : null;
}

function membershipIdOf(row) {
  return row?.membership_id ?? row?.membershipId ?? null;
}

function rowMatchesMembership(row, membership) {
  const rowMembershipId = membershipIdOf(row);
  if (rowMembershipId) return String(rowMembershipId) === String(membership.id);
  return String(row?.user_id ?? '') === String(membership.user_id ?? '');
}

function membershipEndDate(membership, today = todayDateInputValue()) {
  if (membership.end_date) return formatDateOnly(membership.end_date);
  return formatDateOnly(today);
}

function generateMembershipWeeks(membership, today = todayDateInputValue()) {
  const startDate = getWeekStartMonday(membership.start_date);
  const endDate = getWeekEndSunday(membershipEndDate(membership, today));
  if (!dateOnlyToLocalDate(startDate) || compareDateOnly(startDate, endDate) > 0) return [];

  const weeks = [];
  let weekStart = startDate;
  let index = 1;

  while (weekStart && compareDateOnly(weekStart, endDate) <= 0) {
    weeks.push({
      membership,
      semana: index,
      fecha_esperada: weekStart,
      week_end: getWeekEndSunday(weekStart),
      weekly_price: Number(membership.weekly_price ?? MEMBERSHIP_WEEKLY_COST) || MEMBERSHIP_WEEKLY_COST,
    });
    weekStart = addDaysToDateOnly(startDate, index * 7);
    index += 1;
  }

  return weeks;
}

function sessionsForMembershipWeek(week, sessions = []) {
  return sessions.filter((session) => {
    if (!rowMatchesMembership(session, week.membership)) return false;
    if (!(isMembershipValue(session.type) || isMembershipValue(session.concept))) return false;
    const sessionDate = formatDateOnly(session.session_date);
    return compareDateOnly(sessionDate, week.fecha_esperada) >= 0
      && compareDateOnly(sessionDate, week.week_end) <= 0;
  }).sort((a, b) => compareDateOnly(a.session_date, b.session_date) || String(a.id ?? '').localeCompare(String(b.id ?? '')));
}

function membershipSessionNotes(sessions = []) {
  const notes = sessions
    .map((session) => ({
      date: formatDisplayDateOnly(session.session_date),
      notes: String(session.notes ?? '').trim(),
    }))
    .filter((session) => session.notes);

  if (!notes.length) return '-';
  if (notes.length === 1) return notes[0].notes;
  return notes.map((session) => `${session.date}: ${session.notes}`).join(' · ');
}

function membershipWeekObligation(week, sessions = []) {
  return week.weekly_price;
}

function buildLegacyMembershipsFromSessions(sessions = []) {
  const grouped = new Map();

  (sessions ?? [])
    .filter((session) => isMembershipValue(session.type) || isMembershipValue(session.concept))
    .forEach((session) => {
      const userId = String(session.user_id ?? '').trim();
      if (!userId) return;
      const current = grouped.get(userId);
      const sessionDate = formatDateOnly(session.session_date);
      if (!current) {
        grouped.set(userId, {
          id: `legacy-${userId}`,
          user_id: userId,
          username: session.username ?? null,
          status: 'active',
          start_date: sessionDate,
          end_date: sessionDate,
          weekly_price: MEMBERSHIP_WEEKLY_COST,
          sessions_per_week: 1,
          notes: 'Membresía histórica sin registro en public.memberships.',
          legacy: true,
        });
        return;
      }

      if (compareDateOnly(sessionDate, current.start_date) < 0) current.start_date = sessionDate;
      if (compareDateOnly(sessionDate, current.end_date) > 0) current.end_date = sessionDate;
    });

  return [...grouped.values()];
}

function buildMembershipRows(memberships = [], sessions = [], transactions = [], materialDeliveries = []) {
  const sourceMemberships = (memberships ?? []).length
    ? memberships
    : buildLegacyMembershipsFromSessions(sessions);

  const membershipSessions = (sessions ?? [])
    .filter((session) => isMembershipValue(session.type) || isMembershipValue(session.concept))
    .sort((a, b) => compareDateOnly(a.session_date, b.session_date) || String(a.id ?? '').localeCompare(String(b.id ?? '')));

  const membershipPayments = (transactions ?? [])
    .filter((tx) => isMembershipValue(tx.service))
    .map((tx) => ({
      ...tx,
      amount: Math.max(0, Number(tx.amount ?? 0)),
      date: formatDateOnly(tx.date),
    }))
    .filter((tx) => tx.amount > 0)
    .sort((a, b) => compareDateOnly(a.date, b.date) || String(a.id ?? '').localeCompare(String(b.id ?? '')));

  const today = todayDateInputValue();
  const rows = [];

  sourceMemberships
    .slice()
    .sort((a, b) => compareDateOnly(a.start_date, b.start_date) || String(a.id ?? '').localeCompare(String(b.id ?? '')))
    .forEach((membership) => {
      const membershipSessionRows = membershipSessions.filter((session) => rowMatchesMembership(session, membership));
      const latestSessionDate = membershipSessionRows.reduce((latest, session) => {
        const sessionDate = formatDateOnly(session.session_date);
        return !latest || compareDateOnly(sessionDate, latest) > 0 ? sessionDate : latest;
      }, null);
      const payments = membershipPayments.filter((tx) => rowMatchesMembership(tx, membership));
      const latestPaymentDate = payments.reduce((latest, payment) => {
        return !latest || compareDateOnly(payment.date, latest) > 0 ? payment.date : latest;
      }, null);
      const paymentProjectionEndDate = latestPaymentDate ? addDaysToDateOnly(latestPaymentDate, 7) : null;
      const generationEndDate = [today, latestSessionDate, paymentProjectionEndDate]
        .filter(Boolean)
        .sort(compareDateOnly)
        .at(-1);
      const weeks = generateMembershipWeeks(membership, generationEndDate);
      const weekStates = weeks.map((week) => ({
        week,
        fundedAmount: 0,
        fundingDates: [],
        carryoverAmount: 0,
      }));

      const allocatePaymentToWeek = (state, amount, paymentDate) => {
        const obligation = membershipWeekObligation(state.week, []);
        const remainingObligation = Math.max(0, obligation - state.fundedAmount);
        const applied = Math.min(amount, remainingObligation);
        if (applied > 0) {
          state.fundedAmount += applied;
          state.fundingDates.push({ amount: applied, date: paymentDate });
        }
        return amount - applied;
      };

      payments.forEach((payment) => {
        let remainingPayment = payment.amount;

        weekStates.forEach((state) => {
          if (remainingPayment <= 0) return;
          if (compareDateOnly(state.week.fecha_esperada, payment.date) > 0) return;
          remainingPayment = allocatePaymentToWeek(state, remainingPayment, payment.date);
        });

        weekStates.forEach((state) => {
          if (remainingPayment <= 0) return;
          remainingPayment = allocatePaymentToWeek(state, remainingPayment, payment.date);
        });

        if (remainingPayment > 0 && weekStates.length) {
          weekStates.at(-1).carryoverAmount += remainingPayment;
        }
      });

      weekStates.forEach((state) => {
        const { week, fundedAmount, fundingDates, carryoverAmount } = state;
        const weekSessions = sessionsForMembershipWeek(week, membershipSessionRows);
        const firstSession = weekSessions[0] ?? null;
        const usedSessionDates = [...new Set(weekSessions.map((session) => formatDateOnly(session.session_date)))];
        const weekObligation = membershipWeekObligation(week, weekSessions);
        const completionDate = fundingDates.at(-1)?.date ?? null;
        const covered = fundedAmount >= weekObligation;
        const remainingObligation = Math.max(0, weekObligation - fundedAmount);
        let estado = 'PENDIENTE';
        let saldo = null;
        let saldo_tipo = null;

        if (covered) {
          if (completionDate && compareDateOnly(completionDate, week.fecha_esperada) < 0) estado = 'ADELANTADO';
          else if (completionDate && compareDateOnly(completionDate, week.week_end) <= 0) estado = 'CORRIENTE';
          else estado = 'ATRASADO';

          if (estado === 'ADELANTADO') {
            saldo = fundedAmount;
            saldo_tipo = 'credito';
          } else if (carryoverAmount > 0) {
            saldo = carryoverAmount;
            saldo_tipo = 'credito';
          }
        } else if (compareDateOnly(week.week_end, today) < 0) {
          estado = 'ATRASADO';
          saldo = -remainingObligation;
          saldo_tipo = 'adeudo';
        } else if (remainingObligation > 0) {
          saldo = -remainingObligation;
          saldo_tipo = 'pendiente';
        }

        rows.push({
          membership_id: membership.id,
          membership_start_date: formatDateOnly(membership.start_date),
          membership_end_date: membership.end_date ? formatDateOnly(membership.end_date) : null,
          user_id: membership.user_id,
          username: membership.username,
          semana: week.semana,
          periodo: `${formatDateOnly(week.fecha_esperada)} a ${formatDateOnly(week.week_end)}`,
          fecha_esperada: week.fecha_esperada,
          week_end: week.week_end,
          obligacion: weekObligation,
          session_id: firstSession?.id ?? null,
          session_notes: firstSession?.notes ?? '',
          fecha_de_sesion: firstSession ? formatDateOnly(firstSession.session_date) : null,
          sesiones_usadas: usedSessionDates.join(', '),
          sesiones_usadas_lista: usedSessionDates,
          estado,
          estado_operativo: String(membership.status ?? 'active').toUpperCase(),
          fecha_de_saldo: completionDate,
          saldo,
          saldo_tipo,
          notas: membershipSessionNotes(weekSessions),
        });
      });
    });

  return applyMembershipComputedDeliveries(applyMembershipMaterialDeliveries(rows, materialDeliveries));
}

function materialDeliveryKey({ membershipId = null, userId = null, cycleNumber = null }) {
  return [
    membershipId ? String(membershipId) : 'legacy',
    userId ? String(userId) : '',
    Number(cycleNumber ?? 0),
  ].join('|');
}

function applyMembershipMaterialDeliveries(rows = [], materialDeliveries = []) {
  if (!rows.length || !materialDeliveries?.length) return rows;

  const deliveriesByKey = new Map();
  materialDeliveries.forEach((delivery) => {
    const cycleNumber = Number(delivery.cycle_number ?? delivery.cycleNumber ?? 0);
    if (!Number.isFinite(cycleNumber) || cycleNumber < 1) return;
    const key = materialDeliveryKey({
      membershipId: delivery.membership_id ?? null,
      userId: delivery.user_id,
      cycleNumber,
    });
    deliveriesByKey.set(key, delivery);
  });

  return rows.map((row) => {
    const weekNumber = Number(row.semana ?? 0);
    if (!Number.isFinite(weekNumber) || weekNumber < 1) return row;
    const cycleNumber = Math.floor((weekNumber - 1) / 4) + 1;
    const exactKey = materialDeliveryKey({
      membershipId: row.membership_id ?? null,
      userId: row.user_id,
      cycleNumber,
    });
    const legacyKey = materialDeliveryKey({
      membershipId: null,
      userId: row.user_id,
      cycleNumber,
    });
    const delivery = deliveriesByKey.get(exactKey) ?? deliveriesByKey.get(legacyKey);
    if (!delivery) return row;

    return {
      ...row,
      material_cycle_number: cycleNumber,
      material_delivered_at: delivery.delivered_at ? formatDateOnly(delivery.delivered_at) : null,
      material_delivery_notes: delivery.notes ?? '',
    };
  });
}

function formatMembershipRowBalance(row) {
  const saldo = Number(row?.saldo ?? 0);
  if (!row || row.saldo === null || row.saldo === undefined || saldo === 0) return '-';
  if (saldo < 0) {
    return row.saldo_tipo === 'pendiente'
      ? `Pendiente por pagar ${money(Math.abs(saldo))}`
      : `Adeudo ${money(Math.abs(saldo))}`;
  }
  const creditDate = formatDisplayDateOnly(row.fecha_de_credito);
  return creditDate && creditDate !== '-'
    ? `Crédito a favor ${money(saldo)} (${creditDate})`
    : `Crédito a favor ${money(saldo)}`;
}

function membershipCurrentCreditValue(rows = []) {
  const today = todayDateInputValue();
  if (rows.some((row) => row.saldo_tipo === 'adeudo')) return 0;
  return rows
    .filter((row) => row.saldo_tipo === 'credito' && compareDateOnly(row.fecha_esperada, today) > 0)
    .reduce((sum, row) => sum + Math.max(0, Number(row.saldo ?? 0)), 0);
}

function renderMembershipNotices(membershipRows = []) {
  if (!membershipRows.length) return '';

  const paidLateCount = membershipRows
    .filter((row) => row.estado === 'ATRASADO' && row.fecha_de_saldo)
    .length;
  const openBalance = membershipRows
    .filter((row) => row.saldo_tipo === 'adeudo' || row.saldo_tipo === 'pendiente')
    .reduce((sum, row) => sum + Math.min(0, Number(row.saldo ?? 0)), 0);
  const currentCredit = membershipCurrentCreditValue(membershipRows);
  const latestBalance = openBalance < 0 ? openBalance : currentCredit;
  const notices = [];

  if (paidLateCount > 0) {
    notices.push({
      tone: 'warning',
      text: `Tienes ${paidLateCount} sesiones saldadas CON ATRASO`,
    });
  }

  if (latestBalance < 0) {
    notices.push({
      tone: 'danger',
      text: `AVISO: Tu cuenta presenta un adeudo pendiente por un total de ${money(Math.abs(latestBalance))}. En caso de incumplimiento, Hidden Room podrá suspender o cancelar la membresía de acuerdo con los Términos y Condiciones aceptados durante su contratación. Consulta los TyC para conocer los detalles aplicables.`,
    });
  } else if (latestBalance > 0) {
    notices.push({
      tone: 'success',
      text: `Tienes un saldo a favor de ${money(latestBalance)}, ¡MUCHAS FELICIDADES!`,
    });
  } else {
    notices.push({
      tone: 'success',
      text: '¡FELICIDADES! Tu cuenta se encuentra al corriente. Eres acreedor a recompensas y dinámicas.',
    });
  }

  return `
    <div class="db-membership-notices" aria-live="polite">
      ${notices.map((notice) => `
        <p class="db-membership-notice db-membership-notice--${escapeAttr(notice.tone)}">${escapeHTML(notice.text)}</p>
      `).join('')}
    </div>
  `;
}

function membershipBalanceParts(rows = []) {
  const overdue = rows
    .filter((row) => row.saldo_tipo === 'adeudo')
    .reduce((sum, row) => sum + Math.min(0, Number(row.saldo ?? 0)), 0);
  const pending = rows
    .filter((row) => row.saldo_tipo === 'pendiente')
    .reduce((sum, row) => sum + Math.min(0, Number(row.saldo ?? 0)), 0);
  const credit = membershipCurrentCreditValue(rows);
  return { overdue, pending, credit };
}

function membershipOverdueBalanceSummary(rows = []) {
  const { overdue } = membershipBalanceParts(rows);
  if (overdue < 0) return money(Math.abs(overdue));
  return 'Sin saldo vencido';
}

function membershipCreditBalanceSummary(rows = []) {
  const { credit } = membershipBalanceParts(rows);
  return credit > 0 ? money(credit) : 'Sin saldo a favor';
}

function membershipPendingBalanceSummary(rows = []) {
  const { pending } = membershipBalanceParts(rows);
  return pending < 0 ? money(Math.abs(pending)) : 'Sin saldo pendiente';
}

function membershipSummaryTone(key, value) {
  const normalized = normalizeCatalogValue(value);
  if (key === 'credit-balance') return normalized === 'SIN SALDO A FAVOR' ? 'neutral' : 'success';
  if (key === 'status') {
    if (normalized.includes('CANCELADA POR INCUMPLIMIENTOS')) return 'danger';
    if (normalized === 'CON ADEUDO') return 'danger';
    if (normalized === 'ACTIVE') return 'success';
    if (normalized === 'PAUSED') return 'warning';
      if (normalized === 'CANCELLED' || normalized === 'EXPIRED') return 'danger';
  }
  if (key === 'overdue-balance') {
    if (normalized.includes('SIN SALDO')) return 'success';
    if (normalized.includes('CREDITO')) return 'success';
    return 'danger';
  }
  if (key === 'pending-balance') {
    return 'muted';
  }
  if (key === 'balance') {
    if (normalized.includes('ADEUDO') || normalized.includes('ATRASO')) return 'danger';
    if (normalized.includes('CREDITO') || normalized.includes('CORRIENTE')) return 'success';
  }
  if (key === 'expired') {
    return normalized.includes('SIN MEMBRESIAS VENCIDAS') ? 'success' : 'danger';
  }
  return 'neutral';
}

function membershipDisplayStatus(rows = []) {
  const latest = rows
    .slice()
    .sort((a, b) => compareDateOnly(a.fecha_esperada, b.fecha_esperada))
    .at(-1);
  if (!latest) return '-';

  const normalizedStatus = normalizeCatalogValue(latest.estado_operativo);
  const statusLabel = rows.some(rowHasOpenMembershipDebt)
    ? 'CON ADEUDO'
    : latest.estado_operativo || '-';

  if (!['CANCELLED', 'CANCELADA'].includes(normalizedStatus)) return statusLabel;
  if (['CANCELLED', 'CANCELADA'].includes(normalizeCatalogValue(statusLabel))) {
    return 'CANCELADA POR INCUMPLIMIENTOS';
  }
  return 'CANCELADA POR INCUMPLIMIENTOS - ' + statusLabel;
}

function monthLabel(monthKey) {
  if (!monthKey) return '-';
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return String(monthKey);
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function endOfNextMonth(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const date = new Date(year, month + 1, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function membershipRowIsLate(row) {
  const estado = normalizeCatalogValue(row?.estado);
  const saldoTipo = normalizeCatalogValue(row?.saldo_tipo);
  const balanceDate = formatDateOnly(row?.fecha_de_saldo);
  const cutoffDate = formatDateOnly(row?.week_end);
  return estado.includes('ATRASADO')
    || saldoTipo === 'ADEUDO'
    || (balanceDate && balanceDate !== '-' && cutoffDate && cutoffDate !== '-' && compareDateOnly(balanceDate, cutoffDate) > 0);
}

function rowHasOpenMembershipDebt(row) {
  return normalizeCatalogValue(row?.saldo_tipo) === 'ADEUDO' || (membershipRowIsLate(row) && !row?.fecha_de_saldo);
}

function membershipCurrentOverdueValue(rows = []) {
  return rows
    .filter((row) => row.saldo_tipo === 'adeudo')
    .reduce((sum, row) => sum + Math.min(0, Number(row.saldo ?? 0)), 0);
}

function membershipIsActiveAndCurrent(rows = []) {
  const latest = rows
    .slice()
    .sort((a, b) => compareDateOnly(a.fecha_esperada, b.fecha_esperada))
    .at(-1);
  return latest?.estado_operativo === 'ACTIVE' && !rows.some(rowHasOpenMembershipDebt);
}

function membershipDeliveryDelayCutoffs(rows = []) {
  return rows
    .filter((row) => membershipRowIsLate(row))
    .map((row) => ({
      week: Number(row.semana ?? 0),
      cutoff: formatDateOnly(row.week_end),
      isOpen: normalizeCatalogValue(row.saldo_tipo) === 'ADEUDO',
    }))
    .filter((item) => Number.isFinite(item.week) && item.week > 0 && item.cutoff && item.cutoff !== '-')
    .sort((a, b) => compareDateOnly(a.cutoff, b.cutoff) || a.week - b.week);
}

function resolveMembershipEstimatedDelivery(deliveryBase, cutoffs = [], options = {}) {
  let estimatedDelivery = deliveryBase;
  const appliedCutoffs = [];
  const afterDate = options.afterDate ? formatDateOnly(options.afterDate) : null;

  if (!estimatedDelivery) return { estimatedDelivery: null, appliedCutoffs };

  let changed = true;
  while (changed) {
    changed = false;
    for (const cutoff of cutoffs) {
      if (afterDate && compareDateOnly(cutoff.cutoff, afterDate) <= 0) continue;
      if (appliedCutoffs.some((item) => `${item.week}|${item.cutoff}` === `${cutoff.week}|${cutoff.cutoff}`)) continue;
      if (compareDateOnly(cutoff.cutoff, estimatedDelivery) < 0) {
        appliedCutoffs.push(cutoff);
        estimatedDelivery = addDaysToDateOnly(estimatedDelivery, 7);
        changed = true;
        break;
      }
    }
  }

  return { estimatedDelivery, appliedCutoffs };
}

function membershipMaterialDeliveries(rows = []) {
  const sortedRows = rows
    .slice()
    .sort((a, b) => Number(a.semana ?? 0) - Number(b.semana ?? 0));
  const cycles = new Map();
  const today = todayDateInputValue();
  const latest = sortedRows[sortedRows.length - 1] ?? {};
  const membershipActive = latest.estado_operativo === 'ACTIVE';

  sortedRows.forEach((row) => {
    const weekNumber = Number(row.semana ?? 0);
    if (!Number.isFinite(weekNumber) || weekNumber < 1) return;
    const cycleNumber = Math.floor((weekNumber - 1) / 4) + 1;
    const current = cycles.get(cycleNumber) ?? {
      cycleNumber,
      rows: [],
      sessionDates: new Set(),
    };

    current.rows.push(row);
    (Array.isArray(row.sesiones_usadas_lista) ? row.sesiones_usadas_lista : []).forEach((date) => {
      current.sessionDates.add(formatDateOnly(date));
    });
    cycles.set(cycleNumber, current);
  });

  let accumulatedDeliveryDelayWeeks = 0;
  let accumulatedOpenOverdueWeeks = 0;

  return [...cycles.values()]
    .sort((a, b) => a.cycleNumber - b.cycleNumber)
    .map((cycle) => {
      const rowList = cycle.rows.sort((a, b) => Number(a.semana ?? 0) - Number(b.semana ?? 0));
      const firstWeek = (cycle.cycleNumber - 1) * 4 + 1;
      const lastWeek = firstWeek + 3;
      const periodStart = rowList[0]?.fecha_esperada ?? null;
      const periodEnd = periodStart ? addDaysToDateOnly(periodStart, 27) : null;
      const deliveryBase = periodEnd ? addDaysToDateOnly(periodEnd, 28) : null;
      const cycleDelayCutoffs = membershipDeliveryDelayCutoffs(rowList);
      const cycleDelayWeeks = cycleDelayCutoffs.length;
      accumulatedDeliveryDelayWeeks = cycleDelayWeeks > 0 ? accumulatedDeliveryDelayWeeks + cycleDelayWeeks : 0;
      const delayCutoffs = cycleDelayCutoffs;
      const lateWeeks = delayCutoffs.filter((item) => !item.isOpen).length;
      const overdueWeeks = delayCutoffs.filter((item) => item.isOpen).length;
      accumulatedOpenOverdueWeeks = overdueWeeks > 0 ? accumulatedOpenOverdueWeeks + overdueWeeks : 0;
      const currentPendingWeeks = rowList.filter((row) => row.saldo_tipo === 'pendiente').length;
      const deliveryDelayWeeks = accumulatedDeliveryDelayWeeks;
      const estimatedDelivery = deliveryBase ? addDaysToDateOnly(deliveryBase, deliveryDelayWeeks * 7) : null;
      const deliveredRow = rowList.find((row) => row.material_delivered_at);
      const deliveredAt = deliveredRow?.material_delivered_at ?? null;
      const deliveryNotes = deliveredRow?.material_delivery_notes ?? null;
      let status = 'PROGRAMADA';
      let reason = 'Entrega programada según regla contractual';

      if (deliveredAt) {
        status = 'ENTREGADA';
        reason = deliveryNotes || `Material entregado el ${formatDisplayDateOnly(deliveredAt)}`;
      } else if (accumulatedOpenOverdueWeeks > 0) {
        status = 'BLOQUEADA POR ADEUDO';
        reason = overdueWeeks > 0
          ? `${overdueWeeks} semana${overdueWeeks === 1 ? '' : 's'} vencida${overdueWeeks === 1 ? '' : 's'} sin pagar`
          : 'Existe saldo vencido de un ciclo anterior';
      } else if (!membershipActive) {
        status = 'BLOQUEADA POR MEMBRESÍA INACTIVA';
        reason = `Membresía ${latest.estado_operativo || '-'}`;
      } else if (deliveryDelayWeeks > 0 && compareDateOnly(today, estimatedDelivery) < 0) {
        status = 'DIFERIDA POR ATRASO';
        reason = `${deliveryDelayWeeks} semana${deliveryDelayWeeks === 1 ? '' : 's'} de atraso acumulado`;
      } else if (deliveryDelayWeeks === 0 && compareDateOnly(today, deliveryBase) < 0) {
        status = 'PROGRAMADA';
        reason = 'Sin atrasos; entrega programada al cierre del siguiente ciclo';
      } else {
        status = 'DISPONIBLE';
        reason = deliveryDelayWeeks > 0
          ? `${deliveryDelayWeeks} semana${deliveryDelayWeeks === 1 ? '' : 's'} de atraso acumulado aplicada${deliveryDelayWeeks === 1 ? '' : 's'}`
          : 'Fecha de entrega alcanzada';
      }

      return {
        cycle: `Mes ${cycle.cycleNumber}`,
        firstWeek,
        lastWeek,
        includedWeeks: `Semana ${firstWeek} a Semana ${lastWeek}`,
        workedPeriod: `${formatDisplayDateOnly(periodStart)} a ${formatDisplayDateOnly(periodEnd)}`,
        deliveryBase,
        lateWeeks,
        deliveryDelayWeeks,
        delayApplied: deliveryDelayWeeks ? `${deliveryDelayWeeks} semana${deliveryDelayWeeks === 1 ? '' : 's'}` : 'Sin atraso',
        estimatedDelivery,
        deliveredAt,
        deliveryNotes,
        overdueWeeks,
        currentPendingWeeks,
        status,
        sessionDates: [...cycle.sessionDates].sort(compareDateOnly),
        reason,
      };
    });
}

function membershipDeliveryByWeek(rows = []) {
  const deliveries = membershipMaterialDeliveries(rows);
  const byWeek = new Map();

  deliveries.forEach((delivery) => {
    for (let week = delivery.firstWeek; week <= delivery.lastWeek; week += 1) {
      byWeek.set(week, delivery);
    }
  });

  return byWeek;
}

function applyMembershipComputedDeliveries(rows = []) {
  if (!rows.length) return rows;
  const deliveryByWeek = membershipDeliveryByWeek(rows);

  return rows.map((row) => {
    const delivery = deliveryByWeek.get(Number(row.semana ?? 0));
    if (!delivery) return row;
    return {
      ...row,
      material_estimated_delivery: delivery.estimatedDelivery,
      material_delivery_base: delivery.deliveryBase,
      material_delivery_delay_weeks: delivery.deliveryDelayWeeks,
      material_delivery_delay_label: delivery.delayApplied,
      material_delivery_status: delivery.status,
      material_delivery_reason: delivery.reason,
    };
  });
}

function membershipHasCancelledStatus(rows = []) {
  const latest = rows
    .slice()
    .sort((a, b) => compareDateOnly(a.fecha_esperada, b.fecha_esperada))
    .at(-1);
  const normalized = normalizeCatalogValue(latest?.estado_operativo);
  return ['CANCELLED', 'CANCELADA'].includes(normalized)
    || normalized.includes('CANCELADA POR INCUMPLIMIENTOS');
}

function nextMembershipDeliveryText(rows = []) {
  if (membershipHasCancelledStatus(rows)) return 'SIN PR\u00D3XIMA ENTREGA POR MEMBRES\u00CDA CANCELADA';
  const deliveries = membershipMaterialDeliveries(rows);
  if (!deliveries.length) return 'Sin material trabajado';
  const nextDelivery = deliveries.find((item) => item.status !== 'ENTREGADA');
  if (!nextDelivery) return 'Sin próxima entrega';
  return `${formatDisplayDateOnly(nextDelivery.estimatedDelivery)} · ${nextDelivery.status}`;
}

function renderMembershipSummary(rows = []) {
  if (!rows.length) return '';

  const today = todayDateInputValue();
  const sortedAsc = rows
    .slice()
    .sort((a, b) => compareDateOnly(a.fecha_esperada, b.fecha_esperada));
  const latest = sortedAsc[sortedAsc.length - 1] ?? {};
  const upcoming = sortedAsc.find((row) => compareDateOnly(row.fecha_de_sesion || row.fecha_esperada, today) >= 0);
  const expiredMemberships = new Map();

  rows.forEach((row) => {
    if (row.estado_operativo !== 'EXPIRED') return;
    const membershipId = row.membership_id ?? `${row.user_id}-${row.fecha_esperada}`;
    if (expiredMemberships.has(membershipId)) return;
    expiredMemberships.set(membershipId, {
      start: row.membership_start_date || row.fecha_esperada,
      end: row.membership_end_date || row.fecha_esperada,
    });
  });

  const expiredText = expiredMemberships.size
    ? [...expiredMemberships.values()]
      .map((item) => `${formatDisplayDateOnly(item.start)} a ${formatDisplayDateOnly(item.end)}`)
      .join(', ')
    : 'Sin membresías vencidas';

  const items = [
    { key: 'status', label: 'ESTADO DE MEMBRESÍA:', value: membershipDisplayStatus(rows) },
    { key: 'overdue-balance', label: 'SALDO VENCIDO:', value: membershipOverdueBalanceSummary(rows) },
    { key: 'pending-balance', label: 'SALDO PENDIENTE:', value: membershipPendingBalanceSummary(rows) },
    { key: 'credit-balance', label: 'SALDO A FAVOR:', value: membershipCreditBalanceSummary(rows) },
    { key: 'next-session', label: 'PRÓXIMA SESIÓN:', value: upcoming ? formatDisplayDateOnly(upcoming.fecha_de_sesion || upcoming.fecha_esperada) : 'Sin próxima sesión' },
    { key: 'next-delivery', label: 'PRÓXIMA ENTREGA:', value: nextMembershipDeliveryText(rows) },
    { key: 'expired', label: 'MEMBRESÍAS VENCIDAS:', value: expiredText },
  ];

  return `
    <div class="db-membership-summary" aria-label="Resumen de membresía">
      ${items.map((item) => `
        <div class="db-membership-summary__item db-membership-summary__item--${escapeAttr(membershipSummaryTone(item.key, item.value))}">
          <span>${escapeHTML(item.label)}</span>
          <strong>${escapeHTML(item.value)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function membershipIsCurrentlyActive(memberships = [], today = todayDateInputValue()) {
  return memberships.some((membership) => {
    const status = normalizeCatalogValue(membership?.status);
    if (!['ACTIVE', 'ACTIVA'].includes(status)) return false;

    const startDate = formatDateOnly(membership?.start_date);
    const endDate = membership?.end_date ? formatDateOnly(membership.end_date) : null;
    return (!startDate || startDate === '-' || compareDateOnly(startDate, today) <= 0)
      && (!endDate || endDate === '-' || compareDateOnly(endDate, today) >= 0);
  });
}

function renderMembershipSyncFooter(hasActiveMembership = true) {
  if (!hasActiveMembership) {
    const candidateMessage = 'Hola, quiero saber si soy candidato para una membresía en Hidden Room.';
    return `
      <div class="db-membership-sync db-membership-sync--candidate">
        <p><strong>Ahorra dinero con tu MEMBRESÍA.</strong><br>En vez de pagar por unas cuantas horas de sesión, reserva tiempo semanal en el estudio y trabaja cada canción con la calidad y el cuidado que merece.</p>
        <a class="btn-primary db-membership-sync__button" href="${escapeAttr(buildWhatsAppLink(MEMBERSHIP_SUPPORT_WHATSAPP, candidateMessage))}" target="_blank" rel="noopener noreferrer">conoce si eres candidato</a>
      </div>
    `;
  }

  const message = 'Hola, quiero reportar o aclarar información de mi dashboard de membresía en Mysauth OS.';
  return `
    <div class="db-membership-sync">
      <p>Sincronizado desde Mysauth OS. ¿Crees que hay un error? Contáctanos para reportarlo, solicitar aclaraciones o actualización de datos.</p>
      <a class="db-btn-secondary db-membership-sync__button" href="${escapeAttr(buildWhatsAppLink(MEMBERSHIP_SUPPORT_WHATSAPP, message))}" target="_blank" rel="noopener noreferrer">Mensaje por WhatsApp</a>
    </div>
  `;
}

function normalizeTransactionType(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (['INCOME', 'INGRESO', 'INGRESOS'].includes(raw)) return 'INGRESO';
  if (['EXPENSE', 'EGRESO', 'EGRESOS'].includes(raw)) return 'EGRESO';
  return raw;
}

function transactionAmount(tx) {
  return Number(tx?.amount || 0);
}

function eventFinanceAmount(tx) {
  return Number(tx?.hidden_room_share ?? tx?.['M.A.I.'] ?? tx?.['M.A.I'] ?? tx?.MAI ?? tx?.mai ?? 0);
}

function movementTypeConfig(value) {
  return EVENT_MOVEMENT_TYPES.find((item) => item.value === value) ?? EVENT_MOVEMENT_TYPES[0];
}

function movementTypeLabel(value) {
  return EVENT_MOVEMENT_TYPES.find((item) => item.value === value)?.label ?? '';
}

function financeTotals(transactions, amountGetter = transactionAmount, options = {}) {
  const ingresos = sumTransactions(transactions, 'INGRESO', amountGetter);
  const egresos = sumTransactions(transactions, 'EGRESO', amountGetter);
  const hasExplicitIncomeExpense = transactions.some((tx) => {
    const type = normalizeTransactionType(tx.type);
    return type === 'INGRESO' || type === 'EGRESO';
  });
  const fallbackBalance = options.balanceFromAmountWhenNoIncomeExpense && !hasExplicitIncomeExpense
    ? transactions.reduce((sum, tx) => sum + amountGetter(tx), 0)
    : null;

  return {
    ingresos,
    egresos,
    hasExplicitIncomeExpense,
    balance: fallbackBalance ?? ingresos - egresos,
  };
}

function sumTransactions(transactions, type, amountGetter = transactionAmount) {
  return transactions
    .filter((tx) => normalizeTransactionType(tx.type) === type)
    .reduce((sum, tx) => sum + amountGetter(tx), 0);
}

function topClients(transactions, amountGetter = transactionAmount) {
  const totals = new Map();
  transactions
    .filter((tx) => normalizeTransactionType(tx.type) === 'INGRESO')
    .forEach((tx) => {
      const key = clientLabelForTransaction(tx);
      totals.set(key, (totals.get(key) || 0) + amountGetter(tx));
    });

  return [...totals.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

function transactionTypeLabel(value) {
  const type = normalizeTransactionType(value);
  if (type === 'INGRESO') return 'Ingreso';
  if (type === 'EGRESO') return 'Egreso';
  return 'Sin tipo';
}

function transactionStatusLabel(transaction) {
  const status = String(transaction?.status ?? '').trim();
  if (status) return status;
  return 'Registrado';
}

function clientLabelForTransaction(transaction) {
  const user = (state.data.users ?? []).find((item) => String(item.user_id) === String(transaction?.user_id));
  if (user?.display_name) return user.display_name;
  if (user?.username && !isTechnicalClientLabel(user.username)) return `@${user.username}`;
  if (transaction?.username && !isTechnicalClientLabel(transaction.username)) return `@${transaction.username}`;
  return 'Cliente sin nombre';
}

function isTechnicalClientLabel(value) {
  return /^(user|usuario|client|cliente)[_-][a-z0-9-]+$/i.test(String(value ?? '').trim());
}

function renderStatCard(label, value) {
  return `
    <article class="db-card hr-card db-stat-card">
      <div class="db-card__inner">
        <span class="section-label">${escapeHTML(label)}</span>
        <strong>${escapeHTML(value)}</strong>
      </div>
    </article>
  `;
}

function renderServerStatusCard(label, value) {
  return `
    <article class="db-card hr-card db-card--server-status">
      <div class="db-card__inner">
        <span class="section-label">${escapeHTML(label)}</span>
        <strong>${escapeHTML(value ?? '-')}</strong>
      </div>
    </article>
  `;
}

function renderServerMetricCard(label, valueLabel, value, history, unit = '%', options = {}) {
  const numeric = numberOrNull(value);
  const max = Number(options.max || 100);
  const percent = numeric === null ? null : Math.max(0, Math.min(100, (numeric / max) * 100));
  const tone = metricTone(label, numeric);
  const chart = options.chart === 'line'
    ? renderServerSparkline(history, unit, max)
    : renderServerPieChart(percent, label, tone);
  return `
    <article class="db-card hr-card db-card--server-metric db-card--server-metric-${tone}">
      <div class="db-card__inner">
        <div class="db-server-metric__head">
          <span class="section-label">${escapeHTML(label)}</span>
          <strong>${escapeHTML(valueLabel ?? '-')}</strong>
        </div>
        ${chart}
      </div>
    </article>
  `;
}

function renderServerPieChart(percent, label, tone) {
  const value = percent === null ? 0 : Number(percent.toFixed(1));
  const angle = Math.max(0, Math.min(360, value * 3.6));
  const display = percent === null ? 'Sin dato' : `${Math.round(value)}%`;
  return `
    <div class="db-server-pie db-server-pie--${escapeAttr(tone)}" style="--server-pie-angle:${escapeAttr(`${angle.toFixed(1)}deg`)};" aria-label="${escapeAttr(`${label}: ${display}`)}">
      <span>${escapeHTML(display)}</span>
    </div>
  `;
}

function renderServerSparkline(history, unit = '%', max = 100) {
  const values = (history ?? []).map(numberOrNull).filter((value) => value !== null).slice(-30);
  if (!values.length) return '<div class="db-server-sparkline db-server-sparkline--empty">Sin datos</div>';
  const width = 120;
  const height = 34;
  const chartValues = values.length === 1 ? [values[0], values[0]] : values;
  const points = chartValues.map((value, index) => {
    const x = (index / (chartValues.length - 1)) * width;
    const normalized = Math.max(0, Math.min(1, value / max));
    const y = height - normalized * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const latest = values[values.length - 1];
  const latestLabel = unit === 'C' ? `${latest.toFixed(1)} C` : `${Math.round(latest)}%`;
  return `
    <div class="db-server-sparkline" aria-label="Historial: ${escapeAttr(latestLabel)}">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" focusable="false" aria-hidden="true">
        <polyline points="${points}" />
      </svg>
      <span>${escapeHTML(latestLabel)}</span>
    </div>
  `;
}

function metricTone(label, value) {
  if (value === null) return 'neutral';
  if (label === 'Temperatura') {
    if (value >= 80) return 'danger';
    if (value >= 65) return 'warning';
    return 'ok';
  }
  if (value >= 90) return 'danger';
  if (value >= 75) return 'warning';
  return 'ok';
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentDisplay(value) {
  return value === null ? 'No disponible' : `${Math.round(value)}%`;
}

function appendServerStatusSample(serverStatus) {
  const sample = {
    at: Date.now(),
    cpu: numberOrNull(serverStatus.cpuPercent),
    ram: numberOrNull(serverStatus.memory?.percent ?? serverStatus.memoryPercent),
    disk: numberOrNull(serverStatus.diskUsage?.percent ?? serverStatus.diskPercent),
    temperature: numberOrNull(serverStatus.temperatureCelsius),
  };
  const samples = Array.isArray(state.data.serverStatusSamples) ? state.data.serverStatusSamples : [];
  state.data.serverStatusSamples = [...samples, sample].filter((item) => Date.now() - item.at < 30 * 60 * 1000).slice(-30);
  return state.data.serverStatusSamples;
}

async function fetchServerStatus() {
  const cache = state.data.serverStatus;
  const cacheAgeMs = 10_000;
  if (cache && Date.now() - cache.fetchedAt < cacheAgeMs) {
    return cache;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Sesion de Supabase no disponible');
  }

  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  const cloudStatusSource = {
    label: 'mysauth-cloud',
    url: `${CLOUD_HIDDENROOM_URL.replace(/\/$/, '')}/api/server-status`,
  };
  const supabaseStatusSource = {
    label: 'supabase-fallback',
    url: `${CLOUD_FUNCTION_BASE}/server-status`,
  };
  const statusSources = [
    cloudStatusSource,
    supabaseStatusSource,
  ];
  let payload = null;
  let sourceLabel = '';
  let lastError = null;

  for (const source of statusSources) {
    try {
      const response = await fetch(source.url, { method: 'GET', headers });
      const responsePayload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = responsePayload?.error || `No se pudo obtener el estado del servidor (${response.status})`;
        if (response.status === 401 || response.status === 403) throw new Error(message);
        lastError = new Error(message);
        continue;
      }
      payload = responsePayload;
      sourceLabel = source.label;
      break;
    } catch (err) {
      lastError = err;
      if (source.label !== 'mysauth-cloud') throw err;
    }
  }

  if (!payload) {
    throw lastError || new Error('No se pudo obtener el estado del servidor.');
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Respuesta invalida de estado de servidor');
  }

  const serverStatus = {
    online: Boolean(payload.online),
    hostname: payload.hostname ?? payload.host ?? null,
    tailscaleIp: payload.tailscale_ip ?? payload.tailscaleIp ?? payload.tailscale ?? null,
    uptime: payload.uptime ?? payload.uptime_human ?? null,
    uptimeSeconds: payload.uptimeSeconds ?? payload.uptime_seconds ?? null,
    platform: payload.platform ?? null,
    checkedAt: payload.checkedAt ?? payload.checked_at ?? new Date().toISOString(),
    cpu: payload.cpu ?? payload.cpu_status ?? null,
    cpuPercent: payload.cpuPercent ?? payload.cpu_percent ?? null,
    loadAverage: payload.loadAverage ?? payload.load_average ?? null,
    cores: payload.cores ?? null,
    ram: payload.ram ?? payload.memory_label ?? null,
    memory: payload.memory ?? null,
    disk: payload.disk ?? payload.storage ?? null,
    diskUsage: payload.diskUsage ?? payload.disk_usage ?? null,
    temperature: payload.temperature ?? payload.temp ?? null,
    temperatureCelsius: payload.temperatureCelsius ?? payload.temperature_celsius ?? null,
    source: payload.source ?? sourceLabel,
    fetchedAt: Date.now(),
  };
  const remoteSamples = Array.isArray(payload.samples)
    ? payload.samples.map((sample) => ({
      at: sample.at ?? sample.checkedAt ?? sample.checked_at ?? Date.now(),
      cpu: numberOrNull(sample.cpu ?? sample.cpuPercent ?? sample.cpu_percent),
      ram: numberOrNull(sample.ram ?? sample.memoryPercent ?? sample.memory_percent ?? sample.ramPercent ?? sample.ram_percent),
      disk: numberOrNull(sample.disk ?? sample.diskPercent ?? sample.disk_percent),
      temperature: numberOrNull(sample.temperature ?? sample.temperatureCelsius ?? sample.temperature_celsius),
    })).filter((sample) => sample.cpu !== null || sample.ram !== null || sample.disk !== null || sample.temperature !== null).slice(-50)
    : [];
  if (remoteSamples.length) {
    state.data.serverStatusSamples = remoteSamples;
    serverStatus.samples = remoteSamples;
  } else {
    serverStatus.samples = appendServerStatusSample(serverStatus);
  }

  state.data.serverStatus = serverStatus;
  return serverStatus;
}

function eventLabel(event) {
  const name = event.name ?? `Evento ${event.id}`;
  const date = event.event_date ?? event.date;
  return date ? `${name} · ${formatDisplayDateOnly(date)}` : name;
}

async function fetchEventFinanceOptions(context = 'finance') {
  return fetchAdminEventFinanceOptions(context);
}

function isMissingSupabaseRelationError(error) {
  const text = String([
    error?.code,
    error?.status,
    error?.message,
    error?.details,
  ].filter(Boolean).join(' ')).toLowerCase();
  return text.includes('404')
    || text.includes('42p01')
    || text.includes('pgrst205')
    || text.includes('could not find')
    || text.includes('does not exist');
}

async function fetchScrumEvents() {
  const direct = await supabase
    .from('hr_scrum_events')
    .select('id, event_key, name, event_date, status, can_view_scrum, can_edit_scrum')
    .order('event_date', { ascending: false });

  if (!direct.error) return direct;
  if (!isMissingSupabaseRelationError(direct.error)) return direct;

  console.info('[HR] hr_scrum_events unavailable; using event permission fallback until migrations are applied.');

  if (hasRole('admin')) {
    const adminEvents = await supabase
      .from('events')
      .select('id, event_key, name, event_date, status')
      .order('event_date', { ascending: false });

    return {
      data: (adminEvents.data ?? []).map((event) => ({
        ...event,
        can_view_scrum: true,
        can_edit_scrum: true,
      })),
      error: adminEvents.error,
    };
  }

  if (!state.user?.user_id) return { data: [], error: null };

  const assigned = await supabase
    .from('event_user_permissions')
    .select('event_id, can_view_scrum, can_edit_scrum, events:event_id(id, event_key, name, event_date, status)')
    .eq('user_id', state.user.user_id)
    .or('can_view_scrum.eq.true,can_edit_scrum.eq.true');

  if (assigned.error) return { data: null, error: assigned.error };

  return {
    data: (assigned.data ?? [])
      .map((permission) => ({
        ...(permission.events ?? {}),
        id: permission.events?.id ?? permission.event_id,
        can_view_scrum: permission.can_view_scrum,
        can_edit_scrum: permission.can_edit_scrum,
      }))
      .filter((event) => event.id),
    error: null,
  };
}

async function fetchAdminEventFinanceOptions(context = 'finance') {
  try {
    const { data, error } = await supabase
      .from('hr_events_dashboard')
      .select('*')
      .order('event_date', { ascending: false });

    if (error) {
      console.info(`[HR] ${context} events unavailable:`, error.message);
      return [];
    }

    return normalizeEventFinanceOptions(data ?? []);
  } catch (err) {
    console.info(`[HR] ${context} events skipped:`, err?.message ?? err);
    return [];
  }
}

async function fetchAccessibleEventFinanceOptions(context = 'finance') {
  if (hasRole('admin')) return fetchAdminEventFinanceOptions(context);
  if (!state.user?.user_id) return [];

  try {
    const { data, error } = await supabase
      .from('hr_events_user_access')
      .select('*')
      .eq('user_id', state.user.user_id)
      .order('event_date', { ascending: false });

    if (error) {
      console.info(`[HR] ${context} assigned events unavailable:`, error.message);
      return [];
    }

    return normalizeEventFinanceOptions(data ?? []);
  } catch (err) {
    console.info(`[HR] ${context} assigned events skipped:`, err?.message ?? err);
    return [];
  }
}

async function fetchAllEventParticipants() {
  if (Array.isArray(state.data.eventParticipantsAll)) return state.data.eventParticipantsAll;

  const { data, error } = await supabase
    .from('participants')
    .select('id, user_id, role, status, notes')
    .eq('status', 'active')
    .order('user_id', { ascending: true });

  if (error) {
    console.info('[HR] participants unavailable:', error.message);
    state.data.eventParticipantsAll = [];
    return [];
  }

  state.data.eventParticipantsAll = data ?? [];
  return state.data.eventParticipantsAll;
}

async function fetchParticipantsForEvent(eventId) {
  return fetchAllEventParticipants();
}

function normalizeEventFinanceOptions(events = []) {
  const seen = new Set();
  return (events ?? [])
    .map((event) => ({
      ...event,
      id: event?.id ?? event?.event_id ?? null,
      event_id: event?.event_id ?? event?.id ?? null,
      name: String(event?.name ?? event?.event_key ?? '').trim(),
      event_key: String(event?.event_key ?? '').trim(),
    }))
    .filter((event) => {
      const key = String(event.id ?? event.event_id ?? event.event_key ?? '').trim();
      return key && !seen.has(key) && seen.add(key);
    })
    .sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? '') || a.name.localeCompare(b.name, 'es'));
}

function scrumEventForId(eventId) {
  return (state.data.scrumEvents ?? [])
    .find((event) => String(event.id ?? event.event_id) === String(eventId));
}

function canEditScrumEventId(eventId) {
  return canEditScrum(scrumEventForId(eventId));
}

function hasEventKeyCache(events) {
  return Array.isArray(events)
    && events.length > 0
    && events.every((event) => Object.prototype.hasOwnProperty.call(event, 'event_key'));
}

async function fetchPartnerContractsForCurrentUser() {
  const userId = state.user?.user_id;
  const first = await supabase
    .from('partner_contracts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!first.error) return first;

  return supabase
    .from('partner_contracts')
    .select('*')
    .eq('collaborator_id', userId)
    .order('created_at', { ascending: false });
}

async function insertRow(table, payload, successMessage, options = {}) {
  const request = options.returning
    ? supabase.from(table).insert(payload).select(options.returning).maybeSingle()
    : supabase.from(table).insert(payload);
  const { data, error } = await request;
  if (error) {
    console.error(`[HR] ${table} insert:`, error);
    showToast('No se pudo guardar. Revisa permisos/RLS.', 'error');
    return { ok: false, data: null };
  }

  showToast(successMessage, 'success');
  return { ok: true, data };
}

async function handleTaskCreate(form) {
  const payload = formValues(form);
  if (!canEditScrumEventId(payload.event_id)) return showToast('No tienes permiso para editar SCRUM en este evento.', 'error');
  payload.created_by = state.user?.user_id ?? null;
  if (payload.due_date) payload.due_date = formatDateOnly(payload.due_date);

  const result = await insertRow('tasks', payload, 'Tarea creada.');
  if (result.ok) {
    form.reset();
    navigate(state.activeSection || 'collab-tasks');
  }
}

async function handleTaskUpdate(form) {
  const { id, ...payload } = formValues(form);
  if (!canEditScrumEventId(payload.event_id)) return showToast('No tienes permiso para editar SCRUM en este evento.', 'error');
  payload.updated_at = new Date().toISOString();
  if (payload.due_date) payload.due_date = formatDateOnly(payload.due_date);

  const { error } = await supabase.from('tasks').update(payload).eq('id', id);
  if (error) {
    console.error('[HR] task update:', error);
    showToast('No se pudo actualizar la tarea.', 'error');
    return;
  }

  showToast('Tarea actualizada.', 'success');
  navigate(state.activeSection || 'collab-tasks');
}

async function handleTaskStatus(taskId, status) {
  const task = (state.data.tasks ?? []).find((item) => String(item.id) === String(taskId));
  if (!canEditScrumEventId(task?.event_id)) return showToast('No tienes permiso para editar SCRUM en este evento.', 'error');
  const { error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) {
    console.error('[HR] task status:', error);
    showToast('No se pudo mover la tarea.', 'error');
    return;
  }

  navigate(state.activeSection || 'collab-tasks');
}

async function handleTaskDelete(taskId) {
  const task = (state.data.tasks ?? []).find((item) => String(item.id) === String(taskId));
  if (!canEditScrumEventId(task?.event_id)) return showToast('No tienes permiso para editar SCRUM en este evento.', 'error');
  if (!window.confirm('Borrar esta tarea?')) return;

  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) {
    console.error('[HR] task delete:', error);
    showToast('No se pudo borrar la tarea.', 'error');
    return;
  }

  showToast('Tarea borrada.', 'success');
  navigate(state.activeSection || 'collab-tasks');
}

async function prepareDownloadValues(form, values) {
  const sourceType = String(values.source_type || 'link');
  const releaseMode = String(values.release_mode || 'immediate');
  values.release_mode = releaseMode === 'membership_delivery' ? 'membership_delivery' : 'immediate';

  if (values.release_mode === 'membership_delivery') {
    const membershipId = String(values.membership_id ?? '').trim();
    const cycleNumber = Number(values.membership_cycle_number ?? 0);
    if (!membershipId) {
      showToast('Selecciona la membresía correspondiente a esta descarga.', 'error');
      return false;
    }
    if (!Number.isFinite(cycleNumber) || cycleNumber < 1) {
      showToast('Selecciona el ciclo de entrega.', 'error');
      return false;
    }

    let membership = (state.data.membershipOpsOptions ?? [])
      .find((item) => String(item.id) === membershipId);
    if (!membership) {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, user_id')
        .eq('id', membershipId)
        .maybeSingle();
      if (error || !data) {
        console.error('[HR] download membership lookup:', error);
        showToast('No se pudo validar la membresía seleccionada.', 'error');
        return false;
      }
      membership = data;
    }

    const { data: delivery, error: deliveryError } = await supabase
      .from('membership_material_deliveries')
      .select('id')
      .eq('membership_id', membershipId)
      .eq('user_id', membership.user_id)
      .eq('cycle_number', cycleNumber)
      .maybeSingle();

    if (deliveryError) {
      console.error('[HR] download delivery lookup:', deliveryError);
      showToast('No se pudo validar el entregable de membresía.', 'error');
      return false;
    }

    values.user_id = membership.user_id;
    values.membership_id = membershipId;
    values.membership_cycle_number = cycleNumber;
    values.membership_delivery_id = delivery?.id ?? null;
  } else {
    values.membership_id = null;
    values.membership_delivery_id = null;
    values.membership_cycle_number = null;
  }

  if (sourceType === 'file') {
    const source = form.__hrCloudSource || null;
    const localFolderFiles = selectedDownloadFolderFiles(form);
    const localFolderName = selectedDownloadFolderName(localFolderFiles);
    const file = form.querySelector('[data-download-file]')?.files?.[0] || form.__hrCloudFile || null;
    if (!file && !source && !localFolderFiles.length) {
      showToast('Selecciona un archivo o carpeta para subir a Cloud.', 'error');
      return false;
    }
    if (file && (!Number.isFinite(file.size) || file.size <= 0)) {
      showToast('El archivo esta vacio. Vuelve a exportarlo o elige otro archivo.', 'error');
      return false;
    }
    const userId = String(values.user_id ?? '').trim();
    if (!userId) {
      showToast('Selecciona un usuario valido.', 'error');
      return false;
    }
    const targetRoot = getUserDownloadCloudPath(userId);
    if (!targetRoot) {
      showToast("El usuario no tiene user_id operativo asignado.", "error");
      return false;
    }
    if (source?.kind === 'file') {
      let existingTargetFile = null;
      try {
        const targetListing = await listCloudFiles(targetRoot);
        existingTargetFile = targetListing.files.find((item) => item.name === source.name) || null;
      } catch (error) {
        console.info('[HR] existing Cloud target lookup:', error?.message ?? error);
      }

      if (existingTargetFile) {
        const sourceSize = Number(source.size || 0);
        const targetSize = Number(existingTargetFile.size || 0);
        if (!sourceSize || !targetSize || sourceSize === targetSize) {
          values.storage_path = buildCloudDownloadUrl(targetRoot, source.name);
          setDownloadUploadProgress(form, 78, 'Usando archivo existente');
          return true;
        }
        throw new Error('Ya existe un archivo con ese nombre, pero su tamaño es diferente. Cambia el nombre o selecciona el archivo correcto.');
      }
    }
    setDownloadUploadProgress(form, 8, 'Validando fuente');
    if (source?.kind === 'folder' || localFolderFiles.length) {
      const folderName = source?.kind === 'folder' ? source.name : localFolderName;
      if (!folderName) {
        showToast('No se pudo identificar el nombre de la carpeta.', 'error');
        return false;
      }
      if (localFolderFiles.length > 500) {
        showToast('La carpeta supera el límite de 500 archivos.', 'error');
        return false;
      }
      const targetFolderPath = joinCloudPath(targetRoot, folderName);
      await ensureCloudFolderPath(targetFolderPath);
      setDownloadUploadProgress(form, 24, 'Preparando carpeta');
      const sourceFiles = source?.kind === 'folder'
        ? await walkCloudSource(source, { supabase, cloudOrigin: CLOUD_HIDDENROOM_URL })
        : localFolderFiles.map((localFile) => ({
          file: localFile,
          relativePath: selectedDownloadRelativePath(localFile, folderName),
        }));
      if (!sourceFiles.length) throw new Error('La carpeta seleccionada no contiene archivos.');
      const ensuredDestinations = new Set([targetFolderPath]);
      for (let index = 0; index < sourceFiles.length; index += 1) {
        const sourceFile = sourceFiles[index];
        const localFile = source?.kind === 'folder'
          ? await cloudSourceToFile(sourceFile, { supabase, cloudOrigin: CLOUD_HIDDENROOM_URL })
          : sourceFile.file;
        const relativeParent = sourceFile.relativePath.split('/').slice(0, -1).join('/');
        const destination = relativeParent ? joinCloudPath(targetFolderPath, relativeParent) : targetFolderPath;
        if (!ensuredDestinations.has(destination)) {
          await ensureCloudFolderPath(destination);
          ensuredDestinations.add(destination);
        }
        await uploadCloudFileToPath(localFile, destination);
        setDownloadUploadProgress(form, 24 + Math.round(((index + 1) / Math.max(sourceFiles.length, 1)) * 54), 'Copiando carpeta');
      }
      values.type = 'folder';
      values.storage_path = buildCloudFolderDownloadUrl(targetRoot, folderName);
    } else {
      setDownloadUploadProgress(form, 24, 'Preparando carpeta');
      await ensureCloudFolderPath(targetRoot);
      setDownloadUploadProgress(form, 48, 'Subiendo archivo');
      await uploadCloudFileToPath(file, targetRoot);
      values.storage_path = buildCloudDownloadUrl(targetRoot, file.name);
    }
    setDownloadUploadProgress(form, 78, 'Registrando descarga');
  }
  return true;
}
async function handleErpForm(form) {
  const type = form.dataset.form;
  const values = formValues(form);
  const operationAction = form.dataset.operationAction || 'create';
  const shouldShareReceipt = operationAction === 'create-share';

  if (type === 'user-merge') {
    await handleAdminUserMerge(form, values);
    return;
  }

  if (type === 'collab-event-movement-create' || type === 'admin-event-movement-create') {
    await handleEventMovementCreate(form, values);
    return;
  }

  if (type === 'event-participant-create') {
    await handleEventParticipantCreate(form, values);
    return;
  }

  if (type === 'membership-cancel') {
    await handleMembershipCancel(form, values);
    return;
  }

  if (type === 'membership-delivery') {
    await handleMembershipDelivery(form, values);
    return;
  }

  if (type === 'membership-session-notes') {
    await handleMembershipSessionNotes(form, values);
    return;
  }

  if (type === 'download-create') {
    const isFileDownload = String(values.source_type || 'link') === 'file';
    if (isFileDownload) {
      setOperationFormPending(form, true, 'Subiendo...');
    }
    let prepared = false;
    let uploadFailed = false;
    try {
      prepared = await prepareDownloadValues(form, values);
    } catch (err) {
      uploadFailed = true;
      console.error('[HR] download upload:', err);
      if (isFileDownload) setDownloadUploadProgress(form, 100, 'Error al subir');
      showToast(err?.message || 'No se pudo preparar la descarga.', 'error');
      return;
    } finally {
      if (!prepared) {
        setOperationFormPending(form, false);
        if (isFileDownload && !uploadFailed) resetDownloadUploadProgress(form);
      }
    }
    if (!prepared) return;
  }

  if (type === 'beat-sale-create') {
    await handleBeatSaleCreate(form, values);
    return;
  }

  if ('user_id' in values && !values.user_id) {
    showToast('Selecciona un usuario valido.', 'error');
    return;
  }

  const numericKeys = ['amount', 'cost', 'weekly_price', 'sessions_per_week', 'membership_cycle_number'];
  numericKeys.forEach((key) => {
    if (values[key] != null) values[key] = Number(values[key]);
  });

  ['date', 'session_date', 'due_date', 'event_date', 'start_date', 'end_date'].forEach((key) => {
    if (values[key]) values[key] = formatDateOnly(values[key]);
  });

  if (values.type) values.type = normalizeTransactionType(values.type);
  if (type === 'transaction-create') {
    values.service = canonicalServiceValue(values.service);
    if (values.concept === 'PERSONALIZADO') values.concept = String(values.concept_custom ?? '').trim();
    if (isMembershipValue(values.service)) {
      values.service = MEMBERSHIP_CANONICAL;
      if (!values.concept) values.concept = MEMBERSHIP_CANONICAL;
    }
    delete values.concept_custom;
  }
  if (type === 'session-create') {
    values.type = canonicalServiceValue(values.type);
    if (isMembershipValue(values.type)) {
      values.type = MEMBERSHIP_CANONICAL;
      values.concept = MEMBERSHIP_CANONICAL;
      values.cost = MEMBERSHIP_WEEKLY_COST;
    }
    if (!values.status) values.status = 'sin apartado';
  }
  if (type === 'membership-create') {
    values.status = String(values.status || 'active').toLowerCase();
    values.weekly_price = Number(values.weekly_price || MEMBERSHIP_WEEKLY_COST);
    values.sessions_per_week = Number(values.sessions_per_week || 1);
    if (!values.end_date) values.end_date = null;
  }
  if (type === 'payment-method-create' || type === 'service-create') {
    values.key = String(values.key ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    values.name = String(values.name ?? '').trim();
    values.status = String(values.status || 'active').toLowerCase();
    values.sort_order = Number(values.sort_order || 100);
    if (type === 'service-create') {
      values.show_in_finance = values.show_in_finance === 'true' || values.show_in_finance === 'on';
      values.show_in_session = values.show_in_session === 'true' || values.show_in_session === 'on';
      values.session_cost = values.session_cost == null ? null : Number(values.session_cost);
      values.session_minutes = values.session_minutes == null ? null : Number(values.session_minutes);
      if (!values.show_in_session) {
        values.session_cost = null;
        values.session_minutes = null;
      }
    }
    if (!values.key || !values.name) {
      showToast('Ingresa una clave y nombre validos.', 'error');
      return;
    }
  }

  if (type === 'finance-entity-create') {
    values.entity_key = String(values.entity_key ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    values.name = String(values.name ?? '').trim();
    values.entity_type = String(values.entity_type || 'producer').toLowerCase();
    values.status = String(values.status || 'active').toLowerCase();
    values.notes = String(values.notes ?? '').trim() || null;

    if (!values.entity_key || !values.name) {
      showToast('Ingresa una clave y nombre válidos.', 'error');
      return;
    }
  }

  if (type === 'user-create') {
    const ok = await handleAdminUserCreate(values);
    if (ok) form.reset();
    return;
  }

  const operationPayload = { ...values };
  if (type === 'download-create' || type === 'contract-create') {
    delete operationPayload.username;
  }
  if (type === 'download-create') {
    delete operationPayload.source_type;
    delete operationPayload.download_file;
  }

  const map = {
    'transaction-create': ['transactions', withTargetUsername(operationPayload), 'Transaccion creada.'],
    'session-create': ['sessions', withTargetUsername(operationPayload), 'Sesion creada.'],
    'membership-create': ['memberships', withTargetUsername(operationPayload), 'Membresía creada.'],
    'download-create': ['downloads', operationPayload, 'Descarga creada.'],
    'beat-sale-create': ['store_products', operationPayload, 'Beat publicado.'],
    'contract-create': ['contracts', operationPayload, 'Contrato creado.'],
    'event-create': ['events', operationPayload, 'Evento creado.'],
    'finance-entity-create': ['finance_entities', operationPayload, 'Entidad financiera creada.'],
    'payment-method-create': ['payment_methods', operationPayload, 'Metodo de pago creado.'],
    'service-create': ['services', operationPayload, 'Servicio creado.'],
  };

  const config = map[type];
  if (!config) return;

  const result = await insertRow(config[0], config[1], config[2], { returning: 'id' });
  if (result.ok) {
    if (type === 'event-create') {
      // Fuerza a que los selectores y permisos usen el evento recién creado.
      state.data.financeEvents = null;
      state.data.collabFinanceEvents = null;
      state.data.permissionEvents = null;
    } else if (type === 'finance-entity-create') {
      state.data.financeEntities = null;
    } else if (type === 'payment-method-create') {
      state.data.paymentMethods = null;
    } else if (type === 'service-create') {
      state.data.services = null;
      const nextServiceForm = operationPayload.show_in_session && !operationPayload.show_in_finance ? 'session' : 'transaction';
      setPersistedDataValue('erpOpsForm', nextServiceForm);
      form.reset();
      delete form.dataset.operationAction;
      navigate('erp-ops');
      return;
    } else if (shouldShareReceipt) {
      await createUserNotification(
        operationPayload.user_id,
        operationNotificationMessage(type, operationPayload),
        'success'
      );
      await handleOperationReceipt(form, { sharePreferred: true });
    }
    if (type === 'download-create' && String(values.source_type || 'link') === 'file') {
      setDownloadUploadProgress(form, 100, 'Descarga creada');
    }
    form.reset();
    if (type === 'download-create') {
      form.__hrCloudSource = null;
      form.__hrCloudFile = null;
      updateDownloadMembershipFields(form);
      setOperationFormPending(form, false);
      setTimeout(() => resetDownloadUploadProgress(form), 1200);
    }
    delete form.dataset.operationAction;
  } else if (type === 'download-create') {
    if (String(values.source_type || 'link') === 'file') {
      setDownloadUploadProgress(form, 100, 'Error al guardar');
    }
    setOperationFormPending(form, false);
  }
}

async function updateMembershipStatusAction({ membershipId, status, endDate, notes, successMessage, refreshSection = state.activeSection || 'admin-table-editor' }) {
  if (!requireAdminMutation()) return false;
  const cleanMembershipId = String(membershipId ?? '').trim();
  if (!cleanMembershipId) {
    showToast('Selecciona una membresia.', 'error');
    return false;
  }

  const payload = {
    status,
    end_date: endDate ? formatDateOnly(endDate) : todayDateInputValue(),
  };
  const cleanNotes = String(notes ?? '').trim();
  if (cleanNotes) payload.notes = cleanNotes;

  const { error } = await supabase
    .from('memberships')
    .update(payload)
    .eq('id', cleanMembershipId);

  if (error) {
    console.error('[HR] membership status action:', error);
    showToast('No se pudo actualizar la membresia.', 'error');
    return false;
  }

  showToast(successMessage || 'Membresia actualizada.', 'success');
  navigate(refreshSection);
  return true;
}

async function handleMembershipRowStatusAction(action, encodedRow) {
  let row = null;
  try {
    row = JSON.parse(decodeURIComponent(encodedRow || ''));
  } catch (error) {
    console.error('[HR] membership row parse:', error);
  }

  if (!row?.id) {
    showToast('No se pudo leer la membresia seleccionada.', 'error');
    return;
  }

  const isCancel = action === 'cancel';
  const status = isCancel ? 'cancelled' : 'expired';
  const currentStatus = String(row.status ?? '').toLowerCase();
  if (currentStatus === status) {
    showToast(isCancel ? 'La membresia ya esta cancelada.' : 'La membresia ya esta finalizada.', 'info');
    return;
  }

  const label = isCancel ? 'Cancelar' : 'Finalizar';
  if (!window.confirm(label + ' esta membresia? Se marcara con fecha de termino de hoy.')) return;

  const existingNotes = String(row.notes ?? '').trim();
  const actionNote = todayDateInputValue() + ' - Membresia ' + (isCancel ? 'cancelada' : 'finalizada') + ' desde BB.DD.';
  const notes = existingNotes ? existingNotes + '\n' + actionNote : actionNote;

  await updateMembershipStatusAction({
    membershipId: row.id,
    status,
    endDate: todayDateInputValue(),
    notes,
    successMessage: isCancel ? 'Membresia cancelada.' : 'Membresia finalizada.',
    refreshSection: 'admin-table-editor',
  });
}
async function handleMembershipCancel(form, values = formValues(form)) {
  const membershipId = String(values.membership_id ?? '').trim();
  if (!membershipId) {
    showToast('Selecciona una membresía.', 'error');
    return;
  }

  const payload = {
    status: 'cancelled',
    end_date: values.end_date ? formatDateOnly(values.end_date) : todayDateInputValue(),
  };
  const notes = String(values.notes ?? '').trim();
  if (notes) payload.notes = notes;

  const { error } = await supabase
    .from('memberships')
    .update(payload)
    .eq('id', membershipId);

  if (error) {
    console.error('[HR] membership cancel:', error);
    showToast('No se pudo cancelar la membresía.', 'error');
    return;
  }

  showToast('Membresía cancelada.', 'success');
  form.reset();
  navigate('erp-ops');
}

async function handleMembershipDelivery(form, values = formValues(form)) {
  if (!hasRole('admin')) {
    showToast('Acceso no autorizado.', 'error');
    return;
  }
  const staySection = form.dataset.staySection;
  const ok = await saveMembershipDeliveryValues(values);
  if (!ok) return;

  showToast('Entrega de material guardada.', 'success');
  if (staySection === 'admin-table-editor') {
    navigate('admin-table-editor');
  } else {
    form.reset();
    navigate('erp-ops');
  }
}

async function saveMembershipDeliveryValues(values = {}) {
  const membershipId = String(values.membership_id ?? '').trim() || null;
  const cycleNumber = Number(values.cycle_number ?? 0);
  const deliveredAt = values.delivered_at ? formatDateOnly(values.delivered_at) : null;
  let userId = String(values.user_id ?? '').trim();

  if (!Number.isFinite(cycleNumber) || cycleNumber < 1) {
    showToast('Ingresa un ciclo valido.', 'error');
    return false;
  }

  if (!deliveredAt) {
    showToast('Ingresa la fecha real de entrega.', 'error');
    return false;
  }

  if (membershipId) {
    const cachedMembership = (state.data.membershipOpsOptions ?? [])
      .find((membership) => String(membership.id) === membershipId);
    if (cachedMembership?.user_id) {
      userId = String(cachedMembership.user_id);
    } else {
      const { data, error } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('id', membershipId)
        .maybeSingle();
      if (error) {
        console.error('[HR] membership delivery membership lookup:', error);
        showToast('No se pudo validar la membresía.', 'error');
        return false;
      }
      if (data?.user_id) userId = String(data.user_id);
    }
  }

  if (!userId) {
    showToast('Selecciona un usuario o una membresía.', 'error');
    return false;
  }

  const payload = {
    membership_id: membershipId,
    user_id: userId,
    cycle_number: cycleNumber,
    delivered_at: deliveredAt,
  };
  if (values.note_scope === 'delivery' && Object.prototype.hasOwnProperty.call(values, 'notes')) {
    payload.notes = String(values.notes ?? '').trim() || null;
  }

  let existingQuery = supabase
    .from('membership_material_deliveries')
    .select('id')
    .eq('user_id', userId)
    .eq('cycle_number', cycleNumber)
    .limit(1);

  existingQuery = membershipId
    ? existingQuery.eq('membership_id', membershipId)
    : existingQuery.is('membership_id', null);

  const { data: existingRows, error: lookupError } = await existingQuery;
  if (lookupError) {
    console.error('[HR] membership delivery lookup:', lookupError);
    showToast('No se pudo revisar la entrega existente.', 'error');
    return false;
  }

  const existingId = existingRows?.[0]?.id;
  const request = existingId
    ? supabase.from('membership_material_deliveries').update(payload).eq('id', existingId)
    : supabase.from('membership_material_deliveries').insert(payload);

  const { error } = await request;
  if (error) {
    console.error('[HR] membership delivery save:', error);
    showToast('No se pudo guardar la entrega de material.', 'error');
    return false;
  }

  return true;
}

async function handleMembershipSessionNotes(form, values = formValues(form)) {
  if (!hasRole('admin')) {
    showToast('Acceso no autorizado.', 'error');
    return;
  }

  const ok = await saveMembershipSessionNotesValues(values);
  if (!ok) return;

  showToast('Notas de sesión guardadas.', 'success');
  if (form.dataset.staySection === 'admin-table-editor') {
    navigate('admin-table-editor');
  }
}

async function saveMembershipSessionNotesValues(values = {}) {
  const sessionId = String(values.session_id ?? '').trim();
  if (!sessionId) {
    showToast('Esta fila no tiene una sesión registrada para editar.', 'error');
    return false;
  }

  const { error } = await supabase
    .from('sessions')
    .update({ notes: String(values.notes ?? '').trim() || null })
    .eq('id', sessionId);

  if (error) {
    console.error('[HR] membership session notes save:', error);
    showToast('No se pudieron guardar las notas de la sesión.', 'error');
    return false;
  }

  return true;
}

async function handleAdminUserMerge(form, values = formValues(form)) {
  if (!hasRole('admin')) {
    showToast('Acceso no autorizado.', 'error');
    return;
  }

  const keepUserId = String(values.keep_user_id ?? '').trim();
  const duplicateEmail = String(values.duplicate_email ?? '').trim().toLowerCase();
  const holder = form.querySelector('[data-admin-merge-user-result]');

  if (!keepUserId || !duplicateEmail) {
    showToast('Ingresa el User ID historico y el email duplicado.', 'error');
    return;
  }

  const confirmed = window.confirm(
    `Advertencia: vas a vincular el historico operativo de ${keepUserId} al perfil con Auth/email ${duplicateEmail}.\n\nNo se modificaran Auth ni public.users. Solo se re-asignaran operaciones, sesiones, transacciones, premios, contratos, descargas y puntuaciones. Confirmas la fusion?`
  );

  if (!confirmed) return;

  try {
    const { data, error } = await supabase.rpc('admin_merge_public_user_profiles', {
      p_keep_user_id: keepUserId,
      p_duplicate_email: duplicateEmail,
    });

    if (error || data?.success === false) {
      console.error('[HR] admin user merge:', error || data);
      const message = error?.message || data?.error || 'No se pudo fusionar usuarios.';
      showToast(message, 'error');
      if (holder) {
        holder.hidden = false;
        holder.textContent = message;
      }
      return;
    }

    state.data.users = null;
    showToast('Historico operativo vinculado.', 'success');
    if (holder) {
      holder.hidden = false;
      holder.textContent = `Fusion realizada sin modificar Auth ni public.users. Historico: ${data?.historical_user_id ?? keepUserId}. User ID con Auth: ${data?.target_user_id ?? '-'}. Email activo: ${data?.email ?? duplicateEmail}.`;
    }
    form.reset();
  } catch (err) {
    console.error('[HR] admin user merge invoke:', err);
    const message = err?.message || 'Error al fusionar usuarios.';
    showToast(message, 'error');
    if (holder) {
      holder.hidden = false;
      holder.textContent = message;
    }
  }
}

async function handleEventParticipantCreate(form, values = formValues(form)) {
  if (!hasRole('admin')) {
    showToast('Acceso no autorizado.', 'error');
    return;
  }

  const userId = String(values.user_id ?? '').trim();
  if (!userId) {
    showToast('Selecciona un usuario participante.', 'error');
    return;
  }

  const participationPayload = {
    user_id: userId,
    role: values.role ?? null,
    status: values.status ?? 'active',
    notes: values.notes ?? null,
  };

  const { error: participationError } = await supabase
    .from('participants')
    .upsert(participationPayload, { onConflict: 'user_id' });

  if (participationError) {
    console.error('[HR] participant upsert:', participationError);
    showToast('No se pudo guardar el participante.', 'error');
    return;
  } else {
    showToast('Participante guardado.', 'success');
  }

  state.data.eventParticipantsAll = null;
  form.reset();
  navigate('erp-ops');
}

async function handleEventMovementCreate(form, values = formValues(form)) {
  const isAdmin = hasRole('admin');
  const eventId = values.event_id;
  const eventKey = values.event_key;
  const events = state.activeSection === 'collab-finance'
    ? (state.data.collabFinanceEvents ?? [])
    : (state.data.financeEvents ?? []);
  const selectedEvent = events.find((event) => String(event.id ?? event.event_id) === String(eventId));
  const permissions = eventAccessFor(selectedEvent, isAdmin);

  if (!permissions.can_add_finance) {
    showToast('No tienes permiso para capturar finanzas de este evento.', 'error');
    return;
  }

  const movement = movementTypeConfig(values.movement_type);
  const rawAmount = Math.abs(Number(values.amount ?? 0));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    showToast('Ingresa un monto valido.', 'error');
    return;
  }

  const signedAmount = rawAmount * movement.sign;
  const rawHiddenRoomShare = Math.abs(Number(values.hidden_room_share ?? 0));
  const signedHiddenRoomShare = Number.isFinite(rawHiddenRoomShare) ? rawHiddenRoomShare * movement.sign : 0;
  const movementDate = values.movement_date ? formatDateOnly(values.movement_date) : todayDateInputValue();
  const payload = {
    event_id: eventId || null,
    event_key: eventKey || selectedEvent?.event_key || null,
    movement_type: movement.value,
    concept: values.concept,
    amount: signedAmount,
    hidden_room_share: signedHiddenRoomShare,
    from_user_id: values.from_user_id ?? null,
    to_user_id: values.to_user_id ?? null,
    owner_user_id: null,
    owner_entity_id: values.owner_entity_id ?? null,
    payment_method: values.payment_method ?? null,
    movement_date: movementDate,
    notes: values.notes ?? null,
    user_id: state.user?.user_id ?? null,
    username: state.user?.username ?? state.user?.display_name ?? state.user?.email ?? null,
    ...currentUserAuditFields(),
    type: movement.legacyType,
    via: values.payment_method ?? null,
    date: movementDate,
    'M.A.I.': signedHiddenRoomShare,
  };

  const result = await insertRow('hr_transactions', payload, 'Movimiento financiero creado.');
  if (result.ok) {
    form.reset();
    state.data.financeEvents = null;
    state.data.collabFinanceEvents = null;
    navigate(state.activeSection);
  }
}

async function handleEventMovementEdit(encodedTx) {
  let tx;
  try {
    tx = JSON.parse(decodeURIComponent(encodedTx));
  } catch (err) {
    console.error('[HR] event movement edit parse:', err);
    showToast('No se pudo leer el movimiento.', 'error');
    return;
  }

  const events = state.activeSection === 'collab-finance'
    ? (state.data.collabFinanceEvents ?? [])
    : (state.data.financeEvents ?? []);
  const selectedEvent = events.find((event) => String(event.id ?? event.event_id) === String(tx.event_id));
  const permissions = eventAccessFor(selectedEvent, hasRole('admin'));
  if (!permissions.can_edit_finance) {
    showToast('No tienes permiso para editar finanzas de este evento.', 'error');
    return;
  }

  const concept = window.prompt('Concepto', tx.concept ?? '');
  if (concept === null) return;
  const amountInput = window.prompt('Monto firmado', String(tx.amount ?? 0));
  if (amountInput === null) return;
  const hiddenShareInput = window.prompt('Hidden Room Share', String(tx.hidden_room_share ?? eventFinanceAmount(tx) ?? 0));
  if (hiddenShareInput === null) return;
  const paymentMethod = window.prompt('Metodo de pago', tx.payment_method ?? tx.via ?? '');
  if (paymentMethod === null) return;
  const movementDate = window.prompt('Fecha', formatDateOnly(tx.movement_date ?? tx.date));
  if (movementDate === null) return;
  const notes = window.prompt('Notas', tx.notes ?? '');
  if (notes === null) return;

  const amount = Number(amountInput);
  const hiddenRoomShare = Number(hiddenShareInput);
  if (!Number.isFinite(amount) || !Number.isFinite(hiddenRoomShare)) {
    showToast('Monto invalido.', 'error');
    return;
  }

  const payload = {
    concept: concept.trim() || null,
    amount,
    hidden_room_share: hiddenRoomShare,
    payment_method: paymentMethod.trim() || null,
    movement_date: movementDate ? formatDateOnly(movementDate) : null,
    notes: notes.trim() || null,
    via: paymentMethod.trim() || null,
    date: movementDate ? formatDateOnly(movementDate) : null,
    'M.A.I.': hiddenRoomShare,
  };

  const { error } = await supabase
    .from('hr_transactions')
    .update(payload)
    .eq('id', tx.id);

  if (error) {
    console.error('[HR] event movement edit:', error);
    showToast('No se pudo editar el movimiento.', 'error');
    return;
  }

  state.data.financeEvents = null;
  state.data.collabFinanceEvents = null;
  showToast('Movimiento actualizado.', 'success');
  navigate(state.activeSection);
}

async function handleEventFinanceTableUpdate(form) {
  if (!requireAdminMutation()) return;

  const values = formValues(form);
  const config = TABLE_EDITOR_CONFIG.hr_transactions;
  let original;
  try {
    original = JSON.parse(decodeURIComponent(values.original));
  } catch (err) {
    console.error('[HR] event finance table original parse:', err);
    showToast('No se pudo leer la fila original.', 'error');
    return;
  }

  const payload = {};
  config.editableFields.forEach((field) => {
    if (field in values) payload[field] = values[field];
  });

  if ('amount' in payload) {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount)) {
      showToast('Monto invalido.', 'error');
      return;
    }
    payload.amount = amount;
  }

  if ('hidden_room_share' in payload) {
    const hiddenRoomShare = Number(payload.hidden_room_share);
    if (!Number.isFinite(hiddenRoomShare)) {
      showToast('M.A.I. invalido.', 'error');
      return;
    }
    payload.hidden_room_share = hiddenRoomShare;
    payload['M.A.I.'] = hiddenRoomShare;
  }

  if ('movement_type' in payload) {
    payload.type = movementTypeConfig(payload.movement_type).legacyType;
  }
  if ('payment_method' in payload) {
    payload.payment_method = payload.payment_method?.trim() || null;
    payload.via = payload.payment_method;
  }
  if ('movement_date' in payload) {
    payload.movement_date = payload.movement_date ? formatDateOnly(payload.movement_date) : null;
    payload.date = payload.movement_date;
  }
  ['concept', 'from_user_id', 'to_user_id', 'owner_entity_id', 'notes'].forEach((field) => {
    if (field in payload) payload[field] = payload[field]?.trim() || null;
  });

  const ok = await saveAdminTableRow('hr_transactions', config, original, payload, { confirmUserId: false });
  if (ok) {
    state.data.financeEvents = null;
    state.data.collabFinanceEvents = null;
    showToast('Movimiento actualizado.', 'success');
    navigate(state.activeSection);
  }
}
function operationReceiptFormTypeForTable(tableName) {
  const formTypes = {
    transactions: 'transaction-create',
    sessions: 'session-create',
    downloads: 'download-create',
    contracts: 'contract-create',
  };
  return formTypes[tableName] ?? '';
}

function operationReceiptValuesFromRow(tableName, row = {}) {
  if (tableName === 'transactions') {
    return {
      user_id: row.user_id,
      username: row.username,
      date: row.date,
      type: row.type,
      concept: row.concept,
      amount: row.amount,
      via: row.via,
      id_trans: row.id_trans,
      notes: row.notes,
    };
  }

  if (tableName === 'sessions') {
    return {
      user_id: row.user_id,
      username: row.username,
      session_date: row.session_date,
      type: row.type,
      status: row.status,
      concept: row.concept,
      hour: row.hour,
      sc_end: row.sc_end,
      cost: row.cost,
      promo: row.promo,
      notes: row.notes,
    };
  }

  if (tableName === 'downloads') {
    return {
      user_id: row.user_id,
      name: row.name,
      storage_path: row.storage_path,
      release_mode: row.release_mode,
      membership_id: row.membership_id,
      membership_cycle_number: row.membership_cycle_number,
      notes: row.notes,
    };
  }

  if (tableName === 'contracts') {
    return {
      user_id: row.user_id,
      contract: row.contract,
      notes: row.notes,
    };
  }

  return {};
}

function buildOperationReceiptForm(formType, values = {}) {
  const form = document.createElement('form');
  form.dataset.form = formType;

  Object.entries(values).forEach(([name, value]) => {
    if (value === undefined || value === null) return;
    const input = document.createElement('input');
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  });

  return form;
}

function parseAdminTableRowOriginal(encodedRow) {
  try {
    return JSON.parse(decodeURIComponent(encodedRow));
  } catch (err) {
    console.error('[HR] admin row receipt parse:', err);
    showToast('No se pudo leer la operacion seleccionada.', 'error');
    return null;
  }
}

async function handleAdminOperationReceiptShare(tableName, encodedRow) {
  if (!adminTableRowSupportsReceipt(tableName)) return;

  const row = parseAdminTableRowOriginal(encodedRow);
  if (!row) return;

  const formType = operationReceiptFormTypeForTable(tableName);
  const values = operationReceiptValuesFromRow(tableName, row);
  const form = buildOperationReceiptForm(formType, values);
  await handleOperationReceipt(form, { sharePreferred: true });
}

function operationReceiptTitle(formType) {
  const labels = {
    'transaction-create': 'Comprobante de transaccion',
    'session-create': 'Comprobante de sesion',
    'download-create': 'Comprobante de descarga',
    'contract-create': 'Comprobante de contrato',
  };
  return labels[formType] ?? 'Comprobante de operacion';
}

function operationNotificationMessage(formType, values = {}) {
  if (formType === 'download-create' && values.release_mode === 'membership_delivery') {
    return `Se preparó una descarga para tu membresía. Aparecerá en Descargas cuando se entregue el material del Mes ${values.membership_cycle_number ?? '-'}.`;
  }

  const labels = {
    'transaction-create': 'Se registró una transacción en tu cuenta.',
    'session-create': 'Se registró una sesión en tu cuenta.',
    'download-create': 'Se agregó una descarga a tu cuenta.',
    'contract-create': 'Se agregó un contrato a tu cuenta.',
  };
  const base = labels[formType] ?? 'Se registró una operación en tu cuenta.';
  const amount = values.amount ? ` Monto: ${money(values.amount)}.` : '';
  const date = values.date || values.session_date
    ? ` Fecha: ${formatDisplayDateOnly(values.date || values.session_date)}.`
    : '';
  return `${base}${amount}${date}`;
}

function operationReceiptRows(form) {
  const values = formValues(form);
  const user = (state.data.users ?? []).find((item) => String(item.user_id) === String(values.user_id));
  const sessionConfig = sessionTypeConfig(values.type);
  const rows = [
    ['Cliente', userLabel(values.user_id)],
    ['Username', values.username || user?.username || '-'],
    ['User ID', values.user_id || '-'],
  ];

  if (form.dataset.form === 'transaction-create') {
    rows.push(
      ['Fecha', values.date ? formatDisplayDateOnly(values.date) : formatDisplayDateOnly(new Date().toISOString())],
      ['Tipo', values.type || '-'],
      ['Concepto', values.concept || '-'],
      ['Monto', money(values.amount || 0)],
      ['Via', values.via || '-'],
      ['ID transaccion', values.id_trans || '-']
    );
  }

  if (form.dataset.form === 'session-create') {
    const status = values.status || 'sin apartado';
    rows.push(
      ['Fecha', values.session_date ? formatDisplayDateOnly(values.session_date) : '-'],
      ['Servicio', sessionConfig?.label || values.type || '-'],
      ['Status', status],
      ['Concepto', values.concept || '-'],
      ['Hora de inicio', values.hour || '-'],
      ['Hora de final', values.sc_end || '-'],
      ['Costo', money(values.cost || sessionConfig?.cost || 0)],
      ['Promo', values.promo || '-']
    );
  }

  if (form.dataset.form === 'download-create') {
    rows.push(
      ['Nombre', values.name || '-'],
      ['Ruta storage', values.storage_path || '-'],
      ['Liberación', values.release_mode === 'membership_delivery' ? 'Entregable de membresía' : 'Inmediata']
    );
    if (values.release_mode === 'membership_delivery') {
      rows.push(
        ['Membresía', values.membership_id || '-'],
        ['Ciclo', values.membership_cycle_number || '-']
      );
    }
  }

  if (form.dataset.form === 'contract-create') {
    rows.push(['Contrato', values.contract || '-']);
  }

  if (values.notes) rows.push(['Notas', values.notes]);
  rows.push(['Terminos y condiciones', 'Al agendar aceptas que leiste los terminos y condiciones del servicio adquirido, disponibles en hiddenroom.mx/docs']);
  return rows;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function shareReceiptBlob(blob, fileName, title) {
  if (!navigator.share || typeof File === 'undefined') return false;

  const file = new File([blob], fileName, { type: 'application/pdf' });
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;

  await navigator.share({
    title: `Hidden Room - ${title}`,
    text: `Comprobante ${title}`,
    files: [file],
  });
  return true;
}

async function handleOperationReceipt(form, options = {}) {
  try {
    await ensurePdfLibraries();
    const { jsPDF } = window.jspdf;
    const title = operationReceiptTitle(form.dataset.form);
    const generatedAt = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const rows = operationReceiptRows(form);

    doc.setFontSize(16);
    doc.text(`Hidden Room - ${title}`, 40, 48);
    doc.setFontSize(10);
    doc.text(`Generado: ${generatedAt}`, 40, 66);
    doc.autoTable({
      head: [['Campo', 'Detalle']],
      body: rows,
      startY: 88,
      styles: { fontSize: 9, cellPadding: 6, overflow: 'linebreak' },
      headStyles: { fillColor: [32, 32, 32] },
      columnStyles: { 0: { cellWidth: 150 } },
      margin: { left: 40, right: 40 },
    });

    const fileName = `hidden-room-${title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    const blob = doc.output('blob');

    if (options.sharePreferred) {
      try {
        const shared = await shareReceiptBlob(blob, fileName, title);
        if (shared) {
          if (!options.silent) showToast('Comprobante listo para compartir.', 'success');
          return;
        }
      } catch (shareError) {
        if (shareError?.name === 'AbortError') {
          if (!options.silent) showToast('Compartir comprobante cancelado.', 'info');
          return;
        }
        console.info('[HR] receipt share fallback:', shareError?.message ?? shareError);
      }
    }

    downloadBlob(blob, fileName);
    if (!options.silent) showToast('Comprobante PDF descargado.', 'success');
  } catch (err) {
    console.error('[HR] operation receipt:', err);
    showToast('No se pudo generar el comprobante PDF.', 'error');
  }
}

async function handleAdminUserCreate(values) {
  if (!requireAdminMutation()) return false;

  const email = values.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Email invalido.', 'error');
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email,
        profile: {
          display_name: values.display_name ?? null,
          username: values.username ?? null,
          user_id: values.user_id ?? null,
          whatsapp: values.whatsapp ?? null,
          roles: values.roles ?? 'client',
        },
      },
    });

    if (error) {
      console.error('[HR] admin-create-user function:', error);
      const detail = await getFunctionErrorMessage(error);
      showToast(detail || 'No se pudo crear el usuario.', 'error');
      return false;
    }

    showAdminCreatedUserResult(values, data);
    showToast('Usuario creado en Auth/public.users.', 'success');
    state.data.users = null;
    return true;
  } catch (err) {
    console.error('[HR] admin-create-user invoke:', err);
    showToast('Error al contactar la función de creación de usuario.', 'error');
    return false;
  }
}

async function getFunctionErrorMessage(error) {
  const fallback = error?.message || '';
  const response = error?.context;
  if (!response || typeof response.clone !== 'function') return fallback;

  try {
    const payload = await response.clone().json();
    return payload?.error || payload?.message || fallback;
  } catch {
    return fallback;
  }
}
function showAdminCreatedUserResult(values, result) {
  const holder = document.querySelector('[data-admin-create-user-result]');
  const tempPassword = result?.temp_password;
  if (!holder || !tempPassword) return;

  const email = result?.user?.email ?? values.email ?? '';
  const userId = result?.user?.user_id ?? values.user_id ?? '';
  holder.hidden = false;
  holder.innerHTML = `
    <strong>Usuario creado.</strong>
    <span style="display:block;margin-top:6px;">Email: ${escapeHTML(email)}</span>
    <span style="display:block;margin-top:6px;">User ID: ${escapeHTML(userId || '-')}</span>
    <span style="display:block;margin-top:6px;">Contraseña temporal: <code>${escapeHTML(tempPassword)}</code></span>
    <button class="db-btn-secondary" type="button" data-action="copy-temp-password" data-temp-password="${escapeAttr(tempPassword)}">Copiar contraseña temporal</button>
  `;
}

async function handleShareLogin(encodedRow) {
  if (!requireAdminMutation()) return;

  let user;
  try {
    user = JSON.parse(decodeURIComponent(encodedRow));
  } catch (err) {
    console.error('[HR] share login parse:', err);
    showToast('No se pudo preparar el mensaje.', 'error');
    return;
  }

  if (!user.email || !user.temp_password) {
    showToast('El usuario no tiene email o contraseña temporal visible.', 'error');
    return;
  }

  const message = [
    'Hola, estos son tus datos de acceso a Hidden Room / Mysauth:',
    `Correo: ${user.email}`,
    `Contraseña temporal: ${user.temp_password}`,
    'Al iniciar sesión se te pedirá actualizarla.',
  ].join('\n');

  try {
    await navigator.clipboard?.writeText(message);
  } catch (err) {
    console.info('[HR] clipboard unavailable:', err);
  }

  const phone = user.whatsapp || SHARE_LOGIN_WHATSAPP_FALLBACK;
  window.open(buildWhatsAppLink(phone, message), '_blank', 'noopener,noreferrer');
  showToast('Mensaje de login preparado.', 'success');
}

async function handleAccountUpdate(form) {
  const values = formValues(form);
  const email = values.email?.trim();
  const password = values.password;
  const passwordConfirm = values.password_confirm;
  const rawIgUsername = values.ig_username ?? '';
  const igUsername = cleanInstagramUsername(rawIgUsername);
  const currentIgUsername = cleanInstagramUsername(state.user?.ig_username);
  const emailChanged = email !== (state.user?.email ?? '');
  const igChanged = igUsername !== currentIgUsername;

  if (!email) {
    showToast('Ingresa un email valido.', 'error');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('El formato del email no es valido.', 'error');
    return;
  }

  if (rawIgUsername.trim() && igUsername.length < 2) {
    showToast('Escribe un usuario de Instagram valido.', 'error');
    return;
  }

  if (currentIgUsername && !rawIgUsername.trim()) {
    showToast('El usuario de Instagram no puede quedar vacio.', 'error');
    return;
  }

  if (password || passwordConfirm) {
    if (password !== passwordConfirm) {
      showToast('Las contraseñas no coinciden.', 'error');
      return;
    }

    if (password.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres.', 'error');
      return;
    }
  }

  let authUser = null;
  let confirmedImmediately = true;

  if (emailChanged || password) {
    const authPayload = {};
    if (emailChanged) authPayload.email = email;
    if (password) authPayload.password = password;

    const { data, error } = await supabase.auth.updateUser(authPayload);

    if (error) {
      console.error('[HR] account update:', error);
      showToast(error.message || 'No se pudo actualizar la cuenta.', 'error');
      return;
    }

    authUser = data?.user ?? null;
    // NOTE: public.users.email is intentionally NOT updated here.
    // A database trigger syncs auth.users.email → public.users.email automatically.
    confirmedImmediately = !emailChanged || authUser?.email === email;
  }

  if (igChanged) {
    const { error: profileError } = await supabase
      .from('users')
      .update({ ig_username: igUsername })
      .eq('id', state.user.id);

    if (profileError) {
      console.error('[HR] account instagram update:', profileError);
      showToast(profileError.message || 'No se pudo actualizar tu Instagram.', 'error');
      return;
    }
  }

  const nextUser = {
    ...state.user,
    ...(authUser ?? {}),
    email: confirmedImmediately ? email : (state.user.email ?? email),
    ig_username: igChanged ? igUsername : state.user?.ig_username,
  };

  setState({ user: nextUser });
  hydrateTopbar();
  showToast(
    confirmedImmediately
      ? 'Cuenta actualizada correctamente.'
      : 'Revisa tu correo para confirmar el cambio de email. El cambio se aplicará al confirmar.',
    confirmedImmediately ? 'success' : 'info'
  );
  navigate('account-settings');
}

function requireAdminMutation() {
  if (hasRole('admin')) return true;
  showToast('Acceso no autorizado.', 'error');
  return false;
}

async function handleRoleChange(userUuid, role) {
  if (!requireAdminMutation()) return;
  if (!AVAILABLE_ROLES.includes(role)) {
    showToast('Rol invalido.', 'error');
    return;
  }

  const { error } = await supabase.rpc('admin_update_public_user_sensitive', {
    p_target_user_id: userUuid,
    p_changes: { roles: role },
  });

  if (error) {
    console.error('[HR] role update:', error);
    showToast('No se pudo actualizar el rol.', 'error');
    return;
  }

  showToast('Rol actualizado.', 'success');
  navigate('erp-permissions');
}

async function handlePermissionAdd(form) {
  if (!requireAdminMutation()) return;

  const values = formValues(form);
  const userUuid = values.user_uuid;
  const permissionKey = values.permission_key;

  if (!userUuid || !SUGGESTED_PERMISSIONS.includes(permissionKey)) {
    showToast('Permiso invalido.', 'error');
    return;
  }

  const { data: existing, error: checkError } = await supabase
    .from('user_permissions')
    .select('id')
    .eq('user_id', userUuid)
    .eq('permission_key', permissionKey)
    .limit(1);

  if (checkError) {
    console.error('[HR] permission duplicate check:', checkError);
    showToast('No se pudo validar el permiso.', 'error');
    return;
  }

  if ((existing ?? []).length > 0) {
    showToast('Ese permiso ya existe.', 'info');
    return;
  }

  const result = await insertRow(
    'user_permissions',
    { user_id: userUuid, permission_key: permissionKey },
    'Permiso agregado.'
  );

  if (result.ok) navigate('erp-permissions');
}

async function handlePermissionRemove(permissionId) {
  if (!requireAdminMutation()) return;
  if (!permissionId) return;

  const { error } = await supabase
    .from('user_permissions')
    .delete()
    .eq('id', permissionId);

  if (error) {
    console.error('[HR] permission remove:', error);
    showToast('No se pudo quitar el permiso.', 'error');
    return;
  }

  showToast('Permiso removido.', 'success');
  navigate('erp-permissions');
}

function renderEventPermissionsEditor(user) {
  const events = state.data.permissionEvents ?? [];
  const userHasAdminDefaults = expandRoles(user?.roles).includes('admin');
  const assigned = new Map(
    (state.data.eventUserPermissions ?? [])
      .filter((permission) => String(permission.user_id) === String(user.user_id))
      .map((permission) => [String(permission.event_id), permission])
  );

  const rows = events.length
    ? events.map((event) => {
      const permission = assigned.get(String(event.id)) ?? {};
      const searchText = normalizeSearchText([
        event.name,
        event.event_key,
        event.status,
        event.event_date,
      ].filter(Boolean).join(' '));

      return `
        <tr data-search-row data-search-text="${escapeAttr(searchText)}">
          <td class="db-event-permissions__event">
            <strong>${escapeHTML(event.name ?? event.event_key ?? 'Evento')}</strong>
            <small>${escapeHTML(event.event_key ?? '')} ${event.event_date ? `· ${formatDisplayDateOnly(event.event_date)}` : ''}</small>
          </td>
          ${EVENT_PERMISSION_FLAGS.map(([flag, label]) => `
            <td>
              <label class="db-checkbox-label">
                <input type="checkbox" name="${escapeAttr(`${event.id}:${flag}`)}" ${userHasAdminDefaults || permission[flag] ? 'checked' : ''} />
                <span>${escapeHTML(label)}</span>
              </label>
            </td>
          `).join('')}
        </tr>
      `;
    }).join('')
    : '<tr class="db-table__empty-row hr-table-empty"><td colspan="5" class="db-empty hr-table-empty">Sin eventos disponibles.</td></tr>';
  const eventPermissionSearch = tableSearchFor('js-event-permissions-body');

  return `
    <section class="db-event-permissions">
      <h3>Permisos por Evento</h3>
      <label class="db-field">
        <span>Buscar eventos</span>
        <input data-table-search data-table-target="js-event-permissions-body" data-table-count="js-event-permissions-count" placeholder="Buscar evento" value="${escapeAttr(eventPermissionSearch)}" />
        <small id="js-event-permissions-count" class="db-field__hint">${events.length} eventos visibles</small>
      </label>
      <div class="db-table-wrap hr-table-wrap db-event-permissions__table-wrap">
        <table class="db-table hr-table hr-table-editable db-event-permissions__table" aria-label="Permisos por evento">
          <thead>
            <tr>
              <th scope="col">Evento</th>
              ${EVENT_PERMISSION_FLAGS.map(([, label]) => `<th scope="col">${escapeHTML(label)}</th>`).join('')}
            </tr>
          </thead>
          <tbody id="js-event-permissions-body">${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

async function handleEventPermissionsSave(user, form) {
  if (!requireAdminMutation()) return false;
  if (!user?.user_id) {
    showToast('El usuario no tiene User ID operativo.', 'error');
    return false;
  }

  const events = state.data.permissionEvents ?? [];
  const existing = new Map(
    (state.data.eventUserPermissions ?? [])
      .filter((permission) => String(permission.user_id) === String(user.user_id))
      .map((permission) => [String(permission.event_id), permission])
  );

  for (const event of events) {
    const flags = Object.fromEntries(
      EVENT_PERMISSION_FLAGS.map(([flag]) => [
        flag,
        Boolean(form.querySelector(`input[name="${CSS.escape(`${event.id}:${flag}`)}"]`)?.checked),
      ])
    );
    const hasAny = Object.values(flags).some(Boolean);
    const current = existing.get(String(event.id));

    if (hasAny) {
      const { error } = await supabase
        .from('event_user_permissions')
        .upsert({
          event_id: event.id,
          user_id: user.user_id,
          ...flags,
        }, { onConflict: 'event_id,user_id' });

      if (error) {
        console.error('[HR] event permission upsert:', error);
        showToast('No se pudieron guardar permisos por evento.', 'error');
        return false;
      }
    } else if (current?.id) {
      const { error } = await supabase
        .from('event_user_permissions')
        .delete()
        .eq('id', current.id);

      if (error) {
        console.error('[HR] event permission delete:', error);
        showToast('No se pudieron quitar permisos por evento.', 'error');
        return false;
      }
    }
  }

  return true;
}

/**
 * Opens an inline modal to edit a user's profile + email as an admin.
 * Email changes are routed through the "admin-update-user" Edge Function.
 * @param {string} userUuid  auth.users.id / public.users.id
 */
function showAdminUserEditModal(userUuid) {
  const users = state.data.permissionUsers ?? state.data.users ?? [];
  const user = users.find((u) => String(u.id) === String(userUuid));
  if (!user) { showToast('Usuario no encontrado.', 'error'); return; }

  // Remove any previous modal
  document.getElementById('js-admin-user-edit-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'js-admin-user-edit-modal';
  overlay.className = 'db-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'js-admin-user-edit-title');
  overlay.innerHTML = `
    <div class="db-modal__dialog db-modal__dialog--wide">
      <h2 class="db-modal__title" id="js-admin-user-edit-title">Editar usuario</h2>
      <form id="js-admin-user-edit-form" class="db-form db-modal__body">
        <input type="hidden" name="user_uuid" value="${escapeAttr(userUuid)}" />
        <label class="db-field"><span>Display name</span>
          <input name="display_name" value="${escapeAttr(user.display_name ?? '')}" />
        </label>
        <label class="db-field"><span>Username</span>
          <input name="username" value="${escapeAttr(user.username ?? '')}" />
        </label>
        <label class="db-field"><span>WhatsApp</span>
          <input name="whatsapp" value="${escapeAttr(user.whatsapp ?? '')}" />
        </label>
        <label class="db-field"><span>Avatar URL</span>
          <input name="avatar_url" value="${escapeAttr(user.avatar_url ?? '')}" />
        </label>
        <label class="db-field"><span>Email (Auth)</span>
          <input type="email" name="email" value="${escapeAttr(user.email ?? '')}" required />
          <small class="db-field__hint">Cambiar el email requiere confirmación del usuario. Se enruta via Edge Function.</small>
        </label>
        ${renderEventPermissionsEditor(user)}
        <div class="db-modal__actions">
          <button class="btn-primary" type="submit">Guardar</button>
          <button class="db-btn-secondary" type="button" id="js-admin-user-edit-cancel">Cancelar</button>
        </div>
        <div id="js-admin-user-edit-status" class="db-modal__status"></div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#js-admin-user-edit-cancel').addEventListener('click', () => overlay.remove());

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#js-admin-user-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newEmail      = (fd.get('email') ?? '').trim();
    const display_name  = (fd.get('display_name') ?? '').trim() || null;
    const username      = (fd.get('username') ?? '').trim() || null;
    const whatsapp      = (fd.get('whatsapp') ?? '').trim() || null;
    const avatar_url    = (fd.get('avatar_url') ?? '').trim() || null;

    const statusEl = overlay.querySelector('#js-admin-user-edit-status');
    const submitBtn = overlay.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Guardando...';

    const profileOk = await handleAdminUserUpdate(
      user,
      newEmail,
      { display_name, username, whatsapp, avatar_url }
    );
    const eventPermissionsOk = profileOk
      ? await handleEventPermissionsSave(user, e.target)
      : false;

    submitBtn.disabled = false;
    if (profileOk && eventPermissionsOk) {
      overlay.remove();
      navigate('erp-permissions');
    } else {
      if (statusEl) statusEl.textContent = 'No se pudo guardar. Verifica los datos e intenta de nuevo.';
    }
  });
}

/**
 * Admin update of a user's profile fields + email.
 * Email is routed through the Edge Function "admin-update-user" which uses the
 * service-role key server-side to update auth.users.email.
 * The DB trigger then syncs auth.users.email → public.users.email automatically.
 * All other profile fields are updated directly in public.users.
 *
 * @param {Object} selectedUser   Row from public.users (must have .id = auth UUID)
 * @param {string} newEmail
 * @param {Object} profileFields  Other editable public.users fields to save alongside
 */
async function handleAdminUserUpdate(selectedUser, newEmail, profileFields) {
  if (!requireAdminMutation()) return false;

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    showToast('Email de administrador no valido.', 'error');
    return false;
  }

  const emailChanged = newEmail !== (selectedUser.email ?? '');

  // Route the email change (and profile fields) through the Edge Function.
  // The Edge Function uses the service-role key, so we never expose it here.
  if (emailChanged) {
    try {
      const { error: fnError } = await supabase.functions.invoke('admin-update-user', {
        body: {
          id: selectedUser.id,   // public.users.id = auth.users.id (UUID)
          email: newEmail,
          profile: {
            display_name:  profileFields.display_name  ?? selectedUser.display_name  ?? null,
            username:      profileFields.username      ?? selectedUser.username      ?? null,
            whatsapp:      profileFields.whatsapp      ?? selectedUser.whatsapp      ?? null,
            avatar_url:    profileFields.avatar_url    ?? selectedUser.avatar_url    ?? null,
          },
        },
      });

      if (fnError) {
        console.error('[HR] admin-update-user function:', fnError);
        showToast(fnError.message || 'No se pudo actualizar el email del usuario.', 'error');
        return false;
      }

      showToast('Usuario actualizado. El email se sincronizará tras confirmación.', 'success');
      return true;

    } catch (err) {
      console.error('[HR] admin-update-user invoke error:', err);
      showToast('Error al contactar la función de actualización.', 'error');
      return false;
    }
  }

  // Email not changed — update only the profile fields directly in public.users.
  const { error: profileError } = await supabase
    .from('users')
    .update(profileFields)
    .eq('id', selectedUser.id);

  if (profileError) {
    console.error('[HR] admin profile update:', profileError);
    showToast('No se pudo actualizar el perfil.', 'error');
    return false;
  }

  showToast('Perfil del usuario actualizado.', 'success');
  return true;
}

async function handleAdminTableUpdate(form) {
  if (!requireAdminMutation()) return;

  const values = formValues(form);
  const tableName = values.table_name;
  persistAdminTableSearchFromDOM(tableName);
  const config = TABLE_EDITOR_CONFIG[tableName];

  if (!config) {
    showToast('Tabla no permitida.', 'error');
    return;
  }
  if (config.readOnly) {
    showToast('Esta vista es solo lectura.', 'info');
    return;
  }

  let original;
  try {
    original = JSON.parse(decodeURIComponent(values.original));
  } catch (err) {
    console.error('[HR] table editor original parse:', err);
    showToast('No se pudo leer la fila original.', 'error');
    return;
  }

  const payload = {};
  config.editableFields.forEach((field) => {
    if (field in values) payload[field] = values[field];
  });

  const ok = await saveAdminTableRow(tableName, config, original, payload, { confirmUserId: true });
  if (ok) {
    if (tableName === 'payment_methods') state.data.paymentMethods = null;
    if (tableName === 'services') state.data.services = null;
    showToast('Fila actualizada.', 'success');
    navigate('admin-table-editor');
  }
}

async function saveAdminTableRow(tableName, config, original, payload, options = {}) {
  if (tableName === 'payment_methods' || tableName === 'services') {
    if ('key' in payload) payload.key = String(payload.key ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if ('name' in payload) payload.name = String(payload.name ?? '').trim();
    if ('status' in payload) payload.status = String(payload.status || 'active').toLowerCase();
    if ('sort_order' in payload) payload.sort_order = Number(payload.sort_order || 100);
    if (tableName === 'services') {
      if ('show_in_finance' in payload) payload.show_in_finance = parseBooleanField(payload.show_in_finance);
      if ('show_in_session' in payload) payload.show_in_session = parseBooleanField(payload.show_in_session);
      if ('session_cost' in payload) payload.session_cost = payload.session_cost === '' || payload.session_cost == null ? null : Number(payload.session_cost);
      if ('session_minutes' in payload) payload.session_minutes = payload.session_minutes === '' || payload.session_minutes == null ? null : Number(payload.session_minutes);
    }
  }

  if (tableName === 'users' && 'occupations' in payload) {
    payload.occupations = normalizeOccupationsValue(payload.occupations);
  }
  if (tableName === 'users' && 'passline_tracking' in payload) {
    payload.passline_tracking = normalizePasslineTrackingValue(payload.passline_tracking);
  }

  if (tableName === 'users' && 'user_id' in payload && String(payload.user_id ?? '') !== String(original.user_id ?? '') && options.confirmUserId !== false) {
    const confirmed = window.confirm(
      `Advertencia: vas a cambiar el User ID operativo de este usuario.\n\nAnterior: ${original.user_id ?? '-'}\nNuevo: ${payload.user_id || '-'}\n\nEste campo conecta historial, sesiones, transacciones y membresias. Confirma solo si sabes que este cambio es intencional.`
    );

    if (!confirmed) return false;
  }

  const sensitiveUserChanges = {};
  if (tableName === 'users') {
    ['roles', 'temp_password', 'has_auth', 'passline_tracking', 'user_id'].forEach((field) => {
      if (field in payload) {
        sensitiveUserChanges[field] = payload[field];
        delete payload[field];
      }
    });
  }

  // public.users.email must be updated through auth.users via the Edge Function.
  // The DB trigger then syncs auth.users.email → public.users.email automatically.
  if (tableName === 'users' && 'email' in payload) {
    const newEmail = payload.email ?? '';
    delete payload.email; // never write email directly to public.users

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      showToast('El email no tiene un formato válido.', 'error');
      return false;
    }

    try {
      const { error: fnError } = await supabase.functions.invoke('admin-update-user', {
        body: {
          id: original.id,   // public.users.id = auth.users.id (UUID) — NOT user_id
          email: newEmail,
          profile: {
            display_name: payload.display_name ?? original.display_name ?? null,
            username:     payload.username     ?? original.username     ?? null,
            whatsapp:     payload.whatsapp     ?? original.whatsapp     ?? null,
            avatar_url:   payload.avatar_url   ?? original.avatar_url   ?? null,
          },
        },
      });

      if (fnError) {
        console.error('[HR] table editor admin-update-user:', fnError);
        showToast(fnError.message || 'No se pudo actualizar el email. Revisa la Edge Function.', 'error');
        return false;
      }
    } catch (err) {
      console.error('[HR] table editor admin-update-user invoke:', err);
      showToast('Error al contactar la función de actualización de email.', 'error');
      return false;
    }

    // If there are no other fields left to update, we're done.
    if (Object.keys(payload).length === 0 && Object.keys(sensitiveUserChanges).length === 0) {
      return true;
    }
  }

  if (Object.keys(sensitiveUserChanges).length > 0) {
    const { error: sensitiveError } = await supabase.rpc('admin_update_public_user_sensitive', {
      p_target_user_id: original.id,
      p_changes: sensitiveUserChanges,
    });
    if (sensitiveError) {
      console.error('[HR] sensitive users update:', sensitiveError);
      showToast('No se pudo actualizar el campo protegido del usuario.', 'error');
      return false;
    }
  }

  // Update remaining non-email profile fields directly in public.users.
  if (Object.keys(payload).length === 0) {
    return true;
  }

  let query = supabase.from(tableName).update(payload);

  if (config.primaryKey) {
    query = query.eq(config.primaryKey, original[config.primaryKey]);
  } else {
    config.matchFields.forEach((field) => {
      query = query.eq(field, original[field]);
    });
  }

  const { error } = await query;

  if (error) {
    console.error('[HR] table editor update:', error);
    showToast('No se pudo actualizar la fila. Revisa RLS/permisos.', 'error');
    return false;
  }

  return true;
}

function adminRowLabel(row) {
  return row.display_name || row.username || row.email || row.concept || row.name || row.user_id || row.id || 'Fila';
}

function adminFieldLabel(config, field) {
  return config.pdfColumnLabels?.[field] ?? field;
}

function collectAdminTableFormChange(form, config) {
  const values = formValues(form);
  let original;
  try {
    original = JSON.parse(decodeURIComponent(values.original));
  } catch (err) {
    console.error('[HR] table editor original parse:', err);
    return null;
  }

  const payload = {};
  const changes = [];
  config.editableFields.forEach((field) => {
    if (!(field in values)) return;
    const beforeValue = original[field] ?? '';
    const afterValue = values[field] ?? '';
    if (String(beforeValue) === String(afterValue)) return;
    payload[field] = afterValue;
    changes.push({ field, beforeValue, afterValue });
  });

  if (!changes.length) return null;
  return { original, payload, changes };
}

async function handleAdminTableSaveAll() {
  if (!requireAdminMutation()) return;

  const tableName = state.data.adminTableName || setAdminTableName(readStoredAdminTableName());
  persistAdminTableSearchFromDOM(tableName);
  if (tableName === 'membership_dashboard') {
    await handleMembershipDashboardSaveAll();
    return;
  }

  const config = TABLE_EDITOR_CONFIG[tableName];

  if (!config) {
    showToast('Tabla no permitida.', 'error');
    return;
  }
  if (config.readOnly) {
    showToast('Esta vista es solo lectura.', 'info');
    return;
  }

  const forms = [...document.querySelectorAll('form[data-form="admin-table-update"]')];
  const pending = forms
    .map((form) => collectAdminTableFormChange(form, config))
    .filter(Boolean);

  if (!pending.length) {
    showToast('No hay cambios pendientes.', 'info');
    return;
  }

  const summary = pending.flatMap((item, index) => {
    const label = adminRowLabel(item.original);
    return item.changes.map((change) => {
      const beforeText = String(change.beforeValue || '-');
      const afterText = String(change.afterValue || '-');
      return `${index + 1}. ${label} - ${adminFieldLabel(config, change.field)}: ${beforeText} -> ${afterText}`;
    });
  });
  const extraCount = Math.max(0, summary.length - 18);
  const preview = summary.slice(0, 18).join('\n');
  const confirmed = window.confirm(
    `Vas a guardar ${pending.length} fila${pending.length === 1 ? '' : 's'} con ${summary.length} cambio${summary.length === 1 ? '' : 's'}:\n\n${preview}${extraCount ? `\n... y ${extraCount} cambio${extraCount === 1 ? '' : 's'} más.` : ''}\n\n¿Confirmas guardar estos cambios?`
  );

  if (!confirmed) return;

  for (const item of pending) {
    const ok = await saveAdminTableRow(tableName, config, item.original, { ...item.payload }, { confirmUserId: false });
    if (!ok) return;
  }

  showToast('Cambios guardados.', 'success');
  navigate('admin-table-editor');
}

function collectMembershipDeliveryFormChange(form) {
  const values = formValues(form);
  const beforeDeliveredAt = values.delivered_at_original ?? '';
  const afterDeliveredAt = values.delivered_at ?? '';
  const changes = [];

  if (String(beforeDeliveredAt) !== String(afterDeliveredAt)) {
    changes.push({
      field: 'Fecha de entrega',
      beforeValue: beforeDeliveredAt ? formatDisplayDateOnly(beforeDeliveredAt) : '-',
      afterValue: afterDeliveredAt ? formatDisplayDateOnly(afterDeliveredAt) : '-',
    });
  }

  if (!changes.length) return null;

  return {
    type: 'delivery',
    values,
    changes,
    label: `Ciclo ${values.cycle_number || '-'}`,
  };
}

function collectMembershipSessionNotesFormChange(form) {
  const values = formValues(form);
  const beforeNotes = values.notes_original ?? '';
  const afterNotes = values.notes ?? '';
  const changes = [];

  if (String(beforeNotes) !== String(afterNotes)) {
    changes.push({
      field: 'Notas de sesión',
      beforeValue: beforeNotes || '-',
      afterValue: afterNotes || '-',
    });
  }

  if (!changes.length) return null;

  return {
    type: 'session-notes',
    values,
    changes,
    label: `Sesión ${values.session_id || '-'}`,
  };
}

async function handleMembershipDashboardSaveAll() {
  if (!requireAdminMutation()) return;
  persistAdminTableSearchFromDOM('membership_dashboard');

  const deliveryForms = [...document.querySelectorAll('form[data-form="membership-delivery"][data-stay-section="admin-table-editor"]')];
  const sessionNotesForms = [...document.querySelectorAll('form[data-form="membership-session-notes"][data-stay-section="admin-table-editor"]')];
  const pending = [
    ...deliveryForms.map(collectMembershipDeliveryFormChange),
    ...sessionNotesForms.map(collectMembershipSessionNotesFormChange),
  ]
    .filter(Boolean);

  if (!pending.length) {
    showToast('No hay cambios pendientes.', 'info');
    return;
  }

  const invalid = pending.find((item) => item.type === 'delivery' && !item.values.delivered_at);
  if (invalid) {
    showToast('Fecha de entrega es obligatoria para guardar cambios de entrega.', 'error');
    return;
  }

  const summary = pending.flatMap((item, index) => item.changes.map((change) => (
    `${index + 1}. ${item.label} - ${change.field}: ${change.beforeValue} -> ${change.afterValue}`
  )));
  const extraCount = Math.max(0, summary.length - 18);
  const preview = summary.slice(0, 18).join('\n');
  const confirmed = window.confirm(
    `Vas a guardar ${pending.length} fila${pending.length === 1 ? '' : 's'} con ${summary.length} cambio${summary.length === 1 ? '' : 's'}:\n\n${preview}${extraCount ? `\n... y ${extraCount} cambio${extraCount === 1 ? '' : 's'} más.` : ''}\n\n¿Confirmas guardar estos cambios?`
  );

  if (!confirmed) return;

  for (const item of pending) {
    const ok = item.type === 'session-notes'
      ? await saveMembershipSessionNotesValues(item.values)
      : await saveMembershipDeliveryValues(item.values);
    if (!ok) return;
  }

  showToast('Cambios guardados.', 'success');
  navigate('admin-table-editor');
}

async function handleAdminTableDelete(tableName, encodedRow) {
  if (!requireAdminMutation()) return;
  persistAdminTableSearchFromDOM(tableName);

  const config = TABLE_EDITOR_CONFIG[tableName];
  if (!config) {
    showToast('Tabla no permitida.', 'error');
    return;
  }
  if (config.readOnly) {
    showToast('Esta vista es solo lectura.', 'info');
    return;
  }

  let original;
  try {
    original = JSON.parse(decodeURIComponent(encodedRow));
  } catch (err) {
    console.error('[HR] table editor delete parse:', err);
    showToast('No se pudo leer la fila a eliminar.', 'error');
    return;
  }

  const label = config.label || tableName;
  const prefersConcept = tableName === 'transactions' || tableName === 'hr_transactions' || tableName === 'sessions';
  const readable = prefersConcept
    ? (original.concept || original.name || original.id || original.user_id || 'esta fila')
    : (original.display_name || original.username || original.concept || original.name || original.id || original.user_id || 'esta fila');
  const confirmed = tableName === 'downloads'
    ? window.confirm(
      `Vas a quitar la descarga ${readable} del usuario ${original.user_id || 'sin user_id'}.\n\nSolo se borra la asignacion en BB.DD.; el usuario y el archivo en Cloud se conservan.\n\nConfirmas?`
    )
    : window.confirm(
      `Advertencia: vas a eliminar permanentemente ${readable} de ${label}.\n\nEsta accion no se puede deshacer. Confirmas la eliminacion?`
    );

  if (!confirmed) return;

  if (tableName === 'users') {
    await handleAdminUserDelete(original);
    return;
  }

  let query = supabase.from(tableName).delete({ count: 'exact' });
  if (config.primaryKey) {
    query = query.eq(config.primaryKey, original[config.primaryKey]);
  } else if (original.id) {
    query = query.eq('id', original.id);
  } else {
    (config.matchFields ?? []).forEach((field) => {
      query = query.eq(field, original[field]);
    });
  }

  const { error, count } = await query;
  if (error) {
    console.error('[HR] table editor delete:', error);
    showToast('No se pudo eliminar la fila. Revisa RLS/permisos.', 'error');
    return;
  }

  if (count === 0) {
    console.warn('[HR] table editor delete affected 0 rows:', { tableName, original });
    showToast('No se eliminó ninguna fila. Revisa policies DELETE/RLS.', 'error');
    return;
  }

  if (tableName === 'payment_methods') state.data.paymentMethods = null;
  if (tableName === 'services') state.data.services = null;
  showToast(tableName === 'downloads' ? 'Descarga desasignada. Usuario y archivo Cloud conservados.' : 'Fila eliminada.', 'success');
  navigate('admin-table-editor');
}

async function handleAdminUserDelete(user) {
  try {
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: {
        user_id: user.id ?? null,
      },
    });

    if (error) {
      console.error('[HR] admin-delete-user function:', error);
      showToast(error.message || 'No se pudo eliminar el usuario.', 'error');
      return;
    }

    if (data?.error || data?.success === false) {
      console.error('[HR] admin-delete-user:', data.error);
      showToast(data.error, 'error');
      return;
    }

    showToast('Usuario eliminado de Auth y BB.DD.', 'success');
    state.data.users = null;
    navigate('admin-table-editor');
  } catch (err) {
    console.error('[HR] admin-delete-user invoke:', err);
    showToast('Error al contactar la función de eliminación.', 'error');
  }
}

function loadScriptOnce(src, globalCheck) {
  if (globalCheck()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function ensurePdfLibraries() {
  await loadScriptOnce(
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    () => Boolean(window.jspdf?.jsPDF)
  );
  await loadScriptOnce(
    'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',
    () => Boolean(window.jspdf?.jsPDF?.API?.autoTable)
  );
}

async function handleAdminPdfExport(tableLabel = 'Tabla administrativa') {
  if (!requireAdminMutation()) return;

  const table = document.querySelector('.db-table--editor');
  if (!table) {
    showToast('No hay tabla visible para exportar.', 'error');
    return;
  }

  const tableName = state.data.adminTableName || setAdminTableName(readStoredAdminTableName());
  const config = TABLE_EDITOR_CONFIG[tableName] || {};
  const configuredColumns = [...(config.lockedFields ?? []), ...(config.editableFields ?? [])]
    .filter((field, index, arr) => arr.indexOf(field) === index);
  const visibleColumns = configuredColumns.filter((field) => !(config.hiddenColumns ?? []).includes(field));
  const visibleHeaders = [...table.querySelectorAll('thead th')]
    .map((th) => th.textContent.trim())
    .filter((text) => text && text.toLowerCase() !== 'acciones');

  const visibleRows = [...table.querySelectorAll('tbody tr')]
    .filter((tr) => !tr.hidden && !tr.classList.contains('db-table__empty-row'))
    .map((tr) => [...tr.children]
      .slice(0, visibleHeaders.length)
      .map((td) => {
        const input = td.querySelector('input, textarea, select');
        return input ? input.value : td.textContent.trim();
      }));

  const pdfColumns = config.pdfColumns?.length
    ? config.pdfColumns.filter((field) => visibleColumns.includes(field))
    : visibleColumns;
  const columnIndexes = pdfColumns.map((field) => visibleColumns.indexOf(field));
  const headers = pdfColumns.map((field) => config.pdfColumnLabels?.[field] ?? field);
  const rows = visibleRows.map((row) => columnIndexes.map((index) => row[index] ?? '-'));

  if (!rows.length) {
    showToast('No hay filas visibles para exportar.', 'info');
    return;
  }

  try {
    await ensurePdfLibraries();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const generatedAt = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

    doc.setFontSize(16);
    doc.text('Hidden Room - Exportacion BB.DD.', 40, 40);
    doc.setFontSize(10);
    doc.text(`Generado: ${generatedAt}`, 40, 58);
    doc.text(`Tabla: ${tableLabel}`, 40, 74);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 92,
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [32, 32, 32] },
      margin: { left: 40, right: 40 },
    });

    const fileName = `hidden-room-${String(tableLabel).toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    showToast('PDF generado.', 'success');
  } catch (err) {
    console.error('[HR] PDF export:', err);
    showToast('No se pudo generar el PDF.', 'error');
  }
}

async function handleFinancePdfExport() {
  const isCollabFinance = state.activeSection === 'collab-finance';
  if (!isCollabFinance && !requireAdminMutation()) return;
  if (isCollabFinance && !hasRole('admin') && !hasPermission('events.access')) {
    showToast('No tienes permiso para exportar finanzas de eventos.', 'error');
    return;
  }

  const rows = isCollabFinance ? (state.data.collabFinanceRows ?? []) : (state.data.erpFinanceRows ?? []);
  const filters = isCollabFinance
    ? (state.data.collabFinanceFilters ?? { ...getEventFinanceFilters(), scope: 'events', eventId: persistedDataValue('collabFinanceEventId', '') })
    : (state.data.erpFinanceFilters ?? getFinanceFilters());
  const events = isCollabFinance ? (state.data.collabFinanceEvents ?? []) : (state.data.financeEvents ?? []);
  const selectedEvent = isCollabFinance
    ? state.data.collabFinanceSelectedEvent
    : events.find((event) => String(event.id ?? event.event_id ?? event.event_key) === String(filters.eventId));
  const scopeLabel = filters.scope === 'events'
    ? (selectedEvent ? eventLabel(selectedEvent) : (filters.eventId || 'Todos los eventos'))
    : FINANCE_STUDIO_SOURCES.find((item) => item.value === filters.studio)?.label ?? filters.studio;

  if (!rows.length) {
    showToast('No hay datos financieros para exportar.', 'info');
    return;
  }

  try {
    await ensurePdfLibraries();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const generatedAt = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    const isEventFinance = filters.scope === 'events';
    const amountGetter = isEventFinance ? eventFinanceAmount : transactionAmount;
    const { ingresos, egresos, balance, hasExplicitIncomeExpense } = financeTotals(rows, amountGetter, {
      balanceFromAmountWhenNoIncomeExpense: isEventFinance,
    });
    const showIncomeExpenseAsNE = isEventFinance && !hasExplicitIncomeExpense;

    doc.setFontSize(16);
    doc.text('Hidden Room - Finanzas', 40, 40);
    doc.setFontSize(10);
    doc.text(`Generado: ${generatedAt}`, 40, 58);
    doc.text(`Origen: ${filters.scope === 'events' ? 'Eventos' : 'Estudio'} / ${scopeLabel}`, 40, 74);
    doc.text(`Periodo: ${financePeriodLabel(filters)} - Tipo: ${filters.type}`, 40, 90);
    doc.text(`Ingresos cobrados: ${showIncomeExpenseAsNE ? 'NE' : money(ingresos)}   Egresos pagados: ${showIncomeExpenseAsNE ? 'NE' : money(egresos)}   Flujo neto: ${money(balance)}`, 40, 106);

    doc.autoTable({
      head: [isEventFinance
        ? ['Concepto', 'Tipo', 'Monto', 'M.A.I.', 'FROM', 'TO', 'Corresponde a', 'Fecha', 'Metodo', 'Creado por', 'Notas']
        : ['Concepto', 'Tipo', 'Monto', 'Fecha', 'Status', 'Cliente']],
      body: rows.map((tx) => isEventFinance
        ? [
          tx.concept ?? '-',
          movementTypeLabel(tx.movement_type) || tx.type || '-',
          money(Number(tx.amount ?? 0)),
          money(Number(tx.hidden_room_share ?? eventFinanceAmount(tx) ?? 0)),
          participantName(tx.from_user_id),
          participantName(tx.to_user_id),
          financeEntityName(tx.owner_entity_id, tx.owner_user_id),
          formatDisplayDateOnly(tx.movement_date ?? tx.date),
          tx.payment_method ?? tx.via ?? '-',
          tx.created_by_user_id ?? '-',
          tx.notes ?? '-',
        ]
        : [
          tx.concept ?? '-',
          tx.type ?? '-',
          money(Number(tx.amount ?? 0)),
          formatDisplayDateOnly(tx.date),
          tx.status ?? '-',
          tx.username ?? tx.user_id ?? '-',
        ]),
      startY: 124,
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [32, 32, 32] },
      margin: { left: 40, right: 40 },
    });

    const fileName = `hidden-room-finanzas-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    showToast('PDF financiero generado.', 'success');
  } catch (err) {
    console.error('[HR] finance PDF export:', err);
    showToast('No se pudo exportar Finanzas a PDF.', 'error');
  }
}

function filterTableRows(input) {
  const targetId = input.dataset.tableTarget;
  const tbody = document.getElementById(targetId);
  if (!tbody) return;

  const tableName = input.dataset.adminTableName;
  const query = input.value.trim();
  if (tableName) setAdminTableSearch(tableName, query);
  else setTableSearch(input, query);

  const normalizedQuery = normalizeSearchText(query);
  let visibleCount = 0;
  tbody.querySelectorAll('[data-search-row]').forEach((row) => {
    const searchable = normalizeSearchText(row.dataset.searchText || row.textContent);
    const visible = normalizedQuery ? searchable.includes(normalizedQuery) : true;
    row.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  const count = document.getElementById(input.dataset.tableCount);
  if (count) {
    count.textContent = query
      ? `${visibleCount} resultado${visibleCount === 1 ? '' : 's'}`
      : `${visibleCount} filas visibles`;
  }
}

function applyAuthAuditFilter(filter = 'all') {
  document.querySelectorAll('[data-auth-audit-groups]').forEach((block) => {
    const groups = String(block.dataset.authAuditGroups ?? '').split(/\s+/).filter(Boolean);
    block.hidden = filter !== 'all' && !groups.includes(filter);
  });
}


/* ================================================================
   Section 13  UTILITY FUNCTIONS
================================================================ */

/** Prevent XSS when injecting user-supplied strings into innerHTML */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

function escapeAttr(value) {
  return escapeHTML(String(value ?? ''));
}

function enhancePasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]:not([data-password-toggle-ready]), input[type="text"][data-password-visible="true"]:not([data-password-toggle-ready])').forEach((input) => {
    input.dataset.passwordToggleReady = 'true';
    const wrapper = document.createElement('div');
    wrapper.className = 'db-password-field';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'db-password-toggle';
    button.dataset.action = 'toggle-password';
    button.setAttribute('aria-label', 'Ver contraseña');
    button.innerHTML = '<span class="password-eye" aria-hidden="true"></span>';
    wrapper.appendChild(button);
  });
}

/** Human-readable relative time */
function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return 'ahora';
  if (diff < 3600_000)  return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} h`;
  return `${Math.floor(diff / 86400_000)} d`;
}

function syncUserAutofillFields(picker, user) {
  const form = picker?.closest('form');
  if (!form) return;

  const userIdInput = form.querySelector('[data-user-autofill="user_id"]');
  const usernameInput = form.querySelector('[data-user-autofill="username"]');

  if (userIdInput) userIdInput.value = user?.user_id ?? '';
  if (usernameInput) usernameInput.value = user?.username ?? '';
}

function filterUserPicker(search, { clearSelection = false } = {}) {
  const picker = search.closest('.db-user-picker');
  const menu = picker?.querySelector('.db-user-picker__menu');
  const hidden = picker?.querySelector('input[type="hidden"]');
  const query = normalizeSearchText(search.value);

  if (clearSelection && hidden) hidden.value = '';
  if (clearSelection) syncUserAutofillFields(picker, null);
  if (clearSelection) updateDownloadMembershipOptions(picker?.closest('form'), '');
  if (!menu) return;

  const valueField = picker?.dataset.userValueField || 'user_id';
  const requiredField = picker?.dataset.userRequiredField || '';
  const limit = Number(picker?.dataset.userPickerLimit || USER_PICKER_RENDER_LIMIT);
  const pickerUsers = picker?.dataset.membershipUserPicker === 'true'
    ? state.data.membershipDashboardUsers
    : state.data.users;
  const users = uniqueUsers(pickerUsers)
    .filter((user) => !requiredField || String(user?.[requiredField] ?? '').trim());
  const matchedUsers = (query
    ? users.filter((user) => userPickerSearchText(user).includes(query))
    : users)
    .slice(0, Number.isFinite(limit) ? limit : USER_PICKER_RENDER_LIMIT);

  menu.querySelectorAll('.db-user-option, [data-user-picker-clipped]').forEach((item) => item.remove());
  menu.insertAdjacentHTML('afterbegin', renderUserPickerOptions(matchedUsers, { valueField }));

  const empty = menu.querySelector('[data-user-picker-empty]');
  if (empty) empty.hidden = matchedUsers.length > 0;
  menu.hidden = false;
}


/* ================================================================
   Section 14  EVENT DELEGATION - MAIN AREA
================================================================ */

function attachMainDelegation() {
  const main = document.getElementById('js-main');

  main?.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const trendSeries = e.target.closest('[data-finance-trend-series]');
    if (trendSeries) {
      const chartWrap = trendSeries.closest('[data-finance-trend]');
      const selectedIndex = trendSeries.dataset.financeTrendSeries;
      const nextIndex = chartWrap?.dataset.financeTrendActive === selectedIndex ? '' : selectedIndex;
      if (chartWrap) {
        chartWrap.dataset.financeTrendActive = nextIndex;
        chartWrap.querySelectorAll('[data-finance-trend-line]').forEach((line) => {
          line.classList.toggle('is-muted', nextIndex !== '' && line.dataset.financeTrendLine !== nextIndex);
        });
        chartWrap.querySelectorAll('[data-finance-trend-series]').forEach((button) => {
          const isActive = nextIndex !== '' && button.dataset.financeTrendSeries === nextIndex;
          button.classList.toggle('is-active', isActive);
          button.classList.toggle('is-muted', nextIndex !== '' && !isActive);
          button.setAttribute('aria-pressed', String(isActive));
        });
      }
      return;
    }
    const cloudFolderDownload = e.target.closest("[data-cloud-folder-download]");
    if (cloudFolderDownload) {
      e.preventDefault();
      downloadCloudFolderFromPortal(cloudFolderDownload);
      return;
    }

    if (action === 'client-download-preview') {
      const previewButton = e.target.closest('[data-preview-reference]');
      if (previewButton) playCloudPreviewFromPortal(previewButton);
      return;
    }

    const directCloudDownload = e.target.closest('[data-direct-cloud-download="true"]');
    if (directCloudDownload) {
      e.preventDefault();
      downloadCloudFileFromPortal(directCloudDownload);
      return;
    }

    const beatSaleCloudButton = e.target.closest("[data-beat-sale-cloud]");
    if (beatSaleCloudButton) {
      const form = beatSaleCloudButton.closest("form");
      const existing = [...beatSaleCloudPickerRecords].find((record) => record.form === form);
      const picker = getBeatSaleCloudPicker(form);
      if (!existing) picker?.open();
      return;
    }

    const downloadCloudButton = e.target.closest("[data-download-cloud]");
    if (downloadCloudButton) {
      const form = downloadCloudButton.closest("form");
      const existing = [...downloadCloudPickerRecords].find((record) => record.form === form);
      const picker = getDownloadCloudPicker(form);
      if (!existing) picker?.open();
      return;
    }

    if (action === 'download-select-file') {
      e.target.closest('form')?.querySelector('[data-download-file]')?.click();
      return;
    }

    if (action === 'download-select-folder') {
      e.target.closest('form')?.querySelector('[data-download-folder]')?.click();
      return;
    }

    const passwordToggle = e.target.closest('[data-action="toggle-password"]');
    if (passwordToggle) {
      const input = passwordToggle.closest('.db-password-field')?.querySelector('input');
      if (input) {
        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        input.dataset.passwordVisible = visible ? 'false' : 'true';
        passwordToggle.innerHTML = '<span class="password-eye" aria-hidden="true"></span>';
        passwordToggle.setAttribute('aria-label', visible ? 'Ver contraseña' : 'Ocultar contraseña');
      }
      return;
    }

    const clientHomeAction = e.target.closest('.db-client-home-card[data-section]');
    if (clientHomeAction) {
      navigate(clientHomeAction.dataset.section);
      return;
    }

    const qa = e.target.closest('.db-quick-action[data-section], .db-profile-action[data-section]');
    if (qa) {
      navigate(qa.dataset.section);
    }

    const userOption = e.target.closest('.db-user-option[data-user-value]');
    if (userOption) {
      const picker = userOption.closest('.db-user-picker');
      const hidden = picker?.querySelector('input[type="hidden"]');
      const search = picker?.querySelector('[data-user-search]');
      const pickerUsers = picker?.dataset.membershipUserPicker === 'true'
        ? state.data.membershipDashboardUsers
        : state.data.users;
      const user = (pickerUsers ?? []).find((u) => String(u.user_id) === String(userOption.dataset.userId));
      if (hidden) hidden.value = userOption.dataset.userValue ?? '';
      if (search) search.value = userOption.dataset.userDisplay || userLabel(userOption.dataset.userId);
      syncUserAutofillFields(picker, user);
      updateDownloadMembershipOptions(picker?.closest('form'), user?.user_id ?? '');
      picker?.querySelector('.db-user-picker__menu')?.setAttribute('hidden', '');
      picker?.querySelectorAll('.db-user-option').forEach((option) => {
        option.hidden = false;
        option.style.display = '';
      });
      if (user) search?.setAttribute('aria-label', usernameLabel(user));
      if (picker?.dataset.membershipUserPicker === 'true') {
        setAdminTableSearch('membership_dashboard', hidden?.value || '');
        navigate('admin-table-editor');
        return;
      }
    }

    const taskCard = e.target.closest('.db-task-card[data-task-id]');

    if (action === 'view-as-cancel') {
      window.HiddenRoomViewAs?.cancelSelector?.();
      return;
    }

    if (taskCard && action === 'task-edit') {
      const task = (state.data.tasks ?? []).find((item) => String(item.id) === String(taskCard.dataset.taskId));
      const holder = document.querySelector('.db-admin-grid .db-card__inner');
      if (task && holder) holder.innerHTML = renderTaskForm(task);
    }

    if (action === 'task-cancel') {
      navigate(state.activeSection || 'collab-tasks');
    }

    if (taskCard && action === 'task-delete') {
      handleTaskDelete(taskCard.dataset.taskId);
    }

    if (action === 'permission-remove') {
      const btn = e.target.closest('[data-permission-id]');
      handlePermissionRemove(btn?.dataset.permissionId);
    }

    if (action === 'admin-user-edit') {
      const btn = e.target.closest('[data-user-uuid]');
      const userUuid = btn?.dataset.userUuid;
      if (userUuid) showAdminUserEditModal(userUuid);
    }

    if (action === 'share-login') {
      const btn = e.target.closest('[data-user-row]');
      if (btn?.dataset.userRow) handleShareLogin(btn.dataset.userRow);
    }

    if (action === 'copy-temp-password') {
      const btn = e.target.closest('[data-temp-password]');
      if (btn?.dataset.tempPassword) {
        navigator.clipboard?.writeText(btn.dataset.tempPassword)
          .then(() => showToast('Contraseña temporal copiada.', 'success'))
          .catch(() => showToast('No se pudo copiar automáticamente.', 'error'));
      }
    }

    if (action === 'copy-cloud-hiddenroom-url') {
      const btn = e.target.closest('[data-url]');
      const url = btn?.dataset.url;
      if (url) {
        navigator.clipboard?.writeText(url)
          .then(() => showToast('URL copiada a portapapeles.', 'success'))
          .catch(() => showToast('No se pudo copiar automáticamente.', 'error'));
      }
    }

    if (action === 'client-downloads-open-folder') {
      const folderKey = e.target.closest('[data-folder-key]')?.dataset.folderKey;
      if (folderKey) {
        setState({ clientDownloads: { selectedFolder: folderKey, browser: null } });
        renderSection(state.activeSection);
      }
      return;
    }

    if (action === 'client-downloads-back') {
      setState({ clientDownloads: { selectedFolder: null, browser: null } });
      renderSection(state.activeSection);
      return;
    }

    if (action === 'client-download-folder-open') {
      const button = e.target.closest('[data-download-reference]');
      const reference = button?.dataset.downloadReference || '';
      const request = cloudDownloadRequestFromHref(reference);
      if (!request) {
        showToast('La carpeta no tiene una ruta Cloud válida.', 'error');
        return;
      }
      const folderKey = state.clientDownloads?.selectedFolder;
      setState({
        clientDownloads: {
          selectedFolder: folderKey,
          browser: {
            name: button.dataset.downloadName || request.name,
            rootPath: joinCloudPath(request.path, request.name),
            path: joinCloudPath(request.path, request.name),
          },
        },
      });
      renderSection(state.activeSection);
      return;
    }

    if (action === 'client-download-folder-back') {
      const browser = state.clientDownloads?.browser;
      if (!browser) return;
      const atRoot = normalizeCloudPath(browser.path) === normalizeCloudPath(browser.rootPath);
      if (atRoot) {
        setState({ clientDownloads: { selectedFolder: state.clientDownloads?.selectedFolder || null, browser: null } });
      } else {
        const parentPath = parentCloudPath(browser.path);
        setState({
          clientDownloads: {
            selectedFolder: state.clientDownloads?.selectedFolder || null,
            browser: {
              ...browser,
              path: parentPath,
              name: parentPath.split('/').filter(Boolean).pop() || browser.name,
            },
          },
        });
      }
      renderSection(state.activeSection);
      return;
    }
    if (action === 'cloud-upload-file') {
      document.getElementById('js-cloud-file-input')?.click();
      return;
    }

    if (action === 'cloud-create-folder') {
      const name = window.prompt('Nombre de la nueva carpeta');
      if (name) {
        createCloudFolder(name)
          .then(() => renderSection(state.activeSection))
          .catch((err) => showToast(err.message || 'No se pudo crear la carpeta.', 'error'));
      }
      return;
    }

    if (action === 'cloud-open-folder' || action === 'cloud-breadcrumb') {
      const btn = e.target.closest('[data-path]');
      const path = btn?.dataset.path;
      if (path) {
        setState({ erpCloud: { currentPath: normalizeCloudPath(path) } });
        renderSection(state.activeSection);
      }
      return;
    }

    if (action === 'cloud-delete-item') {
      const btn = e.target.closest('[data-item-type][data-item-name]');
      if (btn) {
        deleteCloudFile(btn.dataset.itemType, btn.dataset.itemName)
          .then(() => renderSection(state.activeSection))
          .catch((err) => showToast(err.message || 'No se pudo eliminar.', 'error'));
      }
      return;
    }

    if (action === 'cloud-copy-link') {
      const btn = e.target.closest('[data-url]');
      const url = btn?.dataset.url;
      if (url) {
        navigator.clipboard?.writeText(url)
          .then(() => showToast('Enlace copiado.', 'success'))
          .catch(() => showToast('No se pudo copiar automáticamente.', 'error'));
      }
      return;
    }

    if (action === 'ig-analyze-media') {
      const btn = e.target.closest('[data-media-id]');
      handleIgAnalyzeMedia(btn?.dataset.mediaId);
      return;
    }

    if (action === 'ig-export-csv') {
      const btn = e.target.closest('[data-ranking]');
      exportIgRankingCsv(btn?.dataset.ranking || 'total');
      return;
    }

    if (action === 'ig-export-pdf') {
      exportIgAnalysisPdf();
      return;
    }

    if (action === 'ig-export-comments-markdown') {
      exportIgCommentsMarkdown();
      return;
    }


    if (action === 'instagram-scraper-rank-pdf') {
      exportInstagramScraperRankPdf();
      return;
    }

    if (action === 'instagram-scraper-rank-md') {
      exportInstagramScraperRankMarkdown();
      return;
    }

    if (action === 'instagram-scraper-reset-analysis') {
      resetInstagramScraperAnalysis();
      return;
    }
    if (action === 'instagram-scraper-pdf') {
      downloadInstagramScraperPdf();
      return;
    }

    if (action === 'instagram-scraper-md') {
      downloadInstagramScraperMarkdown();
      return;
    }

    if (action === 'instagram-scraper-load-last') {
      loadInstagramScraperLastResult();
      return;
    }

    if (action === 'ig-reset-analysis') {
      const igState = getIgMentionState();
      igState.analysis = null;
      igState.selectedMedia = null;
      igState.isAnalyzing = false;
      igState.error = '';
      renderSection('erp-ig-mention-rank');
      return;
    }

    if (action === 'refresh-session') {
      handleRefreshSession();
    }

    if (action === 'table-sort') {
      const btn = e.target.closest('[data-table-id][data-sort-field]');
      if (btn) {
        persistAdminTableSearchFromDOM();
        setTableSort(btn.dataset.tableId, btn.dataset.sortField);
        navigate(state.activeSection);
      }
    }

    if (action === 'export-admin-pdf') {
      handleAdminPdfExport(e.target.closest('[data-table-label]')?.dataset.tableLabel);
    }

    if (action === 'admin-table-save-all') {
      handleAdminTableSaveAll();
    }

    if (action === 'export-finance-pdf') {
      handleFinancePdfExport();
    }

    if (action === 'passline-preview') {
      handlePasslinePreview();
      return;
    }

    if (action === 'passline-import') {
      handlePasslineImport();
      return;
    }

    if (action === 'event-movement-edit') {
      const btn = e.target.closest('[data-event-movement]');
      if (btn?.dataset.eventMovement) handleEventMovementEdit(btn.dataset.eventMovement);
    }

    if (action === 'membership-cancel-row' || action === 'membership-finish-row') {
      const btn = e.target.closest('[data-row-original]');
      if (btn) handleMembershipRowStatusAction(action === 'membership-cancel-row' ? 'cancel' : 'finish', btn.dataset.rowOriginal);
      return;
    }

    if (action === 'admin-table-delete') {
      const btn = e.target.closest('[data-table-name][data-row-original]');
      if (btn) handleAdminTableDelete(btn.dataset.tableName, btn.dataset.rowOriginal);
    }

    if (action === 'admin-operation-receipt-share') {
      const btn = e.target.closest('[data-table-name][data-row-original]');
      if (btn) handleAdminOperationReceiptShare(btn.dataset.tableName, btn.dataset.rowOriginal);
      return;
    }

    if (action === 'operation-receipt') {
      const form = e.target.closest('form[data-form]');
      if (form) handleOperationReceipt(form);
    }
  });

  main?.addEventListener('change', (e) => {
    const cloudFileInput = e.target.closest('#js-cloud-file-input');
    if (cloudFileInput && cloudFileInput.files?.length) {
      const file = cloudFileInput.files[0];
      uploadCloudFile(file)
        .then(() => renderSection(state.activeSection))
        .catch((err) => showToast(err.message || 'No se pudo subir el archivo.', 'error'))
        .finally(() => { if (cloudFileInput) cloudFileInput.value = ''; });
      return;
    }

    const beatSaleInput = e.target.closest('input[name="beat_file"]');
    if (beatSaleInput) {
      const form = beatSaleInput.closest("form");
      form.__hrCloudSource = null;
      form.__hrCloudFile = null;
      const label = form.querySelector("[data-beat-sale-source]");
      if (label) label.textContent = "Selecciona un archivo de audio.";
    }

    const downloadFolderInput = e.target.closest('[data-download-folder]');
    if (downloadFolderInput) {
      const form = downloadFolderInput.closest('form');
      const files = [...(downloadFolderInput.files ?? [])];
      form.__hrCloudSource = null;
      form.__hrCloudFile = null;
      form.__hrDownloadFiles = files;
      form.__hrDownloadFolderName = selectedDownloadFolderName(files);
      const fileInput = form.querySelector('[data-download-file]');
      if (fileInput) fileInput.value = '';
      const label = form.querySelector('[data-download-source]');
      if (label) {
        label.textContent = files.length
          ? `Carpeta seleccionada: ${form.__hrDownloadFolderName || 'sin nombre'} (${files.length} archivos).`
          : 'Selecciona un archivo o carpeta para subir a Cloud.';
      }
      updateDownloadMembershipFields(form);
      return;
    }

    const downloadFileInput = e.target.closest("[data-download-file]");
    if (downloadFileInput) {
      const form = downloadFileInput.closest("form");
      form.__hrCloudSource = null;
      form.__hrCloudFile = null;
      form.__hrDownloadFiles = [];
      form.__hrDownloadFolderName = '';
      const folderInput = form.querySelector('[data-download-folder]');
      if (folderInput) folderInput.value = '';
      const label = form.querySelector("[data-download-source]");
      if (label) label.textContent = downloadFileInput.files?.[0]?.name
        ? `Archivo seleccionado: ${downloadFileInput.files[0].name}`
        : "Selecciona un archivo o carpeta para subir a Cloud.";
      updateDownloadMembershipFields(form);
    }

    const statusSelect = e.target.closest('select[data-action="task-status"]');
    const taskCard = statusSelect?.closest('.db-task-card[data-task-id]');
    if (statusSelect && taskCard) {
      handleTaskStatus(taskCard.dataset.taskId, statusSelect.value);
    }

    const roleSelect = e.target.closest('select[data-action="role-change"]');
    if (roleSelect) {
      handleRoleChange(roleSelect.dataset.userUuid, roleSelect.value);
    }

    const tableSelect = e.target.closest('select[data-action="table-editor-table"]');
    if (tableSelect) {
      persistAdminTableSearchFromDOM();
      setAdminTableName(tableSelect.value);
      navigate('admin-table-editor');
      return;
    }

    const tableColumnToggle = e.target.closest('input[data-action="admin-table-toggle-columns"][data-table-name]');
    if (tableColumnToggle) {
      setPersistedDataValue(`adminTableShowAll:${tableColumnToggle.dataset.tableName}`, tableColumnToggle.checked ? '1' : '0');
      navigate('admin-table-editor');
      return;
    }

    const membershipTableSearch = e.target.closest('input[data-table-search][data-admin-table-name="membership_dashboard"]');
    if (membershipTableSearch) {
      setAdminTableSearch('membership_dashboard', membershipTableSearch.value.trim());
      navigate('admin-table-editor');
      return;
    }

    const scrumEvent = e.target.closest('select[data-action="scrum-event-change"]');
    if (scrumEvent) {
      setPersistedDataValue('scrumEventId', scrumEvent.value);
      state.data.scrumEventId = scrumEvent.value;
      navigate(state.activeSection || 'collab-tasks');
      return;
    }

    const financeFilter = e.target.closest('select[data-action="finance-filter"]');
    if (financeFilter) {
      setPersistedDataValue(financeFilter.dataset.filterKey, financeFilter.value);
      if (financeFilter.dataset.filterKey === 'financeScope') {
        if (financeFilter.value === 'studio' && !persistedDataValue('financeStudio', '')) {
          setPersistedDataValue('financeStudio', 'IXT');
        }
      }
      navigate(state.activeSection);
      return;
    }

    const financeMovementView = e.target.closest('select[data-action="finance-movement-view"]');
    if (financeMovementView) {
      setPersistedDataValue('financeMovementView', financeMovementView.value);
      navigate(state.activeSection);
      return;
    }

    const collabFinanceEvent = e.target.closest('select[data-action="collab-finance-event"]');
    if (collabFinanceEvent) {
      setPersistedDataValue('collabFinanceEventId', collabFinanceEvent.value);
      navigate('collab-finance');
      return;
    }

    const mergeDuplicateMode = e.target.closest('select[data-action="merge-duplicate-mode"]');
    if (mergeDuplicateMode) {
      setPersistedDataValue('mergeDuplicateMode', mergeDuplicateMode.value);
      navigate('erp-ops');
      return;
    }

    const opsForm = e.target.closest('select[data-action="erp-ops-form"]');
    if (opsForm) {
      setPersistedDataValue('erpOpsForm', opsForm.value);
      navigate('erp-ops');
      return;
    }

    const authAuditFilter = e.target.closest('select[data-action="auth-audit-filter"]');
    if (authAuditFilter) {
      setPersistedDataValue('authAuditFilter', authAuditFilter.value);
      applyAuthAuditFilter(authAuditFilter.value);
      return;
    }

    const sessionField = e.target.closest('[data-session-type], [data-session-start]');
    if (sessionField) {
      updateSessionDerivedFields(sessionField.closest('form'));
      return;
    }

    const transactionField = e.target.closest('[data-transaction-service], [data-transaction-concept]');
    if (transactionField) {
      updateTransactionConceptFields(transactionField.closest('form'));
      return;
    }

    const downloadReleaseMode = e.target.closest('[data-download-release-mode], [data-download-source-type]');
    if (downloadReleaseMode) {
      updateDownloadMembershipFields(downloadReleaseMode.closest('form'));
      return;
    }
  });

  main?.addEventListener('input', (e) => {
    const tableSearch = e.target.closest('[data-table-search]');
    if (tableSearch) {
      const tableName = tableSearch.dataset.adminTableName;
      if (tableName && state.activeSection === 'admin-table-editor') {
        setAdminTableSearch(tableName, tableSearch.value.trim());
        window.clearTimeout(filterTableRows.remoteTimer);
        filterTableRows.remoteTimer = window.setTimeout(() => navigate('admin-table-editor'), 280);
      } else {
        filterTableRows(tableSearch);
      }
      return;
    }

    const sessionField = e.target.closest('[data-session-type], [data-session-start]');
    if (sessionField) {
      updateSessionDerivedFields(sessionField.closest('form'));
      return;
    }

    const transactionField = e.target.closest('[data-transaction-service], [data-transaction-concept]');
    if (transactionField) {
      updateTransactionConceptFields(transactionField.closest('form'));
      return;
    }

    const search = e.target.closest('[data-user-search]');
    if (!search) return;
    const picker = search.closest('.db-user-picker');
    if (picker?.dataset.membershipUserPicker === 'true') {
      setAdminTableSearch('membership_dashboard', '');
      filterUserPicker(search, { clearSelection: true });
      return;
    }
    filterUserPicker(search, { clearSelection: true });
  });

  main?.addEventListener('focusin', (e) => {
    const search = e.target.closest?.('[data-user-search]');
    if (!search) return;

    const picker = search.closest('.db-user-picker');
    const menu = picker?.querySelector('.db-user-picker__menu');
    if (menu) filterUserPicker(search);
  });

  main?.addEventListener('focusout', (e) => {
    const picker = e.target.closest?.('.db-user-picker');
    if (!picker) return;

    setTimeout(() => {
      if (!picker.contains(document.activeElement)) {
        picker.querySelector('.db-user-picker__menu')?.setAttribute('hidden', '');
      }
    }, 80);
  });

  main?.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;

    e.preventDefault();
    form.dataset.operationAction = e.submitter?.dataset.operationAction || 'create';

    if (form.dataset.form === 'view-as') {
      handleViewAsSubmit(form);
      return;
    }

    if (form.dataset.form === 'finance-goals') {
      handleFinanceGoalsSave(form);
      return;
    }

    if (state.viewAs?.active) {
      showToast('La vista como usuario es de solo lectura.', 'error');
      return;
    }

    if (form.dataset.form === 'task-create') handleTaskCreate(form);
    if (form.dataset.form === 'task-update') handleTaskUpdate(form);
    if (form.dataset.form === 'account-update') handleAccountUpdate(form);
    if (form.dataset.form === 'permission-add') handlePermissionAdd(form);
    if (form.dataset.form === 'admin-table-update') handleAdminTableUpdate(form);
    if (form.dataset.form === 'event-finance-table-update') handleEventFinanceTableUpdate(form);
    if (form.dataset.form === 'user-merge') handleErpForm(form);
    if (form.dataset.form === 'membership-cancel') handleErpForm(form);
    if (form.dataset.form === 'membership-delivery') handleErpForm(form);
    if (form.dataset.form === 'membership-session-notes') handleErpForm(form);
    if (form.dataset.form === 'ig-list-media') handleIgListMedia(form);
    if (form.dataset.form === 'erp-ig-benefits-search') handleErpIgBenefitsSearch(form);
    if (form.dataset.form === 'instagram-scrape') handleInstagramScraper(form);
    if (form.dataset.form?.endsWith('-create') && !form.dataset.form.startsWith('task-')) {
      handleErpForm(form);
    }
  });
}

function handleFinanceGoalsSave(form) {
  const filters = state.data.erpFinanceFilters ?? getFinanceFilters();
  const values = formValues(form);
  const goalsByStudio = persistedDataValue('financeGoalsByStudio', {});
  const nextGoals = {
    income: Math.max(0, Number(values.income || 0)),
    profit: Math.max(0, Number(values.profit || 0)),
    hours: Math.max(0, Number(values.hours || 0)),
  };
  const next = {
    ...(goalsByStudio && typeof goalsByStudio === 'object' ? goalsByStudio : {}),
    [filters.studio]: nextGoals,
  };
  setPersistedDataValue('financeGoalsByStudio', next);
  showToast('Metas guardadas en este navegador.', 'success');
  navigate('erp-finance');
}


/* ================================================================
   Section 15a  ONBOARDING GATE
   -------------------------------------------------------------
   Non-bypassable modal shown when the logged-in user has:
     a) An email ending in @hiddenroom.local (must be replaced)
     b) A non-empty public.users.temp_password (must be changed)
   Both conditions can be true simultaneously; the modal handles both.
   temp_password is NEVER displayed, logged, or sent anywhere
   other than the check above.
================================================================ */

/**
 * Blocks the dashboard with a full-screen overlay until the user
 * completes all required onboarding steps.
 *
 * @param {boolean} needsEmail    - Must replace @hiddenroom.local email
 * @param {boolean} needsPassword - Must replace temporary password
 * @returns {Promise<void>}       - Resolves only after success + reload
 */
function showOnboardingModal(needsEmail, needsPassword) {
  return new Promise((resolve) => {
    // Remove any previous instance
    document.getElementById('js-onboarding-gate')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'js-onboarding-gate';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'onboarding-title');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,.88)',
      'z-index:var(--hr-z-overlay,10001)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:16px',
    ].join(';');

    // Build the inner sections conditionally
    const emailSection = needsEmail ? `
      <section id="js-ob-email-section">
        <h3 style="margin:0 0 8px;font-size:1rem;">Actualiza tu correo electrónico</h3>
        <p style="margin:0 0 12px;font-size:.875rem;color:var(--db-muted,#aaa)">
          Tu cuenta usa un correo temporal. Debes ingresar un correo real para continuar.
        </p>
        <label class="db-field">
          <span>Nuevo correo electrónico</span>
          <input id="js-ob-email" type="email" autocomplete="email" placeholder="Nombre@ejemplo.com" required />
        </label>
        <div id="js-ob-email-error" style="color:#f87171;font-size:.8rem;min-height:18px;margin-top:4px;"></div>
      </section>
    ` : '';

    const passwordSection = needsPassword ? `
      <section id="js-ob-password-section" style="${needsEmail ? 'margin-top:20px;padding-top:20px;border-top:1px solid var(--db-border,#333);' : ''}">
        <h3 style="margin:0 0 8px;font-size:1rem;">Establece una nueva contraseña</h3>
        <p style="margin:0 0 12px;font-size:.875rem;color:var(--db-muted,#aaa)">
          Tu cuenta tiene una contraseña temporal. Debes crear una nueva contraseña para continuar.
        </p>
        <label class="db-field">
          <span>Nueva contraseña</span>
          <input id="js-ob-password" type="password" autocomplete="new-password" placeholder="Nueva contraseña" required />
        </label>
        <label class="db-field" style="margin-top:10px;">
          <span>Confirmar contraseña</span>
          <input id="js-ob-password-confirm" type="password" autocomplete="new-password" placeholder="Confirmar contraseña" required />
        </label>
        <div id="js-ob-password-error" style="color:#f87171;font-size:.8rem;min-height:18px;margin-top:4px;"></div>
      </section>
    ` : '';

    overlay.innerHTML = `
      <div style="background:var(--db-bg,#111);border:1px solid var(--db-border,#333);border-radius:10px;padding:28px 24px;max-width:460px;width:100%;max-height:90vh;overflow-y:auto;">
        <h2 id="onboarding-title" style="margin:0 0 6px;font-size:1.2rem;">Configuración inicial requerida</h2>
        <p style="margin:0 0 20px;font-size:.875rem;color:var(--db-muted,#aaa)">
          Debes completar los siguientes pasos antes de acceder al panel.
        </p>
        ${emailSection}
        ${passwordSection}
        <div id="js-ob-status" style="min-height:18px;font-size:.85rem;margin-top:12px;"></div>
        <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;">
          <button id="js-ob-submit" class="btn-primary" type="button">Guardar y continuar</button>
          <button id="js-ob-logout" class="db-btn-secondary" type="button">Cerrar sesión</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    enhancePasswordToggles(overlay);

    // Prevent any click on the backdrop from closing it
    overlay.addEventListener('click', (e) => { e.stopPropagation(); });

    // Logout button
    overlay.querySelector('#js-ob-logout').addEventListener('click', () => {
      supabase.auth.signOut().finally(() => { window.location.href = './'; });
    });

    // Submit button
    overlay.querySelector('#js-ob-submit').addEventListener('click', async () => {
      const statusEl  = overlay.querySelector('#js-ob-status');
      const submitBtn = overlay.querySelector('#js-ob-submit');

      // Clear previous errors
      if (overlay.querySelector('#js-ob-email-error'))    overlay.querySelector('#js-ob-email-error').textContent    = '';
      if (overlay.querySelector('#js-ob-password-error')) overlay.querySelector('#js-ob-password-error').textContent = '';
      if (statusEl) statusEl.textContent = '';

      // ── Validate email ───────────────────────────────────────────
      let newEmail = null;
      if (needsEmail) {
        newEmail = (overlay.querySelector('#js-ob-email')?.value ?? '').trim();
        const emailErrorEl = overlay.querySelector('#js-ob-email-error');
        if (!newEmail) {
          if (emailErrorEl) emailErrorEl.textContent = 'El correo no puede estar vacío.';
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
          if (emailErrorEl) emailErrorEl.textContent = 'El formato del correo no es válido.';
          return;
        }
        if (newEmail.toLowerCase().endsWith('@hiddenroom.local')) {
          if (emailErrorEl) emailErrorEl.textContent = 'Ingresa un correo real, no @hiddenroom.local.';
          return;
        }
      }

      // ── Validate password ────────────────────────────────────────
      let newPassword = null;
      if (needsPassword) {
        newPassword         = overlay.querySelector('#js-ob-password')?.value ?? '';
        const confirmPass   = overlay.querySelector('#js-ob-password-confirm')?.value ?? '';
        const passErrorEl   = overlay.querySelector('#js-ob-password-error');
        // Retrieve the stored temp_password only for comparison — never display it.
        const tempPass      = state.user?.temp_password ?? '';

        if (!newPassword) {
          if (passErrorEl) passErrorEl.textContent = 'La contraseña no puede estar vacía.';
          return;
        }
        if (newPassword.length < 8) {
          if (passErrorEl) passErrorEl.textContent = 'La contraseña debe tener al menos 8 caracteres.';
          return;
        }
        if (tempPass && newPassword === tempPass) {
          if (passErrorEl) passErrorEl.textContent = 'La nueva contraseña no puede ser igual a la contraseña temporal.';
          return;
        }
        if (newPassword !== confirmPass) {
          if (passErrorEl) passErrorEl.textContent = 'Las contraseñas no coinciden.';
          return;
        }
      }

      // ── Apply updates ────────────────────────────────────────────
      submitBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Guardando...';

      try {
        // Build single auth.updateUser payload
        const authPayload = {};
        if (needsEmail)    authPayload.email    = newEmail;
        if (needsPassword) authPayload.password = newPassword;

        const { error: authError } = await supabase.auth.updateUser(authPayload);
        if (authError) throw authError;

        // If password changed, clear temp_password in public.users
        if (needsPassword) {
          const { error: clearTempError } = await supabase.rpc('clear_my_temp_password');

          if (clearTempError) {
            // Non-fatal: log quietly, don't expose to user
            console.warn('[HR] onboarding: could not clear temp_password', clearTempError);
          }
        }

        // NOTE: public.users.email intentionally NOT updated here;
        // the DB trigger syncs it from auth.users.email automatically.

        if (statusEl) {
          statusEl.style.color = '#4ade80';
          statusEl.textContent = needsEmail
            ? 'Configuración guardada. Si Supabase requiere confirmación, revisa tu bandeja de entrada. Recargando...'
            : 'Configuración guardada. Recargando...';
        }

        setTimeout(() => { window.location.reload(); }, 2200);
        resolve();

      } catch (err) {
        console.error('[HR] onboarding gate update:', err);
        submitBtn.disabled = false;
        if (statusEl) {
          statusEl.style.color = '#f87171';
          statusEl.textContent = err.message || 'No se pudo guardar. Intenta de nuevo.';
        }
      }
    });
  });
}


/* ================================================================
   Section 15  INIT
================================================================ */

async function init() {
  const session = await bootstrapSession();

  if (!session) {
    window.location.href = './';
    return;
  }

  setState({
    user:        session.user,
    actualUser:  session.actualUser || session.user,
    viewAs:      session.viewAs || null,
    roles:       session.roles,
    permissions: session.permissions,
  });
  window.HiddenRoomViewAs?.refreshNavigation?.(state.viewAs);
  window.HiddenRoomViewAs?.refreshBanner?.(state.viewAs);

  renderPortalNavigation();
  hydrateTopbar();
  applyRoleGates();
  syncLocalStorageRecords();

  attachSidebarListeners();
  attachPortalMobileListeners();
  attachUserMenuListeners();
  attachMainDelegation();
  attachRoutePersistenceListener();

  await loadAndRenderNotifications();

  // ── Onboarding gate ──────────────────────────────────────────────
  // Check if the user needs to complete mandatory onboarding steps
  // before they can access the dashboard.
  const needsEmailReplacement = (state.user?.email ?? '').toLowerCase().endsWith('@hiddenroom.local');
  // NOTE: temp_password is only read once here for the gate check, never displayed or logged.
  const hasTempPassword = Boolean(state.user?.temp_password);

  if (needsEmailReplacement || hasTempPassword) {
    await showOnboardingModal(needsEmailReplacement, hasTempPassword);
    // showOnboardingModal only resolves after both required steps are done.
    return; // init() re-runs after reload inside the modal on success.
  }
  // ── End onboarding gate ──────────────────────────────────────────

  navigate(initialSectionKey());
}

window.addEventListener('hiddenroom:ig-username-updated', (event) => {
  const igUsername = event.detail?.ig_username;
  if (!igUsername || !state.user) return;
  state.user = { ...state.user, ig_username: igUsername };
  hydrateTopbar();
});
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


/* ================================================================
   Section 16  PUBLIC API
================================================================ */
export {
  navigate,
  showToast,
  state,
  expandRoles,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasPermission,
  hasAnyPermission,
};
