# Testing Guide (Flows + Env Setup)

This runbook explains how to test the app end-to-end, including the new AI timeline edit flow.

Scope covered:

- asset upload + completion
- timeline create/load/save + optimistic locking
- AI chat streaming (`POST /api/ai/chat` / `POST /ai/chat`)
- AI tool execution (`applyEditorCommands`) and persisted `source: "ai"` timeline versions
- safety controls (rate limit, tool-call bounds, command bounds)

## 1. Environment setup

### Local topology this guide assumes

This guide assumes you run `pnpm dev` from repo root:

- Web app: `http://localhost:3000`
- API worker: `http://localhost:8787`

If you choose different hosts/ports, update these together:

- `apps/api/.dev.vars` -> `CORS_ORIGIN`
- `apps/web/.env.local` -> `NEXT_PUBLIC_APP_URL`
- `apps/web/.env.local` -> `NEXT_PUBLIC_API_BASE_URL`

Use the same hostname across values (`localhost` vs `127.0.0.1`) to avoid auth cookie mismatch during browser testing.

### API env (`apps/api/.dev.vars`)

Bootstrap from the template:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Required secrets:

- `AUTH_SECRET`
- `GEMINI_API_KEY` (required for real Gemini calls)
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Recommended local overrides:

- `APP_ENV=development`
- `CORS_ORIGIN=http://localhost:3000`
- `GIT_SHA=dev-local`
- `R2_ACCOUNT_ID=<your account id>`
- `R2_PRESIGN_TTL_SECONDS=900`
- `AI_CHAT_MODEL=gemini-2.5-flash`
- `AI_CHAT_RATE_LIMIT_PER_HOUR=20`
- `AI_CHAT_MAX_TOOL_CALLS=2`
- `AI_CHAT_MAX_COMMANDS_PER_TOOL_CALL=12`
- `AI_CHAT_LOG_SNIPPET_CHARS=600`

Real-model vs deterministic testing:

- Real-model mode: keep `APP_ENV=development` and set a valid `GEMINI_API_KEY`.
- Deterministic mode (no external Gemini call):
  - API tests already use deterministic mode.
  - Manual API calls can set header `x-ai-test-mode: 1` (non-production only).
  - For browser UI deterministic behavior, temporarily set `APP_ENV=test` locally.

### Web env (`apps/web/.env.local`)

Bootstrap from the template:

```bash
cp apps/web/.env.example apps/web/.env.local
```

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8787`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

### Remote env notes (staging/production)

For deployed flow testing, ensure API secrets are configured in Cloudflare:

- `AUTH_SECRET`
- `GEMINI_API_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Use:

```bash
pnpm --filter api exec wrangler secret put AUTH_SECRET --env production
pnpm --filter api exec wrangler secret put GEMINI_API_KEY --env production
pnpm --filter api exec wrangler secret put R2_ACCESS_KEY_ID --env production
pnpm --filter api exec wrangler secret put R2_SECRET_ACCESS_KEY --env production
```

## 2. One-time setup

From repo root:

```bash
pnpm install
pnpm db:migrate
```

## 3. Recommended test sequence

Run testing in this order to catch setup issues early:

1. Focused deterministic AI tests (fast signal).
2. Upload + timeline baseline in browser.
3. AI chat deterministic call (`x-ai-test-mode: 1`) to validate route + tool flow without provider variability.
4. AI chat real Gemini flow to validate streaming quality and prompt behavior.
5. Safety controls (rate limit + tool bounds).

## 4. Automated test flows

### Full gate (recommended before PR)

```bash
pnpm lint:type
pnpm lint:code
pnpm test
pnpm --filter web run build
```

### Focused AI checks

```bash
pnpm --filter api test -- src/app.test.ts
pnpm --filter web exec vitest run lib/ai-chat.test.ts lib/timeline-state.test.ts
```

What these verify:

- auth + membership checks for `/api/ai/chat`
- streaming responses
- `trim clip 1 to 3s` creates a new `source: "ai"` timeline version
- rate limit returns `429 RATE_LIMITED`
- tool-call bounding for spam-like requests
- prompt/response excerpt logging
- web request payload/context + flush-before-send behavior

## 5. Start local stack

```bash
pnpm dev > /tmp/media-dev.log 2>&1 &
```

Readiness:

```bash
curl -i http://localhost:8787/api/health
curl -i http://localhost:3000
```

Expected:

- API: `200` with `{ "ok": true }`
- Web: `200` HTML

## 6. Manual flow A: Upload + baseline timeline

1. Open `http://localhost:3000`.
2. Create an auth session (DevTools console):

```js
await fetch("http://localhost:8787/api/auth/sign-up/email", {
  method: "POST",
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "Dev User",
    email: `dev-${Date.now()}@example.com`,
    password: "Password123!",
  }),
});
await fetch("http://localhost:8787/api/me", { credentials: "include" });
```

3. Upload a video from the landing page.
4. Confirm timeline loads in editor and save state transitions (`Unsaved edits` → `Saving...` → `Saved`) work as expected when making a manual edit.

## 7. Manual flow B: AI chat happy path

1. In the editor chat panel, send:

- `trim clip 1 to 3s`

2. Expect UI behavior:

- streaming response indicator
- tool chips shown in chat response
- after stream finish, timeline refreshes and reflects AI edit

3. Verify version persistence:

- `GET /api/timelines/:id` should show latest version incremented
- latest version `source` should be `ai`

## 8. API flow for AI chat (curl)

Use a valid member cookie (`better-auth.session_token=<token>`).

```bash
curl -N -X POST http://localhost:8787/api/ai/chat \
  -H 'Content-Type: application/json' \
  -H 'Cookie: better-auth.session_token=<token>' \
  -d '{
    "timelineId": "<timelineId>",
    "messages": [
      {
        "id": "m1",
        "role": "user",
        "parts": [{ "type": "text", "text": "trim clip 1 to 3s" }]
      }
    ],
    "context": {
      "mode": "phase1",
      "notes": "Keep the pacing tight"
    }
  }'
```

Notes:

- `POST /ai/chat` also works (dual route mount).
- phase support:
  - `phase1`: metadata + notes + transcript
  - `phase2`: keyframes/thumbnails + timestamps (caller-supplied)
  - `phase3`: adapter seam for future direct video reference path

Deterministic local API call without Gemini:

```bash
curl -N -X POST http://localhost:8787/api/ai/chat \
  -H 'Content-Type: application/json' \
  -H 'x-ai-test-mode: 1' \
  -H 'Cookie: better-auth.session_token=<token>' \
  -d '{
    "timelineId": "<timelineId>",
    "messages": [
      {
        "id": "m1",
        "role": "user",
        "parts": [{ "type": "text", "text": "trim clip 1 to 3s" }]
      }
    ]
  }'
```

## 9. Safety-control test flows

### Rate limit

To force quickly in local testing, temporarily set a low value:

- `AI_CHAT_RATE_LIMIT_PER_HOUR=1`

Then call `/api/ai/chat` twice in the same hour for the same user/project.

Expected second call:

- `429`
- error code `RATE_LIMITED`

### Tool-call bound

Use deterministic mode and prompt:

- `tool spam`

Expected:

- timeline versions created by one request are bounded by `AI_CHAT_MAX_TOOL_CALLS`
- no unbounded write loop

### Max commands per tool call

Attempt a payload that exceeds `AI_CHAT_MAX_COMMANDS_PER_TOOL_CALL` via tool input.

Expected:

- tool returns an error result
- no timeline mutation for that invalid tool call

## 10. Failure triage

- `401 UNAUTHORIZED`: missing/expired session cookie.
- `404 NOT_FOUND`: user is not a member of the project/timeline.
- `400 BAD_REQUEST` on timeline save/chat flush: stale `baseVersion` conflict.
- `429 RATE_LIMITED`: per user+project hourly limit hit.
- stream returns generic failure copy: inspect API logs for upstream provider error (invalid key, quota, etc.).
- upload complete fails: R2 object missing or size mismatch.

## 11. Verification record template

```md
Date/Time (UTC):
Operator:
Branch/Commit:

Env mode:
- APP_ENV:
- AI_CHAT_MODEL:
- AI_CHAT_RATE_LIMIT_PER_HOUR:
- AI_CHAT_MAX_TOOL_CALLS:
- AI_CHAT_MAX_COMMANDS_PER_TOOL_CALL:

Automated checks:
- pnpm lint:type:
- pnpm lint:code:
- pnpm test:
- pnpm --filter web run build:

Manual flows:
- Upload flow: pass/fail
- Timeline save flow: pass/fail
- AI stream in chat panel: pass/fail
- "trim clip 1 to 3s" created ai version: pass/fail
- Rate limit behavior: pass/fail

Artifacts:
- Project ID:
- Timeline ID:
- Latest version + source:
- Example AI request ID(s):

Notes / blockers:
```
