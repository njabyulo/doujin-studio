# PR/FAQ: Gemini 3 Integration

## Press Release

**Title**
Gemini 3 Powers Multimodal Understanding in the Cinematic Editor

**Summary**
The editor now uses the Gemini 3 API to analyze video frames, audio segments, and user intent. This enables scene detection, story beat identification, and intent-to-edit translation that feel cinematic rather than generic.

**Customer Quote**
"It didn’t just caption my clip. It understood the mood and built a cut plan I could actually use." 

**How It Works**
- The client uploads media, then the backend requests Gemini 3 analysis jobs.
- Video frames and audio slices are summarized into a multimodal timeline.
- The system fuses Gemini 3 outputs into an EDL proposal that the user can review.

**Why It Matters**
This is the core hackathon requirement: a real Gemini 3 integration that does work the user cannot do manually at the same speed.

## FAQ

**Which Gemini 3 capabilities are used?**
Multimodal understanding for video and audio, plus structured output for the EDL plan.

**Where is the Gemini 3 integration described for the submission?**
The submission includes a dedicated ~200-word Gemini integration write-up that explains the input, output, and role of Gemini in the system.

**Is this a simple wrapper?**
No. Gemini outputs directly drive scene grouping, beat detection, and the EDL schema used by preview and render.

**What happens if Gemini is unavailable?**
The editor falls back to manual scene markers and a basic cut plan.
