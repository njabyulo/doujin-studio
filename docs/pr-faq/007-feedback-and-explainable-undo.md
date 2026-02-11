# PR/FAQ: Feedback + Explainable Undo/Redo

## Press Release

**Title**
Every Edit Is Reversible, and Every Change Has a Reason

**Summary**
We add an edit history model that supports undo/redo via timeline versions and preserves the reasoning and evidence behind AI-generated changes. Feedback like "too dark" becomes a first-class signal that improves the next plan.

**How It Works**

- Depends on: server-backed timeline versions + stored EDL proposals.
- Undo/redo: navigate versions; selective revert can be added later.
- Reasoning:
  - store plan summary + per-operation rationale + evidence refs (scene id, transcript span).
- Feedback:
  - store explicit feedback events and use them to adjust future `StyleProfile` defaults.

**Why It Matters**
Trust is the difference between a demo and a tool editors rely on.

## FAQ

**Can users ask "why did you cut here"?**
Yes. The answer comes from stored rationale + evidence refs.

**Does feedback make the system unpredictable?**
No. Preferences are transparent, editable, and applied with confidence thresholds.

**Acceptance Criteria**

- Every AI apply can be explained and reverted.
- Feedback is stored and influences subsequent planning deterministically.
