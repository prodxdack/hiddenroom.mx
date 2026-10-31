---
name: hiddenroom-testing
description: Hidden Room testing and validation skill for JavaScript syntax checks, static route smoke tests, responsive UI review, Supabase auth/RLS flows, Store checkout, Media CMS, Tickets generation/validation/print, Portal dashboard roles, Kairen, cloud agent flows, and regression checklists. Use when verifying changes or adding QA procedures.
---

# Hidden Room Testing

## Workflow

1. Run targeted syntax checks for changed JavaScript.
2. Serve the repo with a static local server for browser checks.
3. Smoke-test affected routes and shared chrome.
4. For any blocking modal change, verify only one dialog/overlay is active at a time and the next queued dialog opens only after the previous one resolves or is cancelled.
5. Run Supabase authorization tests only against Supabase Local with synthetic fixtures; never use production data for test setup or mutation.
6. Exercise `anon`, client A, client B, collaborator, and admin. Verify both allowed and denied paths, including client A attempting to read or change client B's data.
7. Automate RLS and privilege assertions for tables, column grants, `security_invoker` views, RPC execution grants, and ownership predicates.
8. Test Edge Functions locally, including missing/invalid JWTs, insufficient privilege, cross-user identifiers, and approved callers; privileged functions must authorize before service-role work.
9. Document any untested credential-dependent step without substituting production for local validation.

## Quick Commands

```powershell
node --check site.js
node --check portal/dashboard.js
node --check media/admin.js
node --check kairen/kairen.js
node --check store/store.js
node --check tickets/tickets.js
python -m http.server 4175 --bind 127.0.0.1
npx.cmd supabase status
npx.cmd supabase test db --local
```

Use the repository's SQL/pgTAP or equivalent local harness when present. Tests must use synthetic users and data and must leave business fixtures reproducible.

## Route Smoke List

- `/`
- `/media/`
- `/media/admin.html`
- `/kairen/`
- `/store/`
- `/tickets/`
- `/portal/`
- `/portal/dashboard.html`

## References

Read `references/testing-matrix.md` for module-specific manual QA.
