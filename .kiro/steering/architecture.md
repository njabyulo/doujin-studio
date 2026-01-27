---
inclusion: always
---

# Architecture: Ports and Adapters (Hexagonal)

## Dependency Flow (Strict)

```
Handlers → Services → Ports (interfaces) → Implementations (Repos/Adapters)
```

**Critical Rules:**

- Handlers ONLY call services via factory functions (`createProjectService()`)
- Services depend ONLY on port interfaces as types (never implementations)
- Repositories/Adapters implement ports and handle infrastructure

## Forbidden Imports

**Handlers (`apps/api/src/routes/`):**

- ❌ NEVER import repositories, adapters, or DB clients
- ❌ NEVER contain business logic
- ✅ ONLY import service factory functions from `@a-ds/core`

**Services (`packages/core/src/services/`):**

- ❌ NEVER import adapter implementations or factories
- ❌ NEVER import DB/ORM clients
- ❌ NEVER know about HTTP, SQL, or external APIs
- ✅ ONLY depend on port interfaces (types only)

**Repositories/Adapters:**

- ❌ NEVER import services
- ✅ MAY import adapter implementations (repos only)
- ✅ MUST export port interface + implementation

## Layer Responsibilities

### Handlers (`apps/api/src/routes/`)

**Owns:** HTTP concerns only (request/response, validation, status codes)

**Pattern:**

```typescript
// ✅ CORRECT
import { createProjectService } from "@a-ds/core";

projects.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { name } = await c.req.json();
  if (!name) return c.json({ error: "name is required" }, 400);

  const service = createProjectService({
    database: c.get("db"),
    userId: user.id,
  });

  const project = await service.createProject(name);
  return c.json(project, 201);
});

// ❌ WRONG
import { ProjectRepository } from "@a-ds/core/repositories"; // NEVER
import { GeminiAdapter } from "@a-ds/core/adapters"; // NEVER
import { db } from "@a-ds/database"; // NEVER
```

### Services (`packages/core/src/services/`)

**Owns:** Business logic, validation, orchestration

**Pattern:**

```typescript
// ✅ CORRECT: Depend on ports as types only
import type { IProjectRepository } from "../repositories/project.repository";
import type { IEmailSender } from "../adapters/email";

export interface IProjectService {
  createProject(name: string): Promise<TProject>;
}

export class ProjectService implements IProjectService {
  constructor(
    private readonly repo: IProjectRepository,
    private readonly email: IEmailSender,
  ) {}

  async createProject(name: string): Promise<TProject> {
    if (!name || name.length < 3) {
      throw new ValidationError("Project name must be at least 3 characters");
    }

    const project = await this.repo.create({ name, userId: this.userId });
    await this.email.send({
      template: "PROJECT_CREATED",
      data: { projectName: name },
    });
    return project;
  }
}

// Factory hides infrastructure construction
export function createProjectService(
  config: IProjectServiceConfig,
): IProjectService {
  const repo = createProjectRepository(config.database);
  const email = createEmailSender({ region: "us-east-1" });
  return new ProjectService(repo, email);
}

// ❌ WRONG
import { GeminiAdapter } from "../adapters/gemini.adapter"; // NEVER
import { createGeminiAdapter } from "../adapters/gemini.adapter"; // NEVER
import { db } from "@a-ds/database"; // NEVER
```

### Repositories (`packages/core/src/repositories/`)

**Owns:** Data persistence, adapter composition

**Pattern:**

```typescript
// ✅ CORRECT: Export port + implementation
import { db } from "@a-ds/database";
import { projects } from "@a-ds/database/schema";
import { GeminiAdapter } from "../adapters/gemini.adapter";

export interface IProjectRepository {
  create(data: TProjectCreate): Promise<TProject>;
  findById(id: string): Promise<TProject | null>;
}

export class ProjectRepository implements IProjectRepository {
  constructor(
    private readonly db: Database,
    private readonly gemini: IGeminiAdapter,
  ) {}

  async create(data: TProjectCreate): Promise<TProject> {
    const [project] = await this.db
      .insert(projects)
      .values({ name: data.name, userId: data.userId })
      .returning();
    return project;
  }
}

export function createProjectRepository(
  database: Database,
): IProjectRepository {
  const gemini = new GeminiAdapter();
  return new ProjectRepository(database, gemini);
}
```

### Adapters (`packages/core/src/adapters/`)

**Owns:** External API integration, response normalization

**Pattern:**

```typescript
// ✅ CORRECT: Export port + implementation
export interface IGeminiAdapter {
  generateScript(params: TGenerationParams): Promise<TAdScript>;
}

export class GeminiAdapter implements IGeminiAdapter {
  constructor(private readonly apiKey: string) {}

  async generateScript(params: TGenerationParams): Promise<TAdScript> {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/...",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          contents: [{ parts: [{ text: params.prompt }] }],
        }),
      },
    );

    if (!response.ok) {
      throw new GeminiAPIError(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.candidates[0].content.parts[0].text,
      scenes: this.parseScenes(data),
    };
  }

  private parseScenes(data: unknown): TScene[] {
    // Keep vendor parsing private
  }
}

export function createGeminiAdapter(config: {
  apiKey: string;
}): IGeminiAdapter {
  return new GeminiAdapter(config.apiKey);
}
```

## Port Types

**Repository Ports:** Persistence boundaries (DB, cache, event store)

- `IProjectRepository`, `IAssetRepository`

**Adapter Ports:** External system boundaries (APIs, services)

- `IEmailSender`, `IGeminiAdapter`, `IOAuthClient`, `IObjectStore`

## Error Handling by Layer

- **Adapters:** Normalize provider errors (include status/code)
- **Repositories:** Convert infra errors to domain errors
- **Services:** Throw domain-specific errors
- **Handlers:** Map domain errors to HTTP status codes

## Quick Validation Checklist

Before committing, verify:

**Handlers:**

- [ ] No repository/adapter imports
- [ ] Only calls service factory functions
- [ ] No business logic

**Services:**

- [ ] Only type imports for ports
- [ ] No adapter implementation imports
- [ ] No DB/ORM imports
- [ ] No HTTP status codes

**Repositories/Adapters:**

- [ ] Exports port interface
- [ ] No service imports
- [ ] No leaked infrastructure types
