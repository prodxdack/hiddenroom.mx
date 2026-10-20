const SITE_STATUS = "BETA Sitio en construcción";
const SITE_VERSION = "V. 2.5.0";
const GA_MEASUREMENT_ID = "G-VNHC1Z3FXZ";
const HR_SUPABASE_URL = "https://rpcunbkstadgngqrjafp.supabase.co";
const HR_SUPABASE_ANON_KEY = "sb_publishable_7v_FIgTjWjJgtT1YHIAYSw_bRBmQjZO";
const HR_SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const ECOSYSTEM_LINKS = [
  ["academia", "/academia/", "Academia"],
  ["games", "/minijuegos/", "Minijuegos"],
  ["media", "/media/", "Media"],
  ["store", "/store/", "Store"],
  ["studio", "/studio/", "Studio"],
  ["beat-store", "/store/beat_store/", "Beat Store"],
  ["kairen", "/kairen/", "Kairen AI"],
  ["tickets", "/tickets/", "Tickets"],
  ["orbit", "/mysauth_orbit/", "ORBIT", true],
];
const MORE_NAV_KEYS = new Set(["media", "kairen", "tickets", "orbit"]);
const HR_VIEW_AS_STORAGE_KEY = "hr_view_as_user";
const HR_VIEW_AS_RETURN_KEY = "hr_view_as_return";
const HR_VIEW_AS_BANNER_VISIBLE_KEY = "hr_view_as_banner_visible";
const HR_VIEW_AS_BANNER_POSITION_KEY = "hr_view_as_banner_position";
const HR_COPY_EDITOR_VISIBLE_KEY = "hr_copy_editor_visible";

let hrViewAsContext = null;
let resolveHrViewAsReady;
const hrViewAsReady = new Promise((resolve) => {
  resolveHrViewAsReady = resolve;
});

function readUiVisibility(key) {
  try {
    return sessionStorage.getItem(key) !== "hidden";
  } catch (error) {
    return true;
  }
}

function persistUiVisibility(key, visible) {
  try {
    sessionStorage.setItem(key, visible ? "visible" : "hidden");
  } catch (error) {
    console.info("[HR] No fue posible guardar el estado visual:", error?.message || error);
  }
}

function readUiPosition(key) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || "null");
    return {
      x: Number.isFinite(Number(parsed?.x)) ? Number(parsed.x) : 0,
      y: Number.isFinite(Number(parsed?.y)) ? Number(parsed.y) : 0,
    };
  } catch (error) {
    return { x: 0, y: 0 };
  }
}

function persistUiPosition(key, position) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ x: position.x, y: position.y }));
  } catch (error) {
    console.info("[HR] No fue posible guardar la posición visual:", error?.message || error);
  }
}

function applyUiPosition(root, position) {
  const x = Number(position?.x) || 0;
  const y = Number(position?.y) || 0;
  root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function enableLongPressDrag(root, storageKey) {
  if (!root) return;
  const initialPosition = readUiPosition(storageKey);
  applyUiPosition(root, initialPosition);
  let gesture = null;

  root.addEventListener("pointerdown", (event) => {
    const isCollapsed = root.classList.contains("is-collapsed");
    if (event.target.closest("a,input,textarea,select") || (event.target.closest("button") && !isCollapsed)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const start = { x: event.clientX, y: event.clientY };
    const position = readUiPosition(storageKey);
    const finish = (save) => {
      if (!gesture) return;
      window.clearTimeout(gesture.timer);
      document.removeEventListener("pointermove", gesture.move);
      document.removeEventListener("pointerup", gesture.end);
      document.removeEventListener("pointercancel", gesture.end);
      if (save) {
        persistUiPosition(storageKey, gesture.position);
        root.dataset.hrSuppressClick = "true";
        window.setTimeout(() => delete root.dataset.hrSuppressClick, 0);
      }
      root.classList.remove("is-dragging");
      gesture = null;
    };
    const move = (moveEvent) => {
      if (!gesture || moveEvent.pointerId !== event.pointerId) return;
      const deltaX = moveEvent.clientX - start.x;
      const deltaY = moveEvent.clientY - start.y;
      if (!gesture.dragging) {
        if (Math.hypot(deltaX, deltaY) > 8) finish(false);
        return;
      }
      moveEvent.preventDefault();
      gesture.position = { x: position.x + deltaX, y: position.y + deltaY };
      applyUiPosition(root, gesture.position);
    };
    const end = () => finish(Boolean(gesture?.dragging));
    gesture = {
      dragging: false,
      position,
      move,
      end,
      timer: window.setTimeout(() => {
        if (!gesture) return;
        gesture.dragging = true;
        root.classList.add("is-dragging");
      }, 420),
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", end, { once: true });
    document.addEventListener("pointercancel", end, { once: true });
  });
}

function visibilityToggleIcon(hidden) {
  return hidden
    ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 10 6 10 6a18.6 18.6 0 0 1-3.1 3.9M6.2 6.2C3.6 8.1 2 12 2 12s3.5 6 10 6a10.7 10.7 0 0 0 3.7-.7M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
}

function readViewAsSelection() {
  try {
    const raw = sessionStorage.getItem(HR_VIEW_AS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const userId = String(parsed?.userId || "").trim();
    return userId ? { userId } : null;
  } catch (error) {
    console.info("[HR] No fue posible leer la vista como:", error?.message || error);
    return null;
  }
}

function persistViewAsSelection(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized) return false;
  try {
    sessionStorage.setItem(HR_VIEW_AS_STORAGE_KEY, JSON.stringify({ userId: normalized }));
    return true;
  } catch (error) {
    console.info("[HR] No fue posible guardar la vista como:", error?.message || error);
    return false;
  }
}

function clearViewAsSelection() {
  try {
    sessionStorage.removeItem(HR_VIEW_AS_STORAGE_KEY);
    sessionStorage.removeItem(HR_VIEW_AS_RETURN_KEY);
  } catch (error) {
    console.info("[HR] No fue posible limpiar la vista como:", error?.message || error);
  }
  hrViewAsContext = null;
}

function viewAsDisplayName(profile) {
  return profile?.display_name || profile?.username || profile?.email || "Usuario";
}

function resolveEffectivePermissions(profile, permissionRows) {
  return {
    roles: String(profile?.roles || "")
      .split(",")
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean),
    permissions: (permissionRows || [])
      .map((row) => String(row?.permission_key || "").trim().toLowerCase())
      .filter(Boolean),
  };
}

async function resolveViewAsContext(supabase, actualUser, actualProfile, selection = readViewAsSelection()) {
  const actualIsAdmin = roleListIncludesAdmin(actualProfile?.roles);
  const userId = String(selection?.userId || "").trim();

  if (!actualUser?.id || !actualIsAdmin || !userId) {
    const context = {
      active: false,
      actualUser,
      actualProfile,
      user: actualUser,
      profile: actualProfile,
      roles: resolveEffectivePermissions(actualProfile, []).roles,
      permissions: [],
    };
    hrViewAsContext = context;
    resolveHrViewAsReady?.(context);
    return context;
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
    const profileIdColumn = isUuid ? "id" : "user_id";
    const { data: targetProfile, error: profileError } = await supabase
      .from("users")
      .select("id,user_id,display_name,username,email,avatar_url,roles,ig_username")
      .eq(profileIdColumn, userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!targetProfile) throw new Error("El usuario seleccionado ya no existe.");

    const { data: permissionRows, error: permissionsError } = await supabase
      .from("user_permissions")
      .select("permission_key")
      .eq("user_id", targetProfile.id);
    if (permissionsError) throw permissionsError;

    const access = resolveEffectivePermissions(targetProfile, permissionRows);
    const targetUser = {
      ...actualUser,
      id: targetProfile.id || userId,
      user_id: targetProfile.user_id || null,
      email: targetProfile.email || "",
      user_metadata: {
        ...(actualUser.user_metadata || {}),
        display_name: targetProfile.display_name,
        username: targetProfile.username,
      },
    };
    const context = {
      active: String(targetProfile.id || userId) !== String(actualUser.id),
      actualUser,
      actualProfile,
      user: targetUser,
      profile: targetProfile,
      roles: access.roles,
      permissions: access.permissions,
    };
    hrViewAsContext = context;
    resolveHrViewAsReady?.(context);
    document.body?.classList.toggle("hr-view-as-active", context.active);
    if (document.body) document.body.dataset.hrViewAsUser = context.active ? String(targetProfile.id || userId) : "";
    return context;
  } catch (error) {
    console.info("[HR] No fue posible resolver la vista como:", error?.message || error);
    clearViewAsSelection();
    const context = {
      active: false,
      actualUser,
      actualProfile,
      user: actualUser,
      profile: actualProfile,
      roles: resolveEffectivePermissions(actualProfile, []).roles,
      permissions: [],
      error,
    };
    hrViewAsContext = context;
    resolveHrViewAsReady?.(context);
    return context;
  }
}

async function activateViewAs(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized) throw new Error("Selecciona un usuario.");
  const supabase = await getHiddenRoomSupabaseClient();
  const { data: { user: actualUser } } = await supabase.auth.getUser();
  if (!actualUser) throw new Error("La sesión de administrador ya no está disponible.");
  const { data: actualProfile, error } = await supabase
    .from("users")
    .select("id,user_id,display_name,username,email,avatar_url,roles,ig_username")
    .eq("id", actualUser.id)
    .maybeSingle();
  if (error) throw error;
  if (!roleListIncludesAdmin(actualProfile?.roles)) throw new Error("Sólo un administrador puede usar esta vista.");
  const context = await resolveViewAsContext(supabase, actualUser, actualProfile, { userId: normalized });
  if (context.error) throw context.error;
  if (!context.active) throw new Error("No se pudo activar la vista del usuario seleccionado.");
  persistViewAsSelection(normalized);
  return context;
}

function viewAsReturnPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function openViewAsSelector() {
  try {
    sessionStorage.setItem(HR_VIEW_AS_RETURN_KEY, viewAsReturnPath());
  } catch (error) {
    console.info("[HR] No fue posible guardar la ruta de retorno:", error?.message || error);
  }
  window.location.href = "/portal/dashboard.html#view-as";
}

function returnFromViewAs() {
  clearViewAsSelection();
  window.location.reload();
}

function cancelViewAsSelector() {
  let destination = "/portal/dashboard.html#overview";
  try {
    destination = sessionStorage.getItem(HR_VIEW_AS_RETURN_KEY) || destination;
    sessionStorage.removeItem(HR_VIEW_AS_RETURN_KEY);
  } catch (error) {
    console.info("[HR] No fue posible recuperar la ruta de retorno:", error?.message || error);
  }
  window.location.href = destination;
}

function syncViewAsNavigation(context = hrViewAsContext) {
  const actualIsAdmin = roleListIncludesAdmin(context?.actualProfile?.roles);
  document.querySelectorAll("[data-view-as-admin-action]").forEach((control) => {
    control.hidden = !actualIsAdmin;
    const active = Boolean(context?.active);
    control.dataset.viewAsAction = active ? "clear" : "open";
    control.textContent = active
      ? `Volver a mi vista${context?.profile ? ` · ${viewAsDisplayName(context.profile)}` : ""}`
      : "Ver como";
  });
}

function applyViewAsBannerVisibility(visible) {
  const banner = document.getElementById("hr-view-as-banner");
  const toggle = banner?.querySelector("[data-view-as-banner-toggle]");
  if (!banner || !toggle) return;
  banner.classList.toggle("is-collapsed", !visible);
  toggle.setAttribute("aria-expanded", String(visible));
  toggle.setAttribute("aria-label", visible ? "Ocultar vista como" : "Mostrar vista como");
  toggle.title = visible ? "Ocultar vista como" : "Mostrar vista como";
  toggle.innerHTML = visibilityToggleIcon(!visible);
}

function setViewAsBannerVisibility(visible) {
  persistUiVisibility(HR_VIEW_AS_BANNER_VISIBLE_KEY, visible);
  applyViewAsBannerVisibility(visible);
}

function renderViewAsBanner(context = hrViewAsContext) {
  document.getElementById("hr-view-as-banner")?.remove();
  if (!context?.active) return;
  const banner = document.createElement("div");
  banner.id = "hr-view-as-banner";
  banner.className = "hr-view-as-banner";
  banner.setAttribute("role", "status");
  banner.innerHTML = `
    <div class="hr-view-as-banner__content">
      <span>Vista como <strong>${escapeNavText(viewAsDisplayName(context.profile))}</strong></span>
      <button type="button" data-view-as-action="clear">Volver a mi vista</button>
    </div>
    <button class="hr-view-as-banner__toggle" type="button" data-view-as-banner-toggle aria-expanded="true" aria-label="Ocultar vista como" title="Ocultar vista como"></button>
  `;
  document.body.append(banner);
  enableLongPressDrag(banner, HR_VIEW_AS_BANNER_POSITION_KEY);
  applyViewAsBannerVisibility(readUiVisibility(HR_VIEW_AS_BANNER_VISIBLE_KEY));
}

window.HiddenRoomViewAs = window.HiddenRoomViewAs || {
  ready: () => hrViewAsReady,
  getContext: () => hrViewAsContext,
  getSelection: readViewAsSelection,
  isActive: () => Boolean(hrViewAsContext?.active || readViewAsSelection()),
  resolveForAdmin: resolveViewAsContext,
  activate: activateViewAs,
  openSelector: openViewAsSelector,
  cancelSelector: cancelViewAsSelector,
  refreshNavigation: syncViewAsNavigation,
  refreshBanner: renderViewAsBanner,
  clear: returnFromViewAs,
};

function isBeatStorePath(path) {
  return path.startsWith("/store/beat_store/");
}

function isGlobalNavItemActive(key, activeModule, navPath) {
  return (key === activeModule && !(activeModule === "store" && isBeatStorePath(navPath)))
    || (key === "beat-store" && isBeatStorePath(navPath));
}

function renderGlobalNavLink([key, href, label, adminOnly], activeModule, navPath, drawer = false) {
  const current = isGlobalNavItemActive(key, activeModule, navPath);
  const attrs = `${adminOnly ? " data-admin-nav-link hidden" : ""}${current ? ' aria-current="page"' : ""}`;
  return `<a href="${href}"${attrs}>${drawer ? `<span>${label}</span>` : label}</a>`;
}

function renderMoreNav(activeModule, navPath, drawer = false) {
  const moreLinks = ECOSYSTEM_LINKS.filter(([key]) => MORE_NAV_KEYS.has(key));
  const isMoreActive = moreLinks.some(([key]) => isGlobalNavItemActive(key, activeModule, navPath));
  const detailsClass = drawer ? "hr-global-drawer__more" : "hr-nav__more";
  const summaryClass = drawer ? "hr-global-drawer__more-summary" : "hr-nav__more-summary";
  const linksClass = drawer ? "hr-global-drawer__more-links" : "hr-nav__more-links";
  return `
    <details class="${detailsClass}"${isMoreActive ? " open" : ""}>
      <summary class="${summaryClass}" data-global-more-toggle>MÁS <span class="hr-nav__more-chevron" aria-hidden="true"></span></summary>
      <div class="${linksClass}">
        ${moreLinks.map((item) => renderGlobalNavLink(item, activeModule, navPath, drawer)).join("")}
        <button class="${linksClass}__action" type="button" data-view-as-admin-action hidden>Ver como</button>
      </div>
    </details>
  `;
}

let globalSessionSnapshot = null;

const HR_COPY_EDITOR_CANDIDATE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,a,button,li,dt,dd,blockquote,figcaption,legend,summary,span,small";
const HR_COPY_EDITOR_IGNORE_SELECTOR = "#hr-global-nav,#hr-beat-player,#hr-beat-player-fullscreen,#posts-grid,#editorial-grid,#featured-grid,#post-content,#related-grid,#product-grid,#beat-grid,#product-detail,#cart-items,#cart-summary,#orders-list,#tickets-list,#ticket-result,#studio-request-result,#studio-price,script,style,noscript,svg,canvas,video,audio,iframe,input,textarea,select,option,[aria-hidden=\"true\"],[data-hr-copy-ignore],[data-hr-session],[data-hr-drawer-session],.site-status,.site-version,#cursor,#cursorRing";
const HR_SITE_TEXT_OVERRIDES_ENABLED = true;

const hrCopyEditorState = {
  root: null,
  toggle: null,
  quickSave: null,
  visibilityToggle: null,
  visible: true,
  canEdit: false,
  active: false,
  pagePath: "",
  entries: [],
  refreshId: 0,
};

function copyEditorPagePath(url = window.location.href) {
  const parsed = new URL(url, window.location.href);
  let pathname = parsed.pathname || "/";
  if (pathname.endsWith("/index.html")) pathname = pathname.slice(0, -"index.html".length);
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  return pathname || "/";
}

function copyEditorText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function copyEditorKey(element) {
  if (element.dataset.hrCopyKey) return element.dataset.hrCopyKey;
  const parts = [];
  let current = element;
  while (current && current !== document.body) {
    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }
    const parent = current.parentElement;
    if (!parent) break;
    const siblings = [...parent.children].filter((candidate) => candidate.tagName === current.tagName);
    parts.unshift(`${current.tagName.toLowerCase()}:${Math.max(1, siblings.indexOf(current) + 1)}`);
    current = parent;
  }
  return parts.join("/").slice(0, 500);
}

function prepareGlobalCopyTextSegments() {
  document.body?.querySelectorAll("*").forEach((parent) => {
    if (parent.matches("[data-hr-copy-segment]") || parent.closest(HR_COPY_EDITOR_IGNORE_SELECTOR)) return;
    [...parent.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !copyEditorText(node.textContent)) return;
      const text = copyEditorText(node.textContent);
      if (text.length <= 1 || text.length > 2000) return;
      const segment = document.createElement("span");
      segment.dataset.hrCopySegment = "";
      segment.textContent = text;
      node.replaceWith(segment);
    });
  });
}

function collectGlobalCopyEntries() {
  prepareGlobalCopyTextSegments();
  const seenKeys = new Set();
  return [...document.querySelectorAll(HR_COPY_EDITOR_CANDIDATE_SELECTOR)]
    .filter((element) => {
      if (element.closest(HR_COPY_EDITOR_IGNORE_SELECTOR)) return false;
      if (element.children.length) return false;
      const text = copyEditorText(element.textContent);
      return text.length > 1 && text.length <= 2000;
    })
    .map((element) => {
      const key = copyEditorKey(element);
      if (!key || seenKeys.has(key)) return null;
      seenKeys.add(key);
      const defaultText = copyEditorText(element.textContent);
      element.dataset.hrCopyRuntimeKey = key;
      const entry = { key, defaultText, value: defaultText, element, editing: false, lastTapAt: 0 };
      element.addEventListener("input", () => {
        if (!hrCopyEditorState.active) return;
        entry.value = copyEditorText(element.textContent);
        element.classList.toggle("hr-copy-editor-target--changed", entry.value !== entry.defaultText);
      });
      element.addEventListener("dblclick", (event) => beginGlobalCopyInlineEdit(entry, event));
      element.addEventListener("pointerup", (event) => {
        if (!hrCopyEditorState.active || event.pointerType !== "touch") return;
        const now = Date.now();
        if (now - entry.lastTapAt < 420) {
          entry.lastTapAt = 0;
          beginGlobalCopyInlineEdit(entry, event);
          return;
        }
        entry.lastTapAt = now;
      });
      element.addEventListener("blur", () => {
        if (!entry.editing) return;
        entry.editing = false;
        applyGlobalCopyEditorState();
      });
      return entry;
    })
    .filter(Boolean);
}

function setCopyEditorStatus(message, type = "") {
  const save = hrCopyEditorState.quickSave;
  if (!save) return;
  save.textContent = type === "error" ? "Reintentar" : message || "Guardar cambios";
  save.dataset.state = type;
  save.title = type === "error" ? message : "";
}

function setCopyEditorVisibility(visible, persist = true) {
  hrCopyEditorState.visible = Boolean(visible);
  if (persist) persistUiVisibility(HR_COPY_EDITOR_VISIBLE_KEY, hrCopyEditorState.visible);
  hrCopyEditorState.root?.classList.toggle("is-collapsed", !hrCopyEditorState.visible);
  const toggle = hrCopyEditorState.visibilityToggle;
  if (!toggle) return;
  toggle.setAttribute("aria-expanded", String(hrCopyEditorState.visible));
  toggle.setAttribute("aria-label", hrCopyEditorState.visible ? "Ocultar editor de textos" : "Mostrar editor de textos");
  toggle.title = hrCopyEditorState.visible ? "Ocultar editor de textos" : "Mostrar editor de textos";
  toggle.innerHTML = visibilityToggleIcon(!hrCopyEditorState.visible);
}

function applyGlobalCopyEditorState() {
  const active = hrCopyEditorState.active;
  hrCopyEditorState.entries.forEach((entry) => {
    entry.element.classList.toggle("hr-copy-editor-target", active);
    entry.element.classList.toggle("hr-copy-editor-target--changed", active && entry.value !== entry.defaultText);
    if (active) {
      entry.element.setAttribute("data-hr-copy-runtime-key", entry.key);
      if (entry.editing) {
        entry.element.setAttribute("contenteditable", "true");
        entry.element.setAttribute("spellcheck", "true");
      } else {
        entry.element.removeAttribute("contenteditable");
        entry.element.removeAttribute("spellcheck");
      }
    } else {
      entry.element.removeAttribute("data-hr-copy-runtime-key");
      entry.element.removeAttribute("contenteditable");
      entry.element.removeAttribute("spellcheck");
      entry.editing = false;
    }
  });
  hrCopyEditorState.root?.classList.toggle("is-active", active);
  hrCopyEditorState.quickSave?.toggleAttribute("hidden", !active);
  if (hrCopyEditorState.quickSave) {
    hrCopyEditorState.quickSave.style.display = active ? "inline-flex" : "none";
  }
  if (hrCopyEditorState.toggle) {
    hrCopyEditorState.toggle.setAttribute("aria-checked", String(active));
    hrCopyEditorState.toggle.dataset.mode = active ? "editor" : "espectador";
    hrCopyEditorState.toggle.setAttribute(
      "aria-label",
      active ? "Cambiar a modo espectador" : "Cambiar a modo editor",
    );
  }
}

function placeGlobalCopyCaret(element) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function beginGlobalCopyInlineEdit(entry, event) {
  if (!hrCopyEditorState.active || !entry?.element) return;
  event?.preventDefault();
  event?.stopPropagation();
  entry.editing = true;
  applyGlobalCopyEditorState();
  entry.element.focus();
  placeGlobalCopyCaret(entry.element);
}

async function loadGlobalCopyOverrides(entries, pagePath) {
  if (!HR_SITE_TEXT_OVERRIDES_ENABLED) return;
  try {
    const supabase = await getHiddenRoomSupabaseClient();
    const { data, error } = await supabase
      .from("site_text_overrides")
      .select("content_key,override_text")
      .eq("page_path", pagePath)
      .eq("is_active", true);
    if (error) return;
    const overrides = new Map((data || []).map((row) => [String(row.content_key || ""), row.override_text ?? ""]));
    entries.forEach((entry) => {
      if (!overrides.has(entry.key)) return;
      entry.value = String(overrides.get(entry.key));
      entry.element.textContent = entry.value;
    });
  } catch {}
}

async function refreshGlobalCopyEditorPage() {
  const refreshId = ++hrCopyEditorState.refreshId;
  hrCopyEditorState.pagePath = copyEditorPagePath();
  hrCopyEditorState.entries = collectGlobalCopyEntries();
  if (!hrCopyEditorState.canEdit) {
    applyGlobalCopyEditorState();
    return;
  }
  await loadGlobalCopyOverrides(hrCopyEditorState.entries, hrCopyEditorState.pagePath);
  if (refreshId !== hrCopyEditorState.refreshId) return;
  applyGlobalCopyEditorState();
}

function setGlobalCopyEditorAccess(visible) {
  hrCopyEditorState.canEdit = HR_SITE_TEXT_OVERRIDES_ENABLED && Boolean(visible);
  if (!hrCopyEditorState.root) return;
  hrCopyEditorState.root.hidden = !hrCopyEditorState.canEdit;
  if (!hrCopyEditorState.canEdit) {
    hrCopyEditorState.active = false;
    applyGlobalCopyEditorState();
    return;
  }
  refreshGlobalCopyEditorPage();
}

async function saveGlobalCopyEditor() {
  if (!HR_SITE_TEXT_OVERRIDES_ENABLED) return;
  if (!hrCopyEditorState.canEdit || !hrCopyEditorState.entries.length) return;
  if (hrCopyEditorState.quickSave) hrCopyEditorState.quickSave.disabled = true;
  setCopyEditorStatus("Guardando…");
  try {
    const supabase = await getHiddenRoomSupabaseClient();
    const rows = hrCopyEditorState.entries.map((entry) => {
      const value = entry.value.trim();
      const changed = value !== entry.defaultText;
      return {
        page_path: hrCopyEditorState.pagePath,
        content_key: entry.key,
        default_text: entry.defaultText,
        override_text: changed ? value : null,
        is_active: changed,
      };
    });
    const { error } = await supabase
      .from("site_text_overrides")
      .upsert(rows, { onConflict: "page_path,content_key" });
    if (error) throw error;
    setCopyEditorStatus("Cambios guardados", "success");
    applyGlobalCopyEditorState();
  } catch (error) {
    setCopyEditorStatus(error?.message || "No se pudieron guardar los cambios.", "error");
  } finally {
    if (hrCopyEditorState.quickSave) hrCopyEditorState.quickSave.disabled = false;
  }
}

function initGlobalCopyEditor() {
  if (!document.body?.hasAttribute("data-hr-chrome")) return;
  const root = document.createElement("div");
  root.id = "hr-copy-editor";
  root.className = "hr-copy-editor";
  root.dataset.hrCopyIgnore = "";
  root.hidden = true;
  root.innerHTML = `
    <div class="hr-copy-editor__topbar">
      <div class="hr-copy-editor__mode" aria-label="Modo de edición">
        <span class="hr-copy-editor__mode-title">Modo</span>
        <button class="hr-copy-editor__toggle" type="button" role="switch" aria-checked="false" aria-label="Cambiar a modo editor" data-mode="espectador">
          <span class="hr-copy-editor__mode-option hr-copy-editor__mode-option--viewer">Espectador</span>
          <span class="hr-copy-editor__mode-option hr-copy-editor__mode-option--editor">Editor</span>
          <span class="hr-copy-editor__mode-thumb" aria-hidden="true"></span>
        </button>
        <button class="hr-copy-editor__quick-save" type="button" hidden>Guardar cambios</button>
      </div>
      <button class="hr-copy-editor__visibility" type="button" data-copy-editor-visibility-toggle aria-expanded="true" aria-label="Ocultar editor de textos" title="Ocultar editor de textos"></button>
    </div>
  `;
  document.body.append(root);
  hrCopyEditorState.root = root;
  hrCopyEditorState.toggle = root.querySelector(".hr-copy-editor__toggle");
  hrCopyEditorState.quickSave = root.querySelector(".hr-copy-editor__quick-save");
  hrCopyEditorState.visibilityToggle = root.querySelector("[data-copy-editor-visibility-toggle]");
  setCopyEditorVisibility(readUiVisibility(HR_COPY_EDITOR_VISIBLE_KEY), false);
  hrCopyEditorState.toggle.addEventListener("click", () => {
    hrCopyEditorState.active = !hrCopyEditorState.active;
    if (hrCopyEditorState.active) {
      setCopyEditorStatus("");
    }
    applyGlobalCopyEditorState();
  });
  hrCopyEditorState.quickSave.addEventListener("click", saveGlobalCopyEditor);
  hrCopyEditorState.visibilityToggle.addEventListener("click", () => {
    setCopyEditorVisibility(!hrCopyEditorState.visible);
  });
  document.addEventListener("click", (event) => {
    if (!hrCopyEditorState.active) return;
    const target = event.target.closest("[data-hr-copy-runtime-key]");
    if (!target || root.contains(target)) return;
    if (target.closest("a,button")) event.preventDefault();
    target.focus();
  }, true);
  window.addEventListener("hr:spa-content-updated", refreshGlobalCopyEditorPage);
  refreshGlobalCopyEditorPage();
}

function setGlobalAuthState(state) {
  document.querySelectorAll("[data-hr-session], [data-hr-drawer-session]").forEach((target) => {
    target.dataset.hrAuthState = state;
    target.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  });
  document.body?.classList.toggle("hr-auth-loading", state === "loading");
}

function getHiddenRoomSupabaseClient() {
  if (window.__hiddenRoomSupabaseClient) {
    return Promise.resolve(window.__hiddenRoomSupabaseClient);
  }

  if (!window.__hiddenRoomSupabaseClientPromise) {
    window.__hiddenRoomSupabaseClientPromise = import(HR_SUPABASE_CDN).then(({ createClient }) => {
      window.__hiddenRoomSupabaseClient = window.__hiddenRoomSupabaseClient
        || createClient(HR_SUPABASE_URL, HR_SUPABASE_ANON_KEY);
      return window.__hiddenRoomSupabaseClient;
    });
  }

  return window.__hiddenRoomSupabaseClientPromise;
}

window.HiddenRoomSupabase = window.HiddenRoomSupabase || {
  url: HR_SUPABASE_URL,
  anonKey: HR_SUPABASE_ANON_KEY,
  getClient: getHiddenRoomSupabaseClient,
};

function initAnalytics() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);
}

function cleanIndexURL() {
  const { pathname, search, hash } = window.location;
  if (!pathname.endsWith('/index.html')) return;

  const cleanPath = pathname.slice(0, -'index.html'.length);
  window.history.replaceState(null, '', `${cleanPath}${search}${hash}`);
}

function hydrateCanonicalMeta() {
  const cleanURL = new URL(window.location.href);
  if (cleanURL.pathname.endsWith('/index.html')) {
    cleanURL.pathname = cleanURL.pathname.slice(0, -'index.html'.length);
  }

  document.querySelectorAll('meta[property="og:url"]').forEach((meta) => {
    meta.setAttribute('content', cleanURL.href);
  });
}

cleanIndexURL();
hydrateCanonicalMeta();
initAnalytics();

function renderSubNav(module) {
  const path = window.location.pathname;
  const hash = window.location.hash.slice(1);
  const searchParams = new URLSearchParams(window.location.search);
  const page = document.body.dataset.page || "";
  const item = (href, label, active = false, attrs = "") => (
    `<a class="hr-nav__sub-link" href="${href}"${active ? ' aria-current="page"' : ""}${attrs}>${label}</a>`
  );

  if (module === "media") {
    return [
      item("/media/", "Publicaciones", !path.includes("/admin")),
      item("/media/#media-filters", "Categorías"),
      item(
        "/media/admin.html",
        "CMS",
        path.includes("/admin"),
        ` data-media-admin-link data-admin-nav-link hidden`,
      ),
    ].join("");
  }

  if (module === "academia") {
    const view = searchParams.get("view") || hash;
    const isAdmin = view === "admin";
    return [
      item("/academia/", "Cursos", !isAdmin && view !== "my"),
      item("/academia/?view=my", "Mis cursos", view === "my"),
      item("/academia/?view=admin", "Admin", isAdmin, " data-admin-nav-link hidden"),
    ].join("");
  }

  if (module === "store") {
    const isBeatStore = path.startsWith("/store/beat_store/");
    if (isBeatStore) {
      const isBeatAdmin = searchParams.get("view") === "admin" || searchParams.get("admin") === "1";
      const isBeatUpload = path.endsWith("/new-beat.html");
      return [
        item("/store/beat_store/", "Explorar beats", !isBeatAdmin && !isBeatUpload),
        item("/store/cart.html", 'Carrito <span class="cart-count">0</span>', path.endsWith("/cart.html")),
        item(
          "/store/beat_store/orders.html",
          "Mis compras",
          path.endsWith("/orders.html"),
          "",
        ),
        item(
          "/store/beat_store/new-beat.html",
          "Subir",
          isBeatUpload,
          ' data-permission-nav-link="beats.upload" hidden',
        ),
        item(
          "/store/beat_store/?view=admin",
          "Admin beats",
          isBeatAdmin,
          " data-admin-nav-link hidden data-beat-admin-entry",
        ),
      ].join("");
    }

    const isAdminStore = path.endsWith("/store/admin.html");
    return [
      item("/store/", "Tienda", (page === "catalog" || page === "product") && !isAdminStore),
      item(
        "/store/admin.html",
        "Admin Store",
        isAdminStore,
        " data-admin-nav-link hidden",
      ),
      item("/store/cart.html", 'Carrito <span class="cart-count">0</span>', page === "cart"),
      item(
        "/store/orders.html",
        "Mis compras",
        path.endsWith("/orders.html"),
        path.endsWith("/orders.html") ? "" : " data-auth-link hidden",
      ),
    ].join("");
  }
  if (module === "media" && document.body.classList.contains("media-admin")) {
    return `
      <a class="hr-nav__action" href="/media/" target="_blank" rel="noopener">Ver Media</a>
      <button class="hr-nav__action" id="logout-button" type="button">Cerrar sesión</button>
    `;
  }

  if (module === "games") {
    return [
      item("/minijuegos/", "Juegos", true),
      item("/portal/dashboard.html#client-rewards", "Ranking"),
    ].join("");
  }

  if (module === "portal") {
    return "";
  }

  if (module === "tickets") {
    return [
      item("/tickets/", "Eventos", path.endsWith("/tickets/") || path.endsWith("/tickets/index.html")),
      item("/tickets/validate.html", "Validar", path.endsWith("/validate.html")),
      item("/tickets/generate.html", "Admin", path.endsWith("/generate.html") || path.endsWith("/view.html"), " data-admin-nav-link hidden"),
    ].join("");
  }

  return "";
}

function renderNavActions(module) {
  if (document.body.classList.contains("db-body")) {
    return `
      <button class="hr-nav__notifications" id="js-notifications-toggle" aria-label="Notificaciones"
        aria-expanded="false" data-hr-notifications-toggle aria-controls="hr-global-notifications">
        <svg class="hr-nav__notification-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M10.27 21a2 2 0 0 0 3.46 0" />
          <path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 10a6 6 0 0 0-12 0c0 2.5-1.41 3.96-2.74 5.33Z" />
        </svg>
        <span class="hr-nav__notifications-label">Notificaciones</span>
        <span class="hr-nav__notification-count hr-nav__notification-count--number" id="js-notif-count"
          aria-label="notificaciones sin leer" hidden></span>
      </button>
      <button class="hr-nav__account hr-nav__account--button" id="js-user-menu-toggle"
        aria-haspopup="true" aria-expanded="false"
        aria-controls="js-user-menu js-sidebar" aria-label="Abrir menú">
        <span class="hr-nav__avatar" id="js-user-avatar" aria-hidden="true"></span>
        <span class="hr-nav__hello" id="js-user-display-name">-</span>
      </button>
      <nav class="db-user-menu" id="js-user-menu" aria-label="Menú de usuario" hidden>
        <ul class="db-user-menu__list" role="list">
          <li><a class="db-user-menu__item" href="/">Volver al sitio</a></li>
          <li><button class="db-user-menu__item" data-action="profile">Perfil</button></li>
          <li><button class="db-user-menu__item" data-action="settings">Ajustes</button></li>
          <li><button class="db-user-menu__item db-user-menu__item--danger" data-action="logout">Cerrar sesión</button></li>
        </ul>
      </nav>
    `;
  }

  const moduleAction = module === "store" ? `
      <a class="hr-nav__action hr-nav__action--cart" href="/store/cart.html">
        Carrito <span class="cart-count">0</span>
      </a>
    ` : "";

  return `
    ${moduleAction}
    <div class="hr-nav__session" data-hr-session>
      ${globalSessionSnapshot
        ? authenticatedHeaderMarkup(globalSessionSnapshot.profile, globalSessionSnapshot.user, globalSessionSnapshot.unread)
        : globalAuthLoadingMarkup()}
    </div>
    <span id="session-user" class="hr-nav__user" hidden></span>
  `;
}

function globalAuthLoadingMarkup(drawer = false) {
  if (drawer) {
    return '<div class="hr-global-drawer__auth-loading" aria-hidden="true"><span></span><span></span></div>';
  }
  return `
    <div class="hr-nav__auth-loading" aria-hidden="true">
      <span class="hr-nav__auth-loading-bell"></span>
      <span class="hr-nav__auth-loading-account"><i></i><b></b></span>
    </div>
  `;
}

function renderGlobalDrawer(activeModule) {
  const isPortalDashboard = document.body.classList.contains("db-body");
  const navPath = window.location.pathname;
  const drawerSessionMarkup = isPortalDashboard
    ? `
          <div class="hr-global-drawer__guest hr-global-drawer__guest--portal">
            <button type="button" data-global-nav-action="settings">Ajustes</button>
            <button type="button" data-global-nav-action="logout">Cerrar sesión</button>
          </div>
        `
    : `
          <div class="hr-global-drawer__guest">
            <a href="/portal/">Ingresar</a>
            <a href="/portal/?mode=register">Registrarse</a>
          </div>
        `;

  return `
    <button class="hr-global-drawer__backdrop" type="button"
      data-global-drawer-close aria-label="Cerrar menú" hidden></button>
    <aside class="hr-global-drawer" id="hr-global-drawer"
      aria-label="Menú principal" aria-hidden="true" hidden>
      <header class="hr-global-drawer__header">
        <a class="hr-global-drawer__brand" href="/" aria-label="Hidden Room, inicio">
          <img src="/assets/img/white_logo.webp" alt="Hidden Room">
        </a>
        <button class="hr-global-drawer__close" type="button"
          data-global-drawer-close aria-label="Cerrar menú">x</button>
      </header>
      <p class="hr-global-drawer__label">Ecosistema</p>
      <nav class="hr-global-drawer__links" aria-label="Navegación móvil">
        ${ECOSYSTEM_LINKS
          .filter(([key]) => !MORE_NAV_KEYS.has(key))
          .map((item) => renderGlobalNavLink(item, activeModule, navPath, true))
          .join("")}
        ${renderMoreNav(activeModule, navPath, true)}
      </nav>
      <div class="hr-global-drawer__footer">
        <div data-hr-drawer-session>
          ${globalSessionSnapshot
            ? authenticatedHeaderMarkup(globalSessionSnapshot.profile, globalSessionSnapshot.user, globalSessionSnapshot.unread, true)
            : globalAuthLoadingMarkup(true)}
        </div>
        <div class="hr-global-drawer__meta">
          <span class="site-status"></span>
          <a href="/changelog.html" class="site-version"></a>
        </div>
      </div>
    </aside>
  `;
}

function escapeNavText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstName(value, fallback = "Usuario") {
  return String(value || fallback).trim().split(/\s+/)[0] || fallback;
}

function globalDisplayName(profile, user) {
  return firstName(
    profile?.display_name ||
      profile?.username ||
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      "Usuario",
  );
}

function globalAvatarSrc(value) {
  const fallback = "/assets/img/np-negative.webp";
  const avatar = String(value || "").trim();
  if (!/^https?:\/\//i.test(avatar)) return fallback;

  try {
    const url = new URL(avatar);
    const host = url.hostname.toLowerCase();
    const blockedHosts = ["cdninstagram.com", "fbcdn.net", "facebook.com", "fbsbx.com"];
    if (blockedHosts.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
      return fallback;
    }
    return url.href;
  } catch (_error) {
    return fallback;
  }
}

function cleanGlobalInstagramUsername(value) {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#\s]/)[0]
    .replace(/[^a-zA-Z0-9._]/g, "")
    .slice(0, 30);
}

let instagramUsernamePromptOpen = false;
let instagramUsernamePromptResolved = false;

function showGlobalInstagramUsernamePrompt(profile, user, supabase) {
  if (!user?.id || profile?.ig_username || instagramUsernamePromptOpen || instagramUsernamePromptResolved) return;
  if (document.getElementById("js-onboarding-gate")) {
    window.setTimeout(() => showGlobalInstagramUsernamePrompt(profile, user, supabase), 1800);
    return;
  }

  document.getElementById("hr-instagram-username-gate")?.remove();
  instagramUsernamePromptOpen = true;

  const displayName = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "Usuario";
  const overlay = document.createElement("div");
  overlay.id = "hr-instagram-username-gate";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "hr-instagram-username-title");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "background:rgba(0,0,0,.82)",
    "z-index:var(--hr-z-overlay,10001)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:16px",
  ].join(";");

  overlay.innerHTML = `
    <div style="width:min(460px,100%);background:#101010;color:#f8f8f8;border:1px solid rgba(255,255,255,.16);border-radius:8px;box-shadow:0 24px 80px rgba(0,0,0,.45);padding:20px;">
      <h2 id="hr-instagram-username-title" style="margin:0 0 8px;font-size:1.2rem;">Instagram</h2>
      <p style="margin:0 0 16px;color:#d7d7d7;line-height:1.45;">
        <strong>${escapeNavText(displayName)}</strong> Escribe tu usuario de instagram, es importante para que no tengas problemas con tus beneficios.
      </p>
      <form data-hr-instagram-username-form>
        <label style="display:grid;gap:6px;margin-bottom:14px;">
          <span style="font-size:.86rem;color:#bdbdbd;">Usuario de Instagram</span>
          <input name="ig_username" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="tu_usuario" required
            style="width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#050505;color:#fff;padding:12px;font:inherit;" />
        </label>
        <button type="submit" style="width:100%;border:0;border-radius:8px;background:#fff;color:#000;padding:12px 14px;font-weight:700;cursor:pointer;">Guardar Instagram</button>
        <div data-hr-instagram-username-status hidden style="margin-top:10px;color:#fca5a5;font-size:.86rem;"></div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("input[name='ig_username']")?.focus();

  overlay.querySelector("form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button[type='submit']");
    const status = form.querySelector("[data-hr-instagram-username-status]");
    const igUsername = cleanGlobalInstagramUsername(new FormData(form).get("ig_username"));

    if (!igUsername || igUsername.length < 2) {
      if (status) {
        status.hidden = false;
        status.textContent = "Escribe un usuario de Instagram valido.";
      }
      return;
    }

    submit.disabled = true;
    try {
      const { error } = await supabase
        .from("users")
        .update({ ig_username: igUsername })
        .eq("id", user.id);

      if (error) throw error;

      instagramUsernamePromptResolved = true;
      instagramUsernamePromptOpen = false;
      overlay.remove();
      window.dispatchEvent(new CustomEvent("hiddenroom:ig-username-updated", { detail: { ig_username: igUsername } }));
    } catch (error) {
      console.info("[HR] No se pudo guardar Instagram:", error?.message || error);
      submit.disabled = false;
      if (status) {
        status.hidden = false;
        status.textContent = error?.message || "No se pudo guardar tu Instagram.";
      }
    }
  });
}
function authenticatedHeaderMarkup(profile, user, unread = 0, drawer = false) {
  const name = globalDisplayName(profile, user);
  const avatarSrc = globalAvatarSrc(profile?.avatar_url);
  const avatarMarkup = `<img src="${escapeNavText(avatarSrc)}" alt=""
    referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/assets/img/np-negative.webp'">`;

  if (drawer) {
    return `
      <a class="hr-global-drawer__account" href="/portal/dashboard.html">
        <span class="hr-nav__avatar">${avatarMarkup}</span>
        <span class="hr-global-drawer__hello">Hola, <strong>${escapeNavText(name)}</strong></span>
      </a>
      <a class="hr-global-drawer__portal" href="/portal/dashboard.html">Portal</a>
    `;
  }

  return `
    <button class="hr-nav__notifications" type="button" data-hr-notifications-toggle
      aria-label="Notificaciones${unread ? `, ${unread} sin leer` : ""}"
      aria-controls="hr-global-notifications" aria-expanded="false">
      <svg class="hr-nav__notification-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M10.27 21a2 2 0 0 0 3.46 0" />
        <path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 10a6 6 0 0 0-12 0c0 2.5-1.41 3.96-2.74 5.33Z" />
      </svg>
      <span class="hr-nav__notifications-label">Notificaciones</span>
      ${unread ? `<span class="hr-nav__notification-count hr-nav__notification-count--number" aria-hidden="true">${unread}</span>` : ""}
    </button>
    <a class="hr-nav__account" href="/portal/dashboard.html">
      <span class="hr-nav__avatar">${avatarMarkup}</span>
      <span class="hr-nav__hello">Hola, <strong>${escapeNavText(name)}</strong></span>
    </a>
  `;
}

function guestHeaderMarkup(drawer = false) {
  if (drawer) {
    return `
      <div class="hr-global-drawer__guest">
        <a href="/portal/">Ingresar</a>
        <a href="/portal/?mode=register">Registrarse</a>
      </div>
    `;
  }

  return `
    <div class="hr-nav__guest">
      <a href="/portal/">Ingresar</a>
      <span aria-hidden="true">|</span>
      <a href="/portal/?mode=register">Registrarse</a>
    </div>
  `;
}

function globalNotificationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderGlobalNotifications(items) {
  const panel = document.getElementById("hr-global-notifications");
  const list = panel?.querySelector("[data-hr-notifications-list]");
  if (!list) return;

  list.innerHTML = items.length
    ? items.map((item) => `
        <li class="hr-notice hr-notice--${escapeNavText(item.type || "info")} hr-global-notifications__item${item.read ? " is-read" : ""}">
          <span class="hr-notice__dot hr-global-notifications__dot" aria-hidden="true"></span>
          <span class="hr-notice__message hr-global-notifications__message">${escapeNavText(item.message || "Notificación")}</span>
          <time class="hr-notice__time">${escapeNavText(globalNotificationTime(item.created_at))}</time>
        </li>
      `).join("")
    : '<li class="hr-global-notifications__empty">Sin notificaciones nuevas.</li>';
}

function toggleGlobalNotifications(forceOpen) {
  const panel = document.getElementById("hr-global-notifications");
  if (!panel) return;
  const open = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
  panel.hidden = !open;
  document.querySelectorAll("[data-hr-notifications-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", String(open));
  });
}

function attachGlobalNotificationListeners() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-hr-notifications-toggle]");
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      if (document.body.classList.contains("hr-global-menu-open")) toggleGlobalDrawer(false);
      toggleGlobalNotifications();
      return;
    }

    if (event.target.closest("[data-hr-notifications-close]")) {
      toggleGlobalNotifications(false);
      return;
    }

    const panel = document.getElementById("hr-global-notifications");
    if (panel && !panel.hidden && !event.target.closest("#hr-global-notifications")) {
      toggleGlobalNotifications(false);
    }
  });
}

function roleListIncludesAdmin(rawRoles) {
  return String(rawRoles || "").split(",").map((role) => role.trim().toLowerCase()).includes("admin");
}

function setAdminNavigationVisibility(visible) {
  document.querySelectorAll("[data-admin-nav-link]").forEach((link) => {
    link.hidden = !visible;
  });
}

function setPermissionNavigationVisibility(permissionKey, visible) {
  document.querySelectorAll("[data-permission-nav-link]").forEach((link) => {
    if (link.dataset.permissionNavLink === permissionKey) link.hidden = !visible;
  });
}

window.HiddenRoomNavigation = window.HiddenRoomNavigation || {
  setAdminLinksVisible: setAdminNavigationVisibility,
  setPermissionLinksVisible: setPermissionNavigationVisibility,
};

async function hydrateGlobalSession() {
  if (document.body.classList.contains("db-body")) return;
  const sessionTargets = document.querySelectorAll("[data-hr-session]");
  const drawerTargets = document.querySelectorAll("[data-hr-drawer-session]");
  if (!sessionTargets.length && !drawerTargets.length) return;

  setGlobalAuthState("loading");

  try {
    const supabase = await getHiddenRoomSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || null;
    if (!user) {
      clearViewAsSelection();
      syncViewAsNavigation(null);
      renderViewAsBanner(null);
      sessionTargets.forEach((target) => {
        target.innerHTML = guestHeaderMarkup();
      });
      drawerTargets.forEach((target) => {
        target.innerHTML = guestHeaderMarkup(true);
      });
      sessionTargets.forEach((target) => { target.hidden = false; });
      drawerTargets.forEach((target) => { target.hidden = false; });
      setAdminNavigationVisibility(false);
      setGlobalCopyEditorAccess(false);
      setPermissionNavigationVisibility("beats.upload", false);
      renderGlobalNotifications([]);
      toggleGlobalNotifications(false);
      const inactiveViewAsContext = {
        active: false,
        actualUser: null,
        actualProfile: null,
        user: null,
        profile: null,
        roles: [],
        permissions: [],
      };
      hrViewAsContext = inactiveViewAsContext;
      resolveHrViewAsReady?.(inactiveViewAsContext);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("user_id,display_name,username,email,avatar_url,roles,ig_username")
      .eq("id", user.id)
      .maybeSingle();

    const viewAs = await resolveViewAsContext(supabase, user, profile);
    const effectiveProfile = viewAs.active ? viewAs.profile : profile;
    const effectiveUser = viewAs.active ? viewAs.user : user;
    const effectiveRoles = viewAs.roles || resolveEffectivePermissions(effectiveProfile, []).roles;
    const effectivePermissions = viewAs.permissions || [];

    const permissionResult = viewAs.active
      ? { data: effectivePermissions.includes("beats.upload"), error: null }
      : await supabase.rpc("has_beats_upload_permission");
    let hasBeatUploadPermission = permissionResult.data;
    if (permissionResult.error) {
      const { data: permissionRows } = await supabase
        .from("user_permissions")
        .select("permission_key")
        .eq("user_id", user.id);
      hasBeatUploadPermission = (permissionRows || [])
        .map((row) => String(row.permission_key || "").trim().toLowerCase())
        .includes("beats.upload");
    }
    setPermissionNavigationVisibility(
      "beats.upload",
      !viewAs.active && (roleListIncludesAdmin(effectiveProfile?.roles) || Boolean(hasBeatUploadPermission)),
    );

    const notificationTargets = [effectiveUser?.id, effectiveProfile?.user_id].filter(Boolean).map(String);
    let notifications = [];
    if (notificationTargets.length) {
      const { data } = await supabase
        .from("notifications")
        .select("id,message,type,created_at,read,user_id")
        .in("user_id", notificationTargets)
        .order("created_at", { ascending: false })
        .limit(25);
      notifications = data || [];
    }
    const unread = notifications.filter((item) => !item.read).length;
    let canSeeAdminNav = !viewAs.active && roleListIncludesAdmin(effectiveProfile?.roles);
    if (!viewAs.active && !canSeeAdminNav) {
      const { data: academiaPermissionRows } = await supabase
        .from("user_permissions")
        .select("permission_key")
        .eq("user_id", user.id);
      canSeeAdminNav = (academiaPermissionRows || [])
        .map((row) => String(row.permission_key || "").trim().toLowerCase())
        .includes("academia.admin");
    }
    setAdminNavigationVisibility(canSeeAdminNav);
    setGlobalCopyEditorAccess(roleListIncludesAdmin(profile?.roles) && !viewAs.active);
    globalSessionSnapshot = { profile: effectiveProfile, user: effectiveUser, notifications, unread };
    syncViewAsNavigation(viewAs);
    renderViewAsBanner(viewAs);

    sessionTargets.forEach((target) => {
      target.innerHTML = authenticatedHeaderMarkup(effectiveProfile, effectiveUser, unread);
    });
    drawerTargets.forEach((target) => {
      target.innerHTML = authenticatedHeaderMarkup(effectiveProfile, effectiveUser, unread, true);
    });
    sessionTargets.forEach((target) => { target.hidden = false; });
    drawerTargets.forEach((target) => { target.hidden = false; });
    setGlobalAuthState("authenticated");
    renderGlobalNotifications(notifications);
    showGlobalInstagramUsernamePrompt(profile, user, supabase);
  } catch (error) {
    syncViewAsNavigation(null);
    renderViewAsBanner(null);
    setAdminNavigationVisibility(false);
    setGlobalCopyEditorAccess(false);
    setPermissionNavigationVisibility("beats.upload", false);
    sessionTargets.forEach((target) => {
      target.innerHTML = guestHeaderMarkup();
      target.hidden = false;
    });
    drawerTargets.forEach((target) => {
      target.innerHTML = guestHeaderMarkup(true);
      target.hidden = false;
    });
    console.info("[HR] No fue posible hidratar la sesión global:", error?.message || error);
  }
}

async function hydrateGlobalInstagramUsernamePrompt() {
  try {
    const supabase = await getHiddenRoomSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("users")
      .select("id,display_name,username,email,ig_username")
      .eq("id", user.id)
      .maybeSingle();

    showGlobalInstagramUsernamePrompt(profile, user, supabase);
  } catch (error) {
    console.info("[HR] No fue posible validar Instagram global:", error?.message || error);
  }
}
async function attachGlobalSessionSync() {
  if (document.body.classList.contains("db-body")) return;

  try {
    const supabase = await getHiddenRoomSupabaseClient();
    supabase.auth.onAuthStateChange(() => {
      window.setTimeout(hydrateGlobalSession, 0);
      window.setTimeout(hydrateGlobalInstagramUsernamePrompt, 0);
    });
  } catch (error) {
    console.info("[HR] No fue posible sincronizar la sesión global:", error?.message || error);
  }
}

let globalDrawerScrollY = 0;
let globalDrawerScrollLocked = false;
let globalDrawerBodyStyles = null;

function lockGlobalDrawerScroll() {
  if (globalDrawerScrollLocked) return;

  globalDrawerScrollY = window.scrollY;
  globalDrawerBodyStyles = {
    position: document.body.style.position,
    top: document.body.style.top,
    right: document.body.style.right,
    left: document.body.style.left,
    width: document.body.style.width,
  };
  globalDrawerScrollLocked = true;
  document.documentElement.classList.add("hr-scroll-locked");
  document.body.style.position = "fixed";
  document.body.style.top = `-${globalDrawerScrollY}px`;
  document.body.style.right = "0";
  document.body.style.left = "0";
  document.body.style.width = "100%";
}

function syncGlobalOverlayState() {
  const globalOpen = document.body.classList.contains("hr-global-menu-open");
  const portalOpen = document.body.classList.contains("hr-portal-menu-open");
  document.body.classList.toggle("hr-overlay-open", globalOpen || portalOpen);
}

/**
 * Close only persistent global overlays and release the drawer's scroll lock.
 * This is intentionally idempotent so SPA navigation and nav rerenders can
 * call it even when the drawer is already closed or partially replaced.
 */
function releaseGlobalOverlayState() {
  const drawer = document.getElementById("hr-global-drawer");
  const backdrop = document.querySelector(".hr-global-drawer__backdrop");
  const toggle = document.querySelector(".hr-nav__mobile-toggle");
  const instagramGate = document.getElementById("hr-instagram-username-gate");
  const html = document.documentElement;
  const body = document.body;
  const staleBodyScrollMatch = body.style.top.match(/^-([\d.]+)px$/);
  const hadStaleLock = html.classList.contains("hr-scroll-locked")
    || body.classList.contains("hr-global-menu-open")
    || (body.style.position === "fixed" && Boolean(staleBodyScrollMatch));

  if (drawer) {
    drawer.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
  }
  if (backdrop) backdrop.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
  body.classList.remove("hr-global-menu-open");
  syncGlobalOverlayState();
  html.classList.remove("hr-scroll-locked");

  if (globalDrawerScrollLocked || hadStaleLock) {
    const restoreY = globalDrawerScrollLocked
      ? globalDrawerScrollY
      : staleBodyScrollMatch
        ? Math.max(0, Number.parseFloat(staleBodyScrollMatch[1]) || 0)
        : null;
    const originalStyles = globalDrawerBodyStyles;
    body.style.position = originalStyles?.position ?? "";
    body.style.top = originalStyles?.top ?? "";
    body.style.right = originalStyles?.right ?? "";
    body.style.left = originalStyles?.left ?? "";
    body.style.width = originalStyles?.width ?? "";
    globalDrawerScrollLocked = false;
    globalDrawerBodyStyles = null;
    if (restoreY !== null) window.scrollTo(0, restoreY);
  }

  if (instagramGate) {
    instagramGate.remove();
    instagramUsernamePromptOpen = false;
  }
}

window.releaseGlobalOverlayState = releaseGlobalOverlayState;

function toggleGlobalDrawer(forceOpen) {
  const drawer = document.getElementById("hr-global-drawer");
  const backdrop = document.querySelector(".hr-global-drawer__backdrop");
  const toggle = document.querySelector(".hr-nav__mobile-toggle");
  if (!drawer || !backdrop || !toggle) return;

  const open = typeof forceOpen === "boolean"
    ? forceOpen
    : drawer.getAttribute("aria-hidden") === "true";

  drawer.hidden = !open;
  if (open) drawer.scrollTop = 0;
  backdrop.hidden = !open;
  drawer.setAttribute("aria-hidden", String(!open));
  toggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("hr-global-menu-open", open);
  if (open) lockGlobalDrawerScroll();
  else releaseGlobalOverlayState();
  syncGlobalOverlayState();

  if (open) drawer.querySelector(".hr-global-drawer__close")?.focus();
  else toggle.focus();
}

const HR_BEAT_PLAYER_STORAGE_KEY = "hr_global_beat_player_clean";
const HR_BEAT_PLAYER_SOURCE = "beat-store";
const HR_BEAT_STORE_CLOUD_ORIGIN = "https://cloud.hiddenroom.mx";
const HR_BEAT_STORE_SETTINGS_ID = 1;
const HR_WAVESURFER_URL = "/assets/vendor/wavesurfer.esm.js";
let hrWaveSurferModulePromise = null;
let hrWaveSurfer = null;
let hrWaveSurferSrc = "";
let hrWaveSurferReady = false;
let hrWaveSurferFailed = false;
let hrCurrentBeatDetail = null;
let hrBeatPlayerQueue = [];
let hrBeatPlayerRestartTapAt = 0;
let hrGlobalBeatPlayerHydrated = false;
let hrGlobalBeatPlayerDefaultPromise = null;
let hrGlobalBeatPlayerQueuePromise = null;
let hrBeatPlayerFullscreenPlaceholder = null;
let hrBeatPlayerFullscreenLastFocus = null;
let hrBeatAudioContext = null;
let hrBeatAnalyser = null;
let hrBeatAudioSource = null;
let hrBeatGain = null;
let hrBeatAnalyserAudio = null;
let hrBeatVisualizerFrame = 0;
let hrBeatVisualizerResizeObserver = null;
let hrBeatVisualizerFrequencyData = null;
let hrBeatVisualizerEnergy = 0;
let hrBeatVisualizerDisplayValues = [];
let hrBeatVisualizerPalette = { hue: 195, saturation: 69 };
let hrBeatPlayerShuffle = false;
let hrBeatPlayerRepeat = false;
let hrBeatPlayerVolumeBeforeMute = 1;
let hrBeatPlayerVolume = 1;
let hrBeatPlayerMediaSessionBound = false;
let hrBeatPlayerColorValue = "#7cd0e9";
let hrBeatPlayerColorPicker = { hue: 195, saturation: 69, value: 92 };
let hrBeatPlayerColorCycle = false;
let hrBeatPlayerColorCycleFrame = 0;
let hrBeatPlayerColorCycleLastTime = 0;
let hrBeatPlayerColorCycleHue = 195;

const HR_BEAT_PLAYER_COLOR_CYCLE_SPEED = 24;

function shouldRenderGlobalBeatPlayer() {
  const path = window.location.pathname;
  const excludedGames = path.includes("/minijuegos/flappy_") || path.includes("/minijuegos/gol_gana/");
  const excludedPortal = path === "/portal" || path.startsWith("/portal/");
  return !excludedGames && !excludedPortal;
}

const HR_WAVEFORM_FALLBACK_BARS = [
  22, 36, 48, 30, 62, 78, 44, 68, 92, 56, 38, 72, 84, 46, 28, 58,
  74, 96, 64, 42, 30, 52, 80, 68, 40, 26, 58, 88, 72, 48, 34, 64,
  82, 54, 30, 46, 70, 94, 62, 38, 24, 50, 76, 58, 34, 22,
];

function globalWaveformFallbackMarkup() {
  return `<div class="hr-beat-player__wave-fallback" aria-hidden="true">
    ${HR_WAVEFORM_FALLBACK_BARS.map((height) => `<span style="--hr-wave-bar-height:${height}%"></span>`).join("")}
  </div>`;
}

function setGlobalWaveformMode(mode = "fallback") {
  const waveform = document.getElementById("beat-player-waveform");
  if (!waveform) return;
  waveform.dataset.mode = mode;
  const fallback = waveform.querySelector(".hr-beat-player__wave-fallback");
  if (fallback) fallback.hidden = mode === "wave";
}

function beatPlayerIcon(name) {
  const paths = {
    play: '<path d="M8 4.75L19.5 12L8 19.25Z"></path>',
    pause: '<path d="M7 5H11V19H7ZM13 5H17V19H13Z"></path>',
    prev: '<path d="M9.5 4.5L2 12L9.5 19.5L12 17L7 12L12 7ZM17 4.5L9.5 12L17 19.5L19.5 17L14.5 12L19.5 7Z"></path>',
    next: '<path d="M7 4.5L14.5 12L7 19.5L4.5 17L9.5 12L4.5 7ZM14.5 4.5L22 12L14.5 19.5L12 17L17 12L12 7Z"></path>',
    volume: '<path d="M3 9H7L12 5V19L7 15H3Z" fill="currentColor" stroke="none"></path><path d="M15 9.5C16.8 11 16.8 13 15 14.5M17.5 7C20.8 9.7 20.8 14.3 17.5 17" fill="none" stroke="currentColor" stroke-width="2.7"></path>',
    muted: '<path d="M3 9H7L12 5V19L7 15H3Z" fill="currentColor" stroke="none"></path><path d="M15 9L20 15M20 9L15 15" fill="none" stroke="currentColor" stroke-width="2.5"></path>',
    close: '<path d="M5 5L19 19M19 5L5 19"></path>',
    fullscreen: '<path d="M8.5 4.5H4.5V8.5M15.5 4.5H19.5V8.5M8.5 19.5H4.5V15.5M15.5 19.5H19.5V15.5"></path>',
    more: '<circle cx="5" cy="12" r="2.1"></circle><circle cx="12" cy="12" r="2.1"></circle><circle cx="19" cy="12" r="2.1"></circle>',
    shuffle: '<path d="M4 7H7C10 7 12 17 17 17H20M17 14L20 17L17 20M4 17H7C8.5 17 9.5 16 10.5 14.5M14 9.5C15 8 16 7 17 7H20"></path><path d="M17 4L20 7L17 10"></path>',
    repeat: '<path d="M5 8a7 7 0 0 1 12-2l2 2M19 16a7 7 0 0 1-12 2l-2-2M19 4v4h-4M5 20v-4h4"></path>',
  };
  const solidIcons = ["play", "pause", "prev", "next", "more"];
  const heavyIcons = ["close", "fullscreen", "shuffle", "repeat"];
  const variant = solidIcons.includes(name)
    ? " hr-player-icon--solid"
    : heavyIcons.includes(name)
      ? " hr-player-icon--heavy"
      : "";
  const className = `hr-player-icon${variant}`;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.more}</svg>`;
}

function globalBeatPlayerArtMarkup(cover = "") {
  const safeCover = String(cover || "").trim();
  return safeCover
    ? `<img src="${escapeNavText(safeCover)}" alt="" onerror="this.hidden=true;this.parentElement.classList.remove('has-image')"><span class="hr-beat-player__art-icon" aria-hidden="true">${beatPlayerIcon("play")}</span>`
    : `<span>HR</span><span class="hr-beat-player__art-icon" aria-hidden="true">${beatPlayerIcon("play")}</span>`;
}

function beatPlayerAudioContextConstructor() {
  return window.AudioContext || window.webkitAudioContext || null;
}

function beatPlayerHexToRgb(value) {
  const safeValue = /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : "#7cd0e9";
  return {
    red: Number.parseInt(safeValue.slice(1, 3), 16),
    green: Number.parseInt(safeValue.slice(3, 5), 16),
    blue: Number.parseInt(safeValue.slice(5, 7), 16),
  };
}

function beatPlayerRgbToHsv(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return {
    hue,
    saturation: max ? (delta / max) * 100 : 0,
    value: max * 100,
  };
}

function beatPlayerHsvToRgb(hue, saturation, value) {
  const h = ((Number(hue) || 0) % 360 + 360) % 360;
  const s = Math.max(0, Math.min(100, Number(saturation) || 0)) / 100;
  const v = Math.max(0, Math.min(100, Number(value) || 0)) / 100;
  const chroma = v * s;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = v - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (segment < 1) [red, green, blue] = [chroma, x, 0];
  else if (segment < 2) [red, green, blue] = [x, chroma, 0];
  else if (segment < 3) [red, green, blue] = [0, chroma, x];
  else if (segment < 4) [red, green, blue] = [0, x, chroma];
  else if (segment < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];
  return {
    red: Math.round((red + match) * 255),
    green: Math.round((green + match) * 255),
    blue: Math.round((blue + match) * 255),
  };
}

function beatPlayerRgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((channel) => Math.max(0, Math.min(255, Math.round(Number(channel) || 0))).toString(16).padStart(2, "0")).join("")}`;
}

function updateBeatPlayerColorPicker(value = hrBeatPlayerColorValue) {
  const picker = document.querySelector("[data-beat-player-color-picker]");
  if (!picker) return;
  const { red, green, blue } = beatPlayerHexToRgb(value);
  const hsv = beatPlayerRgbToHsv(red, green, blue);
  hrBeatPlayerColorValue = beatPlayerRgbToHex(red, green, blue);
  hrBeatPlayerColorPicker = hsv;
  const saturation = picker.querySelector("[data-color-picker-saturation]");
  const marker = picker.querySelector("[data-color-picker-marker]");
  const hue = picker.querySelector("[data-color-picker-hue]");
  const hex = picker.querySelector("[data-color-picker-hex]");
  if (saturation) saturation.style.setProperty("--hr-picker-hue", `${hsv.hue}deg`);
  if (marker) {
    marker.style.left = `${hsv.saturation}%`;
    marker.style.top = `${100 - hsv.value}%`;
  }
  if (hue && document.activeElement !== hue) hue.value = String(Math.round(hsv.hue));
  if (hex && document.activeElement !== hex) hex.value = hrBeatPlayerColorValue;
  ["r", "g", "b"].forEach((channel) => {
    const input = picker.querySelector(`[data-color-picker-channel="${channel}"]`);
    if (input && document.activeElement !== input) input.value = String({ r: red, g: green, b: blue }[channel]);
  });
  const swatch = document.querySelector("[data-color-picker-swatch]");
  if (swatch) swatch.style.backgroundColor = hrBeatPlayerColorValue;
  const valueLabel = document.querySelector("[data-color-picker-value]");
  if (valueLabel) valueLabel.textContent = hrBeatPlayerColorValue;
}

function setGlobalBeatPlayerColor(value) {
  const safeValue = /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : "#7cd0e9";
  hrBeatPlayerColorValue = safeValue.toLowerCase();
  const rgb = beatPlayerHexToRgb(safeValue);
  const red = rgb.red / 255;
  const green = rgb.green / 255;
  const blue = rgb.blue / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const roundedHue = Math.round(hue);
  const roundedSaturation = Math.round(saturation * 100);
  const tone = (toneLightness, saturationFactor = 1) => {
    const toneSaturation = Math.round(Math.max(0, Math.min(100, roundedSaturation * saturationFactor)));
    return `hsl(${roundedHue}, ${toneSaturation}%, ${toneLightness}%)`;
  };
  const fullscreen = document.getElementById("hr-beat-player-fullscreen");
  hrBeatVisualizerPalette = { hue: roundedHue, saturation: roundedSaturation };
  hrBeatPlayerColorPicker = beatPlayerRgbToHsv(rgb.red, rgb.green, rgb.blue);
  updateBeatPlayerColorPicker(safeValue);
  if (!fullscreen) return;
  fullscreen.style.setProperty("--hr-player-color-deep", tone(7, .42));
  fullscreen.style.setProperty("--hr-player-color-dark", tone(12, .58));
  fullscreen.style.setProperty("--hr-player-color-panel", tone(18, .72));
  fullscreen.style.setProperty("--hr-player-color-mid", tone(29, .82));
  fullscreen.style.setProperty("--hr-player-color-line", tone(48, 1));
  fullscreen.style.setProperty("--hr-player-color-muted", tone(62, .86));
  fullscreen.style.setProperty("--hr-player-color-accent", tone(74, 1.04));
  fullscreen.style.setProperty("--hr-player-color-bright", tone(90, .92));
  fullscreen.style.setProperty("--hr-player-accent", tone(74, 1.04));
  if (hrWaveSurfer?.setOptions) {
    hrWaveSurfer.setOptions({
      waveColor: `hsla(${roundedHue}, ${Math.round(roundedSaturation * .62)}%, 66%, .42)`,
      progressColor: tone(52, 1),
      cursorColor: tone(90, .92),
    });
  }
}

function stopBeatPlayerColorCycle() {
  if (hrBeatPlayerColorCycleFrame) cancelAnimationFrame(hrBeatPlayerColorCycleFrame);
  hrBeatPlayerColorCycleFrame = 0;
  hrBeatPlayerColorCycleLastTime = 0;
}

function syncBeatPlayerColorCycleControl() {
  const control = document.querySelector("[data-color-picker-cycle]");
  const status = document.querySelector("[data-color-picker-cycle-status]");
  if (control) control.checked = hrBeatPlayerColorCycle;
  if (status) status.textContent = hrBeatPlayerColorCycle ? "ON" : "OFF";
}

function animateBeatPlayerColorCycle(timestamp) {
  const fullscreen = document.getElementById("hr-beat-player-fullscreen");
  if (!hrBeatPlayerColorCycle || !fullscreen || fullscreen.hidden || fullscreen.dataset.theme !== "y2k") {
    stopBeatPlayerColorCycle();
    return;
  }
  const elapsed = hrBeatPlayerColorCycleLastTime
    ? Math.min(80, timestamp - hrBeatPlayerColorCycleLastTime) / 1000
    : 0;
  hrBeatPlayerColorCycleLastTime = timestamp;
  hrBeatPlayerColorCycleHue = (hrBeatPlayerColorCycleHue + elapsed * HR_BEAT_PLAYER_COLOR_CYCLE_SPEED) % 360;
  hrBeatPlayerColorPicker.hue = hrBeatPlayerColorCycleHue;
  const rgb = beatPlayerHsvToRgb(
    hrBeatPlayerColorPicker.hue,
    hrBeatPlayerColorPicker.saturation,
    hrBeatPlayerColorPicker.value,
  );
  setGlobalBeatPlayerColor(beatPlayerRgbToHex(rgb.red, rgb.green, rgb.blue));
  hrBeatPlayerColorCycleFrame = requestAnimationFrame(animateBeatPlayerColorCycle);
}

function setBeatPlayerColorCycle(enabled) {
  hrBeatPlayerColorCycle = Boolean(enabled);
  if (hrBeatPlayerColorCycle) {
    hrBeatPlayerColorCycleHue = Number(hrBeatPlayerColorPicker.hue) || 0;
    if (!hrBeatPlayerColorCycleFrame) {
      hrBeatPlayerColorCycleLastTime = 0;
      hrBeatPlayerColorCycleFrame = requestAnimationFrame(animateBeatPlayerColorCycle);
    }
  } else {
    stopBeatPlayerColorCycle();
  }
  syncBeatPlayerColorCycleControl();
}

function ensureBeatPlayerAudioGraph(audio) {
  if (!audio) return false;
  const AudioContextConstructor = beatPlayerAudioContextConstructor();
  if (!AudioContextConstructor) return false;

  if (!hrBeatAudioContext || hrBeatAnalyserAudio !== audio) {
    try {
      audio.crossOrigin = "anonymous";
      if (navigator.audioSession && "type" in navigator.audioSession) {
        try { navigator.audioSession.type = "playback"; } catch {}
      }
      hrBeatAudioContext = new AudioContextConstructor();
      hrBeatAnalyser = hrBeatAudioContext.createAnalyser();
      hrBeatAnalyser.fftSize = 512;
      hrBeatAnalyser.smoothingTimeConstant = 0.82;
      hrBeatAudioSource = hrBeatAudioContext.createMediaElementSource(audio);
      hrBeatGain = hrBeatAudioContext.createGain();
      hrBeatGain.gain.value = hrBeatPlayerVolume;
      hrBeatAudioSource.connect(hrBeatAnalyser);
      hrBeatAnalyser.connect(hrBeatGain);
      hrBeatGain.connect(hrBeatAudioContext.destination);
      // Safari can ignore HTMLMediaElement.volume after createMediaElementSource().
      // Keep the element at unity and apply the page volume through Web Audio.
      try { audio.volume = 1; } catch {}
      hrBeatAnalyserAudio = audio;
      hrBeatVisualizerFrequencyData = new Uint8Array(hrBeatAnalyser.frequencyBinCount);
    } catch {
      hrBeatAudioContext = null;
      hrBeatAnalyser = null;
      hrBeatAudioSource = null;
      hrBeatGain = null;
      hrBeatAnalyserAudio = null;
      hrBeatVisualizerFrequencyData = null;
      return false;
    }
  }

  if (hrBeatAudioContext.state === "suspended") hrBeatAudioContext.resume().catch(() => {});
  return Boolean(hrBeatAnalyser);
}

function resizeBeatPlayerVisualizerCanvas(canvas) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  canvas.style.setProperty("--hr-canvas-dpr", String(dpr));
  canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeBeatPlayerVisualizers() {
  document.querySelectorAll("#beat-player-fullscreen-visualizer, #beat-player-fullscreen-lcd-visualizer")
    .forEach(resizeBeatPlayerVisualizerCanvas);
}

function beatPlayerSpectrumValue(data, index, count) {
  if (!data?.length || !hrBeatAudioContext || !hrBeatAnalyser) return 0;
  const minFrequency = 30;
  const maxFrequency = Math.min(16000, hrBeatAudioContext.sampleRate / 2);
  const minBin = Math.max(1, Math.floor((minFrequency / hrBeatAudioContext.sampleRate) * hrBeatAnalyser.fftSize));
  const maxBin = Math.min(data.length - 1, Math.ceil((maxFrequency / hrBeatAudioContext.sampleRate) * hrBeatAnalyser.fftSize));
  const start = Math.floor(minBin * Math.pow(maxBin / minBin, index / count));
  const end = Math.max(start + 1, Math.ceil(minBin * Math.pow(maxBin / minBin, (index + 1) / count)));
  let total = 0;
  let samples = 0;
  for (let bin = start; bin <= Math.min(maxBin, end); bin += 1) {
    total += data[bin];
    samples += 1;
  }
  return samples ? total / samples / 255 : 0;
}

function beatPlayerAmbientSpectrumValue(data, index, count) {
  if (!data?.length || !hrBeatAudioContext || !hrBeatAnalyser) return 0;
  const minFrequency = 30;
  const maxFrequency = Math.min(16000, hrBeatAudioContext.sampleRate / 2);
  const minBin = Math.max(1, Math.floor((minFrequency / hrBeatAudioContext.sampleRate) * hrBeatAnalyser.fftSize));
  const maxBin = Math.min(data.length - 1, Math.ceil((maxFrequency / hrBeatAudioContext.sampleRate) * hrBeatAnalyser.fftSize));
  const start = Math.floor(minBin * Math.pow(maxBin / minBin, index / count));
  const end = Math.max(start + 1, Math.ceil(minBin * Math.pow(maxBin / minBin, (index + 1) / count)));
  let peak = 0;
  let average = 0;
  let samples = 0;
  for (let bin = start; bin <= Math.min(maxBin, end); bin += 1) {
    const value = data[bin] / 255;
    peak = Math.max(peak, value);
    average += value;
    samples += 1;
  }
  if (!samples) return 0;
  const bandAverage = average / samples;
  const lowFrequencyWeight = 1.06 - (index / Math.max(1, count - 1)) * 0.18;
  return Math.min(1, Math.pow(peak, 0.72) * 0.92 * lowFrequencyWeight + Math.pow(bandAverage, 0.72) * 0.16);
}

function drawBeatPlayerSpectrum(canvas, data, mode = "top") {
  if (!canvas) return 0;
  resizeBeatPlayerVisualizerCanvas(canvas);
  const context = canvas.getContext("2d");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!context || !width || !height) return 0;

  context.clearRect(0, 0, width, height);

  const count = mode === "lcd"
    ? 32
    : Math.max(78, Math.min(110, Math.round(width / 3.4)));
  const gap = mode === "lcd" ? 2 : 1;
  const barWidth = mode === "lcd"
    ? Math.max(1, (width - (count - 1) * gap) / count)
    : Math.min(2.4, Math.max(1, ((width - (count - 1) * gap) / count) * 0.48));
  const maxHeight = mode === "lcd" ? Math.max(4, height - 5) : Math.max(6, height - 2);
  let energyTotal = 0;
  if (mode !== "lcd" && hrBeatVisualizerDisplayValues.length !== count) {
    hrBeatVisualizerDisplayValues = Array.from({ length: count }, () => 0);
  }
  for (let index = 0; index < count; index += 1) {
    const rawValue = mode === "lcd"
      ? beatPlayerSpectrumValue(data, index, count)
      : beatPlayerAmbientSpectrumValue(data, index, count);
    const value = mode === "lcd"
      ? rawValue
      : Math.max(rawValue, hrBeatVisualizerDisplayValues[index] * 0.92);
    if (mode !== "lcd") hrBeatVisualizerDisplayValues[index] = value;
    energyTotal += value;
    const barHeight = Math.max(0, value * maxHeight);
    const x = index * (barWidth + gap);
    const segmentHeight = mode === "lcd" ? 3 : 4;
    const segmentGap = mode === "lcd" ? 2 : 2;
    if (mode === "lcd") {
      const alpha = 0.16 + value * 0.55;
      const bass = index / count < 0.5;
      context.fillStyle = bass
        ? `hsla(${hrBeatVisualizerPalette.hue}, ${Math.min(100, hrBeatVisualizerPalette.saturation * 1.04)}%, 48%, ${alpha})`
        : `hsla(${hrBeatVisualizerPalette.hue}, ${Math.round(hrBeatVisualizerPalette.saturation * .68)}%, 66%, ${alpha})`;
      for (let y = height - 3; y > height - 3 - barHeight; y -= segmentHeight + segmentGap) {
        context.fillRect(x, Math.max(0, y - segmentHeight), barWidth, segmentHeight);
      }
    } else if (barHeight > 0) {
      const alpha = 0.28 + value * 0.34;
      const bass = index / count < 0.26;
      context.fillStyle = bass
        ? `hsla(${hrBeatVisualizerPalette.hue}, ${Math.round(hrBeatVisualizerPalette.saturation * .82)}%, 54%, ${alpha})`
        : `hsla(${hrBeatVisualizerPalette.hue}, ${Math.round(hrBeatVisualizerPalette.saturation * .64)}%, 62%, ${alpha})`;
      context.fillRect(x, height - barHeight, barWidth, barHeight);
    }
  }
  if (mode !== "lcd") {
    const verticalFade = context.createLinearGradient(0, 0, 0, height);
    const { hue, saturation } = hrBeatVisualizerPalette;
    verticalFade.addColorStop(0, `hsla(${hue}, ${Math.round(saturation * .6)}%, 54%, .01)`);
    verticalFade.addColorStop(0.45, `hsla(${hue}, ${Math.round(saturation * .7)}%, 58%, .18)`);
    verticalFade.addColorStop(0.82, `hsla(${hue}, ${Math.round(saturation * .82)}%, 54%, .7)`);
    verticalFade.addColorStop(1, `hsla(${hue}, ${Math.round(saturation * .82)}%, 54%, 1)`);
    context.globalCompositeOperation = "destination-in";
    context.fillStyle = verticalFade;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
  }
  return energyTotal / count;
}

function drawBeatPlayerVisualizerFrame() {
  const data = hrBeatAnalyser && hrBeatVisualizerFrequencyData
    ? (hrBeatAnalyser.getByteFrequencyData(hrBeatVisualizerFrequencyData), hrBeatVisualizerFrequencyData)
    : null;
  const topCanvas = document.getElementById("beat-player-fullscreen-visualizer");
  const lcdCanvas = document.getElementById("beat-player-fullscreen-lcd-visualizer");
  const topEnergy = drawBeatPlayerSpectrum(topCanvas, data, "top");
  const lcdEnergy = drawBeatPlayerSpectrum(lcdCanvas, data, "lcd");
  const targetEnergy = Math.min(1, topEnergy * 0.7 + lcdEnergy * 0.3);
  hrBeatVisualizerEnergy += (targetEnergy - hrBeatVisualizerEnergy) * 0.18;
  const screen = document.querySelector(".hr-beat-player-fullscreen__screen");
  if (screen) {
    screen.style.setProperty("--hr-audio-energy", hrBeatVisualizerEnergy.toFixed(3));
    screen.style.setProperty("--hr-audio-glow", `${12 + Math.round(hrBeatVisualizerEnergy * 28)}px`);
    screen.style.setProperty("--hr-audio-glow-alpha", `${0.1 + hrBeatVisualizerEnergy * 0.18}`);
  }
}

function startBeatPlayerVisualizer() {
  if (hrBeatVisualizerFrame) return;
  const tick = () => {
    drawBeatPlayerVisualizerFrame();
    const fullscreen = document.getElementById("hr-beat-player-fullscreen");
    if (!fullscreen?.hidden || isBeatPlayerPlaying()) {
      hrBeatVisualizerFrame = window.requestAnimationFrame(tick);
    } else {
      hrBeatVisualizerFrame = 0;
    }
  };
  hrBeatVisualizerFrame = window.requestAnimationFrame(tick);
}

function setupBeatPlayerVisualizers(audio) {
  resizeBeatPlayerVisualizers();
  if (hrBeatVisualizerResizeObserver) hrBeatVisualizerResizeObserver.disconnect();
  if (window.ResizeObserver) {
    hrBeatVisualizerResizeObserver = new ResizeObserver(resizeBeatPlayerVisualizers);
    document.querySelectorAll(".hr-beat-player-fullscreen__visualizer, .hr-beat-player-fullscreen__lcd-visualizer")
      .forEach((element) => hrBeatVisualizerResizeObserver.observe(element));
  }
  window.addEventListener("resize", resizeBeatPlayerVisualizers);
  audio.addEventListener("play", () => {
    ensureBeatPlayerAudioGraph(audio);
    startBeatPlayerVisualizer();
  });
  audio.addEventListener("pause", () => {
    if (!document.getElementById("hr-beat-player-fullscreen")?.hidden) startBeatPlayerVisualizer();
  });
}

function updateBeatPlayerMediaSession(detail = hrCurrentBeatDetail) {
  const mediaSession = navigator.mediaSession;
  if (!mediaSession) return;
  try {
    if (detail?.title && typeof window.MediaMetadata === "function") {
      mediaSession.metadata = new MediaMetadata({
        title: String(detail.title),
        artist: String(detail.detail || "Hidden Room"),
        album: "Hidden Room · Beat Store",
        artwork: detail.cover ? [{ src: String(detail.cover), sizes: "512x512" }] : [],
      });
    }
  } catch {}
}

function updateBeatPlayerMediaSessionPosition() {
  const mediaSession = navigator.mediaSession;
  const audio = document.getElementById("beat-audio");
  if (!mediaSession || !audio || typeof mediaSession.setPositionState !== "function") return;
  const duration = Number(audio.duration);
  const currentTime = Number(audio.currentTime);
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) return;
  try {
    mediaSession.setPositionState({
      duration,
      playbackRate: Number(audio.playbackRate) || 1,
      position: Math.max(0, Math.min(duration, currentTime)),
    });
  } catch {}
}

function syncBeatPlayerMediaSessionState() {
  const mediaSession = navigator.mediaSession;
  if (!mediaSession) return;
  try { mediaSession.playbackState = isBeatPlayerPlaying() ? "playing" : "paused"; } catch {}
  updateBeatPlayerMediaSessionPosition();
}

function setupBeatPlayerMediaSession() {
  const mediaSession = navigator.mediaSession;
  if (!mediaSession || hrBeatPlayerMediaSessionBound) return;
  hrBeatPlayerMediaSessionBound = true;
  const handlers = {
    play: () => setGlobalBeatPlayerPlayback(true),
    pause: () => setGlobalBeatPlayerPlayback(false),
    stop: () => setGlobalBeatPlayerPlayback(false),
    seekbackward: (details) => seekGlobalBeatPlayer(-(Number(details.seekOffset) || 10)),
    seekforward: (details) => seekGlobalBeatPlayer(Number(details.seekOffset) || 10),
    previoustrack: () => seekGlobalBeatPlayer(-10),
    nexttrack: () => dispatchGlobalBeatPlayerNext({
      beatId: hrCurrentBeatDetail?.beatId || "",
      src: getBeatPlayerSrc(),
      shuffle: hrBeatPlayerShuffle,
    }),
  };
  Object.entries(handlers).forEach(([action, handler]) => {
    try { mediaSession.setActionHandler(action, handler); } catch {}
  });
}

function seekGlobalBeatPlayer(offset) {
  const audio = document.getElementById("beat-audio");
  if (!audio || !Number.isFinite(audio.duration)) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + Number(offset || 0)));
}

function globalBeatPlayerRelativeFile(value) {
  let clean = String(value || "").trim();
  if (!clean) return "";
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    try {
      const url = new URL(clean);
      clean = url.searchParams.get("file") || url.pathname;
    } catch {
      return "";
    }
  }
  clean = clean
    .split("?")[0]
    .split("#")[0]
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .replace(/^\/+/g, "");
  if (clean.toLowerCase().startsWith("beats_store/")) clean = clean.slice("beats_store/".length);
  if (!clean || clean.split("/").some((part) => !part || part === "." || part === "..")) return "";
  return clean;
}

function globalBeatPlayerPreviewUrl(product) {
  const clean = globalBeatPlayerRelativeFile(product?.beat_preview_path);
  if (!clean || !clean.toLowerCase().startsWith("previews/") || !/\.mp3$/i.test(clean)) return "";
  if (String(product?.beat_preview_status || "").toLowerCase() === "error") return "";
  return new URL("/api/beat-store/stream?file=" + encodeURIComponent(clean), HR_BEAT_STORE_CLOUD_ORIGIN).href;
}

function globalBeatPlayerCoverUrl(product) {
  const raw = String(product?.beat_cover_path || product?.image_url || "").trim();
  if (!raw) return "";
  if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("/")) return new URL(raw, window.location.origin).href;
  const clean = globalBeatPlayerRelativeFile(raw);
  return clean
    ? new URL("/api/beat-store/stream?file=" + encodeURIComponent(clean), HR_BEAT_STORE_CLOUD_ORIGIN).href
    : "";
}

function globalBeatProducerDisplayName(value) {
  const clean = String(value || "").trim().replace(/^@+/, "");
  if (!clean || clean === "Productor por confirmar") return clean || "Productor por confirmar";
  return "@" + clean;
}

function globalBeatProducerSlug(value) {
  return String(value || "")
    .replace(/^@+/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function globalBeatPlayerDetailFromProduct(product, producerProfiles = []) {
  const beatId = String(product?.id || "").trim();
  const src = globalBeatPlayerPreviewUrl(product);
  if (!beatId || !src || product?.category !== "beats") return null;
  const producerProfile = producerProfiles.find((profile) => profile.id === product?.producer_profile_id)
    || producerProfiles.find((profile) => globalBeatProducerSlug(profile.slug) === globalBeatProducerSlug(product?.producer));
  return {
    source: HR_BEAT_PLAYER_SOURCE,
    src,
    title: String(product?.name || "Beat Store").trim() || "Beat Store",
    detail: globalBeatProducerDisplayName(product?.producer),
    cover: globalBeatPlayerCoverUrl(product),
    beatId,
    slug: String(product?.slug || "").trim(),
    producerSlug: producerProfile?.is_active === false ? "" : producerProfile?.slug || globalBeatProducerSlug(product?.producer),
    genre: String(product?.beat_genre || "").trim(),
    bpm: product?.beat_bpm || "",
    key: String(product?.beat_key || "").trim(),
  };
}

async function loadGlobalBeatPlayerQueue(supabase, producerProfiles = []) {
  if (hrGlobalBeatPlayerQueuePromise) return hrGlobalBeatPlayerQueuePromise;
  hrGlobalBeatPlayerQueuePromise = (async () => {
    const { data, error } = await supabase
      .from("store_products")
      .select("id,slug,name,category,image_url,beat_cover_path,producer,producer_profile_id,beat_preview_path,beat_preview_status,beat_genre,beat_bpm,beat_key,featured,created_at")
      .eq("category", "beats")
      .eq("is_active", true)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return [];
    const profileIds = [...new Set((data || []).map((product) => product.producer_profile_id).filter(Boolean))];
    let profiles = producerProfiles;
    if (profileIds.length) {
      const { data: loadedProfiles } = await supabase
        .from("producer_profiles")
        .select("id,slug,is_active")
        .in("id", profileIds);
      profiles = loadedProfiles || producerProfiles;
    }
    return (data || []).map((product) => globalBeatPlayerDetailFromProduct(product, profiles)).filter(Boolean);
  })().catch(() => []);
  return hrGlobalBeatPlayerQueuePromise;
}

async function loadGlobalBeatPlayerDefault() {
  if (!shouldRenderGlobalBeatPlayer() || !document.getElementById("hr-beat-player")) return;
  if (hrGlobalBeatPlayerDefaultPromise) return hrGlobalBeatPlayerDefaultPromise;
  hrGlobalBeatPlayerDefaultPromise = (async () => {
    try {
      const supabase = await getHiddenRoomSupabaseClient();
      const { data: setting, error: settingError } = await supabase
        .from("beat_store_settings")
        .select("global_player_beat_id")
        .eq("id", HR_BEAT_STORE_SETTINGS_ID)
        .maybeSingle();
      if (settingError) return;
      const beatId = String(setting?.global_player_beat_id || "").trim();
      if (!beatId) return;
      const { data: product, error: productError } = await supabase
        .from("store_products")
        .select("id,slug,name,category,image_url,beat_cover_path,producer,producer_profile_id,beat_preview_path,beat_preview_status,beat_genre,beat_bpm,beat_key")
        .eq("id", beatId)
        .eq("category", "beats")
        .eq("is_active", true)
        .maybeSingle();
      if (productError) return;
      let producerProfiles = [];
      const profileIds = product?.producer_profile_id ? [product.producer_profile_id] : [];
      if (profileIds.length) {
        const { data: profiles } = await supabase
          .from("producer_profiles")
          .select("id,slug,is_active")
          .in("id", profileIds);
        producerProfiles = profiles || [];
      }
      const detail = globalBeatPlayerDetailFromProduct(product, producerProfiles);
      if (!detail) return;
      const queue = await loadGlobalBeatPlayerQueue(supabase, producerProfiles);
      if (hrCurrentBeatDetail?.beatId) {
        if (hrBeatPlayerQueue.length < 2) {
          hrBeatPlayerQueue = sanitizeBeatPlayerQueue(queue, hrCurrentBeatDetail);
          persistGlobalBeatPlayerState();
        }
        return;
      }
      setGlobalBeatPlayer(detail, { autoplay: false, queue });
    } catch {}
  })();
  return hrGlobalBeatPlayerDefaultPromise;
}
async function ensureGlobalBeatPlayerQueue() {
  if (!hrCurrentBeatDetail || hrBeatPlayerQueue.length > 1) return;
  try {
    const supabase = await getHiddenRoomSupabaseClient();
    const queue = await loadGlobalBeatPlayerQueue(supabase);
    if (!queue.length) return;
    hrBeatPlayerQueue = sanitizeBeatPlayerQueue(queue, hrCurrentBeatDetail);
    persistGlobalBeatPlayerState();
  } catch {}
}
function renderGlobalBeatPlayer() {
  if (!shouldRenderGlobalBeatPlayer()) return "";
  document.body.classList.add("hr-has-beat-player");
  return `
    <aside class="hr-beat-player is-empty" id="hr-beat-player" aria-label="Reproductor Beat Store" data-state="idle">
      <button class="hr-beat-player__art" id="beat-player-art" type="button" data-beat-player-toggle aria-label="Reproducir preview" title="Reproducir preview" data-tooltip="Reproducir preview" aria-pressed="false"><span>HR</span><span class="hr-beat-player__art-icon" aria-hidden="true">${beatPlayerIcon("play")}</span></button>
      <div class="hr-beat-player__meta">
        <strong><a id="player-title" href="#" data-hr-spa="off" aria-disabled="true">Selecciona un beat</a></strong>
        <span id="player-detail"><a href="#" data-hr-spa="off" aria-disabled="true" tabindex="-1">Productor por confirmar</a></span>
      </div>
      <button class="hr-beat-player__more" type="button" data-beat-player-more aria-label="Opciones del reproductor" title="Opciones del reproductor" data-tooltip="Opciones del reproductor" aria-expanded="false" aria-controls="beat-player-menu">${beatPlayerIcon("more")}</button>
      <button class="hr-beat-player__fullscreen" type="button" data-beat-player-fullscreen aria-label="Abrir reproductor en pantalla completa" title="Abrir reproductor en pantalla completa" data-tooltip="Abrir pantalla completa" aria-controls="hr-beat-player-fullscreen" disabled>${beatPlayerIcon("fullscreen")}</button>
      <div class="hr-beat-player__menu" id="beat-player-menu" hidden>
        <a href="/store/beat_store/">Ir a Beat Store</a>
        <button type="button" data-beat-player-share hidden>Compartir beat</button>
        <a href="#" data-beat-player-edit hidden>Editar beat</a>
      </div>
      <div class="hr-beat-player__controls">
        <div class="hr-beat-player__wave-wrap">
          <div class="hr-beat-player__wave" id="beat-player-waveform" role="slider" aria-label="Progreso del preview" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="0:00 de 0:00" tabindex="0">${globalWaveformFallbackMarkup()}</div>
          <input class="hr-beat-player__seek hr-beat-player__seek--fallback" id="beat-player-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Progreso del preview" disabled hidden>
        </div>
        <span class="hr-beat-player__time" id="beat-player-time">0:00 / 0:00</span>
        <button class="hr-beat-player__mute" type="button" data-beat-player-mute aria-label="Silenciar preview" title="Silenciar preview" data-tooltip="Silenciar preview" aria-pressed="false">${beatPlayerIcon("volume")}</button>
        <input class="hr-beat-player__volume" id="beat-player-volume" type="range" min="0" max="1" value="1" step="0.01" aria-label="Volumen del preview" title="Ajustar volumen del preview">
      </div>
      <audio id="beat-audio" preload="metadata" crossorigin="anonymous"></audio>
    </aside>
    <section class="hr-beat-player-fullscreen" id="hr-beat-player-fullscreen" hidden aria-hidden="true">
      <button class="hr-beat-player-fullscreen__backdrop" type="button" data-beat-player-fullscreen-close aria-label="Cerrar reproductor en pantalla completa"></button>
      <div class="hr-beat-player-fullscreen__dialog" role="dialog" aria-modal="true" aria-labelledby="beat-player-fullscreen-title" tabindex="-1">
        <header class="hr-beat-player-fullscreen__header">
          <div class="hr-beat-player-fullscreen__brand">
            <span>Hidden Room</span>
            <strong>Beat Store</strong>
          </div>
          <span class="hr-beat-player-fullscreen__serial" id="beat-player-fullscreen-genre" aria-hidden="true">GÉNERO</span>
          <button class="hr-beat-player-fullscreen__close" type="button" data-beat-player-fullscreen-close aria-label="Cerrar reproductor en pantalla completa" title="Cerrar reproductor" data-tooltip="Cerrar reproductor">${beatPlayerIcon("close")}</button>
          <div class="hr-beat-player-fullscreen__appearance" aria-label="Apariencia del reproductor">
            <label>
              <span>TEMA</span>
              <select id="beat-player-fullscreen-theme" aria-label="Tema del reproductor">
                <option value="y2k">Y2K</option>
              </select>
            </label>
            <div class="hr-beat-player-color-picker" data-beat-player-color-picker>
              <span class="hr-beat-player-color-picker__label">COLOR</span>
              <button class="hr-beat-player-color-picker__toggle" type="button" data-color-picker-toggle aria-expanded="false" aria-controls="beat-player-color-picker-panel"><span data-color-picker-swatch aria-hidden="true"></span><span data-color-picker-value>#7cd0e9</span></button>
              <div class="hr-beat-player-color-picker__panel" id="beat-player-color-picker-panel" data-color-picker-panel hidden>
                <div class="hr-beat-player-color-picker__saturation" data-color-picker-saturation role="slider" aria-label="Saturación y luminosidad" tabindex="0"><span data-color-picker-marker></span></div>
                <input class="hr-beat-player-color-picker__hue" data-color-picker-hue type="range" min="0" max="359" value="195" step="1" aria-label="Matiz del color">
                <label class="hr-beat-player-color-picker__cycle"><span>CICLO DE COLOR</span><input type="checkbox" data-color-picker-cycle aria-label="Cambiar el color progresivamente"><small data-color-picker-cycle-status>OFF</small></label>
                <div class="hr-beat-player-color-picker__channels">
                  <label><span>R</span><input data-color-picker-channel="r" type="number" min="0" max="255" inputmode="numeric" aria-label="Rojo"></label>
                  <label><span>G</span><input data-color-picker-channel="g" type="number" min="0" max="255" inputmode="numeric" aria-label="Verde"></label>
                  <label><span>B</span><input data-color-picker-channel="b" type="number" min="0" max="255" inputmode="numeric" aria-label="Azul"></label>
                </div>
                <label class="hr-beat-player-color-picker__hex"><span>HEX</span><input data-color-picker-hex type="text" value="#7cd0e9" maxlength="7" spellcheck="false" aria-label="Código hexadecimal"></label>
              </div>
            </div>
          </div>
        </header>
        <div class="hr-beat-player-fullscreen__content">
          <div class="hr-beat-player-fullscreen__visualizer" aria-hidden="true">
            <canvas id="beat-player-fullscreen-visualizer"></canvas>
          </div>
          <div class="hr-beat-player-fullscreen__screen">
            <div class="hr-beat-player-fullscreen__screen-top"><span>LCD / STEREO</span><span>PREVIEW</span></div>
            <div class="hr-beat-player-fullscreen__screen-main">
              <button class="hr-beat-player-fullscreen__art hr-beat-player__art" id="beat-player-fullscreen-art" type="button" data-beat-player-fullscreen-toggle aria-label="Reproducir preview" title="Reproducir preview" data-tooltip="Reproducir preview" aria-pressed="false" disabled><span>HR</span><span class="hr-beat-player__art-icon" aria-hidden="true">${beatPlayerIcon("play")}</span></button>
              <div class="hr-beat-player-fullscreen__meta">
                <span class="hr-beat-player-fullscreen__label">REPRODUCTOR</span>
                <h2 id="beat-player-fullscreen-title"><a href="#" data-hr-spa="off" aria-disabled="true">Selecciona un beat</a></h2>
                <p id="beat-player-fullscreen-producer"><a href="#" aria-disabled="true">Productor por confirmar</a></p>
                <div class="hr-beat-player-fullscreen__stats"><span id="beat-player-fullscreen-bpm">-- BPM</span><span id="beat-player-fullscreen-key">KEY --</span></div>
              </div>
            </div>
            <div class="hr-beat-player-fullscreen__wave-slot" id="beat-player-fullscreen-wave-slot"></div>
            <div class="hr-beat-player-fullscreen__lcd-visualizer" aria-hidden="true">
              <canvas id="beat-player-fullscreen-lcd-visualizer"></canvas>
            </div>
            <div class="hr-beat-player-fullscreen__footer">
              <span id="beat-player-fullscreen-time">0:00 / 0:00</span>
              <span>Preview</span>
            </div>
          </div>
          <div class="hr-beat-player-fullscreen__transport" aria-label="Control central de reproducción">
            <button class="hr-beat-player-fullscreen__nav" type="button" data-beat-player-restart aria-label="Volver al inicio o reproducir el beat anterior" title="Primer toque: volver al inicio · segundo toque: beat anterior" data-tooltip="Inicio / beat anterior" disabled>${beatPlayerIcon("prev")}</button>
            <button class="hr-beat-player-fullscreen__play" type="button" data-beat-player-fullscreen-toggle aria-label="Reproducir preview" title="Reproducir preview" data-tooltip="Reproducir preview" aria-pressed="false" disabled><span class="hr-beat-player__art-icon" aria-hidden="true">${beatPlayerIcon("play")}</span></button>
            <button class="hr-beat-player-fullscreen__nav" type="button" data-beat-player-next aria-label="Reproducir el siguiente beat" title="Siguiente beat" data-tooltip="Siguiente beat" disabled>${beatPlayerIcon("next")}</button>
          </div>
          <div class="hr-beat-player-fullscreen__hardware-row">
            <button type="button" data-beat-player-shuffle aria-label="Activar reproducción aleatoria" title="Activar reproducción aleatoria" data-tooltip="Reproducción aleatoria" aria-pressed="false">${beatPlayerIcon("shuffle")}</button>
            <button type="button" data-beat-player-repeat aria-label="Activar repetición" title="Activar repetición" data-tooltip="Repetir beat" aria-pressed="false">${beatPlayerIcon("repeat")}</button>
            <button class="hr-beat-player__mute" type="button" data-beat-player-mute aria-label="Silenciar preview" title="Silenciar preview" data-tooltip="Silenciar preview" aria-pressed="false">${beatPlayerIcon("volume")}</button>
            <input class="hr-beat-player__volume" id="beat-player-fullscreen-volume" type="range" min="0" max="1" value="1" step="0.01" aria-label="Volumen del preview" title="Ajustar volumen del preview">
          </div>
          <button class="hr-beat-player-fullscreen__buy hr-beat-player__buy" type="button" data-beat-player-buy disabled>COMPRAR BEAT</button>
          <button class="hr-beat-player-fullscreen__share" type="button" data-beat-player-share disabled aria-label="Compartir beat" title="Compartir beat">Compartir beat</button>
        </div>
      </div>
    </section>
  `;
}

function hydrateGlobalBeatPlayer() {
  const player = document.getElementById("hr-beat-player");
  const fallbackAudio = document.getElementById("beat-audio");
  if (!player || !fallbackAudio) return;

  const toggles = player.querySelectorAll("[data-beat-player-toggle]");
  const seek = document.getElementById("beat-player-seek");
  const time = document.getElementById("beat-player-time");
  const mutes = document.querySelectorAll("[data-beat-player-mute]");
  const volumes = document.querySelectorAll("#beat-player-volume, #beat-player-fullscreen-volume");
  const waveform = document.getElementById("beat-player-waveform");
  const more = player.querySelector("[data-beat-player-more]");
  const menu = document.getElementById("beat-player-menu");
  const fullscreen = document.getElementById("hr-beat-player-fullscreen");
  const fullscreenDialog = fullscreen?.querySelector(".hr-beat-player-fullscreen__dialog");
  const fullscreenWaveSlot = document.getElementById("beat-player-fullscreen-wave-slot");
  const fullscreenWaveWrap = player.querySelector(".hr-beat-player__wave-wrap");
  const fullscreenToggles = fullscreen?.querySelectorAll("[data-beat-player-fullscreen-toggle]") || [];
  const fullscreenClose = fullscreen?.querySelectorAll("[data-beat-player-fullscreen-close]") || [];
  const fullscreenRestart = fullscreen?.querySelector("[data-beat-player-restart]");
  const fullscreenNext = fullscreen?.querySelector("[data-beat-player-next]");
  const fullscreenShuffle = fullscreen?.querySelector("[data-beat-player-shuffle]");
  const fullscreenRepeat = fullscreen?.querySelector("[data-beat-player-repeat]");
  const fullscreenTheme = document.getElementById("beat-player-fullscreen-theme");
  const colorPicker = document.querySelector("[data-beat-player-color-picker]");
  const colorPickerToggle = colorPicker?.querySelector("[data-color-picker-toggle]");
  const colorPickerPanel = colorPicker?.querySelector("[data-color-picker-panel]");
  const colorPickerSaturation = colorPicker?.querySelector("[data-color-picker-saturation]");
  const colorPickerHue = colorPicker?.querySelector("[data-color-picker-hue]");
  const colorPickerCycle = colorPicker?.querySelector("[data-color-picker-cycle]");
  const colorPickerHex = colorPicker?.querySelector("[data-color-picker-hex]");
  const colorPickerChannels = colorPicker?.querySelectorAll("[data-color-picker-channel]") || [];
  const colorPickerValue = colorPicker?.querySelector("[data-color-picker-value]");
  const playerShares = document.querySelectorAll("[data-beat-player-share]");
  const buyButtons = document.querySelectorAll("[data-beat-player-buy]");

  fallbackAudio.removeAttribute("controls");
  fallbackAudio.crossOrigin = "anonymous";
  fallbackAudio.setAttribute("playsinline", "");
  fallbackAudio.setAttribute("webkit-playsinline", "");
  fallbackAudio.setAttribute("controlsList", "nodownload noplaybackrate");
  fallbackAudio.addEventListener("contextmenu", (event) => event.preventDefault());

  const sync = () => syncGlobalBeatPlayerControls(toggles, seek, time, mutes, volumes, waveform);
  setupBeatPlayerVisualizers(fallbackAudio);
  setupBeatPlayerMediaSession();
  more?.addEventListener("click", (event) => {
    event.preventDefault();
    const open = Boolean(menu?.hidden);
    if (menu) menu.hidden = !open;
    more.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (event) => {
    if (!menu || menu.hidden) return;
    if (event.target.closest("[data-beat-player-more], #beat-player-menu")) return;
    menu.hidden = true;
    more?.setAttribute("aria-expanded", "false");
  });
  toggles.forEach((toggle) => toggle.addEventListener("click", () => {
    if (!getBeatPlayerSrc()) {
      window.location.assign("/store/beat_store/");
      return;
    }
    toggleGlobalBeatPlayerPlayback();
  }));
  buyButtons.forEach((button) => button.addEventListener("click", () => {
    const event = new CustomEvent("hr:beat-player-buy", {
      cancelable: true,
      detail: { beatId: button.dataset.beatId || "", trigger: button },
    });
    if (window.dispatchEvent(event)) window.location.assign("/store/beat_store/");
  }));
  player.addEventListener("click", (event) => {
    if (getBeatPlayerSrc()) return;
    event.preventDefault();
    event.stopPropagation();
    window.location.assign("/store/beat_store/");
  }, true);
  const openFullscreen = () => {
    if (!fullscreen || !getBeatPlayerSrc()) return;
    hrBeatPlayerFullscreenLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (fullscreenWaveWrap && fullscreenWaveSlot) {
      if (!hrBeatPlayerFullscreenPlaceholder && fullscreenWaveWrap.parentElement) {
        hrBeatPlayerFullscreenPlaceholder = document.createComment("hr-beat-player-wave-placeholder");
        fullscreenWaveWrap.parentElement.insertBefore(hrBeatPlayerFullscreenPlaceholder, fullscreenWaveWrap);
      }
      if (fullscreenWaveWrap.parentElement !== fullscreenWaveSlot) fullscreenWaveSlot.appendChild(fullscreenWaveWrap);
    }
    fullscreen.hidden = false;
    fullscreen.setAttribute("aria-hidden", "false");
    document.body.classList.add("hr-beat-player-fullscreen-open");
    if (hrBeatPlayerColorCycle) setBeatPlayerColorCycle(true);
    fullscreenDialog?.focus();
    resizeBeatPlayerVisualizers();
    startBeatPlayerVisualizer();
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };
  const closeFullscreen = () => {
    if (!fullscreen) return;
    if (fullscreenWaveWrap && hrBeatPlayerFullscreenPlaceholder?.parentNode) {
      hrBeatPlayerFullscreenPlaceholder.parentNode.insertBefore(fullscreenWaveWrap, hrBeatPlayerFullscreenPlaceholder);
    }
    fullscreen.hidden = true;
    fullscreen.setAttribute("aria-hidden", "true");
    document.body.classList.remove("hr-beat-player-fullscreen-open");
    stopBeatPlayerColorCycle();
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    hrBeatPlayerFullscreenLastFocus?.focus?.();
    hrBeatPlayerFullscreenLastFocus = null;
  };
  player.querySelector("[data-beat-player-fullscreen]")?.addEventListener("click", openFullscreen);
  fullscreenToggles.forEach((fullscreenToggle) => fullscreenToggle.addEventListener("click", () => {
    if (!fallbackAudio.src) return;
    toggleGlobalBeatPlayerPlayback();
  }));
  fullscreenClose.forEach((control) => control.addEventListener("click", closeFullscreen));
  fullscreenTheme?.addEventListener("change", () => {
    if (fullscreen) fullscreen.dataset.theme = fullscreenTheme.value || "y2k";
  });
  const applyColorPickerHsv = () => {
    const rgb = beatPlayerHsvToRgb(hrBeatPlayerColorPicker.hue, hrBeatPlayerColorPicker.saturation, hrBeatPlayerColorPicker.value);
    setGlobalBeatPlayerColor(beatPlayerRgbToHex(rgb.red, rgb.green, rgb.blue));
  };
  const updateColorPickerFromPointer = (event) => {
    if (!colorPickerSaturation) return;
    const rect = colorPickerSaturation.getBoundingClientRect();
    hrBeatPlayerColorPicker.saturation = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    hrBeatPlayerColorPicker.value = Math.max(0, Math.min(100, (1 - ((event.clientY - rect.top) / rect.height)) * 100));
    applyColorPickerHsv();
  };
  let colorPickerDragging = false;
  colorPickerToggle?.addEventListener("click", () => {
    const open = Boolean(colorPickerPanel?.hidden);
    if (colorPickerPanel) colorPickerPanel.hidden = !open;
    colorPickerToggle.setAttribute("aria-expanded", String(open));
    if (open) updateBeatPlayerColorPicker();
  });
  colorPickerSaturation?.addEventListener("pointerdown", (event) => {
    colorPickerDragging = true;
    colorPickerSaturation.setPointerCapture?.(event.pointerId);
    updateColorPickerFromPointer(event);
  });
  colorPickerSaturation?.addEventListener("pointermove", (event) => {
    if (colorPickerDragging) updateColorPickerFromPointer(event);
  });
  colorPickerSaturation?.addEventListener("pointerup", () => { colorPickerDragging = false; });
  colorPickerSaturation?.addEventListener("pointercancel", () => { colorPickerDragging = false; });
  colorPickerHue?.addEventListener("input", () => {
    hrBeatPlayerColorPicker.hue = Number(colorPickerHue.value) || 0;
    hrBeatPlayerColorCycleHue = hrBeatPlayerColorPicker.hue;
    applyColorPickerHsv();
  });
  colorPickerCycle?.addEventListener("change", () => {
    setBeatPlayerColorCycle(colorPickerCycle.checked);
  });
  colorPickerChannels.forEach((input) => input.addEventListener("input", () => {
    const rgb = {};
    colorPickerChannels.forEach((channel) => { rgb[channel.dataset.colorPickerChannel] = Number(channel.value) || 0; });
    const hsv = beatPlayerRgbToHsv(rgb.r, rgb.g, rgb.b);
    hrBeatPlayerColorPicker = hsv;
    hrBeatPlayerColorCycleHue = hsv.hue;
    setGlobalBeatPlayerColor(beatPlayerRgbToHex(rgb.r, rgb.g, rgb.b));
  }));
  colorPickerHex?.addEventListener("input", () => {
    const value = colorPickerHex.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      const rgb = beatPlayerHexToRgb(value);
      hrBeatPlayerColorCycleHue = beatPlayerRgbToHsv(rgb.red, rgb.green, rgb.blue).hue;
      setGlobalBeatPlayerColor(value);
    }
  });
  document.addEventListener("click", (event) => {
    if (!colorPickerPanel || colorPickerPanel.hidden || event.target.closest("[data-beat-player-color-picker]")) return;
    colorPickerPanel.hidden = true;
    colorPickerToggle?.setAttribute("aria-expanded", "false");
  });
  if (fullscreen) fullscreen.dataset.theme = fullscreenTheme?.value || "y2k";
  setGlobalBeatPlayerColor(hrBeatPlayerColorValue);
  syncBeatPlayerColorCycleControl();
  fullscreenShuffle?.addEventListener("click", () => {
    hrBeatPlayerShuffle = !hrBeatPlayerShuffle;
    sync();
    emitGlobalBeatPlayerState();
  });
  fullscreenRepeat?.addEventListener("click", () => {
    hrBeatPlayerRepeat = !hrBeatPlayerRepeat;
    sync();
    emitGlobalBeatPlayerState();
  });
  fullscreenRestart?.addEventListener("click", () => {
    if (!fallbackAudio.src) return;
    const now = performance.now();
    const repeatTap = now - hrBeatPlayerRestartTapAt < 2000;
    hrBeatPlayerRestartTapAt = now;
    if (repeatTap) {
      hrBeatPlayerRestartTapAt = 0;
      dispatchGlobalBeatPlayerPrevious({
        beatId: hrCurrentBeatDetail?.beatId || player.dataset.beatId || "",
        src: getBeatPlayerSrc(),
        shuffle: hrBeatPlayerShuffle,
      });
      return;
    }
    if (hrWaveSurfer && hrWaveSurferReady) hrWaveSurfer.seekTo(0);
    else fallbackAudio.currentTime = 0;
    if (hrCurrentBeatDetail) hrCurrentBeatDetail.currentTime = 0;
    sync();
    persistGlobalBeatPlayerState();
    emitGlobalBeatPlayerState();
    window.setTimeout(() => {
      if (performance.now() - hrBeatPlayerRestartTapAt >= 2000) hrBeatPlayerRestartTapAt = 0;
    }, 2000);
  });
  fullscreenNext?.addEventListener("click", () => {
    if (!fallbackAudio.src) return;
    dispatchGlobalBeatPlayerNext({
      beatId: hrCurrentBeatDetail?.beatId || player.dataset.beatId || "",
      src: getBeatPlayerSrc(),
      shuffle: hrBeatPlayerShuffle,
    });
  });
  playerShares.forEach((playerShare) => playerShare.addEventListener("click", async () => {
    const slug = String(hrCurrentBeatDetail?.slug || "").trim();
    if (!slug) return;
    const url = new URL("/store/product.html?slug=" + encodeURIComponent(slug), window.location.origin).href;
    const title = String(hrCurrentBeatDetail?.title || "Beat Store");
    const shareData = { title: title + " | Hidden Room", text: "Escucha " + title + " en Hidden Room.", url };
    try {
      if (typeof navigator.share === "function") await navigator.share(shareData);
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else throw new Error("clipboard unavailable");
      playerShare.textContent = "Enlace copiado";
      window.setTimeout(() => { if (playerShare) playerShare.textContent = "Compartir beat"; }, 1600);
    } catch (error) {
      if (error?.name !== "AbortError") playerShare.textContent = "No se pudo compartir";
      window.setTimeout(() => { if (playerShare) playerShare.textContent = "Compartir beat"; }, 1600);
    }
  }));
  document.addEventListener("keydown", (event) => {
    if (!fullscreen || fullscreen.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeFullscreen();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...fullscreen.querySelectorAll("button:not([disabled])")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  seek?.addEventListener("input", () => {
    if (!Number.isFinite(fallbackAudio.duration) || fallbackAudio.duration <= 0) return;
    fallbackAudio.currentTime = (Number(seek.value) / 1000) * fallbackAudio.duration;
    sync();
  });
  waveform?.addEventListener("keydown", (event) => {
    if (!hrWaveSurfer || !hrWaveSurferReady) return;
    const duration = hrWaveSurfer.getDuration() || 0;
    if (!duration) return;
    const step = event.key === "ArrowLeft" ? -5 : event.key === "ArrowRight" ? 5 : 0;
    if (!step) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(duration, hrWaveSurfer.getCurrentTime() + step));
    hrWaveSurfer.seekTo(next / duration);
  });
  mutes.forEach((mute) => mute.addEventListener("click", () => {
    const muted = !getBeatPlayerMuted();
    if (muted) hrBeatPlayerVolumeBeforeMute = Math.max(.01, getBeatPlayerVolume());
    else if (getBeatPlayerVolume() <= 0) setBeatPlayerVolume(hrBeatPlayerVolumeBeforeMute || 1);
    setBeatPlayerMuted(muted);
    sync();
    emitGlobalBeatPlayerState();
  }));
  const handleVolumeChange = (volume) => {
    const next = Math.max(0, Math.min(1, Number(volume.value) || 0));
    if (next > 0) hrBeatPlayerVolumeBeforeMute = next;
    setBeatPlayerVolume(next);
    setBeatPlayerMuted(next === 0);
    sync();
    emitGlobalBeatPlayerState();
  };
  volumes.forEach((volume) => {
    volume.addEventListener("input", () => handleVolumeChange(volume));
    volume.addEventListener("change", () => handleVolumeChange(volume));
  });

  try {
    sessionStorage.removeItem("hr_global_beat_player");
    const saved = JSON.parse(sessionStorage.getItem(HR_BEAT_PLAYER_STORAGE_KEY) || "null");
    if (isBeatStorePlayerDetail(saved)) setGlobalBeatPlayer(sanitizeBeatPlayerDetail(saved), { autoplay: false, restoreTime: true, queue: saved.queue });
    else sessionStorage.removeItem(HR_BEAT_PLAYER_STORAGE_KEY);
  } catch {
    sessionStorage.removeItem(HR_BEAT_PLAYER_STORAGE_KEY);
  }

  ["loadedmetadata", "durationchange", "timeupdate", "pause", "play", "waiting", "canplay", "ended", "volumechange"].forEach((eventName) => {
    fallbackAudio.addEventListener(eventName, () => {
      syncBeatPlayerMediaSessionState();
      if (hrWaveSurfer) return;
      if (eventName === "waiting") player.dataset.state = "loading";
      if (eventName === "canplay") player.dataset.state = fallbackAudio.paused ? "paused" : "playing";
      if (eventName === "ended") {
        if (hrBeatPlayerRepeat) {
          fallbackAudio.currentTime = 0;
          fallbackAudio.play().catch(() => {});
        } else {
          fallbackAudio.currentTime = 0;
          player.dataset.state = "ended";
          dispatchGlobalBeatPlayerNext({
            beatId: hrCurrentBeatDetail?.beatId || player.dataset.beatId || "",
            src: getBeatPlayerSrc(),
            shuffle: hrBeatPlayerShuffle,
          });
        }
      }
      sync();
      persistGlobalBeatPlayerState();
      emitGlobalBeatPlayerState();
    });
  });

  const resize = () => document.documentElement.style.setProperty("--hr-beat-player-offset", `${Math.ceil(player.getBoundingClientRect().height + 32)}px`);
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(player);
  window.addEventListener("resize", resize);
  sync();
  syncBeatPlayerMediaSessionState();
  emitGlobalBeatPlayerState();
}
function setBeatPlayerControlHint(control, label) {
  if (!control || !label) return;
  control.setAttribute("aria-label", label);
  control.setAttribute("title", label);
  control.dataset.tooltip = label;
}

function syncGlobalBeatPlayerControls(toggle, seek, time, mute, volume, waveform) {
  const fallbackAudio = document.getElementById("beat-audio");
  const player = document.getElementById("hr-beat-player");
  const duration = getBeatPlayerDuration();
  const current = getBeatPlayerCurrentTime();
  const isPlaying = isBeatPlayerPlaying();

  if (player && player.dataset.state !== "loading" && player.dataset.state !== "ended") {
    player.dataset.state = getBeatPlayerSrc() ? (isPlaying ? "playing" : "paused") : "idle";
  }
  const toggleControls = toggle ? (typeof toggle.length === "number" ? [...toggle] : [toggle]) : [];
  toggleControls.forEach((control) => {
    const icon = control.querySelector(".hr-beat-player__art-icon");
    if (icon) icon.innerHTML = beatPlayerIcon(isPlaying ? "pause" : "play");
    setBeatPlayerControlHint(control, isPlaying ? "Pausar preview" : "Reproducir preview");
    control.setAttribute("aria-pressed", String(isPlaying));
  });
  const fullscreenToggles = document.querySelectorAll("[data-beat-player-fullscreen-toggle]");
  const fullscreenOpen = document.querySelector("[data-beat-player-fullscreen]");
  const navigationControls = document.querySelectorAll("[data-beat-player-restart], [data-beat-player-next]");
  const modeControls = document.querySelectorAll("[data-beat-player-shuffle], [data-beat-player-repeat]");
  if (fullscreenOpen) fullscreenOpen.disabled = !getBeatPlayerSrc();
  navigationControls.forEach((control) => { control.disabled = !getBeatPlayerSrc(); });
  modeControls.forEach((control) => {
    const isShuffle = control.hasAttribute("data-beat-player-shuffle");
    const active = isShuffle ? hrBeatPlayerShuffle : hrBeatPlayerRepeat;
    control.disabled = !getBeatPlayerSrc();
    control.classList.toggle("is-active", active);
    control.setAttribute("aria-pressed", String(active));
    setBeatPlayerControlHint(control, `${active ? "Desactivar" : "Activar"} ${isShuffle ? "reproducción aleatoria" : "repetición"}`);
  });
  fullscreenToggles.forEach((fullscreenToggle) => {
    const icon = fullscreenToggle.querySelector(".hr-beat-player__art-icon");
    if (icon) icon.innerHTML = beatPlayerIcon(isPlaying ? "pause" : "play");
    fullscreenToggle.disabled = !getBeatPlayerSrc();
    setBeatPlayerControlHint(fullscreenToggle, isPlaying ? "Pausar preview" : "Reproducir preview");
    fullscreenToggle.setAttribute("aria-pressed", String(isPlaying));
  });
  if (seek) {
    seek.value = duration > 0 ? String(Math.round((current / duration) * 1000)) : "0";
    seek.disabled = duration <= 0;
    seek.style.setProperty("--hr-progress", `${duration > 0 ? (current / duration) * 100 : 0}%`);
  }
  if (waveform) {
    waveform.setAttribute("aria-valuemax", String(Math.round(duration)));
    waveform.setAttribute("aria-valuenow", String(Math.round(current)));
    waveform.setAttribute("aria-valuetext", `${formatGlobalBeatTime(current)} de ${formatGlobalBeatTime(duration)}`);
    waveform.style.setProperty("--hr-wave-progress", `${duration > 0 ? (current / duration) * 100 : 0}%`);
  }
  if (time) time.textContent = `${formatGlobalBeatTime(current)} / ${formatGlobalBeatTime(duration)}`;
  const fullscreenTime = document.getElementById("beat-player-fullscreen-time");
  if (fullscreenTime) fullscreenTime.textContent = `${formatGlobalBeatTime(current)} / ${formatGlobalBeatTime(duration)}`;
  const muteControls = mute ? (typeof mute.length === "number" ? [...mute] : [mute]) : [];
  muteControls.forEach((control) => {
    const muted = getBeatPlayerMuted();
    control.innerHTML = beatPlayerIcon(muted ? "muted" : "volume");
    control.setAttribute("aria-pressed", String(muted));
    setBeatPlayerControlHint(control, muted ? "Activar sonido del preview" : "Silenciar preview");
  });
  const volumeControls = volume ? (typeof volume.length === "number" ? [...volume] : [volume]) : [];
  const currentVolume = Math.max(0, Math.min(1, Number(getBeatPlayerVolume()) || 0));
  volumeControls.forEach((control) => {
    if (document.activeElement !== control) control.value = String(currentVolume);
    const displayedVolume = document.activeElement === control
      ? Math.max(0, Math.min(1, Number(control.value) || 0))
      : currentVolume;
    control.style.setProperty("--hr-volume-progress", `${displayedVolume * 100}%`);
    control.setAttribute("aria-valuenow", displayedVolume.toFixed(2));
    control.setAttribute("aria-valuetext", `${Math.round(displayedVolume * 100)}%`);
  });
  const colorValue = document.querySelector("[data-color-picker-value]");
  if (colorValue) colorValue.textContent = hrBeatPlayerColorValue;
}
function formatGlobalBeatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function emitGlobalBeatPlayerState() {
  window.HiddenRoomBeatPlayer = {
    source: HR_BEAT_PLAYER_SOURCE,
    src: getBeatPlayerSrc(),
    isPlaying: isBeatPlayerPlaying(),
    beatId: hrCurrentBeatDetail?.beatId || document.getElementById("hr-beat-player")?.dataset.beatId || "",
    slug: hrCurrentBeatDetail?.slug || "",
    producerSlug: hrCurrentBeatDetail?.producerSlug || "",
    title: hrCurrentBeatDetail?.title || "",
    shuffle: hrBeatPlayerShuffle,
    repeat: hrBeatPlayerRepeat,
    volume: getBeatPlayerVolume(),
    muted: getBeatPlayerMuted(),
  };
  window.dispatchEvent(new CustomEvent("hr:beat-player-state", { detail: window.HiddenRoomBeatPlayer }));
}

function dispatchGlobalBeatPlayerNext(detail = {}) {
  window.dispatchEvent(new CustomEvent("hr:beat-player-next", {
    cancelable: true,
    detail,
  }));
}
function dispatchGlobalBeatPlayerPrevious(detail = {}) {
  window.dispatchEvent(new CustomEvent("hr:beat-player-previous", {
    cancelable: true,
    detail,
  }));
}

function isBeatStorePlayerDetail(detail) {
  return String(detail?.source || "").trim().toLowerCase() === HR_BEAT_PLAYER_SOURCE
    && Boolean(String(detail?.src || "").trim())
    && Boolean(String(detail?.beatId ?? "").trim());
}

function sanitizeBeatPlayerDetail(detail) {
  const clean = { ...(detail || {}) };
  if (/compra para descargar|compra el beat para descargarlo/i.test(String(clean.detail || ""))) clean.detail = "";
  if (String(clean.detail || "").trim()) clean.detail = globalBeatProducerDisplayName(clean.detail);
  return clean;
}

function sanitizeBeatPlayerQueue(queue, fallbackDetail) {
  const candidates = Array.isArray(queue) ? queue : [];
  const entries = [...candidates, fallbackDetail].filter(isBeatStorePlayerDetail);
  const seen = new Set();
  return entries.map((entry) => sanitizeBeatPlayerDetail(entry)).filter((entry) => {
    const key = String(entry.beatId || entry.src || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function nextGlobalBeatPlayerDetail({ beatId = "", src = "", shuffle = false } = {}) {
  const sequence = hrBeatPlayerQueue.length ? hrBeatPlayerQueue : (hrCurrentBeatDetail ? [hrCurrentBeatDetail] : []);
  if (!sequence.length) return null;
  const currentIndex = sequence.findIndex((entry) => String(entry.beatId || "") === String(beatId) || entry.src === src);
  if (shuffle && sequence.length > 1) {
    const choices = sequence.filter((entry) => entry !== sequence[currentIndex]);
    return choices[Math.floor(Math.random() * choices.length)] || null;
  }
  return sequence[(currentIndex + 1 + sequence.length) % sequence.length] || sequence[0];
}
function previousGlobalBeatPlayerDetail({ beatId = "", src = "" } = {}) {
  const sequence = hrBeatPlayerQueue.length ? hrBeatPlayerQueue : (hrCurrentBeatDetail ? [hrCurrentBeatDetail] : []);
  if (!sequence.length) return null;
  const currentIndex = sequence.findIndex((entry) => String(entry.beatId || "") === String(beatId) || entry.src === src);
  return sequence[(currentIndex - 1 + sequence.length) % sequence.length] || sequence[sequence.length - 1];
}

function setGlobalBeatPlayer(detail, options = {}) {
  detail = sanitizeBeatPlayerDetail(detail);
  if (!isBeatStorePlayerDetail(detail)) return;
  hrBeatPlayerRestartTapAt = 0;
  const player = document.getElementById("hr-beat-player");
  const fallbackAudio = document.getElementById("beat-audio");
  const title = document.getElementById("player-title");
  const producerMetaLink = document.querySelector("#player-detail > a");
  const art = document.getElementById("beat-player-art");
  const fullscreenTitle = document.querySelector("#beat-player-fullscreen-title > a");
  const fullscreenProducer = document.querySelector("#beat-player-fullscreen-producer > a");
  const fullscreenGenre = document.getElementById("beat-player-fullscreen-genre");
  const fullscreenArt = document.getElementById("beat-player-fullscreen-art");
  const bpm = document.querySelectorAll("#beat-player-bpm, #beat-player-fullscreen-bpm");
  const key = document.querySelectorAll("#beat-player-key, #beat-player-fullscreen-key");
  const buyButtons = document.querySelectorAll("[data-beat-player-buy]");
  const playerLinks = [title, fullscreenTitle].filter(Boolean);
  const playerShares = document.querySelectorAll("[data-beat-player-share]");
  if (!detail?.src) return;
  hrBeatPlayerQueue = sanitizeBeatPlayerQueue(options.queue || detail.queue, detail);
  hrCurrentBeatDetail = detail;
  hrBeatVisualizerDisplayValues = [];
  updateBeatPlayerMediaSession(detail);

  destroyBeatWaveform();
  setGlobalWaveformMode("loading");
  if (fallbackAudio) {
    fallbackAudio.pause();
    fallbackAudio.removeAttribute("controls");
    fallbackAudio.src = detail.src;
    fallbackAudio.load();
  }
  player?.classList.remove("is-empty");
  player?.classList.add("is-loaded");
  if (player) player.dataset.state = "loading";
  if (title) title.textContent = detail.title || "Beat Store";
  if (producerMetaLink) producerMetaLink.textContent = detail.detail || "Productor por confirmar";
  if (fullscreenTitle) fullscreenTitle.textContent = detail.title || "Beat Store";
  const productUrl = detail.slug ? new URL(`/store/product.html?slug=${encodeURIComponent(detail.slug)}`, window.location.origin).href : "";
  const beatStoreUrl = new URL("/store/beat_store/", window.location.origin).href;
  playerLinks.forEach((link) => {
    link.href = beatStoreUrl;
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
  });
  playerShares.forEach((shareButton) => {
    const compactShare = Boolean(shareButton.closest("#beat-player-menu"));
    shareButton.hidden = compactShare && !productUrl;
    shareButton.disabled = !productUrl;
  });
  if (fullscreenProducer) fullscreenProducer.textContent = detail.detail || "";
  const producerUrl = detail.producerSlug
    ? new URL(`/store/beat_store/producer.html?producer=${encodeURIComponent(detail.producerSlug)}`, window.location.origin).href
    : "";
  if (fullscreenProducer) {
    if (producerUrl) {
      fullscreenProducer.href = producerUrl;
      fullscreenProducer.removeAttribute("aria-disabled");
      fullscreenProducer.removeAttribute("tabindex");
    } else {
      fullscreenProducer.removeAttribute("href");
      fullscreenProducer.setAttribute("aria-disabled", "true");
      fullscreenProducer.setAttribute("tabindex", "-1");
    }
  }
  if (producerMetaLink) {
    if (producerUrl) {
      producerMetaLink.href = producerUrl;
      producerMetaLink.removeAttribute("aria-disabled");
      producerMetaLink.removeAttribute("tabindex");
    } else {
      producerMetaLink.removeAttribute("href");
      producerMetaLink.setAttribute("aria-disabled", "true");
      producerMetaLink.setAttribute("tabindex", "-1");
    }
  }
  if (fullscreenGenre) fullscreenGenre.textContent = String(detail.genre || "GÉNERO").trim() || "GÉNERO";
  bpm.forEach((element) => { element.textContent = detail.bpm ? `${detail.bpm} BPM` : "-- BPM"; });
  key.forEach((element) => { element.textContent = detail.key ? `KEY ${detail.key}` : "KEY --"; });
  buyButtons.forEach((button) => {
    button.dataset.beatId = detail.beatId || "";
    button.disabled = !detail.beatId;
  });
  if (player) player.dataset.beatId = detail.beatId || "";
  if (art) {
    const cover = String(detail.cover || "").trim();
    art.innerHTML = globalBeatPlayerArtMarkup(cover);
    art.classList.toggle("has-image", Boolean(cover));
    if (fullscreenArt) {
      fullscreenArt.innerHTML = globalBeatPlayerArtMarkup(cover);
      fullscreenArt.classList.toggle("has-image", Boolean(cover));
    }
  }

  loadBeatFallbackAudio(detail, { ...options, keepWaveform: true });
  loadBeatWaveform(detail.src, { ...options, autoplay: Boolean(options.autoplay), media: fallbackAudio }).catch(() => {
    loadBeatFallbackAudio(detail, { ...options, keepCurrentAudio: true });
  });
}
function getWaveSurferModule() {
  if (!hrWaveSurferModulePromise) {
    hrWaveSurferModulePromise = import(HR_WAVESURFER_URL).then((module) => module.default || module.WaveSurfer || module);
  }
  return hrWaveSurferModulePromise;
}

async function loadBeatWaveform(src, options = {}) {
  const player = document.getElementById("hr-beat-player");
  const waveform = document.getElementById("beat-player-waveform");
  const seek = document.getElementById("beat-player-seek");
  if (!waveform) throw new Error("Waveform container missing");

  if (!options.media) destroyBeatWaveform();
  hrWaveSurferFailed = false;
  hrWaveSurferReady = false;
  hrWaveSurferSrc = src;
  waveform.hidden = false;
  setGlobalWaveformMode("loading");
  if (seek) seek.hidden = true;
  if (player) player.dataset.state = "loading";

  const WaveSurfer = await getWaveSurferModule();
  hrWaveSurfer = WaveSurfer.create({
    container: waveform,
    url: src,
    height: 38,
    waveColor: `hsla(${hrBeatVisualizerPalette.hue}, ${Math.round(hrBeatVisualizerPalette.saturation * .62)}%, 66%, .42)`,
    progressColor: `hsl(${hrBeatVisualizerPalette.hue}, ${Math.min(100, Math.round(hrBeatVisualizerPalette.saturation * 1.04))}%, 52%)`,
    cursorColor: `hsl(${hrBeatVisualizerPalette.hue}, ${Math.round(hrBeatVisualizerPalette.saturation * .92)}%, 90%)`,
    cursorWidth: 1,
    barWidth: 2,
    barGap: 2,
    barRadius: 2,
    normalize: true,
    interact: true,
    ...(options.media ? { media: options.media } : {}),
  });

  hrWaveSurfer.on("ready", () => {
    hrWaveSurferReady = true;
    setGlobalWaveformMode("wave");
    const restoreAt = Number(options.currentTime ?? (options.restoreTime ? hrCurrentBeatDetail?.currentTime : 0));
    if (Number.isFinite(restoreAt) && restoreAt > 0 && hrWaveSurfer.getDuration()) {
      hrWaveSurfer.seekTo(Math.max(0, restoreAt) / hrWaveSurfer.getDuration());
    }
    if (player) player.dataset.state = isBeatPlayerPlaying() ? "playing" : "paused";
    syncGlobalBeatPlayerControls(
      player?.querySelectorAll("[data-beat-player-toggle]"),
      seek,
      document.getElementById("beat-player-time"),
      document.querySelectorAll("[data-beat-player-mute]"),
      document.querySelectorAll("#beat-player-volume, #beat-player-fullscreen-volume"),
      waveform,
    );
    if (options.autoplay && !hrWaveSurfer.isPlaying()) {
      setGlobalBeatPlayerPlayback(true);
    }
    emitGlobalBeatPlayerState();

  });
  ["audioprocess", "seeking", "interaction", "play", "pause"].forEach((eventName) => {
    hrWaveSurfer.on(eventName, () => {
      if (player && player.dataset.state !== "loading") player.dataset.state = hrWaveSurfer.isPlaying() ? "playing" : "paused";
      syncGlobalBeatPlayerControls(
        player?.querySelectorAll("[data-beat-player-toggle]"),
        seek,
        document.getElementById("beat-player-time"),
        document.querySelectorAll("[data-beat-player-mute]"),
        document.querySelectorAll("#beat-player-volume, #beat-player-fullscreen-volume"),
        waveform,
      );
      persistGlobalBeatPlayerState();
      emitGlobalBeatPlayerState();
    });
  });
  hrWaveSurfer.on("finish", () => {
    if (hrBeatPlayerRepeat) {
      hrWaveSurfer.seekTo(0);
      setGlobalBeatPlayerPlayback(true);
    } else {
      hrWaveSurfer.seekTo(0);
      if (player) player.dataset.state = "ended";
      dispatchGlobalBeatPlayerNext({
        beatId: hrCurrentBeatDetail?.beatId || player?.dataset.beatId || "",
        src: getBeatPlayerSrc(),
        shuffle: hrBeatPlayerShuffle,
      });
    }
    syncGlobalBeatPlayerControls(
      player?.querySelectorAll("[data-beat-player-toggle]"),
      seek,
      document.getElementById("beat-player-time"),
      document.querySelectorAll("[data-beat-player-mute]"),
      document.querySelectorAll("#beat-player-volume, #beat-player-fullscreen-volume"),
      waveform,
    );
    persistGlobalBeatPlayerState();
    emitGlobalBeatPlayerState();
  });
  hrWaveSurfer.on("error", () => {
    const failedAt = hrWaveSurfer?.getCurrentTime?.() || 0;
    const fallbackDetail = hrCurrentBeatDetail || { src };
    destroyBeatWaveform();
    loadBeatFallbackAudio(fallbackDetail, { ...options, keepCurrentAudio: true, restoreTime: failedAt > 0 || options.restoreTime, currentTime: failedAt || options.currentTime || fallbackDetail.currentTime || 0 });
  });
}

function destroyBeatWaveform() {
  if (hrWaveSurfer) {
    try { hrWaveSurfer.destroy(); } catch {}
  }
  hrWaveSurfer = null;
  hrWaveSurferSrc = "";
  hrWaveSurferReady = false;
  setGlobalWaveformMode("fallback");
}

function loadBeatFallbackAudio(detail, options = {}) {
  const player = document.getElementById("hr-beat-player");
  const audio = document.getElementById("beat-audio");
  const waveform = document.getElementById("beat-player-waveform");
  const seek = document.getElementById("beat-player-seek");
  if (!audio) return;
  hrWaveSurferFailed = true;
  if (waveform) {
    waveform.hidden = false;
    setGlobalWaveformMode("fallback");
  }
  if (seek) seek.hidden = true;
  if (!options.keepCurrentAudio) {
    audio.src = detail.src;
    audio.load();
  }
  const restoreAt = Number(options.currentTime ?? (options.restoreTime ? detail.currentTime : 0));
  if (Number.isFinite(restoreAt) && restoreAt > 0) {
    audio.addEventListener("loadedmetadata", () => {
      audio.currentTime = Math.min(Math.max(0, restoreAt), Number.isFinite(audio.duration) ? audio.duration : restoreAt);
    }, { once: true });
  }
  if (player) player.dataset.state = "loading";
  if (options.autoplay) audio.play().catch(() => {});
}

function getBeatPlayerSrc() {
  return document.getElementById("beat-audio")?.src || hrWaveSurferSrc || "";
}

function getBeatPlayerCurrentTime() {
  return document.getElementById("beat-audio")?.currentTime || hrWaveSurfer?.getCurrentTime?.() || 0;
}

function getBeatPlayerDuration() {
  const audioDuration = document.getElementById("beat-audio")?.duration;
  return Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : (hrWaveSurfer?.getDuration?.() || 0);
}

function isBeatPlayerPlaying() {
  const audio = document.getElementById("beat-audio");
  return Boolean(audio?.src && !audio.paused && !audio.ended);
}

function setGlobalBeatPlayerPlayback(shouldPlay) {
  const audio = document.getElementById("beat-audio");
  if (!audio) return;
  if (shouldPlay) {
    if (hrBeatAudioContext?.state === "suspended") hrBeatAudioContext.resume().catch(() => {});
    audio.play().catch(() => {});
  } else audio.pause();
}

function toggleGlobalBeatPlayerPlayback() {
  setGlobalBeatPlayerPlayback(!isBeatPlayerPlaying());
}

function getBeatPlayerMuted() {
  return Boolean(document.getElementById("beat-audio")?.muted);
}

function setBeatPlayerMuted(muted) {
  const audio = document.getElementById("beat-audio");
  if (audio) audio.muted = muted;
}

function getBeatPlayerVolume() {
  return hrBeatPlayerVolume;
}

function setBeatPlayerVolume(value) {
  const next = Math.max(0, Math.min(1, Number(value) || 0));
  hrBeatPlayerVolume = next;
  if (hrBeatGain) hrBeatGain.gain.value = next;
  const audio = document.getElementById("beat-audio");
  if (audio) {
    audio.volume = 1;
    audio.muted = next === 0;
  }
}
function persistGlobalBeatPlayerState() {
  const title = document.getElementById("player-title");
  const meta = document.getElementById("player-detail");
  const art = document.getElementById("beat-player-art");
  const cover = art?.querySelector("img")?.src || "";
  const src = getBeatPlayerSrc();
  if (!src || !isBeatStorePlayerDetail(hrCurrentBeatDetail)) return;
  try {
    sessionStorage.setItem(HR_BEAT_PLAYER_STORAGE_KEY, JSON.stringify({
      source: HR_BEAT_PLAYER_SOURCE,
      src,
      title: title?.textContent || "Beat Store",
      detail: meta?.textContent || "",
      cover,
      beatId: document.getElementById("hr-beat-player")?.dataset.beatId || hrCurrentBeatDetail?.beatId || "",
      slug: hrCurrentBeatDetail?.slug || "",
      producerSlug: hrCurrentBeatDetail?.producerSlug || "",
      genre: hrCurrentBeatDetail?.genre || "",
      bpm: hrCurrentBeatDetail?.bpm || "",
      key: hrCurrentBeatDetail?.key || "",
      queue: hrBeatPlayerQueue,
      currentTime: getBeatPlayerCurrentTime(),
      wasPlaying: isBeatPlayerPlaying(),
    }));
  } catch {}
}

window.addEventListener("pagehide", persistGlobalBeatPlayerState);
window.addEventListener("beforeunload", persistGlobalBeatPlayerState);
window.addEventListener("hr:beat-preview", (event) => {
  if (!isBeatStorePlayerDetail(event.detail)) return;
  setGlobalBeatPlayer(event.detail, { autoplay: true, queue: event.detail?.queue });
  ensureGlobalBeatPlayerQueue();
});
window.addEventListener("hr:beat-player-default", (event) => {
  if (!isBeatStorePlayerDetail(event.detail)) return;
  setGlobalBeatPlayer(event.detail, { autoplay: false, queue: event.detail?.queue });
  ensureGlobalBeatPlayerQueue();
});
window.addEventListener("hr:beat-player-next", (event) => {
  if (event.defaultPrevented) return;
  if (hrBeatPlayerQueue.length < 2) {
    event.preventDefault();
    ensureGlobalBeatPlayerQueue().then(() => {
      const next = nextGlobalBeatPlayerDetail(event.detail);
      if (next) setGlobalBeatPlayer(next, { autoplay: true, queue: hrBeatPlayerQueue });
    });
    return;
  }
  const next = nextGlobalBeatPlayerDetail(event.detail);
  if (!next) return;
  event.preventDefault();
  setGlobalBeatPlayer(next, { autoplay: true, queue: hrBeatPlayerQueue });
});
window.addEventListener("hr:beat-player-previous", (event) => {
  if (event.defaultPrevented) return;
  if (hrBeatPlayerQueue.length < 2) {
    event.preventDefault();
    ensureGlobalBeatPlayerQueue().then(() => {
      const previous = previousGlobalBeatPlayerDetail(event.detail);
      if (previous && previous.beatId !== hrCurrentBeatDetail?.beatId) {
        setGlobalBeatPlayer(previous, { autoplay: true, queue: hrBeatPlayerQueue });
      }
    });
    return;
  }
  const previous = previousGlobalBeatPlayerDetail(event.detail);
  if (!previous || previous.beatId === hrCurrentBeatDetail?.beatId) return;
  event.preventDefault();
  setGlobalBeatPlayer(previous, { autoplay: true, queue: hrBeatPlayerQueue });
});
window.addEventListener("hr:beat-preview-toggle", (event) => {
  if (event.detail?.source !== HR_BEAT_PLAYER_SOURCE) return;
  const action = event.detail?.action;
  if (!getBeatPlayerSrc()) return;
  if (action === "pause") setGlobalBeatPlayerPlayback(false);
  else if (action === "play") setGlobalBeatPlayerPlayback(true);
  else toggleGlobalBeatPlayerPlayback();
  emitGlobalBeatPlayerState();
});

function attachGlobalDrawerSwipe(drawer) {
  if (!drawer) return;
  let startX = 0;
  let startY = 0;

  drawer.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });

  drawer.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = Math.abs(touch.clientY - startY);
    if (deltaX > 70 && deltaY < 80) toggleGlobalDrawer(false);
  }, { passive: true });
}

function renderGlobalNav() {
  const target = document.getElementById("hr-global-nav");
  if (!target) return;

  releaseGlobalOverlayState();
  document.body.classList.add("hr-has-global-nav");
  const module = document.body.dataset.hrContext || "home";
  const accent = module === "media" ? "media" : "brand";
  const activeModule = module;
  const navPath = window.location.pathname;
  const subnav = renderSubNav(module);
  const actionsClass = document.body.classList.contains("db-body")
    ? "hr-nav__actions db-topbar__actions"
    : "hr-nav__actions";

  target.innerHTML = `
    <header class="hr-nav" data-module="${module}" data-accent="${accent}">
      <div class="hr-nav__main">
        <a class="hr-nav__brand" href="/" aria-label="Hidden Room, inicio">
          <img src="/assets/img/white_logo.webp" alt="">
          <span>Hidden Room</span>
        </a>
        <nav class="hr-nav__links" aria-label="Navegación principal">
          ${ECOSYSTEM_LINKS
            .filter(([key]) => !MORE_NAV_KEYS.has(key))
            .map((item) => renderGlobalNavLink(item, activeModule, navPath))
            .join("")}
          ${renderMoreNav(activeModule, navPath)}
        </nav>
        <div class="hr-nav__mobile-controls">
          <div class="${actionsClass}">${renderNavActions(module)}</div>
          <button class="hr-nav__mobile-toggle" type="button" aria-label="Abrir menú"
            aria-controls="hr-global-drawer" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      ${subnav ? `<nav class="hr-nav__sub" aria-label="Navegación contextual">${subnav}</nav>` : ""}
    </header>
    ${renderGlobalDrawer(activeModule)}
    <aside class="hr-global-notifications" id="hr-global-notifications"
      aria-label="Notificaciones" hidden>
      <header>
        <div>
          <span>Cuenta</span>
          <strong>Notificaciones</strong>
        </div>
        <button type="button" data-hr-notifications-close aria-label="Cerrar notificaciones">x</button>
      </header>
      <ul data-hr-notifications-list>
        <li class="hr-global-notifications__empty">Cargando notificaciones...</li>
      </ul>
    </aside>
    ${document.getElementById("hr-beat-player") ? "" : renderGlobalBeatPlayer()}
  `;

  const globalBeatPlayer = target.querySelector("#hr-beat-player");
  const persistentBeatPlayer = globalBeatPlayer || document.getElementById("hr-beat-player");
  if (persistentBeatPlayer && persistentBeatPlayer.parentElement !== document.body) document.body.appendChild(persistentBeatPlayer);
  if (persistentBeatPlayer) document.body.classList.add("hr-has-beat-player");
  const fullscreenBeatPlayer = target.querySelector("#hr-beat-player-fullscreen") || document.getElementById("hr-beat-player-fullscreen");
  if (fullscreenBeatPlayer && fullscreenBeatPlayer.parentElement !== document.body) document.body.appendChild(fullscreenBeatPlayer);
  const globalDrawer = target.querySelector(".hr-global-drawer");
  const globalDrawerBackdrop = target.querySelector(".hr-global-drawer__backdrop");
  if (globalDrawerBackdrop) document.body.appendChild(globalDrawerBackdrop);
  if (globalDrawer) document.body.appendChild(globalDrawer);
  document.body.classList.toggle("hr-has-subnav", Boolean(subnav));

  target.querySelector(".hr-nav__mobile-toggle")?.addEventListener("click", () => {
    toggleGlobalDrawer();
  });
  document.querySelectorAll("[data-global-drawer-close]").forEach((control) => {
    control.addEventListener("click", () => toggleGlobalDrawer(false));
  });
  document.querySelectorAll("[data-global-more-toggle]").forEach((summary) => {
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      const details = summary.closest("details");
      if (details) details.open = !details.open;
    });
  });
  document.querySelector(".hr-global-drawer")?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-global-nav-action]");
    if (actionButton) {
      const action = actionButton.dataset.globalNavAction;
      const targetControl = document.querySelector(
        `#js-user-menu [data-action="${CSS.escape(action)}"], .db-sidebar__item[data-sidebar-action="${CSS.escape(action)}"]`,
      );
      if (targetControl) {
        event.preventDefault();
        targetControl.click();
      }
      toggleGlobalDrawer(false);
      return;
    }

    if (event.target.closest("a")) toggleGlobalDrawer(false);
  });
  attachGlobalDrawerSwipe(globalDrawer);
  if (!hrGlobalBeatPlayerHydrated) {
    hydrateGlobalBeatPlayer();
    hrGlobalBeatPlayerHydrated = true;
  }
  loadGlobalBeatPlayerDefault();
}

function syncPortalSubNav() {
  if (!document.body.classList.contains("db-body")) return;
  const section = window.location.hash.slice(1);
  if (!section) return;

  const sidebarItem = document.querySelector(`.db-sidebar__item[data-section="${CSS.escape(section)}"]`);
  if (sidebarItem && !sidebarItem.closest("[hidden]")) sidebarItem.click();
}

window.addEventListener("hashchange", syncPortalSubNav);
window.addEventListener("DOMContentLoaded", syncPortalSubNav);
window.addEventListener("DOMContentLoaded", () => {
  hydrateGlobalInstagramUsernamePrompt();
  window.setTimeout(syncPortalSubNav, 500);
  window.setTimeout(syncPortalSubNav, 1400);
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-portal-section]");
  if (!link || !document.body.classList.contains("db-body")) return;

  const section = link.dataset.portalSection;
  const sidebarItem = document.querySelector(`.db-sidebar__item[data-section="${CSS.escape(section)}"]`);
  if (!sidebarItem || sidebarItem.closest("[hidden]")) return;

  event.preventDefault();
  window.history.replaceState(null, "", `#${section}`);
  document.querySelectorAll("[data-portal-section]").forEach((item) => {
    item.removeAttribute("aria-current");
  });
  link.setAttribute("aria-current", "page");
  sidebarItem.click();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") toggleGlobalNotifications(false);
  if (event.key === "Escape" && document.body.classList.contains("hr-global-menu-open")) {
    toggleGlobalDrawer(false);
  }
});

function shouldSkipGlobalFooter() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  return document.body?.dataset.hrFooter === "false"
    || document.body?.dataset.hrContext === "games"
    || pathname === "/minijuegos"
    || pathname.startsWith("/minijuegos/");
}

function initGlobalFooter() {
  const body = document.body;
  if (!body?.hasAttribute("data-hr-chrome") || shouldSkipGlobalFooter()) return;

  const existingFooter = body.querySelector(":scope > footer") || body.querySelector("#hr-spa-content > footer");
  const footer = existingFooter || document.createElement("footer");

  footer.className = "hr-site-footer hr-universal-footer";
  footer.setAttribute("aria-label", "Pie de página");
  footer.innerHTML = `
    <div class="hr-universal-footer__brand">
      <div class="hr-universal-footer__brand-logos">
        <a class="hr-universal-footer__logo-link" href="/" aria-label="Hidden Room, inicio">
          <img class="hr-universal-footer__logo" src="/assets/img/white_logo.webp" alt="Hidden Room">
        </a>
        <a class="hr-universal-footer__logo-link hr-universal-footer__logo-link--mysauth" href="https://mysauth.com/" target="_blank" rel="noopener noreferrer" aria-label="MysAuth, sitio principal">
          <img class="hr-universal-footer__logo hr-universal-footer__logo--mysauth" src="/assets/img/mysauth-logo.webp" alt="MysAuth">
        </a>
      </div>
      <p class="hr-universal-footer__signature">Hidden Room / Grupo Mysauth</p>
    </div>

    <div class="hr-universal-footer__links">
      <nav class="hr-universal-footer__group" aria-label="Explorar Hidden Room">
        <p class="hr-universal-footer__label">Explorar</p>
        <a href="/store/beat_store/">Beat Store</a>
        <a href="/media/">Media</a>
        <a href="/studio/">Studio</a>
        <a href="/tickets/">Eventos</a>
      </nav>

      <nav class="hr-universal-footer__group" aria-label="Ayuda y cuenta">
        <p class="hr-universal-footer__label">Ayuda</p>
        <a href="/store/beat_store/my-beats.html">Mis Beats</a>
        <a href="/store/cart.html">Carrito</a>
        <a href="/store/beat_store/new-beat.html" data-permission-nav-link="beats.upload" hidden>Subir beats</a>
        <a href="https://wa.me/525542881737" target="_blank" rel="noopener noreferrer">Soporte por WhatsApp</a>
      </nav>
    </div>

    <div class="hr-universal-footer__meta">
      <span class="site-status" hidden aria-hidden="true"></span>
      <span class="hr-universal-footer__beta">BETA <span aria-hidden="true">·</span> <span class="site-version"></span></span>
    </div>
  `;

  if (!existingFooter) body.append(footer);
}

document.addEventListener("click", (event) => {
  const banner = event.target.closest("#hr-view-as-banner");
  if (banner?.dataset.hrSuppressClick === "true") {
    event.preventDefault();
    event.stopPropagation();
    delete banner.dataset.hrSuppressClick;
    return;
  }
  const bannerToggle = event.target.closest("[data-view-as-banner-toggle]");
  if (bannerToggle) {
    event.preventDefault();
    event.stopPropagation();
    setViewAsBannerVisibility(bannerToggle.getAttribute("aria-expanded") !== "true");
    return;
  }
  const control = event.target.closest("[data-view-as-action]");
  if (!control) return;
  event.preventDefault();
  if (control.dataset.viewAsAction === "clear") {
    returnFromViewAs();
    return;
  }
  openViewAsSelector();
});

renderGlobalNav();
attachGlobalNotificationListeners();
hydrateGlobalSession();
attachGlobalSessionSync();
initGlobalFooter();
initGlobalCopyEditor();

document.querySelectorAll(".site-status").forEach(el => {
  el.textContent = SITE_STATUS;
});

document.querySelectorAll(".site-version").forEach(el => {
  el.textContent = SITE_VERSION;
});


/* =========================================================
   GLOBAL CUSTOM CURSOR
========================================================= */

const cursor = document.getElementById("cursor");
const ring = document.getElementById("cursorRing");

if (cursor && ring) {

  let mx = 0;
  let my = 0;
  let rx = 0;
  let ry = 0;

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;

    cursor.style.transform =
      `translate(${mx - 5}px, ${my - 5}px)`;
  });

  function animRing() {

    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;

    ring.style.transform =
      `translate(${rx - 18}px, ${ry - 18}px)`;

    requestAnimationFrame(animRing);
  }

  animRing();

  function isCursorTarget(target) {
    return target?.closest?.('a, button, input, [role="button"], .event-row');
  }

  document.addEventListener('mouseenter', (event) => {
    if (isCursorTarget(event.target)) {
      ring.style.borderColor = 'rgba(219,1,0,0.8)';
      ring.style.scale = "1.5";
    }
  }, true);

  document.addEventListener('mouseleave', (event) => {
    if (isCursorTarget(event.target)) {
      ring.style.borderColor = 'rgba(219,1,0,0.5)';
      ring.style.scale = "1";
    }
  }, true);

}


/* =========================================================
   SCROLL REVEAL
========================================================= */

const revealElements = document.querySelectorAll('.reveal');

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-hr-funnel-event]');
  if (!target || typeof window.gtag !== 'function') return;
  window.gtag('event', target.dataset.hrFunnelEvent, { funnel: 'store' });
});

if (revealElements.length > 0) {

  const observer = new IntersectionObserver(entries => {

    entries.forEach(entry => {

      if (entry.isIntersecting) {

        setTimeout(() => {
          entry.target.classList.add('visible');
        }, 80);

        observer.unobserve(entry.target);
      }

    });

  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  });

  revealElements.forEach(el => observer.observe(el));
}


/* =========================================================
   EVENT ROW STAGGER
========================================================= */

document.querySelectorAll('.event-row').forEach((row, i) => {
  row.style.transitionDelay = `${i * 60}ms`;
});


/* =========================================================
   GALLERY SLIDER
========================================================= */

const track = document.getElementById('galleryTrack');

if (track) {

  let galleryIndex = 0;
  const total = track.children.length;

  window.slideGallery = function(dir) {

    galleryIndex =
      (galleryIndex + dir + total) % total;

    track.style.transform =
      `translateX(-${galleryIndex * 100}%)`;
  };

  document.querySelectorAll('[data-gallery-dir]').forEach((button) => {
    button.addEventListener('click', () => {
      window.slideGallery(Number(button.dataset.galleryDir || 0));
    });
  });

}
