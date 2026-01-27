---
inclusion: always
---

# Testing Strategy

## Testing Philosophy

- **Unit tests** for business logic, utilities, isolated components
- **Chrome DevTools MCP** for end-to-end flows and integration testing
- **No traditional integration/e2e tests** - Chrome DevTools MCP handles these

## Unit Testing

### Test Location & Framework

Tests in `__tests__` folders mirroring `src` structure:

- `src/services/project.service.ts` → `__tests__/services/project.service.test.ts`
- Framework: Vitest with built-in mocking (`vi.fn()`, `vi.mock()`)

### What to Unit Test

**DO test:**

- Services: business logic, validation, error handling, orchestration
- Repositories: data access, query building, transformations
- Adapters: API integration, request/response transformation, error normalization
- Utilities: pure functions, transformations, validation
- Components: rendering, interactions, state, props

**DON'T test:**

- Database queries (use Chrome DevTools MCP)
- External API calls (mock in unit tests, test flows with Chrome DevTools MCP)
- Full user flows (use Chrome DevTools MCP)
- UI integration (use Chrome DevTools MCP)

### Test Patterns

**Service tests** - Mock repository and adapter ports:

```typescript
describe("ProjectService", () => {
  let service: ProjectService;
  let mockRepo: IProjectRepository;
  let mockEmail: IEmailSender;

  beforeEach(() => {
    mockRepo = { create: vi.fn(), findById: vi.fn() };
    mockEmail = { send: vi.fn() };
    service = new ProjectService(mockRepo, mockEmail);
  });

  it("should create project and send email", async () => {
    mockRepo.create = vi.fn().mockResolvedValue({ id: "1", name: "Test" });
    const result = await service.createProject("Test");
    expect(mockRepo.create).toHaveBeenCalledWith({ name: "Test" });
    expect(mockEmail.send).toHaveBeenCalled();
  });
});
```

**Repository tests** - Mock database client:

```typescript
describe("ProjectRepository", () => {
  let repo: ProjectRepository;
  let mockDb: Database;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      returning: vi.fn(),
    } as any;
    repo = new ProjectRepository(mockDb);
  });

  it("should insert project", async () => {
    mockDb.returning = vi.fn().mockResolvedValue([{ id: "1" }]);
    await repo.create({ name: "Test" });
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
```

**Adapter tests** - Mock external APIs:

```typescript
global.fetch = vi.fn();

describe("GeminiAdapter", () => {
  it("should call API and parse response", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "result" }] } }],
      }),
    });

    const adapter = new GeminiAdapter("key");
    const result = await adapter.generateScript({ prompt: "test" });
    expect(result.content).toBe("result");
  });
});
```

**Handler tests** - Mock service factories:

```typescript
vi.mock("@a-ds/core", () => ({
  createProjectService: vi.fn(() => ({ createProject: vi.fn() })),
}));

describe("Projects Handler", () => {
  it("should return 201 on success", async () => {
    const response = await app.request("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    expect(response.status).toBe(201);
  });
});
```

**Component tests** - Use @testing-library/react:

```typescript
describe('ProjectCard', () => {
  it('should call onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<ProjectCard project={mockProject} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(mockProject.id);
  });
});
```

### Test Organization

Use `describe` blocks for structure:

```typescript
describe("ServiceName", () => {
  describe("methodName", () => {
    it("should handle normal case", () => {});
    it("should handle error case", () => {});
  });
});
```

### Running Tests

```bash
pnpm test                           # All tests
pnpm --filter @a-ds/core test       # Specific workspace
pnpm --filter @a-ds/core test:watch # Watch mode
```

## Flow Testing with Chrome DevTools MCP

Use Chrome DevTools MCP for end-to-end flows and integration testing.

### What to Test

- Complete user journeys (login → create project → generate script → render)
- System integration (how layers work together)
- Real browser interactions and visual testing
- Real API calls and database operations

### Advantages

- Real Chrome browser testing with visual feedback
- Network and console monitoring
- Performance metrics
- No brittle test code to maintain

### Example Scenarios

**Project creation:** Navigate → click "Create Project" → fill form → submit → verify in list

**AI generation:** Open project → click "Generate Script" → fill description → add URL → submit → verify streaming → verify result

**Video rendering:** Open project → select template → customize → render → monitor progress → verify download

### Available Tools

- Page navigation and interaction
- Element inspection and clicking
- Form filling and screenshots
- Network/console monitoring
- Performance tracing

## Coverage Targets

- Services: 80%+
- Repositories: 70%+
- Adapters: 70%+
- Utilities: 90%+
- Components: 70%+

Focus on critical paths and edge cases, not coverage numbers.

## Best Practices

**DO:**

- Test business logic, error handling, edge cases
- Use descriptive test names
- Keep tests isolated and independent
- Mock external dependencies (ports)
- Test one thing per test
- Use arrange-act-assert pattern

**DON'T:**

- Test implementation details
- Write dependent tests
- Mock everything (test real logic)
- Write tests just for coverage
- Skip error cases
- Write flaky tests

## Summary

**Unit tests** (`__tests__` folders): Services, repositories, adapters, utilities, components

**Chrome DevTools MCP**: User flows, integration, UI interactions, real API/DB operations

**No traditional e2e/integration tests** - Chrome DevTools MCP handles these scenarios
