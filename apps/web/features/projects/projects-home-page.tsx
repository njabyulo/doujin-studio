"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw, Sparkles, SlidersHorizontal } from "lucide-react";
import { Button } from "~/components/ui/button";

type ProjectItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectMeta = {
  progress: number;
  shotCount: number;
  sizeLabel: string;
};

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(160deg, #f4e3d4 0%, #cfd6e8 45%, #ebc6b3 100%)",
  "linear-gradient(160deg, #e7f0d8 0%, #c3d7c8 55%, #f5d7c6 100%)",
  "linear-gradient(160deg, #f3e0cf 0%, #f1c6a7 50%, #d2c4e8 100%)",
  "linear-gradient(160deg, #f7ead7 0%, #cfe0f0 55%, #f0d1c2 100%)",
];

const QUICK_FILTERS = ["All", "Brand kits", "Social cuts", "Media plans"];

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function deriveMeta(project: ProjectItem): ProjectMeta {
  const seed = project.id.replace(/-/g, "");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 10000;
  }
  const progress = 12 + (hash % 72);
  const shotCount = 48 + (hash % 280);
  const sizeLabel = `${(1.2 + (hash % 28) / 10).toFixed(1)}GB`;
  return { progress, shotCount, sizeLabel };
}

async function fetchProjects(): Promise<ProjectItem[]> {
  const response = await fetch("/api/projects", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error("Failed to load projects.");
  }
  return response.json() as Promise<ProjectItem[]>;
}

export function ProjectsHomePage() {
  const [projects, setProjects] = useState<ProjectItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchProjects()
      .then((items) => {
        if (!alive) return;
        setProjects(items);
        setError(null);
      })
      .catch((err: Error) => {
        if (!alive) return;
        setError(err.message || "Failed to load projects.");
      })
      .finally(() => {
        if (!alive) return;
        setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const featuredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.slice(0, 2);
  }, [projects]);

  const recentProjects = useMemo(() => {
    if (!projects) return [];
    return projects.slice(2, 8);
  }, [projects]);

  const featuredDisplay = useMemo(
    () =>
      isLoading
        ? Array.from({ length: 2 }, () => null)
        : featuredProjects,
    [featuredProjects, isLoading],
  );

  const recentDisplay = useMemo(
    () =>
      isLoading
        ? Array.from({ length: 6 }, () => null)
        : recentProjects,
    [isLoading, recentProjects],
  );

  return (
    <div className="ds-light min-h-screen bg-[color:var(--ds-bg-light)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-12 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,227,209,0.6),rgba(255,227,209,0))] blur-3xl" />
        <div className="absolute right-0 top-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(200,221,255,0.55),rgba(200,221,255,0))] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-[color:var(--ds-muted-light)]">
              Projects
            </p>
            <h1 className="display-font text-4xl font-semibold text-[color:var(--ds-text-light)]">
              Home
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="glass"
              className="rounded-full px-4 text-xs font-semibold uppercase tracking-[0.3em]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
            <Button
              variant="accent"
              className="rounded-full px-5 text-sm font-semibold"
              asChild
            >
              <Link href="/">
                <Sparkles className="h-4 w-4" />
                Generate Media
              </Link>
            </Button>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap gap-2">
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className="rounded-full border border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--ds-text-light)] shadow-[var(--ds-shadow-soft)] transition hover:-translate-y-0.5"
            >
              {filter}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-[#f58d39]/40 bg-[#f58d39]/15 p-4 text-sm text-[color:var(--ds-text-light)]">
            {error}
          </div>
        )}

        <section className="mt-10 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[color:var(--ds-text-light)]">
              Featured
            </h2>
            <button
              type="button"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)]"
            >
              Refresh
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {featuredDisplay.map((project, index) => {
              const meta = project ? deriveMeta(project) : null;
              return (
                <div
                  key={project?.id ?? `featured-${index}`}
                  className="group relative overflow-hidden rounded-[32px] border border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] p-5 shadow-[var(--ds-shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--ds-shadow-strong)]"
                >
                  <div
                    className="absolute inset-0 opacity-90"
                    style={{
                      backgroundImage:
                        PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length],
                    }}
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_60%)]" />
                  <div className="relative flex h-full flex-col justify-between gap-6">
                    <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--ds-text-light)]">
                      <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] uppercase tracking-[0.3em]">
                        {meta ? `${meta.progress}%` : "--"}
                      </span>
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-[color:var(--ds-text-light)]"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="rounded-[24px] border border-white/50 bg-white/60 p-4 text-[color:var(--ds-text-light)]">
                      <p className="text-lg font-semibold">
                        {project ? project.title : "Loading project"}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--ds-muted-light)]">
                        {project ? formatShortDate(project.updatedAt) : "—"}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--ds-muted-light)]">
                        <span>{meta ? meta.shotCount : 0} shots</span>
                        <span>{meta ? meta.sizeLabel : "--"}</span>
                      </div>
                    </div>
                  </div>
                  {project && (
                    <Link
                      href={`/projects/${project.id}`}
                      className="absolute inset-0"
                      aria-label={`Open project ${project.title}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-12 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[color:var(--ds-text-light)]">
              Recent
            </h2>
            <span className="text-xs text-[color:var(--ds-muted-light)]">
              {projects?.length ?? 0} projects
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recentDisplay.map((project, index) => {
              const meta = project ? deriveMeta(project) : null;
              return (
                <div
                  key={project?.id ?? `recent-${index}`}
                  className="group relative overflow-hidden rounded-[26px] border border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] p-4 shadow-[var(--ds-shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--ds-shadow-strong)]"
                >
                  <div
                    className="h-[160px] w-full rounded-[20px] border border-white/60 bg-white/70"
                    style={{
                      backgroundImage:
                        PLACEHOLDER_GRADIENTS[(index + 1) % PLACEHOLDER_GRADIENTS.length],
                    }}
                  />
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-[color:var(--ds-text-light)]">
                      {project ? project.title : "Loading project"}
                    </p>
                    <p className="text-xs text-[color:var(--ds-muted-light)]">
                      {project ? formatShortDate(project.createdAt) : "—"}
                    </p>
                    <div className="flex items-center justify-between text-xs text-[color:var(--ds-muted-light)]">
                      <span>{meta ? meta.shotCount : 0} shots</span>
                      <span>{meta ? meta.sizeLabel : "--"}</span>
                    </div>
                  </div>
                  {project && (
                    <Link
                      href={`/projects/${project.id}`}
                      className="absolute inset-0"
                      aria-label={`Open project ${project.title}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
