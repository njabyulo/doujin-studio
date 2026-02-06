---
title: 'Devlog 001 — Cinematic Editor: Shipping the Shell, Planning the Engine'
date: '2026-02-06'
stage: 'v0-ui'
owner: 'N. Jabulo'
---

# TL;DR

- Shipped a cinematic editor **UI shell** with upload-first flow and a responsive AI chat panel.
- Implemented **local blob preview** via `upload-session` to make the editor feel instant.

# Introduction

I started this project after reading [Rohit’s roadmap tweet](https://x.com/rohit4verse/status/2009663737469542875). The line that stuck with me was the gap between “prompt engineer” and “systems architect.” I want to build the latter. The project I chose: a Cursor‑like editor for video, driven by multimodal AI.

I’m taking a **Lego approach**: build small, shippable components early, then connect them later. The goal is to ship something real now (Ownership + Bias for Action) while building toward a full system (Think Big).

# Discovery (from the Remotion editor talk)

I used [Jonny Burger’s Remotion talk](https://www.youtube.com/watch?v=gYf_FWZGHng) as a blueprint for how real editors should feel and behave. These were the notes I pinned to my wall:

- The web is a graphics engine: video, image, text, SVG, canvas.
- Remotion adds **time** as a first‑class dimension in React.
- Professional editors should hide default player controls and use custom UI.
- Use **local blob URLs** for instant preview while uploads continue.
- Uploads should go **direct to S3 via presigned URLs**.
- Render/export uses Remotion Lambda; progress via polling.

Those notes became my first concrete decision: **ship the shell + blob preview now**, and make the S3 + Gemini pipeline the next milestone.

# Design

## Diagram

**Current**

```
Upload (client) → Blob URL → Editor UI (local preview)
```

**Target**

```
Upload → Blob URL preview → S3 presigned upload → Gemini 3 multimodal analysis
→ EDL generation → incremental preview → render pipeline
```

## Flow (What the user can do today)

1. Upload the clip on `/`.
2. Immediate playback in `/projects/[id]` using a blob URL.
3. Cinematic editor layout with tool rail, timeline dock, and AI chat (stubbed).

## UI

I didn’t want the UI to look like a generic dashboard. I spent time on Pinterest, Behance, and Dribbble, then used the [Anthropic Frontend Design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) skill to push the interface toward a “cinematic studio” feel rather than a typical SaaS layout.

That’s a **Thinking Big** move disguised as a small UI task. If the UI doesn’t feel like a real editor, everything else falls apart.

### Components

#### Editor

The Remotion talk shifted me from “player with buttons” to **editor with a timeline**. Instead of default controls, I built the layout around the timeline dock and custom UI. I also started leaning on [Remotion's Best Practices Agent Skills](/Users/njabulo/.agents/skills/remotion-best-practices/SKILL.md) for how assets and compositions should eventually be organized, even if the render system isn’t wired yet.

### Decisions

- Visual direction: warm clay backgrounds, deep charcoal panels, neon‑lime accents.
- Design system: custom tokens + shadcn primitives.

# Maintainable & Clean Code

I **Insist on Highest Standards** by:

- Keeping UI modules isolated and reusable with consistent primitives.
- Implementing React performance patterns such as **memoization + stable props**, aligned with [Vercel React Best Practices Agent Skills](https://vercel.com/blog/introducing-react-best-practices).
- Using a clean upload session boundary so future S3 upload logic can be swapped in without refactoring the UI.

# Problem‑Solving & Data Structures

Right now the system is simple, but the road ahead isn’t. I’m explicitly designing for the next algorithmic steps:

- **Scene segmentation** using frame‑diff thresholds + embedding similarity.
- **EDL scheduling** as an interval list or DAG to support non‑linear edits.

# Roadmap

- Add background S3 uploads (presigned URLs) while keeping local preview.
- Introduce EDL schema and validation layer.
- Implement scene detection + story beats pipeline.
- Add Gemini 3 multimodal analysis + EDL generation.
- Build incremental preview renderer for edits.
