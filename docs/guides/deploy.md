# Deploy Guide

Deploy runbook for `apps/api` (Cloudflare Worker) and `apps/web` (OpenNext on Cloudflare).

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
- `AI_INTERPRET_MODEL` (e.g. `gemini-3-flash-preview`)

Secrets:

- `AUTH_SECRET`
- `GEMINI_API_KEY` (used by `POST /api/editor/interpret`)

### Web (`apps/web/wrangler.jsonc` + env)

- Worker config in `apps/web/wrangler.jsonc`
- Runtime env must include:
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_APP_URL`

## Pre-deploy checks

From repo root:

```bash
pnpm lint:type
pnpm lint:code
pnpm test
pnpm --filter web run build
```

## Deploy sequence

1. Apply remote DB migrations (if needed):

```bash
pnpm db:migrate:remote
```

2. Deploy API:

```bash
pnpm --filter api run deploy
```

3. Verify API:

```bash
curl -i https://doujin.njabulomajozi.com/api/health
curl -i https://doujin.njabulomajozi.com/api/version
```

Notes:

- Root routes (for example `https://doujin.njabulomajozi.com/health`) are expected to be `404`.

4. Deploy Web:

```bash
NEXT_PUBLIC_API_BASE_URL=https://doujin.njabulomajozi.com \
NEXT_PUBLIC_APP_URL=https://doujin.njabulomajozi.com \
pnpm --filter web run deploy
```

5. Verify end-to-end:

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
