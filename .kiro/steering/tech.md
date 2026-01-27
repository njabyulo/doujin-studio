---
inclusion: always
---

# Technology Stack

## Core Technologies

**Monorepo**: pnpm workspaces + Turborepo (dependency-aware builds, caching)
**Language**: TypeScript (strict mode)
**Package Bundler**: tsup with tree-shaking
**Code Quality**: ESLint + Prettier (shared configs)

**Frontend**: Next.js 16 (App Router, RSC), shadcn/ui, Tailwind CSS
**Backend**: Hono API, Better Auth (magic link), PostgreSQL + Drizzle ORM
**AI/Video**: Vercel AI SDK + Google Gemini, Remotion + Remotion Lambda
**Testing**: Vitest (unit), Chrome DevTools MCP (flows)
**Infrastructure**: SST (AWS S3, Lambda), Docker Compose (local dev)

## Critical Conventions

**Path Alias**: Use `~/*` (NOT `@/*`) in Next.js imports
**Table Naming**: Singular (e.g., `project`, `asset`, NOT `projects`)
**Workspace Dependencies**: Always use `workspace:*` for `@a-ds/*` packages
**Testing**: Unit tests in `__tests__/` folders, flow tests via Chrome DevTools MCP only
**Infrastructure**: Define in `infra/` folder (storage.ts, compute.ts, database.ts), import in `sst.config.ts`

## Essential Commands

**Development:**

```bash
pnpm install                      # Install dependencies
pnpm dev                          # Start all apps (builds packages first)
pnpm --filter @a-ds/web dev       # Start specific app
pnpm --filter @a-ds/api dev
```

**Build & Quality:**

```bash
pnpm build                        # Build all (respects dependency order)
pnpm --filter @a-ds/core build    # Build specific package
pnpm format                       # Auto-format (run before commit)
pnpm lint                         # Lint all workspaces
pnpm type-check                   # TypeScript validation
```

**Testing:**

```bash
pnpm test                         # All unit tests
pnpm --filter @a-ds/core test     # Specific workspace
pnpm --filter @a-ds/core test:watch
```

**Database:**

```bash
pnpm --filter @a-ds/database migrate    # Run migrations
pnpm --filter @a-ds/database generate   # Generate migration
```

**Docker:**

```bash
docker-compose up                 # Start services (PostgreSQL, API, web)
docker-compose up -d              # Detached mode
docker-compose down               # Stop all
docker-compose logs -f            # View logs
```

**SST (Infrastructure):**

```bash
npx sst init                      # Initialize SST in project
npx sst dev                       # Start SST dev mode (local resources)
npx sst deploy                    # Deploy to AWS
npx sst deploy --stage production # Deploy to specific stage
```

## CLI Tools

**shadcn/ui**: `pnpm dlx shadcn@latest add <component>` (install UI components)
**Next.js**: `pnpm create next-app@latest` (scaffolding)
**Hono**: `pnpm create hono@latest` (API scaffolding)
**SST**: `npx sst init` (initialize infrastructure as code)

## SST Infrastructure Pattern

**Structure:**

- `sst.config.ts` - Main SST configuration at root (includes `/// <reference path="./.sst/platform/config.d.ts" />`)
- `infra/storage.ts` - S3 buckets for video storage
- `infra/compute.ts` - Lambda functions for Remotion rendering
- `infra/database.ts` - PostgreSQL configuration (Docker in dev, RDS in prod)
- `apps/functions/src/handlers/` - Lambda function handlers organized by type:
  - `http/` - HTTP API handlers (API Gateway)
  - `queue/` - Queue handlers (SQS)
  - `cron/` - Scheduled handlers (EventBridge)

**Key Concepts:**

- Infrastructure defined as TypeScript code
- Resources linked to functions via `link: [bucket]`
- Access resources in code via `import { Resource } from 'sst'`
- Dev mode uses local Docker PostgreSQL
- Production deploys to AWS (S3, Lambda, RDS)

**SST in Monorepo:**

- SST should be installed at ROOT level, not in individual workspaces
- Resource types are auto-generated in `sst-env.d.ts` when you run `sst dev` or deploy
- Type errors for `Resource.{ResourceName}` are expected until SST generates types
- SST automatically: (1) generates types for linked resources, (2) injects links into function package, (3) grants permissions
- Use `Resource.{ResourceName}` to access linked resources in handlers (e.g., `Resource.MyBucket.name`)
- Handler paths in infra: `apps/functions/src/handlers/{type}/{name}.handler`
- Can check `sst-env.d.ts` into source control for teammates to see types without running `sst dev`

## Pre-Commit Requirements

MUST run in order before committing:

1. `pnpm format` - Auto-format with Prettier
2. `pnpm lint` - Fix ESLint issues (must have zero errors/warnings)
3. `pnpm type-check` - Verify TypeScript (must have zero errors)

DO NOT commit if any check fails.
