# Doujin Media Monorepo

This repository contains the web editor, API, shared contracts, and database package for the storage-backed media upload flow.

## Monorepo map

- `apps/web`: Next.js editor and upload UX.
- `apps/api`: Hono + Cloudflare Worker API (auth, projects, assets, media proxy).
- `packages/contracts`: shared request/response schemas.
- `packages/database`: D1 schema + migrations.
- `docs/guides/testing.md`: local validation and E2E test guide.
- `docs/guides/deploy.md`: canonical deploy runbook.

## Quick start (local)

1. Install dependencies:

```bash
pnpm install
```

2. Create local env files:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env.local
```

3. Fill required local values:

- `apps/api/.dev.vars`
  - `AUTH_SECRET`
  - `GEMINI_API_KEY`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_ACCOUNT_ID`
  - `R2_PRESIGN_TTL_SECONDS` (default `900`)
  - `CORS_ORIGIN` should match your web dev origin (`http://localhost:3000` when using `pnpm dev`)
- `apps/web/.env.local`
  - `NEXT_PUBLIC_API_BASE_URL` (usually `http://localhost:8787`)
  - `NEXT_PUBLIC_APP_URL` (usually `http://localhost:3000`)

4. Apply local DB migrations:

```bash
pnpm db:migrate
```

5. Start local API + web:

```bash
pnpm dev
```

6. Readiness checks:

```bash
curl -i http://localhost:8787/api/health
curl -i http://localhost:3000
```

## Daily command cheatsheet

```bash
pnpm dev
pnpm db:migrate
pnpm lint:type
pnpm lint:code
pnpm test
pnpm --filter web run build
pnpm --filter api run deploy
pnpm --filter web run deploy
```

## Storage upload flow (C1-C4)

1. Client creates project (`POST /api/projects`).
2. Client requests video upload session (`POST /api/projects/:id/assets/upload-session`).
3. Browser uploads bytes directly to R2 using returned presigned `PUT` URL.
4. Client completes upload (`POST /api/assets/:id/complete`) with metadata.
5. Client lists/restores latest uploaded asset (`GET /api/projects/:id/assets?...`).
6. Editor playback uses secured proxy URL (`GET /api/assets/:id/file`) with auth and range support.
7. Poster uses same asset flow (`type: "poster"`) and is linked via `posterAssetId`.

## Timeline persistence flow (Epic D)

1. Create or reuse project timeline (`POST /api/projects/:id/timelines`).
2. Load latest timeline state (`GET /api/projects/:id/timelines/latest` or `GET /api/timelines/:id`).
3. Apply local editor commands (`addClip`, `trimClip`, `splitClip`, `moveClip`, `setVolume`, `addSubtitle`, `removeClip`).
4. Debounced autosave writes new timeline versions (`PATCH /api/timelines/:id`).
5. Manual save creates an explicit version (`POST /api/timelines/:id/versions`).
6. Reload restores the latest server version exactly.

Timeline rules:

- one timeline per project (current milestone)
- optimistic locking by `baseVersion`
- timeline JSON uses milliseconds as source-of-truth
- unauthorized is `401`; non-member/missing resources are `404`

## Guides

- [Testing guide](docs/guides/testing.md)
- [Deploy guide](docs/guides/deploy.md)
