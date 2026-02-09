# PR/FAQ: Demo Video and Public Links

## Press Release

**Title**
A Full Demo You Can Watch End-to-End

**Summary**
The project now includes a public demo video and a public project link. Anyone can watch the cinematic editor workflow from upload to AI-driven edit plan.

**Customer Quote**
"I saw the full flow in under two minutes and understood the product instantly." 

**How It Works**
- The demo video is produced in `apps/video` (Remotion) to showcase `apps/web`, following the Remotion best-practices workflow.
- A `Composition` is defined in `apps/video/src/Root.tsx`, with scenes sequenced via `Sequence`.
- Visuals and audio live in `apps/video/public` and are referenced with `staticFile()`, while playback uses Remotion’s media components.
- The recording shows the upload, Gemini analysis, EDL preview, and incremental render.
- The submission includes a public project link and public repository link.

**Why It Matters**
The hackathon requires a working demo and public accessibility for judges.

## FAQ

**Where does the demo video live?**
It is linked in the Devpost submission and the project README.

**How is the demo video produced?**
The demo is rendered with Remotion in `apps/video`, using `Composition` in `src/Root.tsx`, `Sequence` for scene timing, and `staticFile()` for assets, per remotion best-practices.

**Does the demo show Gemini 3 usage?**
Yes. The demo highlights the Gemini-driven analysis and the generated edit plan.

**Is the repo public?**
Yes. The submission includes a public repository unless an AI Studio link is used instead.

**What if the demo backend is down?**
The video still demonstrates the working flow and satisfies the demo requirement.
