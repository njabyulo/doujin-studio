# PR/FAQ: Multimodal Understanding (Frames + Transcript)

## Press Release

**Title**
Video That the System Can See and Hear

**Summary**
We introduce `asset_analyze`: a repeatable analysis pipeline that produces two foundational artifacts per uploaded video: sampled frames with visual labels and a timestamped transcript. These become the inputs to scene detection and EDL planning.

**How It Works**

- Feature id (credits-aligned): `asset_analyze`.
- Inputs (v1):
  - Frames sampled in `apps/web` (video element -> canvas) with `atMs` timestamps.
  - Audio chunks sampled in `apps/web` (WebAudio decode/encode) with `startMs/endMs`.
- `apps/api` calls Gemini 3 using the existing AI Studio API-key flow (same pattern as `apps/api/src/routes/editor.ts`).
- Output: compact, typed `AssetAnalysis` JSON:
  - transcript segments: `[ { startMs, endMs, text, confidence? } ]`
  - frame tags: `[ { atMs, tags: string[], notes? } ]`
  - optional: on-screen text hints (if extracted) and per-window summaries.

**Why It Matters**
This is the analysis lego that sits between Assets and Planning: everything downstream (scene detection, intent translation, planning) can reference stable timecoded evidence.

## FAQ

**Why extract frames/audio in the web app?**
It keeps model keys server-side while avoiding server-side video decoding initially.

**Where is the analysis stored?**
Store as a compact JSON blob (DB row or R2 object) keyed by `assetId` and `analysisVersion`.

**What happens if AI is unavailable?**
`asset_analyze` returns `AI_UNAVAILABLE` (no silent fallback).

**Acceptance Criteria**

- Given an uploaded asset, we can fetch a timestamped transcript and frame-level tags.
- Analysis requests are metered under `feature=asset_analyze`.
