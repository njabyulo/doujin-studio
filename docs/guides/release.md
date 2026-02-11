# Release Guide

# Release Guide

Release runbook for `apps/api` (Cloudflare Worker) and `apps/web` (OpenNext on Cloudflare).

## Topology and route ownership

- API worker: `doujin-api`
  - Route: `doujin.njabulomajozi.com/api/*`
  - D1 binding: `DB`
- Web worker: `doujin-web`
  - Route: `doujin.njabulomajozi.com/*`

Goal: `/api/*` must always resolve to `doujin-api`.

## Config and secrets

### API (`apps/api/wrangler.toml`)

Non-secret vars:

- `APP_ENV`
- `CORS_ORIGIN`
- `GIT_SHA`
- `AI_INTERPRET_MODEL` (example: `gemini-3-flash-preview`)

Secrets:

- `AUTH_SECRET`
- `GEMINI_API_KEY` (required by `POST /api/editor/interpret`; returns `AI_UNAVAILABLE` when missing)

### Web (`apps/web/wrangler.jsonc` + env)

- Worker config: `apps/web/wrangler.jsonc`
- Runtime env:
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_APP_URL`

## 1. Pre-release checks

From repo root:

```bash
pnpm install
pnpm lint:type
pnpm lint:code
pnpm test
pnpm --filter web run build
```

## 2. Database migrations

If there are new migrations:

```bash
pnpm db:migrate:remote
```

## 3. Deploy order

### 3.1 Deploy API

Verify required secrets before deploy:

```bash
pnpm --filter api exec wrangler secret list --env production
pnpm --filter api exec wrangler secret put GEMINI_API_KEY --env production
```

Deploy:

```bash
pnpm --filter api run deploy
```

### 3.2 Verify API

```bash
curl -i https://doujin.njabulomajozi.com/api/health
curl -i https://doujin.njabulomajozi.com/api/version
```

Notes:

- The API worker only serves `/api/*`. Root routes (for example `https://doujin.njabulomajozi.com/health`) are expected to return `404`.

### 3.3 Deploy Web

```bash
NEXT_PUBLIC_API_BASE_URL=https://doujin.njabulomajozi.com \
NEXT_PUBLIC_APP_URL=https://doujin.njabulomajozi.com \
pnpm --filter web run deploy
```

## 4. Post-deploy smoke

- Open `https://doujin.njabulomajozi.com/`
- Create/sign-in
- Create a project
- Upload a clip and confirm local preview works
- Use playback assistant to seek/pause/resume

## Rollback

### API rollback

```bash
pnpm --filter api exec wrangler deployments list --env production
pnpm --filter api exec wrangler rollback <api_deployment_id> --env production --yes -m "rollback api"
```

### Web rollback

```bash
pnpm --filter web exec wrangler deployments list
pnpm --filter web exec wrangler rollback <web_deployment_id> --yes -m "rollback web"
```

Post-rollback verification:

```bash
curl -i https://doujin.njabulomajozi.com/
curl -i https://doujin.njabulomajozi.com/api/health
```

## Troubleshooting

### Route conflicts (`/api/*` serving web)

- Re-deploy API and re-verify `/api/health` before touching web.
- Confirm Cloudflare route configuration still points `/api/*` to `doujin-api`.

### Auth failures (`401`)

- Verify `AUTH_SECRET` consistency and session cookie behavior.
- Confirm `CORS_ORIGIN` matches the web origin for that environment.

### Playback assistant failures (`/api/editor/interpret`)

- Verify `GEMINI_API_KEY` is configured for the API worker.
- Verify `AI_INTERPRET_MODEL` is a valid model id for the Google AI Studio API.

## Evidence template

Record:

- Date/time (UTC)
- Operator
- Commit SHA
- `db:migrate:remote` result (if run)
- API deploy ID
- Web deploy ID
- `/api/health` status
- `/api/version` status
- E2E smoke result
