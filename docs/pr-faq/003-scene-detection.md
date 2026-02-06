# PR/FAQ: Scene Detection and Story Beats

## Press Release

**Title**
Auto-Detect Cuts and Story Beats to Speed Up Cinematic Edits

**Summary**
The editor now detects scene boundaries and major story beats using frame differences and embedding similarity. This gives the AI a reliable structure for pacing and transitions.

**Customer Quote**
"It found my best beats in seconds. I started with a cut plan instead of a blank timeline." 

**How It Works**
- Use frame-diff thresholds to find hard cuts.
- Use embeddings to group visually similar segments into scenes.
- Combine with audio energy changes to tag story beats.

**Why It Matters**
Scene detection provides the scaffolding for intent-based edits like "make this cinematic" or "speed up the middle."

## FAQ

**Will it mis-detect fast motion?**
We blend frame diffs with embeddings and audio cues to reduce false positives.

**Is this real-time?**
First pass runs on upload; later we can incrementally update per segment.

**Can users override boundaries?**
Yes. Users can merge/split scenes and the EDL updates.
