# PR/FAQ: Preference Learning Across Sessions

## Press Release

**Title**
The Editor Learns Your Style Over Time

**Summary**
The editor now captures user preferences (pacing, grade, transition style) and uses them to refine future suggestions.

**Customer Quote**
"By my third edit it already matched my pacing and color grade without asking." 

**How It Works**
- Track explicit feedback ("too dark", "more energy") and implicit edits.
- Store preference vectors per user or team.
- Apply preferences when generating new EDLs.

**Why It Matters**
Reusable style preferences turn one-off edits into a consistent creative system.

## FAQ

**Can users reset preferences?**
Yes. Preferences are editable and can be reset at any time.

**Do preferences apply to every project?**
Default is per-user, with optional per-project overrides.

**How do we avoid overfitting?**
We decay old preferences and only apply high-confidence signals.
