---
name: hiddenroom-dashboard
description: Hidden Room Portal dashboard skill for the vanilla SPA in portal/dashboard.js and dashboard.html. Use when changing role-gated navigation, dashboard sections, admin tables, notifications, toasts, user/profile flows, ERP views, memberships, cloud file manager UI, or dashboard Supabase queries.
---

# Hidden Room Dashboard

## Workflow

1. Read the relevant section in `portal/dashboard.js`; it is organized as a single controller with numbered sections.
2. Preserve the global `state` object as the source of truth for loaded data and active UI state.
3. Keep navigation permission gates cumulative and role-aware.
4. Add new views through existing render/bind/load patterns instead of introducing a second router.
5. Preserve IDs, `data-*` hooks, table column names, and Supabase field names unless a migration updates them.
6. Validate with `node --check portal/dashboard.js` and inspect `/portal/dashboard.html`.
7. When adding a blocking dashboard modal, enqueue it through `window.HiddenRoomModalQueue`; wait for Portal onboarding and profile-completeness prompts before invitations, legal consent, or feature dialogs.

## Architecture

`portal/dashboard.js` is a lightweight SPA over a static HTML shell:

- Supabase session bootstrap.
- Role-composable sidebar gating.
- Client-side section router.
- Per-section render functions.
- Notification/toast system.
- Dashboard preferences in local storage.
- ERP finance, memberships, tasks, cloud manager, profile, scores, and admin data views.

## Permissions

Keep existing `users.roles` and `user_permissions` reads for UI compatibility, but never treat sidebar visibility or `users.roles` alone as secure authorization. Sensitive queries and mutations require enforcement from protected database grants/RLS or internally authorized Edge Functions. Until an approved migration protects the role source, do not expand trust in client-mutable role columns.

## References

Read `references/dashboard-sections.md` before changing section routing, permission gates, or ERP views.
Read `../hiddenroom-frontend/references/modal-coordination.md` before adding or changing dashboard onboarding, profile, legal, invitation, or confirmation modals.
