# Doujin Media Monorepo

AI-assisted video editing stack with:
- web editor (`apps/web`)
- API worker (`apps/api`)
- shared contracts (`packages/contracts`)
- database schema + migrations (`packages/database`)

## What Works Today

- Email/password auth with Better Auth (`/auth/sign-in`, `/auth/sign-up`)
- Upload flow with instant local preview + Cloudflare R2 upload sessions
- Poster generation on upload path
- Timeline CRUD + versioned autosave/manual saves
- AI chat edits via `POST /api/ai/chat` (Gemini + structured tool calls)

## Repo Map

- `apps/web`: Next.js app (home, auth, editor)
- `apps/api`: Hono API on Cloudflare Workers
- `packages/contracts`: Zod schemas + shared types
- `packages/database`: Drizzle schema + D1 migrations
- `docs/guides/testing.md`: end-to-end validation runbook
- `docs/guides/deploy.md`: deploy/rollback runbook

## Local Onboarding (New Dev)

### 1. Prerequisites

- Node.js 20+
- `pnpm` 10+
- Cloudflare access for R2/D1-backed local dev

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
- `GEMINI_API_KEY` (required for real AI responses)
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `CORS_ORIGIN=http://localhost:3000`

Recommended API defaults:
- `APP_ENV=development`
- `R2_PRESIGN_TTL_SECONDS=900`
- `AI_CHAT_MODEL=gemini-2.5-flash`
- `AI_CHAT_RATE_LIMIT_PER_HOUR=20`
- `AI_CHAT_MAX_TOOL_CALLS=2`
- `AI_CHAT_MAX_COMMANDS_PER_TOOL_CALL=12`
- `AI_CHAT_LOG_SNIPPET_CHARS=600`

`apps/web/.env.local`:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8787`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

Important: Keep hostname style consistent (`localhost` everywhere) to avoid cookie/session issues.

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

Expected:
- API health returns `200` + `{"ok":true}`
- Web root returns `200`

## First Happy-Path Check (5 minutes)

1. Open `http://localhost:3000`.
2. Click `Create account` and sign up.
3. Upload a video from `/`.
4. Confirm redirect into `/projects/:id` and video preview appears.
5. In chat panel, send: `trim clip 1 to 3s`.
6. Confirm timeline updates and save status returns to `Saved`.

## Key Runtime Flows

### Upload + Media

1. `POST /api/projects`
2. `POST /api/projects/:id/assets/upload-session`
3. Browser `PUT` directly to R2 pre-signed URL
4. `POST /api/assets/:id/complete`
5. `GET /api/projects/:id/assets?...`
6. `GET /api/assets/:id/file` (auth + range support)

### Timeline

1. `POST /api/projects/:id/timelines` (create/reuse)
2. `GET /api/projects/:id/timelines/latest` or `GET /api/timelines/:id`
3. `PATCH /api/timelines/:id` (autosave)
4. `POST /api/timelines/:id/versions` (manual save)

Rules:
- optimistic locking via `baseVersion`
- timeline timebase is milliseconds
- `401` unauthenticated, `404` non-member/missing resource

### AI Chat

- `POST /api/ai/chat` (also mounted at `/ai/chat`)
- streams assistant responses
- bounded tool-calls apply structured editor commands and persist `source: "ai"` timeline versions

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

- `401 UNAUTHORIZED` in UI/API: session missing/expired; re-auth and verify `CORS_ORIGIN` + app origin match.
- Upload session works but complete fails: validate R2 credentials and object size consistency.
- Editor save conflict (`400 BAD_REQUEST`): stale `baseVersion`; refresh timeline.
- AI errors: check `GEMINI_API_KEY` and API logs.

## More Guides

- [Testing guide](docs/guides/testing.md)
- [Deploy guide](docs/guides/deploy.md)
