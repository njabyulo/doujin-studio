---
inclusion: always
---

# Code Standards

## Naming Conventions

**Types**: `T` prefix → `TUser`, `TProject`, `TConnection`
**Interfaces**: `I` prefix → `IProjectService`, `IGeminiAdapter`
**Zod Schemas**: `S` prefix → `SCreateProject`, `SGenerationParams`

```typescript
// Types
export type TProject = {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
};

// Interfaces
export interface IProjectService {
  createProject(name: string): Promise<TProject>;
}

// Zod schemas (derive types with z.infer)
export const SCreateProject = z.object({
  name: z.string().min(3),
  userId: z.string(),
});
export type TCreateProject = z.infer<typeof SCreateProject>;
```

**Location**: Define in `packages/shared/src/`

## Workspace Dependencies

**ALWAYS** use `workspace:*` for internal packages (`@a-ds/*`)

```json
{
  "dependencies": {
    "@a-ds/shared": "workspace:*",
    "@a-ds/core": "workspace:*",
    "@a-ds/database": "workspace:*"
  }
}
```

## Modern JavaScript/TypeScript

**Use ES6+ features:**
- `const`/`let` (never `var`)
- Arrow functions
- `async`/`await` (not `.then()`)
- Destructuring
- Spread operator
- Nullish coalescing (`??`)
- Optional chaining (`?.`)

**Module system:**
- ES modules (`import`/`export`)
- Named exports preferred over default exports

```typescript
// ✅ GOOD
const getUser = async (userId: string): Promise<TUser | null> => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
};

const { email, name } = user ?? {};
const scopes = [...defaultScopes, ...additionalScopes];

export { ProjectService, AIService };

// ❌ BAD
var getUser = function(userId) {
  return db.select().from(users).then(function(result) {
    return result[0] || null;
  });
};

export default ProjectService;
```

## Quality Checks (MANDATORY)

**After ANY code changes, run in order:**

1. `pnpm format` - Auto-format with Prettier
2. `pnpm lint` - Check/fix ESLint issues
3. `pnpm type-check` - Verify TypeScript types

**Pre-commit requirements:**
- ❌ DO NOT commit if lint has errors/warnings
- ❌ DO NOT commit if type-check has errors
- ❌ DO NOT commit if code is unformatted
- ✅ Fix ALL issues before committing

**When checks fail:**
1. Run `pnpm format` to auto-fix formatting
2. Run `pnpm lint` to auto-fix linting (manual fixes may be needed)
3. Manually fix type errors, re-run `pnpm type-check`
4. Re-run all checks until passing

## Commit Guidelines

**Format**: Conventional commits (`<type>(<scope>): <subject>`)

**Types**: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`

**Strategy**:
- Atomic commits (one logical change)
- Group related changes together
- Include auto-formatted/updated files
- Separate formatting-only changes

```bash
# ✅ GOOD
feat(projects): add project versioning support

- Implement version tracking in ProjectService
- Add version history API endpoints
- Add tests for version management

fix(auth): handle token expiration in Better Auth flow

- Add token refresh logic when token expires
- Handle 401 errors from Better Auth
```

## Error Handling

**Domain-specific error classes:**

```typescript
export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`);
    this.name = 'ProjectNotFoundError';
  }
}
```

**Retry logic with exponential backoff:**

```typescript
async function fetchWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retryable errors
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
      }
    }
  }

  throw lastError!;
}
```

**Graceful degradation:**

```typescript
async generateScript(params: TGenerationParams): Promise<TAdScript> {
  try {
    return await this.gemini.generateScript(params);
  } catch (error) {
    if (error instanceof RateLimitError) {
      const cached = await this.cache.get(`script:${params.productDescription}`);
      if (cached) return cached;
    }
    throw error;
  }
}
```

**Never expose internals** - Don't leak stack traces or internal details to clients

## Performance & Cost

**Database optimization:**

```typescript
// ✅ GOOD - Batch query
const projects = await db
  .select()
  .from(projects)
  .where(inArray(projects.userId, userIds))
  .limit(100);

// ❌ BAD - N+1 query
for (const userId of userIds) {
  const projects = await db.select().from(projects).where(eq(projects.userId, userId));
}
```

**Caching:**

```typescript
const cached = await cache.get(`user:${userId}`);
if (cached) return cached;

const user = await fetchUserFromAPI(userId);
await cache.set(`user:${userId}`, user, 3600);
return user;
```

**Guidelines:**
- Optimize queries, use indexes, avoid N+1 problems
- Cache expensive operations
- Batch API calls and database operations
- Minimize third-party API calls
- Use connection pooling

## Pre-Commit Checklist

- [ ] Types use `T` prefix, interfaces use `I`, schemas use `S`
- [ ] Internal packages use `workspace:*`
- [ ] ES6+ features used (const/let, arrow functions, async/await)
- [ ] Named exports preferred
- [ ] `pnpm format` run and passing
- [ ] `pnpm lint` run with NO errors/warnings
- [ ] `pnpm type-check` run with NO errors
- [ ] Tests written and passing
- [ ] Domain-specific error classes used
- [ ] Database queries optimized (no N+1)
- [ ] Caching used for expensive operations
- [ ] Commit message follows conventional format
- [ ] Changes committed in logical chunks
