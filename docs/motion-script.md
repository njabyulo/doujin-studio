Use
- remotion best practice skills
- chrome devtools mcp to visually see (http://localhost:3000)
- codebase /Users/njabulo/Documents/development/playground/i/media

Create the video in /Users/njabulo/Documents/development/playground/i/media/apps/my-video


# Launch Video Motion Script (Remotion)

Project: `i/media`
Duration target: 60–75s
Aspect: 16:9 primary, safe for 1:1 and 9:16 crops
Tone: crisp, modern, product‑first

---

## 1) Overview
This script is structured as a scene list with Remotion‑friendly timing, copy, VO (optional), and motion/transition notes. Use it as the blueprint for a Remotion composition and then map each scene to a `Sequence` with consistent timing.

- Frame rate: 30fps
- Total length target: 1:10 (2100 frames)
- Style tokens (suggested):
  - Primary: `#0F172A` (slate)
  - Accent: `#22C55E` (green)
  - Secondary accent: `#38BDF8` (sky)
  - Background: off‑white `#F8FAFC`
  - Type: display `Space Grotesk`, body `Inter`

---

## 2) Scene List (Time‑coded)

### Scene 1 — Cold Open (0:00–0:05 | 150f)
**On‑screen copy:**
- Big: “Media that ships.”
- Small: “Launch faster with i/media”

**VO (optional):** “Media that ships.”

**Motion:**
- Text scales from 0.9 → 1.0 with subtle blur‑in.
- Background gradient sweep left→right.

**Transition:** quick cut with light flash (2–3 frames).

---

### Scene 2 — Problem (0:05–0:12 | 210f)
**On‑screen copy:**
- Title: “Creative bottlenecks”
- Bullets (stagger in):
  - “Last‑minute edits”
  - “Version sprawl”
  - “Slow approvals”

**VO:** “Teams lose momentum when media slows the launch.”

**Motion:**
- Bullet list appears with 6‑frame stagger, 12px vertical rise.
- Subtle background noise texture.

**Transition:** slide‑left.

---

### Scene 3 — The Shift (0:12–0:18 | 180f)
**On‑screen copy:**
- Big: “Build once. Launch everywhere.”

**VO:** “i/media is the system for launch‑ready content.”

**Motion:**
- Kinetic type; each word pops in on beat.

**Transition:** diagonal wipe.

---

### Scene 4 — Product Montage (0:18–0:33 | 450f)
**On‑screen copy:**
- Header: “One workspace”
- Cards (3):
  1) “Templates”
  2) “Automations”
  3) “Render pipeline”

**VO:** “Templates, automations, and a reliable render pipeline in one workspace.”

**Motion:**
- 3 cards slide up with shadow and parallax.
- Subtle hover‑like micro motion (2px float).

**Transition:** zoom‑out to reveal next scene.

---

### Scene 5 — Feature Focus: Templates (0:33–0:42 | 270f)
**On‑screen copy:**
- Title: “Templates that adapt”
- Subtitle: “Swap inputs, keep quality.”

**VO:** “Start from templates that adapt to your launch.”

**Motion:**
- Mock UI frame with content changing (cross‑fade between versions).
- Highlight stroke animates around key area.

**Transition:** quick cross‑fade.

---

### Scene 6 — Feature Focus: Automations (0:42–0:50 | 240f)
**On‑screen copy:**
- Title: “Automate the busywork”
- Subtitle: “Render on schedule. Notify on finish.”

**VO:** “Automate renders and approvals.”

**Motion:**
- Timeline path draws across screen; icons pop on nodes.

**Transition:** horizontal blur.

---

### Scene 7 — Feature Focus: Pipeline (0:50–0:58 | 240f)
**On‑screen copy:**
- Title: “A pipeline you can trust”
- Subtitle: “Fast previews. Reliable exports.”

**VO:** “The pipeline is built for speed and reliability.”

**Motion:**
- Progress bar fills, numbers count up.
- Export icon scales in.

**Transition:** hard cut with click SFX.

---

### Scene 8 — Proof / Metrics (0:58–1:05 | 210f)
**On‑screen copy:**
- Stat 1: “3× faster launch media”
- Stat 2: “50% fewer revisions”
- Stat 3: “24/7 automated renders”

**VO:** “Ship faster with fewer revisions.”

**Motion:**
- Stats count‑up. Each stat appears with tick sound.

**Transition:** fade to brand.

---

### Scene 9 — Call to Action (1:05–1:10 | 150f)
**On‑screen copy:**
- Big: “Launch with i/media”
- Button: “Get started”
- Small: “docs.imedia.dev” (placeholder)

**VO:** “Launch with i/media.”

**Motion:**
- Logo draws in with stroke reveal.
- Button pulses once.

**End:** hold on CTA for 1s.

---

## 3) Remotion Structure (Suggested)

- `src/LaunchVideo.tsx`
  - `<Composition id="LaunchVideo" durationInFrames={2100} fps={30} width={1920} height={1080} />`
- `src/scenes/Scene01_ColdOpen.tsx` … `Scene09_CTA.tsx`
- `src/components/TypeIn.tsx`, `Card.tsx`, `StatCount.tsx`
- `src/styles/tokens.ts`

**Scene timing map:**
- S1: 0–150
- S2: 150–360
- S3: 360–540
- S4: 540–990
- S5: 990–1260
- S6: 1260–1500
- S7: 1500–1740
- S8: 1740–1950
- S9: 1950–2100

---

## 4) Production Notes
- Keep UI mockups high‑contrast and minimal.
- Favor single focal point per scene.
- Avoid long paragraphs; 4–6 words per line max.
- Sound design optional but recommended (soft clicks, whooshes).
- All copy should be editable in a `content.ts` file.

---

## 5) Next Steps
- Confirm brand colors and fonts.
- Decide on real metrics or placeholders.
- Provide any UI screenshots or Figma exports for the montage.

