# Release Guide

This checklist is for releasing `apps/api` and `apps/web`.

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

1. Deploy API:

```bash
pnpm --filter api run deploy
```

If the playback assistant should use real Gemini calls (not fallback), ensure the API worker has the secret configured:

```bash
pnpm --filter api exec wrangler secret put GEMINI_API_KEY --env production
```

2. Verify API:

```bash
curl -i https://doujin.njabulomajozi.com/api/health
curl -i https://doujin.njabulomajozi.com/api/version
```

3. Deploy Web:

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
- Use playback assistant (`/api/editor/interpret`) to seek/pause/resume

Notes:

- The API worker only serves `/api/*` routes. Root routes (for example `/health`) are expected to return `404`.

## 5. Evidence template

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
