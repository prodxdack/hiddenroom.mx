const HR_SPA_ROUTES = new Set(['/','/store/','/store/product.html','/store/beat_store/','/store/beat_store/producer.html','/media/','/academia/','/kairen/','/tickets/']);
const HR_SPA_EXCLUDED = ['/portal/','/portal/dashboard.html','/tickets/generate.html','/tickets/validate.html','/tickets/view.html'];
const HR_SPA_CACHE_TTL = 60 * 1000;
const hrSpaViewCache = new Map();
const hrSpaPending = new Map();
let hrSpaNavigationId = 0;
let hrSpaActiveCleanups = [];
let hrSpaReady = false;
let hrSpaActiveNavigation = 0;

function hrSpaPath(url) {
  const path = url.pathname.replace(/\/index\.html$/, '/') || '/';
  if (path.endsWith('.html')) return path;
  return path.endsWith('/') ? path : `${path}/`;
}
function hrSpaCacheKey(url) { return `${url.origin}${hrSpaPath(url)}${url.search}`; }
function hrSpaDevEnabled() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || new URLSearchParams(window.location.search).has('hr_debug');
}
function hrSpaDebug(event, details = {}) {
  if (hrSpaDevEnabled()) console.info(`[HR SPA] ${event}`, details);
}
function pathStartsWithMinijuegos(url) { return hrSpaPath(url).startsWith('/minijuegos/'); }
function hrSpaIsCompatible(url) {
  if (url.origin !== window.location.origin) return false;
  const path = hrSpaPath(url);
  if (pathStartsWithMinijuegos(url)) return false;
  if (HR_SPA_EXCLUDED.some((prefix) => path === prefix || path.startsWith(`${prefix}admin`))) return false;
  return HR_SPA_ROUTES.has(path);
}
function hrSpaCanPrefetch(url) {
  if (!hrSpaIsCompatible(url) || url.href === window.location.href) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
  if (document.querySelector(`a[href="${CSS.escape(url.href)}"][download]`)) return false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData) return false;
  if (['slow-2g', '2g'].includes(connection?.effectiveType) || Number(connection?.downlink) > 0 && connection.downlink < 1.5) return false;
  return true;
}
function hrSpaEnsureRoot() {
  let root = document.getElementById('hr-spa-content');
  if (root) return root;
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    if (!hrSpaIsGlobalStylesheet(link) && link.href.startsWith(window.location.origin)) {
      link.setAttribute('data-hr-spa-page-asset', '');
    }
  });
  root = document.createElement('div');
  root.id = 'hr-spa-content';
  const keep = new Set(['hr-global-nav', 'cursor', 'cursorRing', 'hr-beat-player', 'hr-beat-player-fullscreen']);
  [...document.body.children].forEach((child) => {
    if (keep.has(child.id) || child.matches('.hr-global-drawer, .hr-global-drawer__backdrop') || child.tagName === 'SCRIPT') return;
    root.appendChild(child);
  });
  document.body.appendChild(root);
  return root;
}
function hrSpaSkeletonMarkup(url) {
  const path = hrSpaPath(url);
  if (path === "/store/" || path === "/media/") {
    const modifier = path === "/media/" ? " hr-skeleton-grid--media" : " hr-skeleton-grid--store";
    return `<div class="hr-skeleton-grid${modifier}" aria-hidden="true">${Array.from({ length: 6 }, () => `<article class="hr-skeleton-card"><div class="hr-skeleton-block ${path === "/media/" ? "hr-skeleton-block--media" : ""}"></div><div class="hr-skeleton-line hr-skeleton-line--short"></div><div class="hr-skeleton-line"></div><div class="hr-skeleton-line hr-skeleton-line--medium"></div><div class="hr-skeleton-actions"><span></span><span></span></div></article>`).join("")}</div>`;
  }
  if (path === "/store/beat_store/") return `<div class="hr-skeleton-grid hr-skeleton-grid--beats" aria-hidden="true">${Array.from({ length: 6 }, () => '<article class="hr-skeleton-card hr-skeleton-card--beat"><div class="hr-skeleton-block hr-skeleton-block--cover"></div><div class="hr-skeleton-stack"><div class="hr-skeleton-line hr-skeleton-line--short"></div><div class="hr-skeleton-line"></div><div class="hr-skeleton-line hr-skeleton-line--medium"></div><div class="hr-skeleton-actions"><span></span><span></span></div></div></article>').join("")}</div>`;
  if (path === "/kairen/" || path === "/tickets/") return `<div class="hr-skeleton-shell" aria-hidden="true"><div class="hr-skeleton-line hr-skeleton-line--short"></div><div class="hr-skeleton-line hr-skeleton-line--title"></div><div class="hr-skeleton-grid hr-skeleton-grid--shell">${Array.from({ length: path === "/tickets/" ? 3 : 2 }, () => '<article class="hr-skeleton-card"><div class="hr-skeleton-line"></div><div class="hr-skeleton-line hr-skeleton-line--medium"></div><div class="hr-skeleton-line hr-skeleton-line--short"></div><div class="hr-skeleton-actions"><span></span><span></span></div></article>').join("")}</div></div>`;
  return '<div class="hr-skeleton-home" aria-hidden="true"><div class="hr-skeleton-block hr-skeleton-block--hero"></div><div class="hr-skeleton-home__lines"><span></span><span></span><span></span></div></div>';
}
function hrSpaShowSkeleton(root, url) {
  root.replaceChildren();
  root.insertAdjacentHTML("beforeend", hrSpaSkeletonMarkup(url));
  root.setAttribute("aria-busy", "true");
}
function hrSpaCaptureBeatPlayback() {
  const audio = document.getElementById("beat-audio");
  if (!audio?.src) return null;
  return {
    audio,
    src: audio.src,
    currentTime: Number(audio.currentTime) || 0,
    wasPlaying: !audio.paused && !audio.ended,
    volume: audio.volume,
    muted: audio.muted,
  };
}
function hrSpaRestoreBeatPlayback(snapshot) {
  if (!snapshot?.wasPlaying) return;
  const audio = document.getElementById("beat-audio");
  if (!audio || audio !== snapshot.audio || audio.src !== snapshot.src) return;
  if (Number.isFinite(snapshot.currentTime) && Math.abs(audio.currentTime - snapshot.currentTime) > 0.25) {
    try { audio.currentTime = snapshot.currentTime; } catch {}
  }
  audio.volume = snapshot.volume;
  audio.muted = snapshot.muted;
  if (audio.paused) audio.play().catch(() => {});
}
function hrSpaUpdateActiveNavigation(url) {
  const target = new URL(url, window.location.href);
  document.querySelectorAll("#hr-global-nav a[href]").forEach((link) => {
    const linkUrl = new URL(link.href, window.location.href);
    const samePath = hrSpaPath(linkUrl) === hrSpaPath(target);
    const sameQuery = linkUrl.search === target.search;
    const sameHash = !linkUrl.hash || linkUrl.hash === target.hash;
    link.toggleAttribute("aria-current", samePath && sameQuery && sameHash ? "page" : false);
  });
}
async function hrSpaApplyDocument(parsed, url) {
  const root = hrSpaEnsureRoot();
  await hrSpaSyncPageHeadAssets(parsed, url);
  const sourceBody = parsed.body;
  const nodes = [...sourceBody.children].filter((node) => node.id !== 'hr-global-nav' && node.id !== 'hr-beat-player' && node.id !== 'cursor' && node.id !== 'cursorRing' && node.tagName !== 'SCRIPT');
  root.replaceChildren(...nodes.map((node) => node.cloneNode(true)));
  document.title = parsed.title || document.title;
  const parsedDescription = parsed.querySelector('meta[name="description"]')?.getAttribute('content');
  if (parsedDescription) {
    let description = document.querySelector('meta[name="description"]');
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.appendChild(description); }
    description.content = parsedDescription;
  }
  document.body.className = sourceBody.className;
  Object.keys(document.body.dataset).forEach((key) => delete document.body.dataset[key]);
  Object.entries(sourceBody.dataset).forEach(([key, value]) => { document.body.dataset[key] = value; });
  document.body.classList.add('hr-spa-ready');
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = url.href;
  document.querySelectorAll('meta[property="og:url"]').forEach((meta) => { meta.content = url.href; });
  return root;
}

function hrSpaIsGlobalStylesheet(node, baseUrl = window.location.href) {
  const href = node.getAttribute('href');
  if (!href) return false;
  const resolved = new URL(href, baseUrl);
  return resolved.origin === window.location.origin && /^\/styles(?:-\d+)?\.css$/i.test(resolved.pathname);
}

function hrSpaWaitForStylesheet(link) {
  if (link.sheet) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (loaded) => {
      if (settled) return;
      settled = true;
      resolve(loaded);
    };
    link.addEventListener('load', () => finish(true), { once: true });
    link.addEventListener('error', () => finish(false), { once: true });
  });
}

async function hrSpaSyncPageHeadAssets(parsed, url) {
  const oldPageAssets = [...document.head.querySelectorAll('[data-hr-spa-page-asset]')];
  const oldGlobalStyles = [...document.head.querySelectorAll('link[rel="stylesheet"]')].filter((node) => hrSpaIsGlobalStylesheet(node));
  const oldAssets = new Set([...oldPageAssets, ...oldGlobalStyles]);
  const newStylesheets = [];

  for (const source of parsed.head.querySelectorAll('link[rel="stylesheet"], style#beat-store-banner-critical')) {
    if (source.tagName === 'STYLE') {
      const style = source.cloneNode(true);
      style.setAttribute('data-hr-spa-page-asset', '');
      document.head.appendChild(style);
      continue;
    }

    const href = source.getAttribute('href');
    if (!href) continue;
    const resolved = new URL(href, url.href);
    const isGlobalStylesheet = hrSpaIsGlobalStylesheet(source, url.href);
    const isPageStylesheet = resolved.origin === window.location.origin && !isGlobalStylesheet;
    const isGoogleFont = resolved.origin === 'https://fonts.googleapis.com';
    if (!isPageStylesheet && !isGlobalStylesheet && !isGoogleFont) continue;

    const link = source.cloneNode(true);
    link.href = resolved.href;
    link.setAttribute('data-hr-spa-page-asset', '');
    document.head.appendChild(link);
    if (isPageStylesheet || isGlobalStylesheet) newStylesheets.push(link);
  }

  const stylesLoaded = await Promise.all(newStylesheets.map((link) => hrSpaWaitForStylesheet(link)));
  const keepOldGlobalStyles = newStylesheets.length > 0 && stylesLoaded.some((loaded) => !loaded);
  oldAssets.forEach((node) => {
    if (keepOldGlobalStyles && oldGlobalStyles.includes(node)) return;
    node.remove();
  });
}
function hrSpaReadModuleScripts(parsed, url) {
  return [...parsed.querySelectorAll('script[type="module"][src]')]
    .map((script) => new URL(script.getAttribute('src'), url.href).href)
    .filter((src) => new URL(src).origin === window.location.origin && !src.includes('/portal/dashboard.js'));
}
async function hrSpaMount(parsed, url) {
  hrSpaActiveCleanups.splice(0).forEach((cleanup) => { try { cleanup(); } catch {} });
  const modules = hrSpaReadModuleScripts(parsed, url);
  for (const source of modules) {
    const separator = source.includes('?') ? '&' : '?';
    const module = await import(`${source}${separator}hr_spa=${++hrSpaNavigationId}`);
    const mount = module.mount || module.default?.mount;
    if (typeof mount === 'function') {
      const cleanup = await mount({ root: document.getElementById('hr-spa-content'), url });
      if (typeof cleanup === 'function') hrSpaActiveCleanups.push(cleanup);
    }
  }
}
function hrSpaCachedView(url) {
  const key = hrSpaCacheKey(url);
  const entry = hrSpaViewCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > HR_SPA_CACHE_TTL) { hrSpaViewCache.delete(key); return null; }
  return entry;
}
async function hrSpaGetView(url, { prefetch = false } = {}) {
  const cached = hrSpaCachedView(url);
  if (cached) { hrSpaDebug('cache hit', { url: url.href, prefetch }); return { html: cached.html, fromCache: true }; }
  const key = hrSpaCacheKey(url);
  if (hrSpaPending.has(key)) return { html: await hrSpaPending.get(key), fromCache: false };
  const startedAt = performance.now();
  const request = fetch(url.href, { headers: { 'X-HiddenRoom-SPA': '1' } }).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    if (!parsed.body || !parsed.querySelector('body[data-hr-chrome]')) throw new Error('Página incompatible');
    hrSpaViewCache.set(key, { html, createdAt: Date.now() });
    hrSpaDebug(prefetch ? 'prefetch complete' : 'navigation fetch', { url: url.href, ms: Math.round(performance.now() - startedAt) });
    return html;
  }).finally(() => hrSpaPending.delete(key));
  hrSpaPending.set(key, request);
  if (prefetch) hrSpaDebug('prefetch start', { url: url.href });
  return { html: await request, fromCache: false };
}
function hrSpaPrefetch(input) {
  const url = new URL(input, window.location.href);
  if (!hrSpaCanPrefetch(url) || hrSpaCachedView(url) || hrSpaPending.has(hrSpaCacheKey(url))) return;
  hrSpaGetView(url, { prefetch: true }).catch(() => {});
}
async function hrSpaNavigate(input, { replace = false, fromPopState = false } = {}) {
  const url = new URL(input, window.location.href);
  if (url.pathname.endsWith('/index.html')) url.pathname = url.pathname.slice(0, -'index.html'.length);
  if (!hrSpaIsCompatible(url)) return false;
  const beatPlayback = hrSpaCaptureBeatPlayback();
  window.releaseGlobalOverlayState?.();
  const root = hrSpaEnsureRoot();
  const navigationId = ++hrSpaActiveNavigation;
  const startedAt = performance.now();
  let view;
  try {
    if (!fromPopState) window.history[replace ? 'replaceState' : 'pushState']({ hrSpa: true }, '', url.href);
    hrSpaUpdateActiveNavigation(url);
    view = await hrSpaGetView(url);
    if (navigationId !== hrSpaActiveNavigation) return false;
    if (!view.fromCache) { document.body.classList.add('hr-spa-loading'); root.classList.add('hr-spa-content--leaving'); hrSpaShowSkeleton(root, url); }
    const parsed = new DOMParser().parseFromString(view.html, 'text/html');
    await hrSpaApplyDocument(parsed, url);
    root.removeAttribute("aria-busy");
    if (typeof window.renderGlobalNav === 'function') window.renderGlobalNav();
    if (typeof window.initGlobalFooter === 'function') window.initGlobalFooter();
    if (typeof window.hydrateGlobalSession === 'function') await window.hydrateGlobalSession();
    window.dispatchEvent(new CustomEvent('hr:spa-content-updated', { detail: { url: url.href } }));
    document.querySelectorAll('.site-status').forEach((el) => { el.textContent = window.HiddenRoomSite?.status || el.textContent; });
    await hrSpaMount(parsed, url);
    hrSpaRestoreBeatPlayback(beatPlayback);
    if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    root.classList.add('hr-spa-content--entering');
    requestAnimationFrame(() => root.classList.remove('hr-spa-content--leaving'));
    window.setTimeout(() => root.classList.remove('hr-spa-content--entering'), 220);
    hrSpaDebug('navigation complete', { url: url.href, cached: view.fromCache, ms: Math.round(performance.now() - startedAt) });
    return true;
  } catch (error) {
    window.releaseGlobalOverlayState?.();
    hrSpaDebug('fallback', { url: url.href, error: error?.message || String(error) });
    window.location.href = url.href;
    return false;
  } finally {
    document.body.classList.remove('hr-spa-loading');
  }
}
function hrSpaHandleClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href]');
  if (!link || link.target === '_blank' || link.hasAttribute('download') || link.dataset.hrSpa === 'off') return;
  if (link.protocol !== 'http:' && link.protocol !== 'https:') return;
  const url = new URL(link.href, window.location.href);
  if (!hrSpaIsCompatible(url)) return;
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    event.preventDefault(); window.history.pushState({ hrSpa: true }, '', url.href);
    hrSpaUpdateActiveNavigation(url);
    if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  event.preventDefault(); hrSpaNavigate(url);
}
function hrSpaHandlePrefetch(event) {
  const link = event.target.closest?.('a[href]');
  if (!link || link.target === '_blank' || link.hasAttribute('download') || link.dataset.hrSpa === 'off') return;
  if (event.type === 'pointerover' && link.contains(event.relatedTarget)) return;
  const url = new URL(link.href, window.location.href);
  if (hrSpaCanPrefetch(url)) window.setTimeout(() => hrSpaPrefetch(url), event.type === 'focusin' ? 0 : 80);
}
window.HiddenRoomApp = window.HiddenRoomApp || {};
window.HiddenRoomApp.navigate = hrSpaNavigate;
window.HiddenRoomApp.mount = hrSpaMount;
window.HiddenRoomApp.prefetch = hrSpaPrefetch;
window.HiddenRoomApp.invalidate = (input) => { if (!input) return hrSpaViewCache.clear(); hrSpaViewCache.delete(hrSpaCacheKey(new URL(input, window.location.href))); };
window.HiddenRoomApp.register = (cleanup) => { if (typeof cleanup === 'function') hrSpaActiveCleanups.push(cleanup); return cleanup; };
document.addEventListener('click', hrSpaHandleClick);
document.addEventListener('pointerover', hrSpaHandlePrefetch, { passive: true });
document.addEventListener('focusin', hrSpaHandlePrefetch);
window.addEventListener('popstate', () => { const url = new URL(window.location.href); if (hrSpaIsCompatible(url)) hrSpaNavigate(url, { fromPopState: true }); });
function hrSpaInit() { if (hrSpaReady || !document.body.hasAttribute('data-hr-chrome')) return; hrSpaReady = true; hrSpaEnsureRoot(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hrSpaInit, { once: true }); else hrSpaInit();
const hrSpaStyle = document.createElement('style');
hrSpaStyle.id = 'hr-spa-style';
hrSpaStyle.textContent = `#hr-spa-content{opacity:1;transform:translateY(0);transition:opacity 160ms ease,transform 180ms ease}#hr-spa-content.hr-spa-content--leaving{opacity:.18;transform:translateY(4px)}#hr-spa-content.hr-spa-content--entering{animation:hr-spa-enter 180ms ease both}body.hr-spa-loading{cursor:progress}@keyframes hr-spa-enter{from{opacity:.72;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){#hr-spa-content{transition:none}#hr-spa-content.hr-spa-content--entering{animation:none}}`;
document.head.appendChild(hrSpaStyle);
