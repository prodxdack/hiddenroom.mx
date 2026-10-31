---
name: hiddenroom-frontend
description: Hidden Room frontend engineering for the static GitHub Pages app. Use when changing HTML, vanilla JavaScript modules, shared navigation/chrome, browser Supabase clients, route-level behavior, or module pages in /, /media, /store, /tickets, /kairen, /portal, and /minijuegos.
---

# Hidden Room Frontend

## Workflow

1. Map the target page from its folder and body attributes before editing.
2. Preserve the static architecture: no build step, no framework, ES modules from CDN where already used. Progressive client-side navigation is allowed when it preserves direct GitHub Pages URLs and traditional fallback.
3. Use `site.js` for global chrome/session/navigation behavior and module files for feature logic.
4. Keep Supabase anon-key access in browser code limited to user-scoped or public operations protected by RLS.
5. Prefer DOM delegation and explicit `data-*` hooks over brittle text selectors.
6. Validate changed JavaScript with `node --check <file>`.
7. Serve the repo with a static server and inspect the affected route after user-facing UI changes.

## Modal coordination

All blocking modals must use the shared `window.HiddenRoomModalQueue` and return a Promise for their complete lifecycle. Do not add route-specific queues or stack modals with z-indexes. Follow `references/modal-coordination.md`; profile/onboarding gates must finish before invitations, legal consent, or informational prompts.

## Architecture

- Root marketing site: `index.html`, `site.js`, `styles.css`.
- Global chrome: body uses `data-hr-chrome` and `data-hr-context`; `site.js` renders nav, drawer, session affordances, version/status.
- Portal auth/dashboard: `portal/login.js`, `portal/recovery.js`, `portal/dashboard.js`.
- Store: `store/store.js`, `store/admin.js`, and product-specific payment functions. Beat Store uses Mercado Pago; other products may use Stripe.
- Media: `media/config.js`, `media/media.js`, `media/admin.js`, `media/post.js`.
- Tickets: `tickets/tickets.js`, `tickets/validate.js`, `tickets/view.js`.
- Kairen: `kairen/kairen.js`, Edge Function `supabase/functions/kairen-gemini`.
- Minigames: isolated HTML/CSS/JS under `minijuegos/*`.

## Conventions

- Keep files route-local unless behavior is truly shared across modules.
- Keep generated HTML escaped with local helpers such as `escapeHtml`, `escapeHTML`, or equivalent.
- Keep redirects safe; reuse `hr_return_after_login` only for allow-listed local destinations.
- Keep browser state keys namespaced with `hr_` or module-specific prefixes.
- Keep Spanish user-facing copy consistent with existing module tone.

## References

Read `references/frontend-map.md` when the task spans multiple modules or touches shared navigation/session behavior.
Read `references/modal-coordination.md` when adding or changing any modal, onboarding gate, legal consent prompt, invitation, drawer-like dialog, or SPA route teardown.
