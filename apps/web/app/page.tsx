"use client";

import type { TStoryboard } from "@a-ds/remotion";
import {
  ArrowUpRight,
  AudioLines,
  PenSquare,
  Sparkles,
  Timer,
  Workflow,
} from "lucide-react";
import { useCallback, useState } from "react";
import { AiChatInput } from "~/components/domain/ai-chat-input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Editor } from "../components/domain/editor";

const HERO_STATS = [
  { value: "12K+", label: "Ads generated" },
  { value: "6hr", label: "Average time saved" },
  { value: "98%", label: "On-brand confidence" },
];

const TRUSTED = ["Aspect", "Northwind", "Aperture", "Sundial", "Orbiton"];

const SAMPLE_PROMPTS = [
  {
    label: "Launch sprint",
    prompt:
      "Draft a 15-second launch sprint for a new wearable that leans on motion cues.",
  },
  {
    label: "Founder letter",
    prompt:
      "Outline a founder letter video with three testimonial beats and a calm voiceover.",
  },
  {
    label: "UGC duo",
    prompt:
      "Give me a duo-style UGC storyboard for a productivity app with hooks in the first 3 seconds.",
  },
];

const COURSE_BLUEPRINTS = [
  {
    id: "stoic",
    title: "Stoic Principles for Modern Success",
    prompt: "The Stoic's guide to modern success",
    modules: [
      "Introduction to Stoicism",
      "The Four Cardinal Virtues",
      "Dichotomy of Control",
      "Managing Emotions",
      "Improving Decision-Making",
      "Building Resilience",
      "Fostering Meaningful Relationships",
      "Stoicism in Modern Life",
    ],
  },
  {
    id: "marketing",
    title: "AI for Modern Marketing",
    prompt: "How to use AI for marketing",
    modules: [
      "AI-driven segmentation",
      "Personalized content",
      "Predictive analytics",
      "Creative testing",
      "Workflow automation",
    ],
  },
  {
    id: "sales",
    title: "Foundations of Sales Mastery",
    prompt: "Mastering sales",
    modules: [
      "Understanding customer needs",
      "Effective communication",
      "Product storytelling",
      "Objection handling",
      "Closing playbook",
    ],
  },
  {
    id: "succession",
    title: "Succession Planning Essentials",
    prompt: "I want to learn succession planning",
    modules: [
      "Identifying critical roles",
      "Assessing successors",
      "Developing talent",
      "Implementing the plan",
      "Reviewing and updating",
    ],
  },
];

const WORKFLOW_STEPS = [
  {
    title: "Collect context",
    description:
      "Drop a URL, assets, and previous winners. We ingest palettes, copy, compliance notes, and tone automatically.",
    icon: Workflow,
    tag: "01",
  },
  {
    title: "Draft & remix",
    description:
      "Storyboard blocks stay editable. Spin variants for channels or personas without losing approvals.",
    icon: PenSquare,
    tag: "02",
  },
  {
    title: "Ship everywhere",
    description:
      "Hand off decks, export Remotion projects, or trigger renders directly from the assistant.",
    icon: AudioLines,
    tag: "03",
  },
];

const EXAMPLE_SHOWCASE = [
  {
    title: "Lumina Bikes Night Sprint",
    format: "16:9 launch film",
    result: "+41% view-through rate",
    description:
      "URL import pulled palette + VO cadence, then AI proposed camera moves and matched emphasis to each scene.",
  },
  {
    title: "Northwind Desk Refresh",
    format: "9:16 social stack",
    result: "2x swipe-ups",
    description:
      "UGC duo template remixed with compliance guardrails, multi-language captions, and automated CTA swaps.",
  },
  {
    title: "Sundial Hotels Moments",
    format: "Square carousel",
    result: "-60% production time",
    description:
      "Combined storyboards and Remotion exports so the in-house team only tweaked motion curves before shipping.",
  },
];

export default function Home() {
  const [storyboard, setStoryboard] = useState<TStoryboard | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleGenerate = async (url: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate storyboard");
      }

      const text = await response.text();
      const storyboardData = JSON.parse(text);
      setStoryboard(storyboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5FBE6] text-[#233D4D]">
      {!storyboard && (
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
          <header className="flex flex-wrap items-center justify-between gap-6 border-b border-[#233D4D]/15 pb-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full border border-[#215E61]/40 bg-[#215E61]/10" />
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-[#215E61]">
                  Studio
                </p>
                <p className="text-lg font-semibold">A-DS</p>
              </div>
            </div>
            <nav className="flex flex-1 justify-center gap-6 text-sm text-[#233D4D]/70">
              <button
                className="transition hover:text-[#233D4D]"
                onClick={() => scrollToSection("courses")}
                type="button"
              >
                Courses
              </button>
              <button
                className="transition hover:text-[#233D4D]"
                onClick={() => scrollToSection("workflow")}
                type="button"
              >
                Workflow
              </button>
              <button
                className="transition hover:text-[#233D4D]"
                onClick={() => scrollToSection("examples")}
                type="button"
              >
                Examples
              </button>
            </nav>
            <div className="flex items-center gap-3">
              <Button
                className="rounded-full border border-[#215E61]/40 px-5 text-[#215E61]"
                variant="ghost"
              >
                Log in
              </Button>
              <Button className="rounded-full bg-[#FE7F2D] px-5 font-semibold text-white hover:bg-[#e67123]">
                Sign up
              </Button>
            </div>
          </header>

          <main className="flex-1 space-y-20 py-12">
            <section className="grid gap-12 border-b border-[#233D4D]/15 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-8">
                <div className="space-y-4">
                  <Badge className="w-fit border border-[#215E61]/30 bg-transparent px-3 py-1 text-[11px] uppercase tracking-[0.4em] text-[#215E61]">
                    Studio update · 2.2
                  </Badge>
                  <h1 className="text-pretty text-4xl font-semibold leading-tight sm:text-5xl">
                    Creative intelligence that turns a single URL into a week of
                    learning-ready storyboards.
                  </h1>
                  <p className="max-w-xl text-lg text-[#233D4D]/70">
                    Describe what you are shipping, touch the assistant once,
                    and watch it generate briefs, courses, and render-ready
                    scenes without leaving your brand-safe canvas.
                  </p>
                </div>

                <div className="grid gap-4 border-y border-[#233D4D]/15 py-6 sm:grid-cols-3">
                  {HERO_STATS.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-3xl font-semibold text-[#215E61]">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.4em] text-[#233D4D]/60">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-[#233D4D]/60">
                    Trusted by
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[#233D4D]/70">
                    {TRUSTED.map((logo) => (
                      <span
                        className="border border-[#233D4D]/20 px-3 py-1"
                        key={logo}
                      >
                        {logo}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4" id="hero-chat-input">
                <div className="rounded-3xl border border-[#233D4D]/20 bg-[#233D4D] p-6 text-white shadow-[0_20px_60px_rgba(35,61,77,0.35)]">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/70">
                    What do you want to learn about?
                  </p>
                  <p className="mt-3 text-2xl font-semibold">
                    Drop a link, topic, or KPI.
                  </p>
                  <div className="mt-5 rounded-2xl border border-white/15 bg-[#215E61] p-4">
                    <AiChatInput
                      onSubmit={handleGenerate}
                      disabled={isGenerating}
                      variant="main"
                    />
                  </div>
                  {error && (
                    <div className="mt-4 rounded-2xl border border-[#FE7F2D]/30 bg-[#FE7F2D]/20 p-4 text-sm">
                      {error}
                    </div>
                  )}
                  <div className="mt-5 space-y-2">
                    <p className="text-xs uppercase tracking-[0.4em] text-white/70">
                      Try prompts
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_PROMPTS.map((prompt) => (
                        <button
                          className="rounded-full border border-white/40 px-4 py-2 text-sm text-white/90 transition hover:border-white hover:text-white"
                          disabled={isGenerating}
                          key={prompt.label}
                          onClick={() => handleGenerate(prompt.prompt)}
                          type="button"
                        >
                          {prompt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-white/80">
                    <p className="font-semibold">Prompt tip</p>
                    <p className="mt-1 text-white/70">
                      Mention the channel, voice, and any compliance rules. We
                      keep revisions synced to your brand kit.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-8" id="courses">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.4em] text-[#215E61]">
                  Courses like these
                </p>
                <h2 className="text-3xl font-semibold">
                  We turn one request into entire learning arcs.
                </h2>
                <p className="text-[#233D4D]/70">
                  Your storyboard brief becomes modular lessons, ready for
                  editors, enablement, and production teams.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="rounded-3xl border border-[#215E61]/30 bg-white p-6 shadow-[0_20px_50px_rgba(33,94,97,0.1)]">
                  <p className="text-xs uppercase tracking-[0.4em] text-[#215E61]">
                    A-DS turns this...
                  </p>
                  <p className="mt-3 text-xl font-semibold text-[#233D4D]">
                    {COURSE_BLUEPRINTS[0].prompt}
                  </p>
                  <div className="mt-6 space-y-3 text-sm text-[#233D4D]/80">
                    {COURSE_BLUEPRINTS[0].modules.slice(0, 4).map((module) => (
                      <div className="flex items-start gap-2" key={module}>
                        <Sparkles className="mt-1 h-4 w-4 text-[#FE7F2D]" />
                        <span>{module}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="mt-6 w-full rounded-full border border-[#215E61]/40 text-[#215E61]"
                    variant="ghost"
                  >
                    Watch it build live
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {COURSE_BLUEPRINTS.slice(1).map((course) => (
                    <div
                      className="flex h-full flex-col gap-4 rounded-3xl border border-[#233D4D]/15 bg-white p-5 shadow-[0_15px_40px_rgba(35,61,77,0.08)] transition hover:-translate-y-1 hover:border-[#215E61]/40"
                      key={course.id}
                    >
                      <div className="rounded-2xl border border-[#215E61]/30 bg-[#215E61]/10 p-4 text-sm text-[#215E61]">
                        {course.prompt}
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-[#233D4D]">
                          {course.title}
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-[#233D4D]/80">
                          {course.modules.map((module) => (
                            <li className="flex items-start gap-2" key={module}>
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#FE7F2D]" />
                              <span>{module}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button
                        className="mt-auto w-fit rounded-full border border-[#215E61]/40 px-4 text-[#215E61]"
                        variant="ghost"
                      >
                        View outline
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-6" id="workflow">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.4em] text-[#215E61]">
                  Workflow
                </p>
                <h2 className="text-3xl font-semibold">
                  Three passes to publish
                </h2>
                <p className="text-[#233D4D]/70">
                  Teams stay on one canvas while AI handles research, pacing,
                  and approvals.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {WORKFLOW_STEPS.map((step) => (
                  <div
                    className="rounded-2xl border border-[#233D4D]/15 bg-white p-5"
                    key={step.title}
                  >
                    <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.4em] text-[#215E61]">
                      <span>{step.tag}</span>
                      <step.icon className="h-4 w-4 text-[#215E61]" />
                    </div>
                    <p className="text-lg font-semibold text-[#233D4D]">
                      {step.title}
                    </p>
                    <p className="mt-2 text-sm text-[#233D4D]/75">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-6" id="examples">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.4em] text-[#215E61]">
                  Examples
                </p>
                <h2 className="text-3xl font-semibold">
                  Work that shipped this month
                </h2>
                <p className="text-[#233D4D]/70">
                  Every outline moves from AI suggestion to rendered edit faster
                  than last sprint.
                </p>
              </div>
              <div className="divide-y divide-[#233D4D]/10 rounded-3xl border border-[#233D4D]/15 bg-white">
                {EXAMPLE_SHOWCASE.map((example) => (
                  <div
                    className="grid gap-4 p-6 md:grid-cols-[1.1fr_0.9fr]"
                    key={example.title}
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.4em] text-[#215E61]">
                        {example.format}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[#233D4D]">
                        {example.title}
                      </p>
                      <p className="mt-2 text-sm text-[#233D4D]/75">
                        {example.description}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 text-sm text-[#233D4D]/75">
                      <span className="text-xs uppercase tracking-[0.4em] text-[#215E61]">
                        Result
                      </span>
                      <p className="text-lg font-semibold text-[#215E61]">
                        {example.result}
                      </p>
                      <Button
                        className="w-fit rounded-full border border-[#215E61]/40 px-4 py-2 text-[#215E61]"
                        variant="ghost"
                      >
                        Watch breakdown
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section
              className="rounded-3xl border border-[#215E61]/40 bg-[#215E61] p-8 text-white"
              id="newsletter"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/70">
                    New
                  </p>
                  <h3 className="text-3xl font-semibold">
                    Daily puzzle newsletter
                  </h3>
                  <p className="text-white/80">
                    A two-minute challenge that keeps your creative muscles
                    primed. Receive fresh briefs, pacing puzzles, and storyboard
                    critiques in your inbox.
                  </p>
                </div>
                <form className="flex w-full max-w-md flex-col gap-3 md:flex-row">
                  <input
                    aria-label="Email address"
                    className="h-12 flex-1 rounded-full border border-white/40 bg-transparent px-4 text-sm text-white placeholder:text-white/60 focus:border-white focus:outline-none"
                    placeholder="Email address"
                    type="email"
                  />
                  <Button
                    className="h-12 rounded-full bg-[#FE7F2D] px-6 text-white hover:bg-[#e67123]"
                    type="button"
                  >
                    Subscribe
                  </Button>
                </form>
              </div>
            </section>
          </main>
        </div>
      )}

      {storyboard && (
        <div className="fixed inset-0 flex bg-white">
          <div className="h-full w-[80%]">
            <Editor storyboard={storyboard} />
          </div>
          <div className="flex h-full w-[20%] flex-col border-l border-black/5 bg-white">
            <div className="flex-1 overflow-y-auto p-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                Chat history arrives here soon.
              </div>
            </div>
            <div className="border-t border-zinc-200 p-3">
              <AiChatInput />
            </div>
          </div>
        </div>
      )}

      {isGenerating && !storyboard && (
        <div className="mx-auto mt-6 flex max-w-4xl items-center gap-3 rounded-2xl border border-[#215E61]/30 bg-[#215E61] px-4 py-3 text-sm text-white">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#FE7F2D]" />
          <Timer className="h-4 w-4 text-white" />
          <p>Generating storyboard… hold tight.</p>
        </div>
      )}
    </div>
  );
}
