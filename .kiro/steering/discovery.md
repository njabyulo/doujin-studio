---
inclusion: always
---

# Discovery and Planning

## Core Principle

**NEVER implement without discovery.** Always: understand problem → research → plan → clarify → implement.

## Discovery Steps

### 1. Understand the Problem

- What problem are we solving? What's the customer need?
- Define success metrics (latency, throughput, error rates)
- Clarify acceptance criteria
- **Ask clarifying questions if anything is unclear**

### 2. Research Codebase

- Search for similar implementations (`grepSearch`)
- Review architecture patterns, types/interfaces
- Check related services/repositories/adapters
- Review database schema

### 3. Research External Dependencies

**Tools:**

- **Context7 MCP** (preferred): `mcp_ontext7_resolve_library_id` → `mcp_ontext7_query_docs`
  - Use for: React, Next.js, Drizzle, Hono, Better Auth, official docs
  - Limit: 3 calls per question
- **Web search** (fallback): `remote_web_search`, `webFetch`
  - Use for: tutorials, troubleshooting, library comparisons

**Research:**

- Official documentation and API specs
- Version compatibility and breaking changes
- Best practices

### 4. Define Requirements

**Functional:** Features, inputs/outputs, edge cases, error handling

**Non-Functional:** Performance targets, security, reliability, cost

### 5. Identify Dependencies & Risks

- Upstream/downstream dependencies
- External services, APIs, libraries
- Database schema changes
- Technical and business risks

### 6. Break Down Work

- Create specific, testable subtasks (hours, not days)
- Order by dependencies
- Define test strategy

## Asking Clarifying Questions

**CRITICAL: Ask before implementing if anything is unclear, ambiguous, or missing.**

### When to Ask

- Unclear/missing requirements or conflicting information
- Unknown constraints (performance, security)
- Architecture decisions between approaches
- Edge cases or assumptions requiring validation

### Effective Questions

**Good format:**

1. Provide context (what you researched)
2. State the ambiguity clearly
3. Offer 2-3 options with implications
4. Explain how answer affects implementation

**Bad format:**

- Vague questions without context
- No research shown
- Questions answerable from existing info

### When to STOP vs Proceed

**STOP if:**

- Core requirement unclear
- Critical technical decisions unresolved (architecture, security)
- Data schema ambiguous
- Integration points undefined
- Success criteria vague

**CAN proceed if:**

- Edge cases handleable later
- UI polish not affecting core functionality
- Flexible solution supports multiple options
- Question about future phases

## Critical Decisions: Escalate to Human

**CRITICAL: Escalate decisions that significantly impact architecture, security, UX, or scope.**

### Must Escalate

- Architecture pattern choices
- Security approaches (auth, encryption, secrets)
- Technology selection between viable options
- Scope changes (adding/removing features)
- Breaking changes (APIs, migrations, patterns)
- Database schema or data relationships
- New dependencies (libraries, services)
- Cost implications (infrastructure, licensing)

### Can Decide Independently

- Implementation details within established patterns
- Code organization within existing structure
- Test strategy and organization
- Variable naming and code style
- Internal helper functions
- Non-behavior-changing refactoring

### Decision Presentation Format

```markdown
## Critical Decision: [Topic]

**Context:** [Why decision is needed]

**Research:** [What you learned]

**Options:**

A. [Approach]

- Pros: [List]
- Cons: [List]
- Impact: [Architecture/security/performance/cost/timeline]

B. [Approach]

- Pros: [List]
- Cons: [List]
- Impact: [Architecture/security/performance/cost/timeline]

**Recommendation:** [Your recommendation and reasoning]

**Questions:** [Specific questions for decision maker]
```

### Immediate Escalation Required

- Security uncertainty
- Potential data loss/corruption
- Breaking existing functionality
- Budget approval needed
- Policy/compliance conflicts

**DO NOT proceed until critical decisions are resolved.**

## Workflow

1. **Read** - Understand requirements, note unclear points
2. **Clarify** - Ask questions, wait for responses, document answers
3. **Research** - Search codebase, research dependencies, review patterns
4. **Plan** - Break into subtasks, identify dependencies/risks/decisions
5. **Decide** - Present options to human, wait for decisions, document
6. **Implement** - Follow patterns, write tests, ask questions if issues arise

## Pre-Implementation Checklist

Before implementing, verify:

- [ ] Requirements and customer need understood
- [ ] Success metrics defined
- [ ] All ambiguities clarified
- [ ] Critical decisions resolved
- [ ] Codebase searched for similar implementations
- [ ] External dependencies researched
- [ ] Requirements defined (functional + non-functional)
- [ ] Dependencies and risks identified
- [ ] Work broken into clear subtasks
- [ ] Approach follows existing patterns

**Only implement when checklist complete. If critical questions or decisions remain, STOP and ask.**
