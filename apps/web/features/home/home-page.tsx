"use client";

import { ArrowUpRight, Sparkles, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const TRUSTED = ["Aspect", "Northwind", "Aperture", "Sundial", "Orbiton"];

const SAMPLE_PROMPTS = [
  {
    label: "Launch sprint",
    prompt:
      "https://lumina-bikes.com | 30s launch edit | emphasize carbon frame, dual motor assist, and overnight shipping. Mood: cinematic night ride with neon reflections. CTA: Preorder for March deliveries.",
  },
  {
    label: "Founder letter",
    prompt:
      "https://northwind.com | 25s founder letter | warm, confident, minimal B-roll. Highlight the why, the team, and the promise. CTA: Book a demo.",
  },
  {
    label: "UGC duo",
    prompt:
      "https://orbiton.app | 15s duo UGC | hooks in first 3 seconds, playful captions, quick cuts. CTA: Try the free plan.",
  },
];

const MOSAIC_CARDS = [
  {
    title: "Live music",
    subtitle: "Launch hero cut",
    tag: "16:9",
    className: "col-span-2 row-span-2",
    gradient: "linear-gradient(135deg, #1b1f2a 0%, #3d2a5c 55%, #9a4d42 100%)",
    textClass: "text-white",
  },
  {
    title: "Meet Olympians",
    subtitle: "Cinematic opener",
    tag: "9:16",
    className: "row-span-2",
    gradient: "linear-gradient(135deg, #bfe0ff 0%, #6ab7ff 100%)",
    textClass: "text-[#1d2a3a]",
  },
  {
    title: "Celebrate Pride",
    subtitle: "Social loop",
    tag: "1:1",
    className: "",
    gradient: "linear-gradient(135deg, #e6f2d5 0%, #c7e3a8 100%)",
    textClass: "text-[#24412a]",
  },
  {
    title: "Mexican cuisine",
    subtitle: "Founder story",
    tag: "9:16",
    className: "",
    gradient: "linear-gradient(135deg, #ffd9b0 0%, #ffb37d 100%)",
    textClass: "text-[#4c2415]",
  },
  {
    title: "Great for groups",
    subtitle: "UGC collage",
    tag: "15s",
    className: "col-span-2",
    gradient: "linear-gradient(135deg, #10151f 0%, #1d2a3a 100%)",
    textClass: "text-white",
  },
];

export function HomePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => prompt.trim().length > 0, [prompt]);
  const clearError = useCallback(() => setError(null), []);

  const handleGenerate = useCallback(
    async (nextPrompt?: string) => {
      const value = (nextPrompt ?? prompt).trim();
      if (!value || isGenerating) return;

      setIsGenerating(true);
      setIsTransitioning(true);
      setError(null);

      try {
        const projectResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: value }),
        });

        if (!projectResponse.ok) {
          const message = await projectResponse.text();
          throw new Error(message || "Failed to create project");
        }

        const created = (await projectResponse.json()) as {
          project: { id: string };
        };

        setPrompt("");
        router.push(`/projects/${created.project.id}`);
      } catch (generationError) {
        console.error("Media generation failed", generationError);
        setIsTransitioning(false);
        setError(
          generationError instanceof Error
            ? generationError.message
            : "An unexpected error occurred",
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, prompt, router],
  );

  return (
    <div className="ds-light ds-landing min-h-screen">
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-drift absolute -left-48 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,221,189,0.7),rgba(255,221,189,0))] blur-3xl" />
        <div className="bg-drift absolute -right-48 top-20 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(190,215,255,0.6),rgba(190,215,255,0))] blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,201,164,0.55),rgba(255,201,164,0))] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
        <Header />

        <main className="page-enter mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section className="space-y-7">
            <div className="inline-flex items-center gap-3 rounded-full border border-[color:var(--ds-border)] bg-[color:var(--ds-glass)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted)] shadow-[var(--ds-shadow-soft)] backdrop-blur-xl">
              <Sparkles className="h-4 w-4 text-[color:var(--ds-accent-warm)]" />
              Personal-to-business media in minutes
            </div>

            <div className="space-y-4">
              <h1 className="display-font text-4xl font-semibold leading-tight text-[color:var(--ds-text)] sm:text-5xl">
                Doujin Studio turns personal ideas into business‑ready media
                kits.
              </h1>
              <p className="max-w-xl text-base text-[color:var(--ds-muted)] sm:text-lg">
                Drop a prompt or URL. We capture your intent, generate video +
                image prompts, and deliver a kit ready for social or paid
                distribution.
              </p>
            </div>

            <div className="glassPanel p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--ds-muted)]">
                    Start with a prompt
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--ds-text)]">
                    A sentence or URL is enough.
                  </p>
                </div>
                <Button variant="glass" className="rounded-full px-4">
                  View demo
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4">
                <form
                  className="relative overflow-hidden rounded-[32px] border border-[color:var(--ds-border)] bg-[color:var(--ds-glass)] p-5 shadow-[var(--ds-shadow-soft)] backdrop-blur-2xl"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleGenerate();
                  }}
                >
                  <textarea
                    id="prompt"
                    name="prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Prompt or URL (e.g. https://example.com | 2 short launch videos + 3 social images | ... )"
                    disabled={isGenerating}
                    rows={5}
                    className="w-full resize-none bg-transparent text-base text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-muted)] outline-none"
                  />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--ds-border)] pt-4">
                    <p className="text-xs text-[color:var(--ds-muted)]">
                      Tip: include an aspect ratio like `9:16` if you care.
                    </p>
                    <Button
                      type="submit"
                      variant="accent"
                      className="rounded-full px-6"
                      disabled={!canSubmit || isGenerating}
                    >
                      {isGenerating ? "Generating…" : "Generate Media"}
                    </Button>
                  </div>
                </form>
              </div>
              {error && (
                <div className="mt-4 rounded-2xl border border-[#f58d39]/40 bg-[#f58d39]/15 p-4 text-sm text-[color:var(--ds-text)]">
                  <div className="flex items-center justify-between gap-3">
                    <span>{error}</span>
                    <button
                      type="button"
                      aria-label="Dismiss error"
                      className="text-xs underline"
                      onClick={clearError}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  className="rounded-full border border-[color:var(--ds-border)] bg-white/60 px-4 py-2 text-sm text-[color:var(--ds-text)] transition hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-soft)]"
                  disabled={isGenerating}
                  onClick={() => void handleGenerate(prompt.prompt)}
                  type="button"
                >
                  {prompt.label}
                </button>
              ))}
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--ds-muted)]">
                Trusted by
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[color:var(--ds-muted)]">
                {TRUSTED.map((logo) => (
                  <span
                    className="rounded-full border border-[color:var(--ds-border)] bg-white/60 px-4 py-1"
                    key={logo}
                  >
                    {logo}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="relative">
            <div className="grid auto-rows-[140px] grid-cols-2 gap-4">
              {MOSAIC_CARDS.map((card) => (
                <div
                  key={card.title}
                  className={cn(
                    "relative overflow-hidden rounded-[26px] p-4 shadow-[var(--ds-shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--ds-shadow-strong)]",
                    card.className,
                    card.textClass,
                  )}
                  style={{ backgroundImage: card.gradient }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="inline-flex w-fit rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em]">
                      {card.tag}
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{card.title}</p>
                      <p className="text-xs opacity-75">{card.subtitle}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-[26px] border border-[color:var(--ds-border)] bg-[color:var(--ds-glass)] p-5 text-sm text-[color:var(--ds-muted)] shadow-[var(--ds-shadow-soft)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--ds-muted)]">
                Output
              </p>
              <p className="mt-2 text-base text-[color:var(--ds-text)]">
                Deliver a hero video, supporting cutdowns, and image variants
                ready for personal creators or business teams.
              </p>
            </div>
          </section>
        </main>
      </div>

      {isGenerating && !isTransitioning && <StatusBanner />}
      {isTransitioning && <GenerationOverlay />}
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full border border-[color:var(--ds-border)] bg-white/70" />
        <div>
          <p className="text-xs uppercase tracking-[0.5em] text-[color:var(--ds-muted)]">
            Doujin
          </p>
          <p className="text-lg font-semibold text-[color:var(--ds-text)]">
            Studio
          </p>
        </div>
      </div>
      <nav className="hidden items-center gap-6 text-sm text-[color:var(--ds-muted)] md:flex">
        <button
          className="transition hover:text-[color:var(--ds-text)]"
          type="button"
        >
          Templates
        </button>
        <button
          className="transition hover:text-[color:var(--ds-text)]"
          type="button"
        >
          Workflows
        </button>
        <button
          className="transition hover:text-[color:var(--ds-text)]"
          type="button"
        >
          Pricing
        </button>
      </nav>
      <div className="flex items-center gap-3">
        <Button variant="glass" className="rounded-full px-5">
          Log in
        </Button>
        <Button variant="accent" className="rounded-full px-5">
          Generate Media
        </Button>
      </div>
    </header>
  );
}

function StatusBanner() {
  return (
    <div className="mx-auto mt-6 flex max-w-4xl items-center gap-3 rounded-2xl border border-[color:var(--ds-border)] bg-[color:var(--ds-glass)] px-4 py-3 text-sm text-[color:var(--ds-text)] shadow-[var(--ds-shadow-soft)] backdrop-blur-xl">
      <div className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--ds-accent-warm)]" />
      <Timer className="h-4 w-4" />
      <p>Generating media… hold tight.</p>
    </div>
  );
}

function GenerationOverlay() {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-md">
      <div className="glassPanel px-10 py-12 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[color:var(--ds-border)] border-t-[color:var(--ds-accent-warm)]" />
        <p className="mt-6 text-2xl font-semibold text-[color:var(--ds-text)]">
          Setting up your editor
        </p>
        <p className="mt-2 text-[color:var(--ds-muted)]">
          We’re generating media prompts and opening the project workspace.
        </p>
      </div>
    </div>
  );
}
