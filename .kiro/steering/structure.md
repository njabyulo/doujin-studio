# Project Structure

## Monorepo Organization

```
a-ds/
├── apps/                       # Application workspaces
│   ├── api/                    # Hono API server
│   └── web/                    # Next.js frontend
├── packages/                   # Shared packages
│   ├── core/                   # Business logic (services, repositories, adapters)
│   ├── database/               # Drizzle ORM schemas and migrations
│   ├── shared/                 # Shared types, interfaces, schemas
│   └── eslint-config/          # Shared ESLint configuration
├── .kiro/                      # Kiro configuration
│   ├── specs/                  # Feature specifications
│   └── steering/               # Steering documents
├── turbo.json                  # Turborepo configuration
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── docker-compose.yml          # Docker orchestration
└── package.json                # Root workspace config
```

## Apps

### apps/api (Hono API)
```
apps/api/
├── src/
│   ├── routes/                 # API route handlers
│   │   └── *.handler.ts        # Handler files (handler → service pattern)
│   ├── middleware/             # Auth, validation, error handling
│   ├── lib/                    # API utilities and Better Auth setup
│   └── index.ts                # API entry point
├── __tests__/                  # Unit tests
│   ├── routes/                 # Handler unit tests
│   └── middleware/             # Middleware unit tests
├── .eslintrc.js                # Extends @a-ds/eslint-config/node
├── Dockerfile
└── package.json
```

### apps/web (Next.js Frontend)
```
apps/web/
├── src/
│   ├── app/                    # App Router pages
│   ├── components/             # React components (shadcn/ui)
│   ├── lib/                    # Client utilities and Better Auth client
│   └── hooks/                  # Custom React hooks
├── __tests__/                  # Unit tests
│   ├── components/             # Component unit tests
│   ├── lib/                    # Utility unit tests
│   └── hooks/                  # Hook unit tests
├── public/                     # Static assets
├── components.json             # shadcn/ui configuration
├── tsconfig.json               # Uses ~/* path alias
├── .eslintrc.js                # Extends @a-ds/eslint-config/next
└── package.json
```

## Packages

### packages/core (Business Logic)
```
packages/core/
├── src/
│   ├── services/               # Business logic services
│   │   └── *.service.ts        # Service implementations with factory functions
│   ├── repositories/           # Data access layer (NOT exported)
│   │   └── *.repository.ts     # Repository implementations
│   ├── adapters/               # External service adapters (NOT exported)
│   │   └── *.adapter.ts        # Adapter implementations (Gemini, Storage)
│   ├── templates/              # Remotion video templates
│   └── index.ts                # Exports ONLY service factories
├── __tests__/                  # Unit tests
│   ├── services/               # Service unit tests
│   ├── repositories/           # Repository unit tests
│   └── adapters/               # Adapter unit tests
├── tsup.config.ts              # tsup build configuration
└── package.json
```

**Key Pattern**: Services expose `create{Service}()` factory functions that accept only configuration. Repositories and adapters are internal implementation details.

### packages/database (Data Layer)
```
packages/database/
├── src/
│   ├── schema/                 # Drizzle schemas (singular naming)
│   │   ├── project.ts          # project table
│   │   ├── asset.ts            # asset table
│   │   ├── template.ts         # template table
│   │   ├── script.ts           # script table
│   │   └── renderJob.ts        # renderJob table
│   ├── migrations/             # SQL migrations
│   └── client.ts               # DB connection
├── __tests__/                  # Unit tests
│   └── schema/                 # Schema validation tests
├── tsup.config.ts
└── package.json
```

**Note**: Better Auth auto-generates `user`, `session`, and `verification` tables.

### packages/shared (Shared Types)
```
packages/shared/
├── src/
│   ├── types/                  # TypeScript types (T* prefix)
│   ├── interfaces/             # TypeScript interfaces (I* prefix)
│   ├── schemas/                # Zod validation schemas (S* prefix)
│   └── constants/              # Shared constants
├── __tests__/                  # Unit tests
│   └── schemas/                # Schema validation tests
├── tsup.config.ts
└── package.json
```

### packages/eslint-config (Code Quality)
```
packages/eslint-config/
├── base.js                     # Base ESLint rules
├── next.js                     # Next.js specific rules
├── node.js                     # Node.js specific rules
└── package.json
```

## Architectural Patterns

### Ports and Adapters (Hexagonal Architecture)

This project follows strict Ports and Adapters architecture with one-way dependencies:

```
API Handlers → Services → (Repository Ports + Adapter Ports) → Implementations
```

**Complete dependency flow:**
```
apps/api/routes/*.handler.ts
  ↓ calls (via factory functions ONLY)
packages/core/services/*.service.ts
  ↓ depends on (as types/interfaces ONLY)
packages/core/repositories/*.repository.ts (ports/interfaces)
packages/core/adapters/*.adapter.ts (ports/interfaces)
  ↓ implemented by
Repository/Adapter implementations
  ↓ use
DB clients, External SDKs/APIs
```

**Critical Rules:**
- ✅ Handlers MUST ONLY call services (never repositories or adapters directly)
- ✅ Services depend on ports (interfaces) as types only
- ✅ Services MUST NOT import adapter implementations or factories
- ✅ Services MUST NOT import DB/ORM clients
- ✅ Repositories may import adapter implementations
- ❌ Repositories/adapters MUST NOT import services

**Example Flow**:
1. Handler receives HTTP request and validates input
2. Handler creates service: `createProjectService({ database, userId })`
3. Handler calls service method: `service.createProject(name)`
4. Service uses repository port (interface) internally
5. Repository implementation uses DB/adapters
6. Handler maps service result to HTTP response

### Naming Conventions

- **Interfaces**: `I*` prefix (e.g., `IProjectService`, `IProjectRepository`, `IGeminiAdapter`)
- **Types**: `T*` prefix (e.g., `TProject`, `TAdScript`)
- **Zod Schemas**: `S*` prefix (e.g., `SCreateProject`, `SGenerationParams`)
- **Database Tables**: Singular naming (e.g., `project`, `asset`, `renderJob`)
- **Service Factories**: `create{Service}` (e.g., `createProjectService`, `createAIService`)
- **Repository Ports**: `I{Entity}Repository` (e.g., `IProjectRepository`, `IAssetRepository`)
- **Adapter Ports**: `I{Provider}Adapter` (e.g., `IGeminiAdapter`, `IEmailSender`, `IObjectStore`)

## Workspace Dependencies

Packages reference each other using workspace protocol:

```json
{
  "dependencies": {
    "@a-ds/shared": "workspace:*",
    "@a-ds/core": "workspace:*",
    "@a-ds/database": "workspace:*"
  }
}
```

## Build Order

Turborepo ensures correct build order:
1. `@a-ds/shared` (no dependencies)
2. `@a-ds/database` (depends on shared)
3. `@a-ds/core` (depends on shared and database)
4. `@a-ds/web` and `@a-ds/api` (depend on all packages)

When running `pnpm dev`, packages are built first, then dev servers start.

## Import Patterns

### Frontend (apps/web)
```typescript
// Uses ~/* path alias
import { Button } from '~/components/ui/button';
import { useAuth } from '~/hooks/useAuth';
import { createProjectService } from '@a-ds/core';
import type { TProject } from '@a-ds/shared';
```

### Backend (apps/api)
```typescript
// ✅ CORRECT: Handler imports only services
import { createProjectService } from '@a-ds/core';
import type { IProjectService } from '@a-ds/core';
import { SCreateProject } from '@a-ds/shared';

// ❌ FORBIDDEN: Never import repositories or adapters in handlers
// import { ProjectRepository } from '@a-ds/core/repositories'; // ❌
// import { GeminiAdapter } from '@a-ds/core/adapters'; // ❌
// import { db } from '@a-ds/database'; // ❌
```

### Packages (packages/core)
```typescript
// ✅ CORRECT: Service depends on ports as types only
import type { IProjectRepository } from '../repositories/project.repository';
import type { IEmailSender } from '../adapters/email';

export interface IProjectService {
  createProject(name: string): Promise<TProject>;
}

export class ProjectService implements IProjectService {
  constructor(
    private readonly repo: IProjectRepository,
    private readonly email: IEmailSender
  ) {}

  async createProject(name: string): Promise<TProject> {
    // Business logic here
    const project = await this.repo.create({ name });
    await this.email.send({ template: 'PROJECT_CREATED' });
    return project;
  }
}

// Factory function hides repository/adapter construction
export function createProjectService(config: IProjectServiceConfig): IProjectService {
  const repo = createProjectRepository(config.database);
  const email = createEmailSender(config.emailConfig);
  return new ProjectService(repo, email);
}

// ❌ FORBIDDEN in services:
// import { ProjectRepository } from '../repositories/project.repository'; // ❌
// import { createEmailSender } from '../adapters/email'; // ❌
// import { db } from '@a-ds/database'; // ❌
```

## Configuration Files

- **turbo.json**: Turborepo task orchestration with dependency ordering
- **pnpm-workspace.yaml**: Defines workspace packages
- **.npmrc**: pnpm configuration
- **.eslintrc.js**: Root ESLint config
- **.prettierrc**: Prettier formatting rules
- **docker-compose.yml**: Local development services
- **tsconfig.json**: TypeScript configuration (each workspace has its own)
- **tsup.config.ts**: Package build configuration (in each package)
