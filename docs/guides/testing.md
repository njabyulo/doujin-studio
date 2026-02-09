# Testing Guide (Local + Browser E2E)

This guide validates the storage flow end-to-end:

- Asset registry + upload sessions
- Direct-to-R2 upload contract
- Upload completion + metadata
- Auth-protected media proxy with range support
- Editor restore of uploaded video/poster on reload
- Timeline version create/load/save with optimistic locking

## 1. Prerequisites

- Node + pnpm installed.
- `ffmpeg` and `ffprobe` installed (for disposable test clip generation and metadata checks).
- Cloudflare credentials available for local R2 signing tests.

Required local env values:

- `apps/api/.dev.vars`
  - `AUTH_SECRET`
  - `GEMINI_API_KEY`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_ACCOUNT_ID`
  - `R2_PRESIGN_TTL_SECONDS`
  - `CORS_ORIGIN=http://localhost:3000`
- `apps/web/.env.local`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8787`
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`

## 2. Generate a disposable upload file (do not use `apps/video`)

```bash
ffmpeg -y \
  -f lavfi -i testsrc=size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=880:sample_rate=44100 \
  -t 8 \
  -c:v libx264 -pix_fmt yuv420p -c:a aac \
  /tmp/media-test-upload.mp4
```

## 3. Automated gates

Run from repo root:

```bash
pnpm install
pnpm db:migrate
pnpm lint:type
pnpm lint:code
pnpm test
pnpm --filter web run build
```

Expected: all commands exit 0.

## 4. Start local dev stack

```bash
pnpm dev > /tmp/media-dev.log 2>&1 &
```

Readiness:

```bash
curl -i http://localhost:8787/api/health
curl -i http://localhost:3000
```

Expected:

- API health: `200` with `{ "ok": true }`
- Web root: `200` HTML

## 5. Browser E2E (Chrome DevTools)

1. Open `http://localhost:3000`.
2. Create auth session (DevTools console):

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

3. Upload `/tmp/media-test-upload.mp4` from landing page.
4. Verify expected network sequence:

- `POST /api/projects`
- `POST /api/projects/:id/assets/upload-session` (video)
- R2 `PUT` to presigned URL
- `POST /api/projects/:id/assets/upload-session` (poster)
- poster R2 `PUT`
- `POST /api/assets/:posterId/complete`
- `POST /api/assets/:videoId/complete`
- `GET /api/projects/:id/assets?type=video&status=uploaded&limit=1`

5. Confirm editor shows:

- video playable
- metadata (`duration`, `width x height`)
- poster-backed preview path restored on reload

6. Reload page and verify persisted load comes from backend endpoints, not blob-only URLs.

## 6. API verification snippets

Use a valid member session cookie (`better-auth.session_token=...`).

Asset read:

```bash
curl -i http://localhost:8787/api/assets/<assetId> -H 'Cookie: better-auth.session_token=<token>'
```

Project latest uploaded asset:

```bash
curl -i 'http://localhost:8787/api/projects/<projectId>/assets?type=video&status=uploaded&limit=1' \
  -H 'Cookie: better-auth.session_token=<token>'
```

Authorized media stream:

```bash
curl -i http://localhost:8787/api/assets/<assetId>/file -H 'Cookie: better-auth.session_token=<token>'
```

Range read:

```bash
curl -i -H 'Range: bytes=0-1023' \
  http://localhost:8787/api/assets/<assetId>/file \
  -H 'Cookie: better-auth.session_token=<token>'
```

Expected: `206` + `Content-Range` + `Accept-Ranges: bytes`.

Unauthorized and outsider checks:

```bash
# unauthenticated
curl -i http://localhost:8787/api/assets/<assetId>/file

# authenticated outsider (not a project member)
curl -i -b /tmp/outsider.cookies.txt http://localhost:8787/api/assets/<assetId>/file
```

Expected:

- unauthenticated: `401 UNAUTHORIZED`
- outsider/non-member: `404 NOT_FOUND`

## 7. Timeline endpoint verification

Use the same authenticated member cookie for the project.

Create/get project timeline:

```bash
curl -i -X POST http://localhost:8787/api/projects/<projectId>/timelines \
  -H 'Content-Type: application/json' \
  -H 'Cookie: better-auth.session_token=<token>' \
  -d '{"name":"Main Timeline"}'

curl -i http://localhost:8787/api/projects/<projectId>/timelines/latest \
  -H 'Cookie: better-auth.session_token=<token>'
```

Autosave/manual version writes:

```bash
curl -i -X PATCH http://localhost:8787/api/timelines/<timelineId> \
  -H 'Content-Type: application/json' \
  -H 'Cookie: better-auth.session_token=<token>' \
  -d '{"baseVersion":1,"source":"autosave","data":{"schemaVersion":1,"fps":30,"durationMs":10000,"tracks":[{"id":"video-track","kind":"video","name":"Video","clips":[]},{"id":"subtitle-track","kind":"subtitle","name":"Subtitles","clips":[]}]}}'

curl -i -X POST http://localhost:8787/api/timelines/<timelineId>/versions \
  -H 'Content-Type: application/json' \
  -H 'Cookie: better-auth.session_token=<token>' \
  -d '{"baseVersion":2,"source":"manual","data":{"schemaVersion":1,"fps":30,"durationMs":10000,"tracks":[{"id":"video-track","kind":"video","name":"Video","clips":[]},{"id":"subtitle-track","kind":"subtitle","name":"Subtitles","clips":[]}]}}'
```

Expected:

- valid save increments version
- stale `baseVersion` returns `400 BAD_REQUEST`
- non-member timeline access returns `404 NOT_FOUND`

## 8. Failure triage

- `401` on authenticated calls:
  - session cookie missing or expired.
- `404` for member asset:
  - wrong project/asset ID or membership mismatch.
- R2 `PUT` fails (CORS/signature/SSL):
  - verify `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, and bucket CORS.
  - ensure `docs/guides/deploy/r2-cors.json` is applied.
- Upload session succeeds but complete fails:
  - object missing in bucket or `size` mismatch.
- Browser can upload but video won’t play:
  - inspect `GET /api/assets/:id/file` status/headers and range responses.
- Timeline save fails with conflict:
  - client `baseVersion` is stale; reload timeline and retry.

## 9. Verification record template

Use this for each local validation run.

```md
Date/Time (UTC):
Operator:
Branch/Commit:

Automated checks:
- pnpm lint:type:
- pnpm lint:code:
- pnpm test:
- pnpm --filter web run build:

E2E evidence:
- Project ID:
- Video Asset ID:
- Poster Asset ID:
- Upload session status:
- Complete status:
- Range request status:
- Unauthorized status:
- Outsider status:
- Timeline ID:
- Timeline latest version:
- Timeline autosave status:

Notes / blockers:
```
