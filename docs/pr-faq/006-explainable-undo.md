# PR/FAQ: Explainable Edits and Undo/Redo

## Press Release

**Title**
Every Edit Comes with a Reason and a One-Click Undo

**Summary**
Each AI edit now stores not only what changed, but why. Users can ask "Why did you cut here?" and undo with confidence.

**Customer Quote**
"I trust the assistant more because it can justify every decision and I can revert in one click." 

**How It Works**
- Attach a rationale string and evidence refs to each EDL change.
- Track an edit history graph (not just linear undo).
- Expose an explanation panel in the chat UI.

**Why It Matters**
Transparency builds trust and makes AI edits feel collaborative, not opaque.

## FAQ

**Is this just for AI edits?**
No. Manual edits also log intent so the history remains coherent.

**Does this bloat storage?**
Rationales are short strings and diffs; storage impact is minimal.

**Can users export the rationale log?**
Yes. It can be exported with the EDL for auditability.
