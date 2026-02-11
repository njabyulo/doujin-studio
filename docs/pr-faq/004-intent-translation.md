# PR/FAQ: Intent Translation (Prompt -> StyleProfile)

## Press Release

**Title**
"Make It Cinematic" Becomes a Typed Edit Target

**Summary**
We add an intent translation step that compiles vague requests into a constrained `StyleProfile`. This profile becomes the planner's input, making outputs inspectable, stable, and easier to evaluate.

**How It Works**

- Feature id (credits-aligned): `editor_plan` (intent translation is part of planning).
- Input: user prompt + project context.
- Output: `StyleProfile` (Zod-validated), e.g. pacing targets, grade targets, audio priorities, caption style.
- Works without full multimodal; improves when `asset_analyze` is available.

**Why It Matters**
It closes the gap between human language and concrete timeline operations.

## FAQ

**Is this just free-form text from a model?**
No. The output is constrained and validated; invalid profiles are rejected.

**Acceptance Criteria**

- A prompt produces a valid `StyleProfile` consistently.
- The profile is stored with the plan/proposal for traceability.
