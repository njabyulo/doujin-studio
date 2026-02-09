# PR/FAQ: Epic F — Background Processing Lego (future Storage + EDL pipeline)

## Press Release

**Title**  
Background Processing Foundation for Post-Upload Artifacts and Timeline Export

**Summary**  
Epic F introduces the next orchestration Lego: async artifact generation after upload and a placeholder export workflow for timeline EDL artifacts. This work is planned to keep upload UX fast while enabling richer downstream processing.

## F1. Queue: "generate poster + waveform metadata"

**Status**  
Planned (not yet implemented)

**Goal**  
Async processing foundation.

**Planned flow**  
- On asset upload completion, enqueue a job.
- A worker consumer processes the job, writes artifacts to R2, and updates DB records.

**Acceptance criteria**  
Poster and waveform metadata appear after upload without blocking UI.

## F2. Workflow: EDL export pipeline (placeholder)

**Status**  
Planned (not yet implemented)

**Goal**  
The orchestration Lego for “EDL pipeline later”.

**Planned flow**  
- Define a workflow that loads the latest timeline version.
- Generate EDL JSON (with CMX3600 support planned later).
- Write the export artifact to R2 and mark the export record in the database.

**Acceptance criteria**  
`POST /timelines/:id/export` produces an artifact in R2.

## FAQ

**Is `POST /timelines/:id/export` available now?**  
No. It is a planned placeholder interface for this epic.

**Will this block current upload and editing flows?**  
No. The intent is to keep current UI flows non-blocking while background processing runs asynchronously.

**Why split this into queue + workflow pieces?**  
It keeps the storage artifact generation and timeline export orchestration modular so each part can evolve independently.
