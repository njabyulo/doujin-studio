---
title: 'Devlog 001 — Cinematic Editor: Shipping the Loop, Not Just the Shell'
date: '2026-02-09'
stage: 'v0-loop'
owner: 'N. Jabulo'
---

# TL;DR

- Shipped a working upload-to-edit loop: auth, upload, timeline persistence, and AI chat edits.
- Implemented fast local preview + Cloudflare R2-backed uploads with poster generation.
- Wired Gemini chat to real tool-calling so prompts can persist timeline edits.

# Introduction

I started this project after reading [Rohit’s roadmap tweet](https://x.com/rohit4verse/status/2009663737469542875). What stuck with me was the gap between being a “prompt engineer” and being a “systems architect.” I want to build the latter. The project I chose is a Cursor‑like editor for video, driven by multimodal AI.

I’m taking a **Lego approach**: build small, shippable components early, then connect them over time. The goal is to ship something real now (Ownership + Bias for Action) while still building toward a full system (Think Big).

# Discovery (from the Remotion editor talk)

I used [Jonny Burger’s Remotion talk](https://www.youtube.com/watch?v=gYf_FWZGHng) as a blueprint for how real editors should feel and behave. These were the notes I pinned to my wall:

- The web is a graphics engine: video, image, text, SVG, canvas.
- Remotion adds **time** as a first‑class dimension in React.
- Professional editors should hide default player controls and use custom UI.
- Use **local blob URLs** for instant preview while uploads continue.
- Uploads should go **direct to object storage via presigned URLs**.
- Render/export uses Remotion Lambda, with progress tracked via polling.

Those notes became my first concrete decision: **ship the end-to-end interaction loop first**, then evolve the orchestration and rendering pipeline.

# Design

## Diagram

**Current**

```
Auth → Upload (client) → Blob URL preview + R2 upload session
→ Timeline versioning → AI chat (Gemini tool-calls) → persisted timeline edits
```

**Target**

```
Upload complete → background artifact jobs (poster/waveform)
→ richer multimodal analysis → EDL export workflow → incremental preview/render
```

## Flow (What the user can do today)

1. Create an account or sign in.
2. Upload from `/` and get immediate local preview while cloud upload completes.
3. Land in `/projects/[id]` with a created/loaded timeline and autosave/manual versioning.
4. Use AI chat; prompt-driven edits are streamed and applied as structured timeline commands.

## UI

I didn’t want the UI to look like a generic dashboard. I spent time on Pinterest, Behance, and Dribbble, then used the [Anthropic Frontend Design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) skill to push the interface toward a “cinematic studio” feel rather than a typical SaaS layout.

That’s a **Thinking Big** move disguised as a small UI task. If the UI doesn’t feel like a real editor, everything else falls apart.

### Components

#### Editor

The Remotion talk shifted me from “player with buttons” to an **editor with timeline semantics**. Instead of default controls, I built around timeline state, versioned saves, and command-based edits. I also leaned on Remotion best-practices guidelines for timing discipline and future rendering constraints.

### Decisions

- Visual direction: warm clay backgrounds, deep charcoal panels, neon‑lime accents.
- Design system: custom tokens + shadcn primitives.

# Maintainable & Clean Code

I **Insist on Highest Standards** by:

- Keeping UI modules isolated and reusable with consistent primitives.
- Implementing React performance patterns such as **memoization + stable props**, aligned with [Vercel’s React best practices](https://vercel.com/blog/introducing-react-best-practices).
- Keeping the API contract-first, with shared Zod schemas in `packages/contracts`.
- Using bounded AI tool-calling and versioned timeline writes to prevent unbounded mutations.

# Problem‑Solving & Data Structures

The core data model now exists: assets, timelines, timeline versions, and command application. The road ahead is orchestration and intelligence depth.

Key system choices now:

- Timeline is the source of truth, versioned with optimistic locking.
- AI edits are command-based and validated, not free-form text mutations.
- Timebase remains milliseconds in editing contracts.

Next algorithmic steps:

- **Scene segmentation** using frame‑diff thresholds + embedding similarity.
- **EDL scheduling/export** as stable machine-readable artifacts.

# Roadmap

- **EDL schema**: strengthen edit contract for planning, preview, and export.
- **Scene detection**: detect cut points and story beats.
- **Multimodal analysis**: fuse visual/audio understanding for better suggestions.
- **Incremental preview**: render only changed segments for faster iteration.
- **Explainable undo**: rationale + reversible edit history for trust.
- **Preference learning**: adapt suggestions to user style over time.
- **Background processing Lego**: queue/workflow foundation for poster + waveform jobs and the future `POST /timelines/:id/export` flow.
