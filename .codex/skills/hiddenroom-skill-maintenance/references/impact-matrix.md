# Skill Impact Matrix

Use this matrix to choose the smallest correct set of Skills to update.

## Frontend and Routes

Changed files:

- `index.html`, `site.js`, root page assets.
- `media/*.html`, `media/*.js`.
- `store/*.html`, `store/*.js`.
- `tickets/*.html`, `tickets/*.js`.
- `kairen/*.html`, `kairen/*.js`.
- `minijuegos/**`.

Update:

- `hiddenroom-frontend`
- `hiddenroom-testing`
- `hiddenroom-performance` when loading/runtime behavior changes.
- `hiddenroom-documentation` when routes or setup steps change.

## Shared Modal and Overlay Coordination

Changed files:

- `site.js` shared modal/session coordination.
- `assets/js/legal-service.js` legal consent dialogs.
- `portal/dashboard.js` onboarding/profile gates.
- Route modules that open invitations, confirmations, or blocking dialogs.

Update:

- `hiddenroom-frontend` and its modal-coordination reference.
- `hiddenroom-dashboard` when Portal gates or dashboard prompts are affected.
- `hiddenroom-design-system` for overlay, focus, scroll-lock, or responsive dialog behavior.
- `hiddenroom-testing` for no-overlap, queue order, cancellation, logout, and SPA teardown checks.
- `hiddenroom-cache-busting` when published JS or CSS references change.

## Design System

Changed files:

- `styles.css`
- `portal/dashboard.css`
- module CSS bridges.
- design tokens, `hr-*` primitives, layout conventions.

Update:

- `hiddenroom-design-system`
- `hiddenroom-frontend` if markup conventions changed.
- `hiddenroom-testing` if visual QA routes or breakpoints changed.

## Dashboard and ERP

Changed files:

- `portal/dashboard.js`
- `portal/dashboard.html`
- `portal/dashboard.css`
- ERP migrations, finance tables, membership/session/task logic.

Update:

- `hiddenroom-dashboard`
- `hiddenroom-erp`
- `hiddenroom-memberships` when membership contracts, weeks, balances, deliveries, or client/admin parity changes.
- `hiddenroom-supabase` for schema/RLS changes.
- `hiddenroom-security` for role/permission changes.
- `hiddenroom-testing` for role QA changes.

## Supabase and Edge Functions

Changed files:

- `supabase/migrations/**`
- `supabase/functions/**`
- `supabase/config.toml`
- generated type files.
- `supabase/db-*.txt` snapshots.

Update:

- `hiddenroom-supabase`
- `hiddenroom-security`
- `hiddenroom-testing`
- `hiddenroom-documentation` if deploy/secrets/setup steps changed.
- `hiddenroom-erp`, `hiddenroom-cloud-agent`, or module Skills when the affected domain is specific.


## Debian Server

Changed facts or files:

- Tailscale SSH target, Debian hostname, or production user.
- Cloudflare Tunnel/cloudflared routing for `cloud.hiddenroom.mx`.
- Docker File Browser fallback, ports, volumes, or root path.
- `mysauth-cloud-agent.service`, live agent path, env loading, or systemd behavior.
- Production service diagnostics, ports, logs, or safe command lists.

Update:

- `hiddenroom-debian-server`
- `hiddenroom-cloud-agent` when cloud file processing changes.
- `hiddenroom-security` when exposure, secrets, routing, or path boundaries change.
- `hiddenroom-documentation` when runbooks or install docs must mirror production facts.
- `hiddenroom-testing` when remote smoke checks or service-health QA changes.

## Local Workstation

Changed facts or files:

- Windows, PowerShell, PATH, Git safe.directory, Node, npm, Python, Docker Desktop, WSL 2, Supabase CLI, Playwright, or Tailscale client setup.
- `package.json` or `package-lock.json` dependency changes that affect local development tooling.
- New local validation commands, install procedures, or repeated setup failures.

Update:

- `hiddenroom-workstation`
- `hiddenroom-testing` when validation commands change.
- `hiddenroom-documentation` when user-facing setup docs need to mirror the workstation flow.
- `hiddenroom-debian-server` only when Tailscale/server access facts or production procedures change.
## Cloud Agent

Changed files:

- `mysauth-cloud-agent.js`
- `mysauth-cloud-agent.service`
- `supabase/functions/cloud-*`
- cloud migrations, staging bucket policies.
- `docs/cloud-agent-installation.md`.

Update:

- `hiddenroom-cloud-agent`
- `hiddenroom-security`
- `hiddenroom-supabase`
- `hiddenroom-documentation`
- `hiddenroom-testing`

## Store, Payments, Media, Tickets, Kairen

Update module Skills based on the layer touched:

- Store/payments: `hiddenroom-frontend`, `hiddenroom-supabase`, `hiddenroom-security`, `hiddenroom-testing`, `hiddenroom-documentation`. Preserve the product-specific provider distinction: Beat Store uses Mercado Pago; other products may use Stripe.
- Media CMS: `hiddenroom-frontend`, `hiddenroom-dashboard` only if portal integration changes, `hiddenroom-security`, `hiddenroom-testing`.
- Tickets: `hiddenroom-frontend`, `hiddenroom-supabase`, `hiddenroom-security`, `hiddenroom-testing`.
- Kairen: `hiddenroom-frontend`, `hiddenroom-supabase`, `hiddenroom-security`, `hiddenroom-testing`.

## Validation and Metadata

Always update `agents/openai.yaml` when:

- The Skill name changes.
- The scope or trigger wording materially changes.
- The default prompt no longer describes the Skill.

Always run `quick_validate.py` after edits.

## Cross-Cutting Semantic Changes

Architecture, payment-provider, permission/security-boundary, or production-topology changes also update:

- `hiddenroom-mysauth-core` for shared project context and routing.
- Every affected area Skill and reference identified above.
- `agents/openai.yaml` only where its prompt or scope became materially inaccurate.

After structural validation, search affected Skills for stale terminology and contradictory claims. Treat `quick_validate.py` as a structure check, not semantic proof.

