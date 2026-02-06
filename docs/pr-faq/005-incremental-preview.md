# PR/FAQ: Incremental Preview Rendering

## Press Release

**Title**
Preview Only What Changed, Not the Whole Video

**Summary**
The editor now renders previews only for affected segments after each change. Unchanged sections are cached for instant playback.

**Customer Quote**
"I can iterate in seconds because the editor only re-renders the 5 seconds I touched." 

**How It Works**
- Track affected segments based on EDL diff.
- Render only the impacted windows.
- Cache unchanged segments and stitch for preview playback.

**Why It Matters**
Rapid iteration is the key to maintaining creative flow during AI-assisted editing.

## FAQ

**Does this reduce final quality?**
No. This is for previews only. Final export always renders full quality.

**How do we store caches?**
Local cache for previews; cloud cache for shared workspaces.

**What happens if a change affects the entire timeline?**
The system falls back to full render.
