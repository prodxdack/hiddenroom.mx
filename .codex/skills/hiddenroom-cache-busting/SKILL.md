---
name: hiddenroom-cache-busting
description: Hidden Room cache-busting workflow for GitHub Pages static assets. Use when changing published JS or CSS files referenced with ?v= query strings, when Safari/iPhone keeps stale dashboard behavior, or before pushing frontend/dashboard/site changes that must be visible immediately.
---

# Hidden Room Cache Busting

## Workflow

1. Identify changed published assets:
   - Dashboard: `portal/dashboard.js`, `portal/dashboard.css`, shared `../site.js`, `../styles.css` referenced from `portal/dashboard.html`.
   - Root site: `site.js`, `styles.css` referenced from `index.html`.
   - Module pages may have their own HTML entry points; search with `rg -n "\\?v="`.
2. If a referenced JS or CSS asset changed and the user expects it to update in production, update the matching `?v=` query string in the HTML that loads it.
3. Use a descriptive monotonic value: `YYYYMMDD-short-feature`, for example `20260720-user-picker-services`.
4. Keep the query string scoped to assets that actually changed. Do not churn unrelated `?v=` values.
5. Validate changed HTML/JS:
   - Run `node --check portal/dashboard.js` when dashboard JS changed.
   - Run `git diff --check -- <changed files>`.
   - When the modal coordinator or prompt flow changes, bump the query string for `site.js`, the route module, and any shared legal-service module that changed.
6. Mention cache impact in the final response. For iPhone Safari, recommend closing/reopening Safari or using a private tab if CDN/browser cache still lingers briefly.

## Current Entry Points

- `portal/dashboard.html` loads:
  - `../styles.css?v=...`
  - `dashboard.css?v=...`
  - `../site.js?v=...`
  - `dashboard.js?v=...`
- `index.html` loads:
  - `./styles.css?v=...`
  - `./site.js?v=...`

## Guardrails

- Do not add timestamps automatically to every asset on every task; update only affected assets.
- Do not remove cache-busters. GitHub Pages and Safari need explicit query changes for reliable refresh.
- Preserve existing relative paths and script attributes such as `defer` and `type="module"`.
