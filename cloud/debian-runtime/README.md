# Cloud Debian runtime (production)

This directory contains the production Debian Cloud API and its single SQLite worker. Cloud web, portal file operations, and the Windows backup client use this backend; Supabase Auth remains for initial sign-in and session exchange. The API stays bound to `127.0.0.1` behind the existing Cloudflare Tunnel proxy.

## Requirements and configuration

- Node.js 20 or newer; install this directory's dependencies independently with `npm ci`.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` should be stored in a restricted environment file readable only by the service account and root and are used only by `POST /auth/exchange` to verify a new Hidden Room session and cache that user's operational `public.users.user_id`, roles, and Cloud permissions locally.
- Exchange returns a random opaque Cloud session. Later Cloud requests validate its SHA-256 hash and cached local permission record in SQLite; they do not call Supabase. The session expires after `CLOUD_LOCAL_SESSION_TTL_MS` (default 8 hours). New exchanges require Supabase.
- `CLOUD_SQLITE_PATH`, `CLOUD_LOCAL_STAGING_ROOT`, and `CLOUD_HIDDENROOM_ROOT` must be on volumes with monitored free space. SQLite uses WAL and `synchronous=FULL`.
- Optional controls: `CLOUD_LOCAL_API_HOST` (default loopback), `CLOUD_LOCAL_API_PORT` (8090), `CLOUD_LOCAL_MAX_UPLOAD_BYTES` (50 GiB), `CLOUD_LOCAL_MIN_FREE_BYTES` (2 GiB), `CLOUD_LOCAL_ALLOWED_ORIGINS` (comma-separated exact origins).

## Local API endpoints

- GET /health
- POST /auth/exchange with a valid Supabase bearer token
- POST /api/transfers starts or resumes an idempotent transfer. HEAD /api/transfers/{id} returns its durable offset. PATCH /api/transfers/{id} appends one chunk (5 MiB default, configurable up to 16 MiB). The API persists an offset only after the chunk is fsynced and verifies the complete SHA-256 before queueing the backup job.
- PUT /api/backups?path=... remains available for single-request compatibility.
- GET /api/jobs and GET /api/jobs/{id} return only the caller's jobs.
- GET /api/tombstones returns the caller's business_user_id and markers so the Windows client can recover its operational route identity after restart; confirmed DELETE /api/tombstones?path=... manages manual-delete blocks.
- GET /api/count?path=... counts files below the caller's own user root.
- GET /api/files?path=... lists a Cloud directory. Admin sessions may browse Cloud; `academia.admin` is restricted to `/academia`.
- GET /api/files/download?path=... streams one regular file with an attachment disposition.
- POST /api/files/upload?path=...&name=... accepts a raw body with `Content-Length` and `X-Content-Sha256`, verifies it in a same-directory temporary file, then atomically renames it into place.
- POST /api/folders creates a directory without replacing an existing one.
- DELETE /api/files/item?path=...&type=file|folder&name=...&confirm=yes requires admin and explicit confirmation. It moves the item into `.cloud-runtime-trash`, records metadata in SQLite, and creates local tombstones for paths under `users/{user_id}__{slug}`.
- GET /api/trash lists eligible recoverable items; POST /api/trash/restore with `{id}` restores to the original path and removes its tombstone. DELETE /api/trash/item?id=...&confirm=yes permanently removes an item.
- GET /api/metrics returns retained local metrics to admins.

The portal loads `portal/cloud-runtime-config.js` with `https://cloud.hiddenroom.mx/local-api`; the public Cloud app uses its own `cloud/public/cloud-runtime-config.js`, and the Windows client defaults to the same Debian endpoint. The web proxy accepts an explicit allowlist of methods and routes to loopback only. Existing `.trash` manifests remain separate from `.cloud-runtime-trash`; do not point both implementations at the same trash directory. Commerce, producer approval, and entitlement checks still depend on Hidden Room/Supabase. The worker currently executes `backup_upload` jobs only because the existing Cloud queue contract has no restore job. File restoration is provided by the explicit local trash API, not by a background restore queue.
## Windows client

The Windows client defaults to https://cloud.hiddenroom.mx/local-api. Its local server proxies resumable 5 MiB chunks directly to Debian and stores the opaque Cloud token with Windows DPAPI. It uses Supabase Auth only to sign in or renew an expired session; file uploads, job status, tombstones, and counts use Debian. The local UI origin http://127.0.0.1:<port> is allowed because its port can vary.

The Debian API remains bound to loopback and must not be exposed publicly. Cloudflare Tunnel continues to reach the web app, which proxies the allowlisted `/local-api/*` routes to `127.0.0.1:8090`. The portal and public Cloud app are switched to Debian; keep Supabase fallback code and historical tables intact during the rollback observation period.
## Durable backup

Run `src/backup-db.js` with `CLOUD_SQLITE_PATH` and `CLOUD_SQLITE_BACKUP_DIR`. It refuses to write to the same device as the database by default, makes an online SQLite backup, and runs `quick_check` before publishing the snapshot. If no second device is available and the operator accepts that the snapshot will also be lost if Debian's disk fails, set `CLOUD_SQLITE_BACKUP_ALLOW_SAME_DEVICE=true`; the command prints a warning. The test suite reopens a snapshot as a restored database and checks integrity. Copy `CLOUD_HIDDENROOM_ROOT/.cloud-runtime-trash` alongside the SQLite snapshot because trash payloads are files, while their metadata and tombstones are in SQLite. A systemd timer should be enabled only after an independently mounted destination is selected and restore testing succeeds. This script intentionally does not delete older backups.

The tombstone-only transition utility is src/import-tombstones.js. It validates an exported version-1 JSON manifest in dry-run mode by default; pass --apply only after reviewing the count and errors. src/export-tombstones.js exports the SQLite state for rollback reconciliation and refuses to overwrite an existing file. See docs/cloud-debian-migration-release.md for the staged rollout and rollback procedure.

## Migration guardrails

Production Cloud traffic now reaches Debian through the allowlisted proxy while the API itself remains bound to loopback. Preserve the existing Supabase tables and staging objects through the rollback window. Never use Supabase Auth UUID as a filesystem route; use the `public.users.user_id` operational ID.
