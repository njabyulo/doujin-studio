# PR/FAQ: Edit Decision List (EDL) Schema

## Press Release

**Title**
A Shared Edit Plan That Every Tool Can Understand

**Summary**
The editor now produces a structured Edit Decision List (EDL) that represents cuts, transitions, grades, and audio changes in a single, validated schema. This becomes the core contract between AI planning, UI, and rendering.

**Customer Quote**
"When I say 'make it cinematic,' I can see exactly what the editor plans to do before it does anything." 

**How It Works**
- Define a versioned EDL schema (JSON) with timestamps, effects, and rationale.
- Validate edits client-side and server-side before applying.
- Store the EDL as the source of truth for previews and exports.

**Why It Matters**
A stable EDL lets us plan edits once and apply them consistently across preview, render, and export.

## FAQ

**Why not just apply edits directly?**
The EDL makes edits explainable, auditable, and repeatable.

**Does this slow down iteration?**
No. It speeds iteration by enabling incremental previews and targeted updates.

**How do we handle schema changes?**
EDL is versioned; older plans are migrated or supported with adapters.

**What metadata do we store?**
Timestamps, effects, parameters, and a short rationale per edit.
