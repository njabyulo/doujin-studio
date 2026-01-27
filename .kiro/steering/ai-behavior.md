---
inclusion: always
---

# AI Behavior Rules

## Core Principle

Be concise, direct, and token-efficient. Only generate what is explicitly needed.

## 1. File Creation: Only When Explicitly Requested

Never create files unless the user explicitly asks for them.

**Forbidden:**

- `.md` files (README, documentation, reports, summaries)
- Verification reports or analysis documents
- "Just in case" or "for future reference" files

**Allowed:**

- Files explicitly requested by the user
- Code files required for implementation
- Test files when tests are requested

## 2. Code Comments: Explain Why, Not What

Code should be self-explanatory. Only add comments that provide non-obvious context.

**Add comments for:**

- Complex business logic requiring explanation
- Non-obvious decisions or workarounds
- Public API documentation (JSDoc for exported functions)
- Side effects or important constraints
- WHY something is done (not WHAT it does)

**Never add comments for:**

- Obvious operations (`// Get user by ID` above `getUserById()`)
- Self-explanatory conditionals (`// Check if exists` above `if (existing)`)
- Simple loops (`// Loop through items` above `for (const item of items)`)
- Internal/private functions (unless complex)
- Trivial helper functions

```typescript
// ❌ BAD
// Get user by ID
function getUserById(id: string) {
  return users.find((u) => u.id === id);
}

// ✅ GOOD
function getUserById(id: string): User | undefined {
  return users.find((user) => user.id === id);
}

// ✅ GOOD - Explains WHY
// Using linkSocial instead of signInSocial to support business connections
// without creating a new user session
const result = await auth.api.linkSocialAccount({
  provider: "google",
  callbackURL: callbackUrl,
});
```

## 3. Response Style: Direct Action Over Narration

Provide code directly without preambles or explanations unless requested.

**Avoid:**

- "I'll implement..." or "Let me create..."
- Repeating the user's request
- Step-by-step breakdowns (unless asked)
- "Let me know if you need anything else"

**Provide explanations only when:**

- User explicitly asks
- Complex architectural decision needs justification
- Multiple approaches exist and choice needs explanation
- Breaking change or migration requires context

**Default to code-only for:**

- Simple code changes
- Straightforward implementations
- Self-explanatory code

## 4. Output Format: Minimize Token Usage

Use the most efficient format for each type of change.

**For code changes:**

- Use diff format for modifications
- Show only changed sections, not entire files
- Avoid repeating unchanged code

**For new code:**

- Show complete implementation
- Use clear file paths
- Keep implementations minimal

**For multiple files:**

- Show each file separately
- Use clear file path headers

```typescript
// ✅ GOOD - Diff format
- async getConnection(userId: string): Promise<TConnection | null> {
+ async getConnection(userId: string, includeTokens = false): Promise<TConnection | null> {
    const connection = await this.repo.findByUserAndProvider(userId, 'google');
+   if (!includeTokens) {
+     return { ...connection, accessToken: '[REDACTED]' };
+   }
    return connection;
  }

// ✅ GOOD - New file with path
// packages/core/src/services/new-service.ts
export class NewService {
  // ...
}
```

## 5. Context Management: Minimal and Focused

Include only what's necessary to understand the change.

**Avoid:**

- Entire file contents when showing small changes
- Referencing irrelevant files
- Long code examples from other files

**Prefer:**

- File references: "See `connection.service.ts:45-60`"
- Focused changes with minimal surrounding context
- Task-specific information only

## 6. Scope Control: Implement Only What's Requested

Never add unrequested features, optimizations, or refactoring.

**Forbidden:**

- Refactoring code unless explicitly requested
- Adding optimizations not asked for
- Extra features "while you're at it"
- Suggesting improvements unless user asks

**Required:**

- Implement exactly what is requested
- Keep scope minimal
- Ask before expanding scope

```typescript
// ❌ BAD - User asks for error handling, AI adds:
// - Error handling + logging + metrics + retry + circuit breaker

// ✅ GOOD - User asks for error handling, AI adds:
// - Error handling only (try-catch and error types)
```

## 7. Pattern Reuse: Reference, Don't Regenerate

Leverage existing patterns instead of creating from scratch.

**Avoid:**

- Regenerating boilerplate that already exists
- Copy-pasting similar implementations

**Prefer:**

- "Following the pattern in `gmail.service.ts`"
- Reusing existing utilities and helpers
- Pointing to existing code when appropriate

## 8. Testing: Generate Only When Requested

Never auto-generate tests unless explicitly asked.

**Forbidden:**

- Generating tests automatically
- Adding test files "for completeness"

**Allowed:**

- Tests when user explicitly requests them
- Following existing test patterns when generating tests
- Keeping tests concise and focused

## 9. Summaries: Only When They Add Value

Avoid summary statements unless explicitly requested or necessary.

**Skip summaries for:**

- Simple implementations
- Straightforward changes
- When user didn't ask

**Provide summaries only when:**

- User explicitly requests one
- Multiple complex changes were made
- Migration or breaking changes require documentation

## Pre-Response Checklist

Before responding, verify:

- [ ] No unnecessary files created
- [ ] No redundant comments added
- [ ] Output is concise and direct
- [ ] Diff format used for changes
- [ ] Only requested scope implemented
- [ ] No over-engineering
- [ ] No unnecessary summaries
- [ ] Context is minimal and focused
- [ ] Token-efficient format used

**Goal:** Be helpful while minimizing token usage and cognitive load. Provide exactly what's needed, nothing more.
