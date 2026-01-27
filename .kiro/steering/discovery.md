---
inclusion: always
---

# Discovery and Planning Rules

## Core Principle

**NEVER implement without discovery first.** Start with customer need → define success metrics → design solution → implement.

Before writing code:
1. Understand the problem and customer need
2. Define quantifiable success metrics
3. Research codebase patterns and similar implementations
4. Break down into actionable subtasks
5. Identify dependencies, risks, constraints
6. **Ask clarifying questions for any ambiguity**
7. **Escalate critical decisions to human**
8. Document findings and plan

## Discovery Checklist

### 1. Understand the Problem

- [ ] Read ticket thoroughly - what problem are we solving?
- [ ] Identify customer need and value proposition
- [ ] Define quantifiable success metrics (latency, throughput, error rates)
- [ ] Clarify acceptance criteria - how do we know it's done?
- [ ] Identify stakeholders and related work
- [ ] **Ask clarifying questions if anything is unclear**

### 2. Research Codebase

- [ ] Search for similar implementations (`grepSearch`)
- [ ] Review architecture patterns and existing types/interfaces
- [ ] Check related services/repositories/adapters
- [ ] Review database schema

### 3. Research External Dependencies

- [ ] Read official documentation for libraries/APIs
- [ ] Check API specs, version compatibility, breaking changes
- [ ] Research best practices

**Tools:** `mcp_ontext7_resolve_library_id`, `mcp_ontext7_query_docs`, `remote_web_search`, `webFetch`

### 4. Technology Comparison (if needed)

When choosing between options:
- [ ] List 2-3 viable alternatives
- [ ] Compare pros/cons (performance, compatibility, cost)
- [ ] Check existing usage in codebase
- [ ] Document decision with reasoning

### 5. Define Requirements

**Functional:**
- [ ] List features, inputs/outputs, edge cases
- [ ] Define error handling approach

**Non-Functional:**
- [ ] Performance targets (P50, P95, P99)
- [ ] Security (auth, authorization, encryption)
- [ ] Reliability (retry logic, graceful degradation)
- [ ] Cost implications

### 6. Identify Dependencies & Risks

- [ ] Upstream/downstream dependencies
- [ ] External services, APIs, libraries
- [ ] Database schema changes
- [ ] Technical and business risks
- [ ] Constraints (time, budget, capacity)

### 7. Break Down the Ticket

- [ ] Create specific, testable subtasks (completable in hours)
- [ ] Order by dependencies
- [ ] Estimate effort
- [ ] Define test strategy

## Asking Clarifying Questions

**CRITICAL: Ask the user for clarification before implementing if anything is unclear, ambiguous, or missing.**

### When to Ask

- Unclear or missing requirements
- Conflicting information or multiple interpretations
- Unknown constraints (performance, security)
- Architecture decisions between approaches
- Edge cases needing clarification
- Assumptions requiring validation

### Question Types

**Requirements:** Functionality details, edge case behavior, validation rules, business logic

**Technical:** Technology choices, architecture patterns, performance/security requirements

**Scope:** What's included/excluded, MVP vs full feature, phase boundaries

**Data:** Required fields, validation, relationships, migrations, retention policies

### Effective Question Format

✅ **GOOD:**
1. Provide context (what you researched and understand)
2. State the ambiguity clearly
3. Offer 2-3 options with implications
4. Explain how answer affects implementation

❌ **BAD:**
- Vague questions without context
- Questions showing no research
- Questions answerable from ticket
- No demonstration of understanding

### When NOT to Proceed

**STOP if:**
- Core requirement unclear (don't know what to build)
- Critical technical decisions unresolved (affects architecture)
- Data schema ambiguous (affects database design)
- Security requirements unclear (affects approach)
- Integration points undefined (affects API design)
- Success criteria vague (won't know when done)

**CAN proceed if:**
- Question about edge cases handleable later
- Question about UI polish not affecting core functionality
- Can implement flexible solution supporting multiple options
- Question about future phases, not current scope

**Document assumptions:**
```typescript
/**
 * Implementation Plan: [Feature]
 *
 * Assumptions (pending clarification):
 * - [List assumptions]
 *
 * Questions asked:
 * - [List questions and responses]
 */
```

## Critical Decisions: Human-in-the-Loop

**CRITICAL: Escalate decisions that significantly impact architecture, security, UX, or scope to the human.**

### What Requires Human Input

A decision is **critical** if it:
- Changes system design, patterns, or structure
- Affects authentication, authorization, encryption
- Significantly alters user interaction
- Adds/removes features or changes deliverables
- Has cost implications (infrastructure, licensing)
- Creates technical debt or breaks existing patterns
- Requires new dependencies (libraries, services)
- Changes database schema or data relationships
- May significantly impact performance

### When to Escalate

**MUST escalate:**
- Architecture pattern choices
- Security approaches (auth, encryption, secrets)
- Technology selection between viable options
- Scope changes (adding/removing features)
- Breaking changes (APIs, migrations, patterns)

**CAN decide independently:**
- Implementation details within established patterns
- Code organization within existing structure
- Test strategy and organization
- Variable naming and code style
- Internal helper functions
- Non-behavior-changing refactoring

### Decision Presentation Format

```markdown
## Critical Decision: [Topic]

### Context
[Why decision is needed]

### Research
[What you learned]

### Options

**Option A:** [Approach]
- Pros: [List]
- Cons: [List]
- Impact: Architecture, security, performance, cost, timeline

**Option B:** [Approach]
- Pros: [List]
- Cons: [List]
- Impact: Architecture, security, performance, cost, timeline

### Recommendation
[Your recommendation and reasoning]

### Questions
1. [Specific questions for decision maker]

**Please select Option A, B, or provide alternative guidance.**
```

### Document Decisions

```typescript
/**
 * Critical Decisions Made:
 *
 * 1. [Decision Name]
 *    Decision: [Option chosen]
 *    Made by: [Human/date]
 *    Rationale: [Why]
 *    Impact: [Effects]
 */
```

### Immediate Escalation Required

- Decision affects security and you're uncertain
- Could cause data loss or corruption
- Breaks existing functionality
- Requires significant budget approval
- Conflicts with policies or compliance

**DO NOT proceed until critical decisions are resolved.**

## Discovery Workflow

1. **Read Ticket** - Read 2-3 times, identify requirements, note unclear points, ask questions
2. **Clarify** (if needed) - List unclear points, ask specific questions, wait for responses, document answers
3. **Research** - Search codebase, research dependencies, compare options, review patterns
4. **Plan** - Break into subtasks, identify dependencies/risks, ask additional questions, identify critical decisions
5. **Decide** (if needed) - Research options, present to human, wait for decisions, document rationale
6. **Document** - Record findings, approach, breakdown, assumptions, questions/answers, decisions
7. **Review** (if complex) - Get feedback, adjust plan, ask follow-ups, confirm decisions
8. **Implement** - Follow patterns, write tests, document, ask questions if issues arise

## Pre-Implementation Checklist

- [ ] Requirements understood, customer need defined
- [ ] Quantifiable success metrics defined
- [ ] All ambiguities clarified with user
- [ ] Critical decisions identified and resolved
- [ ] Codebase searched for similar implementations
- [ ] External dependencies researched
- [ ] Technology options compared (if applicable)
- [ ] Functional and non-functional requirements defined
- [ ] Dependencies and risks identified
- [ ] Ticket broken into clear subtasks
- [ ] Research and plan documented
- [ ] Approach follows existing patterns
- [ ] Assumptions documented
- [ ] Questions/answers documented

**Only implement when checklist complete. If critical questions or decisions remain, STOP and ask the user.**
