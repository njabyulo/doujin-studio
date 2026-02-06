# PR/FAQ: Multimodal Analysis Engine

## Press Release

**Title**
A Unified Understanding of Vision and Audio for Smarter Edits

**Summary**
The editor now combines video and audio embeddings to understand composition, lighting, dialogue, and mood. This powers intent translation and smarter cut decisions.

**Customer Quote**
"It understood where the energy peaks and built the pacing I wanted without me scrubbing every second." 

**How It Works**
- Extract visual embeddings per segment to capture composition and tone.
- Extract audio embeddings for dialogue, music, and ambient shifts.
- Fuse both streams to label narrative arcs and highlight key moments.

**Why It Matters**
Multimodal understanding is the difference between a generic cut and a story-driven edit.

## FAQ

**Is this run locally or in the cloud?**
Initial version runs in the cloud. We can add local inference later for privacy.

**How do we handle long videos?**
We segment by scenes and sample frames/audio for efficient analysis.

**How is this used by the editor?**
The fused embeddings feed the EDL generator and preview planner.
