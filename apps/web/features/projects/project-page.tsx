"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { AiChatInput } from "~/features/storyboards/components/ai-chat-input";
import { readStoryboardFromStorage } from "~/features/storyboards/hooks/use-storyboard-generation";
import { Button } from "~/components/ui/button";

const Editor = dynamic(
  () => import("./components/editor").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading editor…</p>
      </div>
    ),
  },
);

export function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isBrowser = typeof window !== "undefined";
  const storyboard =
    isBrowser && params?.id ? readStoryboardFromStorage(params.id) : null;

  const projectTitle = storyboard?.adTitle ?? "Untitled Storyboard";
  const brandColor = storyboard?.branding?.primaryColor ?? "#215E61";
  const brandFont = storyboard?.branding?.fontFamily ?? "Inter";
  const scenes = storyboard?.scenes ?? [];
  const totalDuration = scenes.reduce(
    (acc, scene) => acc + (scene.durationInSeconds ?? 0),
    0,
  );

  if (!isBrowser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading project…
      </div>
    );
  }

  if (!storyboard) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center text-slate-700">
        <p className="text-lg font-semibold">Storyboard not found</p>
        <p className="max-w-md text-sm text-slate-500">
          It looks like this project has expired or has not been generated yet.
          Start a new brief from the home page.
        </p>
        <Button onClick={() => router.push("/")} className="rounded-full px-6">
          Back to home
        </Button>
      </div>
    );
  }

  const metaCards = [
    { label: "Scenes", value: scenes.length.toString() },
    {
      label: "Total duration",
      value: `${totalDuration || 0}s`,
    },
    { label: "Brand font", value: brandFont },
  ];

  return (
    <div className="min-h-screen bg-[#F5FBE6]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#215E61]/25 pb-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#215E61]/30 text-[#215E61] transition hover:bg-[#215E61]/10"
              aria-label="Back to brief"
            >
              ←
            </button>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.4em] text-[#215E61]">
                Project
              </p>
              <p className="truncate text-2xl font-semibold text-[#233D4D]">
                {projectTitle}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-[#215E61]/30 px-3 py-1 text-sm text-[#215E61] md:flex">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: brandColor }}
              />
              <span>{brandFont}</span>
            </div>
            <Button
              variant="ghost"
              className="rounded-full border border-[#215E61]/30 px-4 text-sm text-[#215E61] hover:bg-[#215E61]/10"
              onClick={() => router.push("/")}
            >
              Back to brief
            </Button>
            <Button className="rounded-full bg-[#FE7F2D] px-5 text-sm font-semibold text-white hover:bg-[#e67123]">
              Share preview
            </Button>
          </div>
        </header>

        <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex flex-col gap-6 rounded-3xl border border-white/60 bg-white/80 p-4 shadow-[0_25px_80px_rgba(33,61,77,0.15)] sm:p-6">
            <div className="relative w-full overflow-hidden rounded-3xl border border-[#233D4D]/10 bg-gradient-to-br from-[#233D4D]/5 to-[#215E61]/10 p-3 sm:p-4">
              <div className="relative w-full min-h-[460px] rounded-2xl bg-black/5 sm:min-h-[520px] xl:min-h-[640px]">
                <Editor storyboard={storyboard} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {metaCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-[#233D4D]/10 bg-white/80 p-4 text-sm text-[#233D4D]/70"
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-[#215E61]">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[#233D4D]">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[#233D4D]/10 bg-[#F5FBE6] p-4 text-sm text-[#233D4D]/80">
              <p className="text-base font-semibold text-[#233D4D]">
                Storyboard summary
              </p>
              <p className="mt-2 leading-relaxed">
                {scenes[0]?.voiceoverScript
                  ? scenes[0]?.voiceoverScript
                  : "This storyboard is ready for timing, VO polish, and render export. Use the chat assistant to request adjustments once the workspace is unlocked."}
              </p>
            </div>
          </section>

          <aside className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/95 p-4 sm:p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[#215E61]">
                Scenes overview
              </p>
              <div className="mt-3 max-h-[260px] space-y-3 overflow-y-auto pr-1">
                {scenes.length > 0 ? (
                  scenes.map((scene, index) => (
                    <div
                      key={`${scene.textOverlay}-${index}`}
                      className="flex gap-3 rounded-2xl border border-[#233D4D]/10 bg-white/80 p-3"
                    >
                      <span className="text-xs font-semibold text-[#215E61]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-[#233D4D]">
                          {scene.textOverlay}
                        </p>
                        <p className="text-xs text-[#233D4D]/70">
                          {(scene.voiceoverScript ?? "").slice(0, 120)}
                          {scene.voiceoverScript &&
                          scene.voiceoverScript.length > 120
                            ? "…"
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-[#233D4D]/20 bg-white/60 p-4 text-sm text-[#233D4D]/70">
                    Scenes will appear here once the storyboard includes them.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#233D4D]/10 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#233D4D]">
                    Assistant
                  </p>
                  <p className="text-xs text-[#233D4D]/60">
                    Chat-powered edits arrive soon.
                  </p>
                </div>
                <span className="rounded-full border border-[#215E61]/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#215E61]">
                  Google Veo
                </span>
              </div>
              <div className="mt-4">
                <AiChatInput disabled variant="compact" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
