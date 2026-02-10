# Doujin Media Monorepo

AI-assisted video editing stack with:

- web editor (`apps/web`)
- API worker (`apps/api`)
- shared types/schemas (`packages/core`)
- database schema + migrations (`packages/database`)

## What Works Today

- Email/password auth with Better Auth (`/auth/sign-in`, `/auth/sign-up`)
- Create and list projects
- Local-first editor: upload a clip and edit a timeline stored in browser session state
- AI playback assistant (Gemini) that interprets natural-language playback commands via `POST /api/editor/interpret` (served by `apps/api`)

## API Surface (Consumed By `apps/web`)

Only these API endpoints are expected/maintained:

- `GET|POST|OPTIONS /api/auth/*`
- `GET /api/me`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/health`
- `GET /api/version`
- `POST /api/editor/interpret`

The API worker intentionally does not serve a duplicate root surface (for example `/health` without `/api`).

## Repo Map

- `apps/web`: Next.js app (home, auth, editor)
- `apps/api`: Hono API on Cloudflare Workers (auth + projects)
- `packages/core`: Zod schemas + shared types
- `packages/database`: Drizzle schema + D1 migrations
- `docs/guides/testing.md`: local + CI testing runbook
- `docs/guides/deploy.md`: deploy/rollback runbook
- `docs/guides/release.md`: release checklist

## Local Onboarding (New Dev)

### 1. Prerequisites

- Node.js 20+
- `pnpm` 10+

### 2. Install

```bash
pnpm install
```

### 3. Create local env files

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env.local
```

### 4. Set required env values

Use this local topology with `pnpm dev`:

- Web: `http://localhost:3000`
- API: `http://localhost:8787`

`apps/api/.dev.vars` (minimum):

- `AUTH_SECRET`
- `CORS_ORIGIN=http://localhost:3000`

Optional (enables real AI playback interpretation):

- `GEMINI_API_KEY=...`
- `AI_INTERPRET_MODEL=gemini-3-flash-preview`

Recommended API defaults:

- `APP_ENV=development`
- `GIT_SHA=dev-local`

`apps/web/.env.local`:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8787`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

Important: keep hostname style consistent (`localhost` everywhere) to avoid cookie/session issues.

### 5. Apply DB migrations

```bash
pnpm db:migrate
```

### 6. Start dev stack

```bash
pnpm dev
```

### 7. Verify services are up

```bash
curl -i http://localhost:8787/api/health
curl -i http://localhost:3000
```

## First Happy-Path Check (5 minutes)

1. Open `http://localhost:3000`.
2. Click `Create account` and sign up.
3. Upload a video from `/`.
4. Confirm redirect into `/projects/:id` and video preview appears.
5. In the playback assistant, send: `go to middle`.
6. Confirm the video seeks and the command reasoning appears.

## Key Runtime Flows

### Projects

1. `POST /api/projects`
2. `GET /api/projects`

### Editor Timeline (Local)

- Timeline state is computed and persisted client-side (session storage). No timeline CRUD endpoints are used.

### AI Playback Assistant

- `POST /api/editor/interpret` (API worker route in `apps/api`)
- Returns a structured playback command (play/pause/seek/none) plus reasoning.

## Daily Commands

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

## Troubleshooting

- `401 UNAUTHORIZED`: session missing/expired; verify `CORS_ORIGIN` + app origin match.
- AI errors on `/api/editor/interpret`: confirm `GEMINI_API_KEY` is configured for `apps/api`.

## More Guides

- [Testing guide](docs/guides/testing.md)
- [Deploy guide](docs/guides/deploy.md)
- [Release guide](docs/guides/release.md)
