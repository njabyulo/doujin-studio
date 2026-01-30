# DevLog 001: Building an AI-Powered Video Ad Generator

## 🎬 The Vision

I'm building an AI ad creation tool that turns any URL into a professional 30-second video ad. Think of it as your personal video production team, powered by AI.

**The flow is simple:**

1. Drop in a URL (product page, website, anything)
2. AI analyzes it and generates a compelling script
3. Customize the video in real-time
4. Export a production-ready MP4

## 🛠️ Tech Stack Decisions

After researching similar tools (Vibe Studio, Creatify), I chose a modern, cost-effective stack:

**Frontend:**

- Next.js 16 (App Router) - Fast, SEO-friendly, great DX
- Remotion - React-based video rendering (open-source!)
- Tailwind CSS + shadcn/ui - Beautiful UI without the bloat

**Backend:**

- Hono API - Lightweight, fast, TypeScript-first
- Google Gemini 2.5 Flash - Affordable AI with great quality
- AWS Lambda + S3 - Serverless, pay-per-use scaling

**Architecture:**

- Monorepo (pnpm + Turborepo) - Clean separation, shared code
- Hexagonal architecture - Testable, maintainable, scalable
- SST for infrastructure - Infrastructure as code, type-safe

## 💡 Key Technical Challenges

### 1. Real-Time Video Preview

Building a smooth video editor in the browser was tricky. Remotion's Player component handles the heavy lifting, but I had to build custom controls for:

- Scrubbing through the timeline
- Play/pause with frame-accurate seeking
- Real-time updates as users edit

### 2. AI Script Generation

Getting Gemini to consistently output structured ad scripts required careful prompt engineering. The AI needs to:

- Analyze URL content
- Generate 3-6 compelling scenes
- Include timing, text overlays, and transitions
- Match brand voice and style

### 3. Video Rendering at Scale

Remotion renders videos server-side, which is CPU-intensive. Solution:

- AWS Lambda with 3GB memory
- 15-minute timeout for complex renders
- S3 for video storage
- Background job processing (coming soon)

## 🎨 What's Working

✅ URL-to-script AI generation (Gemini integration)
✅ Real-time video preview with custom player
✅ Scene-by-scene editing
✅ Video export to MP4
✅ Serverless infrastructure (scales automatically)

## 🚧 What's Next

**Phase 1 (Current):**

- [ ] Multiple video templates
- [ ] Asset library (upload images, videos, audio)
- [ ] User authentication (Better Auth)
- [ ] Project management

**Phase 2:**

- [ ] Advanced text animations
- [ ] Multiple aspect ratios (16:9, 9:16, 1:1)
- [ ] Background music library
- [ ] Batch rendering

**Phase 3:**

- [ ] Team collaboration
- [ ] Template marketplace
- [ ] Analytics dashboard

## 📊 Cost Analysis

One of my goals was keeping this affordable:

**Development:**

- Using open-source tools (Remotion, Next.js)
- Leveraging existing APIs (Gemini, AWS)
- No expensive custom ML models

**Running Costs (estimated monthly):**

- AI API (Gemini): ~$50-200
- AWS (Lambda + S3): ~$100-500
- Total: ~$150-700/month (scales with usage)

Compare this to building custom ML models or using expensive video APIs - this is 10x cheaper.

## 🤔 Lessons Learned

1. **Start with existing APIs** - Don't reinvent the wheel. Gemini + Remotion saved months of work.

2. **Serverless is perfect for this** - Video rendering is bursty. Pay-per-use makes sense.

3. **Type safety everywhere** - TypeScript + SST's type-safe infrastructure = fewer bugs, faster development.

4. **Monorepo pays off** - Shared types between frontend/backend/infrastructure eliminates sync issues.

## 🎯 Why This Matters

Video ads are expensive and time-consuming to produce. Small businesses and creators need:

- Fast turnaround (minutes, not days)
- Professional quality
- Affordable pricing
- Easy customization

This tool delivers all of that.

## 📈 Progress So Far

- ✅ POC working end-to-end
- ✅ AI generation functional
- ✅ Video rendering working
- ✅ Infrastructure deployed
- 🚧 Adding templates and customization
- 🚧 Building asset management
- 📅 User auth and projects (next week)

## 🔗 Links

- [Live Demo](#) (coming soon)
- [GitHub](#) (open-sourcing parts of it)
- [Technical Deep Dive](#) (blog post coming)

---

**Follow along** as I build this in public. Next update: Adding multiple video templates and asset library.

What features would you want in an AI video ad tool? Drop your thoughts below! 👇

#BuildInPublic #AI #VideoEditing #NextJS #Remotion #Serverless #AWS #TypeScript
