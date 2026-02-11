# PR/FAQ: EDL Generation (Plan Before Apply)

## Press Release

**Title**
Generate a Whole Edit Plan, Then Apply Safely

**Summary**
We introduce planning-first editing: the system generates an EDL proposal, validates it, and only then applies it as typed `TEditorCommand` mutations that create a new timeline version.

**How It Works**

- Feature id (credits-aligned): `editor_plan`.
- Storage primitive (already in repo): `ai_edl_proposals` (migration `packages/database/src/migrations/0006_edl.sql`).
- Inputs to the planner:
  - `StyleProfile` (intent translation)
  - optional `asset_analyze` signals (scene candidates, transcript evidence)
  - current `TTimelineData`
- Outputs:
  - proposal: operations JSON + summary + evidence refs
  - apply: operations -> `TEditorCommand[]` using `packages/core/src/editor-command-engine.ts`
  - new `timeline_versions` row with `source="ai"`

**Why It Matters**
Planning-first enables trust, incremental preview, and explainable undo.

## FAQ

**Why not apply edits directly?**
Plans are reviewable, diffable, and safer to validate than raw model outputs.

**Acceptance Criteria**

- Prompt -> proposal is created and persisted.
- Applying a proposal produces a new timeline version and never mutates in place.
