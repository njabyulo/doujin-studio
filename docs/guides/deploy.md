# Deploy Guide (Canonical)

This is the canonical deploy runbook for `apps/api` and `apps/web`.

## 1. Topology and route ownership

- API worker: `doujin-api`
  - Route: `doujin.njabulomajozi.com/api/*`
  - Bindings: `DB` (D1), `MEDIA_BUCKET` (R2)
- Web worker: `doujin-web`
  - Route: `doujin.njabulomajozi.com/*`

Goal: API route must always resolve to `doujin-api` after deploy.

## 2. Config and secret matrix

### API (`apps/api/wrangler.toml` + secrets)

Non-secret vars:

- `APP_ENV`
- `CORS_ORIGIN`
- `GIT_SHA`
- `MEDIA_BUCKET_NAME`
- `R2_ACCOUNT_ID`
- `R2_PRESIGN_TTL_SECONDS`

Secrets:

- `AUTH_SECRET`
- `GEMINI_API_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

### Web (`apps/web/wrangler.jsonc` + env)

- Worker config in `apps/web/wrangler.jsonc`
- local env (`apps/web/.env.local`) must include:
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_APP_URL`

## 3. Pre-deploy checks

From repo root:

```bash
pnpm --filter api exec wrangler whoami
pnpm --filter api exec wrangler r2 bucket list
pnpm --filter @doujin/database exec wrangler d1 info doujin --config ../../apps/api/wrangler.toml
pnpm lint:type
pnpm lint:code
pnpm test
pnpm --filter web run build
```

## 4. Release sequence

From repo root:

1. Apply remote DB migrations:

```bash
pnpm db:migrate:remote
```

2. Deploy API:

```bash
pnpm --filter api run deploy
```

3. Verify API before web deploy:

```bash
curl -i https://doujin.njabulomajozi.com/api/health
curl -i https://doujin.njabulomajozi.com/api/version
```

4. Deploy web:

```bash
NEXT_PUBLIC_API_BASE_URL=https://doujin.njabulomajozi.com \
NEXT_PUBLIC_APP_URL=https://doujin.njabulomajozi.com \
pnpm --filter web run deploy
```

5. Verify end-to-end:

```bash
curl -i https://doujin.njabulomajozi.com/
curl -i https://doujin.njabulomajozi.com/api/health
```

## 5. R2 CORS management

Source policy file:

- `docs/guides/deploy/r2-cors.json`

Apply policy:

```bash
pnpm --filter api exec wrangler r2 bucket cors set doujin-media docs/guides/deploy/r2-cors.json
```

Read policy back:

```bash
pnpm --filter api exec wrangler r2 bucket cors get doujin-media
```

Policy must allow browser upload origins and methods (`PUT`, `GET`, `HEAD`) and expose `etag`.

## 6. Rollback

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

## 7. Troubleshooting

### R2 signing or upload failures

- Check `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`.
- Confirm presign TTL (`R2_PRESIGN_TTL_SECONDS`) and bucket name (`MEDIA_BUCKET_NAME`).
- Confirm CORS policy is applied from `docs/guides/deploy/r2-cors.json`.

### Auth failures (`401`)

- Verify `AUTH_SECRET` consistency and session cookie behavior.
- Confirm `CORS_ORIGIN` matches web origin in each environment.

### Route conflicts (`/api/*` serving web)

- API worker deployment may be missing/failed.
- Re-deploy API and re-verify `/api/health` before touching web.

### Upload pipeline regressions

- Validate sequence:
  - upload-session
  - R2 `PUT`
  - complete
  - list asset
  - secured file stream/range
- Confirm `assets.status` transitions to `uploaded` only after object existence + size match.

## 8. Release evidence checklist

Record for each deploy:

- Date/time (UTC)
- Operator
- Commit SHA
- `db:migrate:remote` result
- API deploy ID
- Web deploy ID
- `/api/health` status
- `/api/version` status
- smoke E2E result (project upload + playback)
- rollback needed? (yes/no + reason)
