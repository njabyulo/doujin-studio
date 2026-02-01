# AGENTS GUIDE
Operational notes for /Users/njabulo/Documents/development/playground/i/ads.
Use this before running commands or editing code.
Stick to pnpm + Turbo tasks; never switch to npm or yarn.
Default shell is macOS; commands assume zsh/bash with pnpm@10.28.2 installed.
Document should stay near 150 lines and remain accurate.
## Repository Layout
- Monorepo managed by pnpm workspaces (apps/_, packages/_).
- apps/web: Next.js 16 App Router front end with Vitest + Testing Library.
- apps/functions: SST/Remotion utilities mainly linted today.
- packages/database: Drizzle ORM schema/migrations plus typed helpers.
- packages/shared: zod schemas/types/constants shared across layers.
- packages/remotion: Remotion compositions bundled via tsup for render jobs.
- packages/config + root infra files (.sst, turbo.json, docker-compose.yaml) guide tooling.
## Toolchain Expectations
- pnpm scripts fan out through Turbo; run from repo root.
- Turbo cache lives in .turbo; clear via pnpm clean when builds misbehave.
- pnpm clean:all also removes node_modules and .sst for hard resets.
- Node version follows system; run pnpm env use if mismatched.
- Next config enables React Compiler; avoid class components and dynamic require.
- Vitest + Happy DOM drive tests; fast-check powers property suites.
- Remotion + tsup output to dist; keep builds deterministic for Lambdas.
## Environment & Secrets
- .env is local only; never commit credentials or secrets.
- SST infra scripts (pnpm dev:infra:\*) assume AWS profile withlillian-creds.
- Set DATABASE_URL before pnpm --filter @a-ds/database db:generate|db:migrate.
- Better Auth requires BETTER_AUTH_SECRET + NEXT_PUBLIC_APP_URL for cookies.
- Correlation + idempotency headers carry debugging IDs; avoid logging payload data.
- Stub outbound services (email, S3, queues) when testing; CI stays offline.
- Document new env requirements inside README and this guide.
## Global Commands
- pnpm install installs workspace deps pinned in pnpm-lock.yaml.
- pnpm dev runs Turbo dev graph (Next dev server, watchers, lint if wired).
- pnpm build triggers Turbo build graph across packages.
- pnpm lint, pnpm lint:code, pnpm lint:type run lint/type targets via Turbo.
- pnpm test starts Turbo test graph invoking each workspace runner.
- pnpm format / pnpm format:check apply or verify Prettier across repo.
- pnpm clean clears Turbo cache; pnpm clean:all also wipes node_modules plus .sst.
## Package Workflows
- pnpm --filter web dev|build|lint|test scopes to the Next.js app.
- pnpm --filter web lint:type runs tsc --noEmit for strict checking.
- pnpm --filter @a-ds/shared build|dev|test drives tsup + Vitest for shared schemas.
- pnpm --filter @a-ds/database db:generate|db:migrate|db:studio handle Drizzle flows.
- pnpm --filter @a-ds/remotion build produces Remotion bundles via tsup.
- pnpm --filter functions lint enforces node-target lint/type rules for lambdas.
- Append -- --watch or additional flags after scripts to forward CLI options.
## Single Test Recipes
- Default web suite: pnpm --filter web test -- run (CI) or pnpm --filter web test:watch locally.
- Target a file: pnpm --filter web vitest run apps/web/**tests**/lib/error-helpers.test.ts.
- Shared package: pnpm --filter @a-ds/shared vitest run src/schemas/brand-kit.test.ts.
- Add --runInBand, --coverage, or reporter flags after -- as needed.
- Property suites prefer vitest --run --file <path> instead of test.only.
- UI debugging: pnpm --filter web vitest --ui (install @vitest/ui globally).
- Build shared package before running tests if tsup artifacts might be stale.
## Database Workflows
- packages/database/src/schema defines tables; export them via src/index.ts.
- pnpm --filter @a-ds/database db:generate emits SQL migrations (needs DATABASE_URL).
- pnpm --filter @a-ds/database db:migrate applies migrations through tsx runner.
- pnpm --filter @a-ds/database db:studio opens Drizzle Studio; Turbo keeps it persistent.
- Keep SQL columns snake_case and map to camelCase in TypeScript layers.
- Wrap db access per feature helper rather than scattering raw queries.
- Sanitize SQL in logs; never expose credentials or raw statements.
## Frontend Build Notes
- Next App Router source under apps/web/app; components live in components/ or domain folders.
- Tailwind 4 alpha driven by components.json; combine classes via cn() helper.
- Fonts declared with next/font; keep app/globals.css as the single global stylesheet.
- API routes in app/api must reuse lib/\*.ts domain logic.
- Streaming helpers in lib/stream-consumer.ts manage SSE/AI responses; reuse for new flows.
- Mark server utilities with "use server" when exported as actions.
- Static assets belong in apps/web/public; avoid bundling large binaries.
## Formatting & Linting
- Prettier config lives at packages/config/prettier/.prettierrc (semi true, double quotes, width 80).
- Run pnpm format:check in CI and pnpm format locally to fix drift.
- ESLint configs extend @a-ds/config for both Next and Node packages.
- @typescript-eslint/no-unused-vars ignores \_-prefixed args/vars for intentional skips.
- Avoid editing generated config files (_.config.js, _.mjs) unless necessary.
- tsconfig files extend packages/config/typescript/\*; override only when required.
- Maintain manual import order (builtin, third-party, workspace, relative); no auto sorter enforced.
## Imports & Boundaries
- Use import { type Foo } from "..." for type-only references to help tree-shaking.
- Alias ~/\* maps to apps/web; rely on it for intra-app imports instead of deep relatives.
- Shared package exposes S* schemas and T* types via @a-ds/shared/schemas or /types.
- Database clients live in @a-ds/database/client; avoid pulling Drizzle internals in UI.
- UI code and hooks never hit the database directly; go through API or lib helpers.
- Keep server-only modules .ts while React UI modules stay .tsx.
- Side-effectful utilities (fetch, AWS SDK v3) live in lib and are mocked with vi.mock in tests.
## TypeScript & Modeling
- Repo enforces strict, isolatedModules, esModuleInterop, bundler resolution, and noEmit.
- Schemas use S prefix (SBrandKit) while inferred types use T prefix (TBrandKit).
- Compose shared schemas before crafting feature-specific validators.
- Use discriminated unions for state machines like RenderStatus in hooks/useRenderPolling.ts.
- Literal unions ("generate" | "render" | ...) centralize operation names for rate limits + idempotency.
- Never export any; wrap external SDKs behind typed interfaces when needed.
- Encapsulate env access inside helpers so validation happens once.
## React & UI Practices
- Only function components allowed; React Compiler forbids class components.
- Derive minimal state from props and share complex logic via hooks in apps/web/hooks.
- Place effects inside useEffect with cleanup for timers/listeners as shown in useRenderPolling.
- Compose classes through cn() rather than manual string concatenation or repeated Tailwind tokens.
- Maintain accessible semantics and test via Testing Library getByRole queries.
- Fetch handlers should throw on non-OK responses to integrate with error helpers.
- Prefer streaming responses for long flows by reusing stream-consumer helpers.
## API & Resilience
- Correlation IDs come from lib/correlation-middleware; propagate x-correlation-id everywhere.
- Error helpers in lib/error-helpers centralize statuses, headers, and payloads.
- checkIdempotency and storeIdempotencyKey guard mutation handlers against duplicate work.
- lib/rate-limit-middleware defines RATE_LIMITS; reuse checkRateLimit instead of ad-hoc counters.
- Retry and checkpoint utilities already exist under apps/web/lib; extend them before writing new ones.
- Better Auth setup lives in lib/auth.ts; import the shared auth instance for sessions.
- AWS interactions must use the v3 clients listed in package.json and share credential accessors.
## Testing Philosophy
- Vitest powers all suites; tests live under apps/web/**tests** mirroring features.
- fast-check drives property suites; pin seeds when capturing regressions.
- Use @testing-library/react and jest-dom for behavior-focused assertions; avoid snapshots.
- Mock modules with vi.mock at file scope and reset via beforeEach to avoid bleed.
- Async tests should await screen.findBy\* or waitFor rather than using setTimeout.
- When mocking fetch, vi.spyOn(global, "fetch") and restore between cases.
- Shared package tests may import from src/ directly while tsup builds handle dist consumers.
## Error Handling & Logging
- Use createErrorResponse helpers for consistent payloads and headers.
- Include correlationId details but omit sensitive request data in logs.
- Wrap DB or external errors before surfacing to avoid leaking stack traces.
- Rate limit violations should return createRateLimitError with Retry-After header.
- Idempotency helpers silently ignore duplicate insert races; rethrow other errors.
- Prefer structured logging with context (operation, user, correlation) per log line.
- Never log secrets, tokens, or request bodies containing customer data.
## Auth & Security
- Better Auth + Drizzle adapter configured in lib/auth.ts; reuse exported auth instance.
- Session cookies mark httpOnly true and secure when NODE_ENV===production.
- Trusted origins derive from NEXT_PUBLIC_APP_URL; keep env values current.
- Email verification currently logs links; integrate email provider before production.
- Correlation + idempotency IDs should not reveal user identifiers.
- Validate incoming payloads with shared zod schemas before mutating data.
- Strip PII from error responses and analytics events.
## Git & Workflow
- Work on feature branches and only commit when the user explicitly asks.
- Run pnpm lint && pnpm test before opening PRs or wrapping tasks.
- Avoid editing .turbo, .sst, pnpm-lock, or generated migration snapshots manually.
- Document new scripts, env requirements, or conventions inside package.json and AGENTS.md.
- Keep workspace dependency versions as workspace:\*; do not pin internal packages.
- Schema edits require migration files plus updated exports in one change set.
- Use gh CLI for GitHub PR/issue automation when needed.
## Automation & Maintenance
- No .cursor/rules, .cursorrules, or .github/copilot-instructions.md exist today; no extra policies.
- If such automation files appear, summarize their guidance here verbatim.
- Follow repo formatting/lint configs as the primary policy surface.
- Prefer human-authored product requirements when they conflict with AI defaults.
- Capture new automation guardrails (policy IDs, rate limits) in this section immediately.
- Revisit package scripts and update this guide whenever commands or tooling change.
- Keep AGENTS.md near 150 lines by pruning stale notes before adding new ones.
