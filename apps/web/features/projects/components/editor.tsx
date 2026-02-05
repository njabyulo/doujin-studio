"use client";

import type { TMediaPlan, TMediaPrompt } from "@doujin/shared";
import { SMediaPlan } from "@doujin/shared";
import {
  ArrowLeft,
  Film,
  ImageIcon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";

interface EditorProps {
  projectId?: string;
}

interface ProjectRow {
  id: string;
  title: string;
  mediaPlanJson?: unknown;
}

interface ProjectPayload {
  project: ProjectRow;
}

type GenerationProgress = { message: string; progress: number };

type AssetOverride = {
  url: string;
  isNew?: boolean;
};

function base64ToBlob(base64: string, mimeType: string) {
  const byteString = atob(base64);
  const buffer = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i += 1) {
    buffer[i] = byteString.charCodeAt(i);
  }
  return new Blob([buffer], { type: mimeType });
}

function createFallbackPlan(title: string): TMediaPlan {
  return {
    version: "1",
    project: { title },
    prompts: {
      videos: [],
      images: [],
    },
  };
}

export function Editor({ projectId }: EditorProps) {
  const [projectTitle, setProjectTitle] = useState("Project");
  const [mediaPlan, setMediaPlan] = useState<TMediaPlan | null>(null);
  const [assetOverrides, setAssetOverrides] = useState<
    Record<string, AssetOverride>
  >({});
  const [generationProgress, setGenerationProgress] = useState<
    GenerationProgress[]
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to load project");
      }

      const data = (await res.json()) as ProjectPayload;
      const title = data.project.title ?? "Project";
      setProjectTitle(title);

      const parsedPlan = SMediaPlan.safeParse(data.project.mediaPlanJson);
      if (parsedPlan.success) {
        setMediaPlan(parsedPlan.data);
      } else {
        setMediaPlan(createFallbackPlan(title));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const pendingCount = useMemo(() => {
    if (!mediaPlan) return 0;
    const pendingVideos = mediaPlan.prompts.videos.filter(
      (item) => !item.asset?.url,
    ).length;
    const pendingImages = mediaPlan.prompts.images.filter(
      (item) => !item.asset?.url,
    ).length;
    return pendingVideos + pendingImages;
  }, [mediaPlan]);

  const applyPromptAsset = useCallback(
    (
      promptId: string,
      assetType: "image" | "video",
      asset: { url: string; mimeType?: string },
    ) => {
      setMediaPlan((prev) => {
        if (!prev) return prev;
        const listKey = assetType === "video" ? "videos" : "images";
        const list = prev.prompts[listKey].map((prompt) =>
          prompt.id === promptId
            ? { ...prompt, asset: { ...prompt.asset, ...asset } }
            : prompt,
        );
        return {
          ...prev,
          prompts: {
            ...prev.prompts,
            [listKey]: list,
          },
        };
      });
    },
    [],
  );

  const markAssetOverride = useCallback((promptId: string, url: string) => {
    setAssetOverrides((prev) => ({
      ...prev,
      [promptId]: { url, isNew: true },
    }));

    setTimeout(() => {
      setAssetOverrides((prev) => {
        const current = prev[promptId];
        if (!current) return prev;
        return { ...prev, [promptId]: { ...current, isNew: false } };
      });
    }, 1200);
  }, []);

  const requestUploadUrl = useCallback(
    async (promptId: string, contentType: string) => {
      const res = await fetch(`/api/projects/${projectId}/assets/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: promptId, contentType }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to request upload URL");
      }

      return (await res.json()) as {
        uploadUrl: string;
        s3Key: string;
        publicUrl: string;
      };
    },
    [projectId],
  );

  const confirmMediaAsset = useCallback(
    async (
      promptId: string,
      assetType: "image" | "video",
      s3Key: string,
      mimeType?: string,
    ) => {
      const res = await fetch(`/api/projects/${projectId}/media/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId, assetType, s3Key, mimeType }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to confirm asset");
      }

      return (await res.json()) as { promptId: string; assetUrl: string };
    },
    [projectId],
  );

  const uploadAssetBlob = useCallback(
    async (promptId: string, assetType: "image" | "video", blob: Blob) => {
      const contentType =
        blob.type || (assetType === "video" ? "video/mp4" : "image/png");
      const { uploadUrl, s3Key, publicUrl } = await requestUploadUrl(
        promptId,
        contentType,
      );

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });

      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }

      const confirm = await confirmMediaAsset(
        promptId,
        assetType,
        s3Key,
        contentType,
      );
      const finalUrl = confirm.assetUrl ?? publicUrl;
      applyPromptAsset(promptId, assetType, {
        url: finalUrl,
        mimeType: contentType,
      });
      markAssetOverride(promptId, finalUrl);
    },
    [applyPromptAsset, confirmMediaAsset, markAssetOverride, requestUploadUrl],
  );

  const generateImagePrompt = useCallback(
    async (promptId: string) => {
      const res = await fetch(`/api/projects/${projectId}/generate/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Image generation failed");
      }

      return (await res.json()) as {
        promptId: string;
        mimeType: string;
        base64: string;
      };
    },
    [projectId],
  );

  const generateVideoPrompt = useCallback(
    async (promptId: string) => {
      const res = await fetch(`/api/projects/${projectId}/generate/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Video generation failed");
      }

      return (await res.json()) as {
        promptId: string;
        sourceUrl: string;
      };
    },
    [projectId],
  );

  const startGeneration = useCallback(async () => {
    if (!projectId || !mediaPlan || isGenerating) return;
    if (pendingCount === 0) {
      setGenerationProgress([
        { message: "All media assets are already generated.", progress: 100 },
      ]);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationProgress([
      { message: "Preparing generation queue", progress: 5 },
    ]);

    try {
      const pendingImages = mediaPlan.prompts.images.filter(
        (item) => !item.asset?.url,
      );
      const pendingVideos = mediaPlan.prompts.videos.filter(
        (item) => !item.asset?.url,
      );
      const queue: Array<{ id: string; type: "image" | "video" }> = [
        ...pendingImages.map((item) => ({
          id: item.id,
          type: "image" as const,
        })),
        ...pendingVideos.map((item) => ({
          id: item.id,
          type: "video" as const,
        })),
      ];

      const total = queue.length;
      let completed = 0;

      for (const item of queue) {
        setActivePromptId(item.id);
        setGenerationProgress([
          {
            message: `Generating ${completed + 1} of ${total} (${item.type})`,
            progress:
              total === 0
                ? 100
                : Math.min(95, Math.round((completed / total) * 90 + 10)),
          },
        ]);

        if (item.type === "image") {
          const generated = await generateImagePrompt(item.id);
          const blob = base64ToBlob(generated.base64, generated.mimeType);
          const previewUrl = URL.createObjectURL(blob);
          markAssetOverride(generated.promptId, previewUrl);
          await uploadAssetBlob(generated.promptId, "image", blob);
        } else {
          const generated = await generateVideoPrompt(item.id);
          const proxyUrl = `/api/projects/${projectId}/assets/video-proxy?uri=${encodeURIComponent(
            generated.sourceUrl,
          )}`;
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            const message = await response.text();
            throw new Error(message || "Failed to download generated video");
          }
          const blob = await response.blob();
          const previewUrl = URL.createObjectURL(blob);
          markAssetOverride(generated.promptId, previewUrl);
          await uploadAssetBlob(generated.promptId, "video", blob);
        }

        completed += 1;
      }

      setGenerationProgress([
        { message: "Media generation complete", progress: 100 },
      ]);

      await loadProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setActivePromptId(null);
      setIsGenerating(false);
    }
  }, [
    generateImagePrompt,
    generateVideoPrompt,
    isGenerating,
    loadProject,
    markAssetOverride,
    mediaPlan,
    pendingCount,
    projectId,
    uploadAssetBlob,
  ]);

  if (!projectId) {
    return (
      <div className="ds-light flex min-h-screen items-center justify-center text-[color:var(--ds-muted-light)]">
        Project id missing.
      </div>
    );
  }

  if (isLoading && !mediaPlan) {
    return (
      <div className="ds-light flex min-h-screen items-center justify-center text-[color:var(--ds-muted-light)]">
        Loading project…
      </div>
    );
  }

  return (
    <div className="ds-light min-h-screen bg-[color:var(--ds-bg-light)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,227,209,0.7),rgba(255,227,209,0))] blur-3xl" />
        <div className="absolute right-0 top-32 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(190,215,255,0.55),rgba(190,215,255,0))] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="glass"
              className="h-10 w-10 rounded-full p-0 text-[color:var(--ds-text-light)]"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-[color:var(--ds-muted-light)]">
                Project
              </p>
              <p className="display-font text-2xl font-semibold text-[color:var(--ds-text-light)]">
                {projectTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--ds-muted-light)]">
              {pendingCount} pending
            </div>
            <Button
              type="button"
              variant="accent"
              className="rounded-full px-5 text-sm font-semibold"
              onClick={() => void startGeneration()}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating…" : "Generate Media"}
            </Button>
          </div>
        </header>

        {error && (
          <div className="mt-4 rounded-2xl border border-[#f58d39]/40 bg-[#f58d39]/15 p-4 text-sm text-[color:var(--ds-text-light)]">
            {error}
          </div>
        )}

        {generationProgress.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)]">
              <Sparkles className="h-4 w-4 text-[color:var(--ds-accent-warm)]" />
              {generationProgress[generationProgress.length - 1]?.message}
            </div>
            <div className="mt-3 h-2 rounded-full bg-[color:var(--ds-bg-light-2)]">
              <div
                className="h-full rounded-full bg-[color:var(--ds-accent)] transition-all"
                style={{
                  width: `${generationProgress[generationProgress.length - 1]?.progress ?? 0}%`,
                }}
              />
            </div>
          </div>
        )}

        <main className="mt-10 space-y-12">
          <Section
            title="Video Prompts"
            subtitle="Motion-ready directions for your cinematic cuts"
            icon={Film}
            prompts={mediaPlan?.prompts.videos ?? []}
            overrides={assetOverrides}
            type="video"
            activePromptId={activePromptId}
          />
          <Section
            title="Image Prompts"
            subtitle="Stills, posters, and social-ready visual moments"
            icon={ImageIcon}
            prompts={mediaPlan?.prompts.images ?? []}
            overrides={assetOverrides}
            type="image"
            activePromptId={activePromptId}
          />
        </main>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  prompts,
  overrides,
  type,
  activePromptId,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  prompts: TMediaPrompt[];
  overrides: Record<string, AssetOverride>;
  type: "video" | "image";
  activePromptId: string | null;
}) {
  const countLabel = `${prompts.length} prompts`;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-[color:var(--ds-muted-light)]">
            <Icon className="h-4 w-4" />
            {title}
          </div>
          <p className="mt-2 text-lg font-semibold text-[color:var(--ds-text-light)]">
            {subtitle}
          </p>
        </div>
        <div className="rounded-full border border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] px-3 py-1 text-xs text-[color:var(--ds-muted-light)]">
          {countLabel}
        </div>
      </div>

      {prompts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] p-10 text-center text-sm text-[color:var(--ds-muted-light)]">
          No {type} prompts yet. Generate media to populate this gallery.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              type={type}
              overrideUrl={overrides[prompt.id]?.url}
              highlight={overrides[prompt.id]?.isNew}
              isGenerating={activePromptId === prompt.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PromptCard({
  prompt,
  type,
  overrideUrl,
  highlight,
  isGenerating,
}: {
  prompt: TMediaPrompt;
  type: "video" | "image";
  overrideUrl?: string;
  highlight?: boolean;
  isGenerating?: boolean;
}) {
  const chips = [
    prompt.aspectRatio ? `Aspect ${prompt.aspectRatio}` : null,
    type === "video" && prompt.durationSec ? `${prompt.durationSec}s` : null,
    prompt.style ? prompt.style : null,
  ].filter(Boolean) as string[];

  const assetUrl = overrideUrl ?? prompt.asset?.url;

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-[28px] border border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] p-5 shadow-[var(--ds-shadow-soft)] transition",
        highlight ? "ring-2 ring-[color:var(--ds-accent-warm)]" : "",
      ].join(" ")}
    >
      <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,221,189,0.6),rgba(255,221,189,0))] blur-2xl" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(190,215,255,0.4),rgba(190,215,255,0))] blur-2xl" />
      </div>

      <div className="relative space-y-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)]">
          <span>{type === "video" ? "Video" : "Image"}</span>
          {chips.length > 0 && (
            <span className="rounded-full border border-[color:var(--ds-border-light)] bg-[color:var(--ds-bg-light-2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--ds-text-light)]">
              {chips[0]}
            </span>
          )}
        </div>

        <div className="rounded-2xl border border-[color:var(--ds-border-light)] bg-white/70 p-4 text-[color:var(--ds-text-light)]">
          <p className="text-sm font-semibold">{prompt.prompt}</p>
          {chips.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.slice(1).map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] px-3 py-1 text-[11px] text-[color:var(--ds-muted-light)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[color:var(--ds-border-light)] bg-[color:var(--ds-bg-light-2)]">
          {assetUrl ? (
            type === "video" ? (
              <video
                src={assetUrl}
                className="h-52 w-full object-cover"
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl}
                alt={prompt.prompt}
                className="h-52 w-full object-cover"
                loading="lazy"
              />
            )
          ) : (
            <div className="relative flex h-52 items-center justify-center">
              <div className="absolute inset-0 animate-pulse bg-[linear-gradient(120deg,rgba(255,255,255,0.35),rgba(255,255,255,0.15),rgba(255,255,255,0.35))] opacity-60" />
              <div className="relative flex flex-col items-center gap-2 text-xs uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)]">
                <span>{isGenerating ? "Generating" : "Queued"}</span>
                <span className="text-[10px] tracking-[0.25em]">
                  Preparing preview
                </span>
              </div>
              {isGenerating && (
                <div className="absolute inset-0 ring-2 ring-[color:var(--ds-accent-warm)]" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
