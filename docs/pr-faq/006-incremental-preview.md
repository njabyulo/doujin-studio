# PR/FAQ: Incremental Preview (Render Only What Changed)

## Press Release

**Title**
Fast Iteration by Previewing Affected Ranges Only

**Summary**
After applying an EDL, the system computes affected timeline ranges and renders previews only for those segments. Unchanged segments are reused from cache.

**How It Works**

- Depends on: versioned timelines + plan/apply producing a command diff.
- Compute affected ranges from the applied `TEditorCommand[]` and timeline diff.
- Render those ranges and cache by a stable hash of (inputs + effects + time range).

**Why It Matters**
This keeps the edit loop fast enough for real creative iteration.

## FAQ

**Is this the final export pipeline?**
No. Final export renders full timeline; incremental preview is for iteration speed.

**Acceptance Criteria**

- After an apply, preview updates without re-rendering the entire timeline.
- Unchanged segments are cache hits.
