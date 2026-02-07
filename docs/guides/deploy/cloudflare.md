# Cloudflare Deployment Guide

This guide covers deploying `apps/web` to Cloudflare Workers using OpenNext and provisioning a D1 database. `apps/video` is intentionally out of scope.

**Prerequisites**

- Node.js + pnpm installed
- Cloudflare account with Workers and D1 enabled
- `wrangler` authenticated (`wrangler login`)

**Key Files**

- Worker config: `/Users/njabulo/Documents/development/playground/i/media/apps/web/wrangler.jsonc`
- OpenNext config: `/Users/njabulo/Documents/development/playground/i/media/apps/web/open-next.config.ts`
- Local dev vars: `/Users/njabulo/Documents/development/playground/i/media/apps/web/.dev.vars`
- D1 migrations: `/Users/njabulo/Documents/development/playground/i/media/packages/database/src/migrations/0000_init.sql`

**1) Create the D1 database**
Run from the monorepo root and use the workspace-local Wrangler (so it reads `apps/web/wrangler.jsonc`).

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter web exec wrangler d1 create doujin
```

Copy the returned `database_id` into `wrangler.jsonc` at:

```jsonc
"database_id": "REPLACE_WITH_D1_DATABASE_ID"
```

**2) Apply D1 migrations**
Local D1 (for dev):

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter web exec wrangler d1 migrations apply doujin --local
```

Remote D1 (for prod):

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter web exec wrangler d1 migrations apply doujin --remote
```

**3) Set environment variables**
Local dev values live in `.dev.vars` (already created). Update as needed:

```bash
# /Users/njabulo/Documents/development/playground/i/media/apps/web/.dev.vars
NEXT_PUBLIC_APP_URL=http://localhost:8787
GOOGLE_GENERATIVE_AI_API_KEY=
```

For production, set secrets in Cloudflare:

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter web exec wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
```

**4) Build for Workers (OpenNext)**
From repo root (recommended for monorepo tooling):

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter web build
```

This generates `.open-next/` which is the Worker output.
OpenNext requires `apps/web/open-next.config.ts` (already in this repo).

**5) Run locally on Workers**

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter web dev
```

**6) Deploy**

```bash
cd /Users/njabulo/Documents/development/playground/i/media
pnpm --filter web deploy
```

**Monorepo Tip**
Prefer the root `package.json` scripts with `pnpm --filter web …` so dependencies and workspace tooling stay consistent.

**Notes**

- Wrangler defaults to local D1; use `--remote` for prod migrations or remote queries.
- Local Wrangler dev uses local D1 only (no remote D1 access in dev).
- If you see missing Worker types in TS, ensure `@cloudflare/workers-types` stays in `@doujin/database` devDependencies.
- `.open-next/`, `.wrangler/`, and `.dev.vars` are gitignored.
