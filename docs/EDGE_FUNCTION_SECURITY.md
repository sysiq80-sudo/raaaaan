# Edge Function Security Status

Updated: 2026-05-28

This document records the current security posture verified from local Edge Function code, deployed Supabase functions, and remote migration state.

## Production secrets

Required Edge Function secrets exist:

- `ALLOWED_ORIGINS`
- `INTERNAL_EDGE_SECRET`

Known provider secrets present:

- `INFOBIP_API_KEY`
- `INFOBIP_BASE_URL`
- `INFOBIP_SENDER`
- `TELEGRAM_BOT_TOKEN`

Not currently present:

- `INFOBIP_WEBHOOK_SECRET`

## Internal-only functions

These functions reject unsigned requests with `403 FORBIDDEN_INTERNAL_ONLY` before service-role work:

- `process-scheduled-rides`
- `captain-guardian-alerts`
- `cleanup-stale-rides`
- `cleanup-stale-subscriptions`
- `cleanup-old-otps`
- `cron-cancel-stale-rides`
- **`detect-fraud-patterns`** _(added 2026-05-28)_

`process-scheduled-rides` also passes `x-internal-secret` when invoking `match-ride`.

## Database and cron callers

Migration `20270528001000_captain_guardian_internal_secret_callers.sql` updates Captain Guardian DB/cron callers to read `internal_edge_secret` from Supabase Vault and call `captain-guardian-alerts` with `x-internal-secret` instead of an anon JWT.

The migration is applied on the remote project.

## Browser-facing/admin functions

- `process-wallet-topup` validates the user JWT, checks `user_roles.role = admin`, then delegates approve/reject to the atomic database RPCs `approve_topup_request` and `reject_topup_request`.
- `detect-dual-stop` imports `getCorsHeaders` correctly and uses request-aware CORS.

## Webhooks

- `sms-webhook` now supports `INFOBIP_WEBHOOK_SECRET` or `SMS_WEBHOOK_SECRET` validation before creating the service-role Supabase client.
- Accepted webhook auth forms for `sms-webhook` when the secret is configured:
  - `x-infobip-webhook-secret: <secret>`
  - `x-webhook-secret: <secret>`
  - `Authorization: Bearer <secret>`
  - HMAC SHA-256 over the raw body via `x-infobip-signature` or `x-hub-signature-256`
- Because `INFOBIP_WEBHOOK_SECRET` is not currently configured in Supabase secrets, `sms-webhook` logs a warning and does not enforce provider validation yet. Configure the secret and the matching Infobip outbound webhook header/signature to make this fail-closed.

### admin-telegram-webhook _(temporarily disabled 2026-05-28)_

- **Current mode: disabled by code** — function returns `200 OK` immediately with no side effects.
- No DB updates, no wallet approval/rejection handling, and no outbound customer notifications run while disabled.
- `config.toml`: `verify_jwt = false` (kept for webhook compatibility while paused).
- Re-enable path (later): switch off the disable flag in code and restore secret-token enforcement.

## Verification performed

- `supabase db push` applied `20270528001000_captain_guardian_internal_secret_callers.sql`.
- `supabase migration list` shows `20270528001000` present locally and remotely.
- Deployed functions:
  - `detect-dual-stop`
  - `process-wallet-topup`
  - `process-scheduled-rides`
  - `captain-guardian-alerts`
  - `cleanup-stale-rides`
  - `cleanup-stale-subscriptions`
  - `cleanup-old-otps`
  - `cron-cancel-stale-rides`
  - `sms-webhook`
  - **`admin-telegram-webhook`** _(2026-05-28)_
  - **`detect-fraud-patterns`** _(2026-05-28)_
- Negative production HTTP tests returned `403 FORBIDDEN_INTERNAL_ONLY` for:
  - All internal functions without `x-internal-secret` header.
  - `detect-fraud-patterns` confirmed: `Status: 403, Body: {"success":false,"error":"FORBIDDEN_INTERNAL_ONLY"}`.
- `admin-telegram-webhook`: returns `200 OK` with no side effects (function paused).
- CORS smoke tests returned request-aware `Access-Control-Allow-Origin` for `http://localhost:5173`.

## Required user actions (blocking full enforcement)

### A — admin-telegram-webhook

No action required right now because the function is intentionally paused.
When business decides to re-enable Telegram admin flow, re-apply secret-token setup and webhook registration.

### B — detect-fraud-patterns cron caller

Ensure that any cron job or DB function that calls `detect-fraud-patterns` passes the `x-internal-secret` header:

```http
x-internal-secret: <value from Vault internal_edge_secret>
```

(Same pattern already used by `captain-guardian-alerts` callers — see migration `20270528001000`.)

### C — sms-webhook / Infobip

Set `INFOBIP_WEBHOOK_SECRET` in Supabase secrets and configure Infobip to send the matching `x-infobip-webhook-secret` header on outbound webhooks.

### D — Supabase Vault verification

Confirm `internal_edge_secret` exists: **Dashboard → Vault → Secrets → search `internal_edge_secret`**.
If missing, create it and redeploy all internal functions.

## Remaining work

- Review remaining active service-role functions not yet in this hardening batch, especially `captain-support-bot` and legacy bot/SMS functions.
- Continue gradual cleanup of static `corsHeaders` imports in functions after each function's response paths are reviewed.
- Optional (future): if Telegram admin workflow is needed again, remove pause flag and enforce `ADMIN_TELEGRAM_WEBHOOK_SECRET` in production.
