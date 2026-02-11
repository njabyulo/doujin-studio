# PR/FAQ: Scene Detection (Candidates + Evidence)

## Press Release

**Title**
Automatic Scene Boundaries You Can Trust

**Summary**
We add scene boundary detection as a derived output of `asset_analyze`. The system proposes cut/scene candidates with confidence and evidence, so planning can reference real story structure instead of guessing.

**How It Works**

- Depends on: `asset_analyze` artifacts (frames + transcript).
- Candidate generation (v1):
  - Fast heuristic: frame-diff spikes on sampled frames.
  - Optional confirmation: Gemini checks ambiguous boundaries and produces a confidence score.
- Output contract stored with analysis:
  - `sceneCandidates: [ { atMs, confidence, evidence: { frameAtMs, notes } } ]`

**Why It Matters**
Scene boundaries become the backbone for pacing and cut planning.

## FAQ

**Is this "final" scene detection?**
No. v1 is a candidate generator with evidence; it gets refined by feedback and better sampling.

**Does this require full video decoding server-side?**
No. v1 uses sampled frames from `apps/web`.

**Acceptance Criteria**

- For an analyzed asset, scene candidates exist with confidence and evidence pointers.
- Downstream planners can reference candidates by timecode.
