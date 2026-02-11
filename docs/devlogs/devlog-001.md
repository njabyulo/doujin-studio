---
title: "Devlog 001 — Cinematic Editor: Shipping the Loop, Not Just the Shell"
date: "2026-02-11"
stage: "v0-playback-loop"
owner: "N. Jabulo"
---

# TL;DR

- Shipped a working **start-from-a-file** loop: auth, project creation, local video preview, and a local-first editor.
- Implemented an API worker (Hono + D1 + Better Auth) with shared Zod contracts in `@doujin/core`.
- Added Gemini-powered **playback interpretation** (`/api/editor/interpret`) with daily credit enforcement.

# Introduction

I started this project after reading [Rohit’s roadmap tweet](https://x.com/rohit4verse/status/2009663737469542875). What stuck with me was the gap between being a “prompt engineer” and being a “systems architect.” I want to build the latter. The project I chose is a Cursor‑like editor for video, driven by multimodal AI.

I’m taking a **Lego approach**: build small, shippable components early, then connect them over time. The goal is to ship something real now (Ownership + Bias for Action) while still building toward a full system (Think Big).

# Discovery (from the Remotion editor talk)

I used [Jonny Burger’s Remotion talk](https://www.youtube.com/watch?v=gYf_FWZGHng) as a blueprint for how real editors should feel and behave. These were the notes I pinned to my wall:

- The web is a graphics engine: video, image, text, SVG, canvas.
- Remotion adds **time** as a first‑class dimension in React.
- Professional editors should hide default player controls and use custom UI.
- Use **local blob URLs** for instant preview while uploads continue.
- Uploads should go **direct to object storage** once the ingest pipeline exists.
- Rendering/export needs a separate pipeline; don’t block early editor iteration on it.

Those notes became my first concrete decision: **ship the end-to-end interaction loop first**, then evolve the orchestration and rendering pipeline.

# Design

## Diagram

**Current**

```
Auth → Create Project (API) → Local video file (client) → Blob URL preview
→ Local-first timeline state (session storage)
→ AI playback interpretation (Gemini) → structured playback commands
```

**Target**

```
Asset ingest (R2) → analysis jobs (frames + transcript)
→ scene candidates → plan-first EDL proposals → apply as versioned timeline writes
→ incremental preview + explainable undo/feedback
```

## Flow (What the user can do today)

1. Create an account or sign in.
2. Start from a local video file on `/`.
3. If authenticated, the app creates a project server-side and routes to `/projects/[id]`. If not authenticated, the selected file is held locally and resumed after sign-in.
4. Edit against a local-first timeline state and use AI to interpret playback commands (play/pause/seek).

## UI

I didn’t want the UI to look like a generic dashboard. The editor is opinionated: it treats timeline state and commands as first-class, and it intentionally de-emphasizes “player controls” in favor of an editing surface.

That’s a **Thinking Big** move disguised as a small UI task. If the UI doesn’t feel like a real editor, everything else falls apart.

### Components

#### Editor

The Remotion talk shifted me from “player with buttons” to an **editor with timeline semantics**. In the current codebase, that shows up as:

- Shared, validated timeline contracts in `@doujin/core`.
- Local-first timeline state in `apps/web` (session storage), so editing is responsive before persistence exists.
- A command-oriented approach in `packages/core/src/editor-command-engine.ts` (foundation for applying structured edits later).

### Decisions

- Visual direction: editor-first layout with a dedicated playback surface + timeline semantics.
- System direction: ship one interaction paradigm repeatedly (API + contracts + editor commands), then add “analysis legos.”

# Maintainable & Clean Code

I **Insist on Highest Standards** by:

- Keeping UI modules isolated and reusable with consistent primitives.
- Keeping the API contract-first, with shared Zod schemas in `packages/core/src/index.ts`.
- Enforcing “API lives in `apps/api`” via `scripts/check-web-api-ownership.mjs`.
- Metering AI usage by stable feature id (today: `editor_interpret`) and returning explicit quota headers.

# Problem‑Solving & Data Structures

The core editing data model is already shaped in code, even if not all of it is wired end-to-end yet:

- `@doujin/core` defines assets, timelines, versions, and command application.
- The database migrations include tables for assets, timelines, and EDL proposals.
- The web app currently runs a local-first timeline while the server-backed timeline API is built out.

The road ahead is to connect these layers without losing iteration speed.

Key system choices now:

- Contracts are the spine: Zod schemas are shared and used to validate inputs/outputs.
- Editing is command-based and validated; AI should emit bounded structures, not mutate free-form state.
- Timebase remains milliseconds in all edit contracts.

Next algorithmic steps:

- **Frames + transcript analysis** as the first multimodal lego.
- **Scene candidates** derived from analysis and cheap heuristics.
- **Plan-first EDL proposals** that are validated before apply.

# Roadmap

- **Model routing strategy**: global-first provider selection for Gemini now, Nova later.
- **Multimodal understanding**: frames + transcript (`feature=asset_analyze`).
- **Scene detection**: store candidates with evidence.
- **Intent translation**: prompt -> `StyleProfile` (`feature=editor_plan`).
- **EDL generation**: plan-first proposals using `ai_edl_proposals`, then apply as versioned timeline writes.
- **Incremental preview**: render only affected ranges.
- **Feedback + explainable undo**: reversible history + “why” grounded in evidence.
