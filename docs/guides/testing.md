# Testing Guide

This runbook covers testing for the current `apps/web` + `apps/api` surface.

## Local topology

- Web app: `http://localhost:3000`
- API worker: `http://localhost:8787`

The API worker only serves `/api/*` routes. Root routes (for example `/health`) are expected to return `404`.

## Environment setup

From repo root:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env.local
pnpm install
pnpm db:migrate
```

Required values:

- `apps/api/.dev.vars`
  - `AUTH_SECRET`
  - `CORS_ORIGIN=http://localhost:3000`
- `apps/web/.env.local`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8787`
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`

Optional (enables real AI playback interpretation):

- `apps/api/.dev.vars`
  - `GEMINI_API_KEY=...` (used by `POST /api/editor/interpret`)

## Automated checks

From repo root:

```bash
pnpm lint:type
pnpm lint:code
pnpm test
pnpm --filter web run build
```

Focused:

```bash
pnpm --filter api test
pnpm --filter web test
```

## Manual smoke test

1. Start local stack:

```bash
pnpm dev
```

2. Readiness:

```bash
curl -i http://localhost:8787/api/health
curl -i http://localhost:8787/api/version
curl -i http://localhost:3000
```

3. Browser flow:

- Open `http://localhost:3000`
- Create an account (email/password)
- Upload a video from `/` (local preview)
- Confirm redirect into `/projects/:id`
- In the playback assistant, send: `restart` or `go to 5 seconds`

Expected:

- Project list and project creation work (`GET /api/projects`, `POST /api/projects`)
- Playback assistant returns a JSON command and the video reacts accordingly
- No network timeline CRUD calls are required for the editor
