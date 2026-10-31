# Testing Matrix

## Frontend Syntax

Run `node --check` for every changed `.js` file. Edge Function TypeScript may need Supabase/Deno tooling; at minimum inspect syntax and imports.

## Responsive Visual QA

Check about:

- 390px mobile.
- 768px tablet.
- 1440px desktop.

Look for overflow, overlapping nav, broken drawers, clipped buttons, unreadable tables, and ticket print regressions.

## Auth Roles

- Guest: home, media public, store catalog/cart, login/register.
- Authenticated client: dashboard client views, store orders, scores/downloads scoped to self.
- Collaborator/partner: allowed ERP or scrum views only.
- Admin: media CMS, store admin, tickets admin, dashboard admin tables, cloud file manager.

## Automated Supabase Authorization

- Start Supabase Local and seed synthetic identities for `anon`, client A, client B, collaborator, and admin.
- Assert table privileges and sensitive column privileges separately from RLS.
- For each scoped table, test the permitted owner case and client A attempting client B's `SELECT`, `INSERT`, `UPDATE`, and `DELETE` paths as applicable.
- Test exposed views as the calling role and require `security_invoker` or no client grant.
- Test RPC grants, confirm privileged functions are not executable by `PUBLIC`, and exercise internal authorization for any `SECURITY DEFINER` function.
- Invoke Edge Functions locally for unauthenticated, unauthorized, cross-user, and authorized cases, especially before service-role access.
- Keep fixtures synthetic and deterministic; do not point automated tests at project `rpcunbkstadgngqrjafp`.

## Module Flows

- Store: catalog filter/search, product detail, cart quantity, checkout function, success page, orders page.
- Media: public list, post detail, admin auth gate, create/edit draft, cover upload.
- Tickets: event list, generation, folio ranges, QR validation, print/download.
- Portal: login/register/recovery, section navigation, notifications, profile, membership and ERP tables.
- Portal modal sequence: onboarding (if required) → Instagram → WhatsApp/celular → legal consent or invitation; test cancellation, logout, SPA teardown, and a second pending invitation without overlap.
- Memberships: no `anon` access to `membership_dashboard`, self-only client access, global admin access, cross-client denial, historical-data preservation, and parity between Cliente > Membresías and ERP > BB.DD. > Membresía.
- Payments: provider-specific checkout/webhook tests; Beat Store uses Mercado Pago, while other products may use Stripe. Preserve order and fulfillment behavior.
- Downloads and exclusive licenses: owner-only access, denied cross-client access, release/entitlement rules, exclusive-license uniqueness, and admin management paths.
- Cloud: list, upload via staging, create folder, delete file/folder, pending job handling, and remote service health when approved.
- Debian Cloud routing: if testing production, use `hiddenroom-debian-server` to verify `cloudflared`, Docker `filebrowser`, `mysauth-cloud-agent`, ports, and route probes without exposing secrets.
- MysAuth Cloud app: `node --check cloud/server.js`, `node --check cloud/public/cloud.js`, `/health` returns 200, `/api/files` returns 401 without token, File Browser fallback returns 200 on `127.0.0.1:8081`.
- Kairen: UI loads and Edge Function error states are handled.

## Remote Dependencies

Provider sandboxes and authenticated integrations may require credentials. Keep secrets out of output and state clearly what was not exercised; never replace local authorization tests with production writes.

