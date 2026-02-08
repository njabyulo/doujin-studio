# Cloudflare Operations Runbook (Dev + Production)

This runbook is the standard operating procedure for Cloudflare workflows in this monorepo.
It applies to `apps/api` and `apps/web` only.

## 1) Document control

- Runbook owner: platform/application team
- Scope: deploy, verify, and rollback for `doujin-api` and `doujin-web`
- Last verified: February 8, 2026
- Production domain: `https://doujin.njabulomajozi.com`
- API route: `doujin.njabulomajozi.com/api/*`
- Out of scope: `apps/video`

## 2) Service topology

- Web worker: `doujin-web`
  - Route: `doujin.njabulomajozi.com/*`
- API worker: `doujin-api`
  - Route: `doujin.njabulomajozi.com/api/*`
- API runtime bindings:
  - `DB` (D1 database: `doujin`)
  - `MEDIA_BUCKET` (R2 bucket: `doujin-media`)

## 3) Source of truth

- Root scripts: `/Users/njabulo/Documents/development/playground/i/media/package.json`
- Turbo graph: `/Users/njabulo/Documents/development/playground/i/media/turbo.json`
- API worker config: `/Users/njabulo/Documents/development/playground/i/media/apps/api/wrangler.toml`
- Web worker config: `/Users/njabulo/Documents/development/playground/i/media/apps/web/wrangler.jsonc`
- Web Next config: `/Users/njabulo/Documents/development/playground/i/media/apps/web/next.config.ts`
- DB scripts: `/Users/njabulo/Documents/development/playground/i/media/packages/database/package.json`
- DB migrations: `/Users/njabulo/Documents/development/playground/i/media/packages/database/src/migrations`

## 4) Secrets and config policy

API secrets:

- `AUTH_SECRET`
- `GEMINI_API_KEY`

Web secrets:

- `GOOGLE_GENERATIVE_AI_API_KEY`

Policy:

- Keep non-sensitive values in Wrangler config (`[vars]` / JSONC fields).
- Keep sensitive values in `.dev.vars` (local) and Cloudflare secrets (production).

## 5) Command contract

Root scripts:

- `pnpm dev`: local-safe dev for `api` + `web`
- `pnpm dev:all`: run all workspace dev tasks
- `pnpm db:migrate`: local D1 migration only
- `pnpm db:migrate:remote`: remote D1 migration (explicit)
- `pnpm run deploy`: convenience deploy for both workers (not preferred for controlled releases)

Preferred production commands:

- `pnpm --filter api run deploy`
- `pnpm --filter web run deploy`

Why preferred:

- Root `pnpm run deploy` uses Turbo with `--continue=always`, so one service can fail while another succeeds.

## 6) Entry criteria (go/no-go)

Release is **GO** only if all checks below pass.

```bash
cd /Users/njabulo/Documents/development/playground/i/media

# 1) Wrangler auth
pnpm --filter api exec wrangler whoami

# 2) Account capability checks
pnpm --filter api exec wrangler r2 bucket list
pnpm --filter @doujin/database exec wrangler d1 info doujin --config ../../apps/api/wrangler.toml

# 3) Secret presence checks
pnpm --filter api exec wrangler secret list --env production --format pretty
pnpm --filter web exec wrangler secret list --format pretty

# 4) Local quality gates
pnpm lint
pnpm test
pnpm build
```

If any check fails: **NO-GO**. Fix first, then restart entry checks.

## 7) Local development SOP (safe default)

```bash
cd /Users/njabulo/Documents/development/playground/i/media
cp apps/api/.dev.vars.example apps/api/.dev.vars
# fill AUTH_SECRET and GEMINI_API_KEY in apps/api/.dev.vars

pnpm db:migrate
pnpm dev
```

Expected:

- No remote Cloudflare infra is used by default.
- Local binding state persists in `.wrangler/state`.

Health checks:

```bash
curl -s http://127.0.0.1:8787/health
curl -s http://127.0.0.1:8787/api/health
```

Expected response body for both:

```json
{ "ok": true }
```

## 8) Production release SOP (standard change)

Use this exact sequence.

```bash
cd /Users/njabulo/Documents/development/playground/i/media
```

1. Apply remote schema migrations (intentional).

```bash
pnpm db:migrate:remote
```

2. Deploy API first.

```bash
pnpm --filter api run deploy
```

3. API verification gate (must pass before web deploy).

```bash
curl -sS -i https://doujin.njabulomajozi.com/api/health
curl -sS -i https://doujin.njabulomajozi.com/api/version
```

Expected:

- `200` for both
- `x-request-id` header present
- `/api/health` body is `{ "ok": true }`

4. Deploy web.

```bash
pnpm --filter web run deploy
```

5. End-to-end verification gate.

```bash
curl -sS -i https://doujin.njabulomajozi.com/
curl -sS -i https://doujin.njabulomajozi.com/api/health
```

Expected:

- `/` returns `200`
- `/api/health` still returns API `200` response (not Next.js HTML 404)

## 9) Rollback SOP

Rollback target: last known good version for each worker.

API rollback:

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter api exec wrangler deployments list --env production
pnpm --filter api exec wrangler rollback <api_version_id> --env production --yes -m "rollback api"
```

Web rollback:

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter web exec wrangler deployments list
pnpm --filter web exec wrangler rollback <web_version_id> --yes -m "rollback web"
```

Post-rollback checks:

```bash
curl -sS -i https://doujin.njabulomajozi.com/
curl -sS -i https://doujin.njabulomajozi.com/api/health
```

## 10) Failure handling and troubleshooting

### A) R2 not enabled (`code: 10042`)

Symptom:

- API deploy fails with `Please enable R2 through the Cloudflare Dashboard. [code: 10042]`.

Impact:

- API deployment fails.
- If web deploy succeeds separately, `/api/*` can return Next.js 404 from `doujin-web`.

Resolution:

1. Enable R2 in Cloudflare dashboard for the account.
2. Ensure bucket exists:

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter api exec wrangler r2 bucket list
pnpm --filter api exec wrangler r2 bucket create doujin-media
```

3. Re-run section 8 from step 2.

### B) `/api/health` returns Next.js 404 HTML

Symptom:

- `https://doujin.njabulomajozi.com/api/health` returns HTML and `x-opennext` header.

Cause:

- API route is currently being served by `doujin-web` (API worker not active on route).

Resolution:

- Deploy/rollback API worker and re-run API verification gate before any web action.

### C) Missing secret failures

Set secrets:

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter api exec wrangler secret put AUTH_SECRET
pnpm --filter api exec wrangler secret put GEMINI_API_KEY
pnpm --filter web exec wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
```

## 11) Release evidence template

Record this for each production release:

- Date/time (UTC):
- Operator:
- Git commit SHA:
- D1 migration command + output summary:
- API deploy version ID:
- Web deploy version ID:
- API verification (`/api/health`, `/api/version`):
- Final verification (`/`, `/api/health`):
- Rollback needed? (yes/no):

## 12) Operational notes

- Prefer section 8 sequence over root convenience deploy.
- Use local-first commands for development (`pnpm dev`, `pnpm db:migrate`).
- Use explicit remote commands only when intentionally changing production state.
