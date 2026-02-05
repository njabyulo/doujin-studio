"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const Editor = dynamic(
  () => import("./components/editor").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="ds-light relative min-h-screen overflow-hidden bg-[#f6f7fb]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-48 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,221,189,0.65),rgba(255,221,189,0))] blur-3xl" />
          <div className="absolute -right-44 top-24 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(190,215,255,0.5),rgba(190,215,255,0))] blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(215,227,170,0.4),rgba(215,227,170,0))] blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-6 py-10">
          <div className="h-10 w-10 rounded-full border border-[color:var(--ds-border-light)] bg-white/70 shadow-[var(--ds-shadow-soft)]" />
          <div className="mt-6 h-10 w-60 rounded-2xl bg-white/60" />

          <div className="mt-8 grid grid-flow-dense auto-rows-[140px] grid-cols-2 gap-4 md:auto-rows-[160px] md:grid-cols-3 lg:auto-rows-[170px] lg:grid-cols-4">
            <div className="col-span-2 row-span-2 overflow-hidden rounded-[34px] border border-[color:var(--ds-border-light)] bg-white/70 shadow-[var(--ds-shadow-strong)]">
              <div className="h-full w-full animate-pulse bg-[linear-gradient(120deg,rgba(255,255,255,0.55),rgba(255,255,255,0.15),rgba(255,255,255,0.55))]" />
            </div>
            <div className="col-span-2 row-span-2 overflow-hidden rounded-[34px] border border-[color:var(--ds-border-light)] bg-white/70 shadow-[var(--ds-shadow-strong)]">
              <div className="h-full w-full animate-pulse bg-[linear-gradient(120deg,rgba(255,255,255,0.5),rgba(255,255,255,0.14),rgba(255,255,255,0.5))]" />
            </div>
            {Array.from({ length: 6 }, (_, idx) => (
              <div
                key={idx}
                className="row-span-2 overflow-hidden rounded-[32px] border border-[color:var(--ds-border-light)] bg-white/65 shadow-[var(--ds-shadow-soft)]"
              >
                <div className="h-full w-full animate-pulse bg-[linear-gradient(120deg,rgba(255,255,255,0.45),rgba(255,255,255,0.1),rgba(255,255,255,0.45))]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
);

export function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  return <Editor projectId={projectId} />;
}
