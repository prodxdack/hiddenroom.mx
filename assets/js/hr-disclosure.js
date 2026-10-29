const HR_DISCLOSURE_STORAGE_PREFIX = 'hr_disclosure:';

function escapeDisclosureHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function storageKey(key) {
  return `${HR_DISCLOSURE_STORAGE_PREFIX}${String(key ?? '').trim()}`;
}

export function getHrDisclosureState(key) {
  try {
    const stored = window.localStorage.getItem(storageKey(key));
    if (stored === null) return null;
    return stored === 'true';
  } catch {
    return null;
  }
}

export function isHrDisclosureOpen(key, defaultOpen = false) {
  const stored = getHrDisclosureState(key);
  return stored === null ? Boolean(defaultOpen) : stored;
}

export function renderHrDisclosure({
  key,
  title = '',
  meta = '',
  summary = '',
  body = '',
  className = '',
  defaultOpen = false,
  responsiveOnly = false,
}) {
  const safeKey = escapeDisclosureHtml(key);
  const safeClasses = String(className)
    .split(/\s+/)
    .filter((token) => /^[a-zA-Z0-9_-]+$/.test(token))
    .join(' ');
  const summaryMarkup = summary || `
    <span>${escapeDisclosureHtml(title)}</span>
    ${meta ? `<small>${escapeDisclosureHtml(meta)}</small>` : ''}
  `;
  const isDesktop = responsiveOnly && window.matchMedia && !window.matchMedia('(max-width: 800px)').matches;
  const open = isDesktop || isHrDisclosureOpen(key, defaultOpen);

  return `
    <details class="hr-disclosure${safeClasses ? ` ${safeClasses}` : ''}" data-hr-disclosure="${safeKey}"${responsiveOnly ? ' data-hr-disclosure-responsive="true"' : ''}${open ? ' open' : ''}>
      <summary class="hr-disclosure__summary">${summaryMarkup}</summary>
      ${body}
    </details>
  `;
}

if (!window.__hrDisclosurePersistenceBound) {
  document.addEventListener('toggle', (event) => {
    const disclosure = event.target.closest?.('[data-hr-disclosure]');
    if (!disclosure || event.target !== disclosure) return;

    if (disclosure.dataset.hrDisclosureResponsive === 'true'
      && window.matchMedia && !window.matchMedia('(max-width: 800px)').matches
      && !disclosure.open) {
      disclosure.open = true;
      return;
    }

    try {
      window.localStorage.setItem(storageKey(disclosure.dataset.hrDisclosure), String(disclosure.open));
    } catch {
      // Disclosure behavior remains available when storage is blocked.
    }
  }, true);

  window.__hrDisclosurePersistenceBound = true;
}
