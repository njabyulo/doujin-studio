"use client";

import type { TMediaPlan, TMediaPrompt } from "@doujin/shared";
import { SMediaPlan } from "@doujin/shared";
import { ArrowLeft, Film, ImageIcon, Sparkles } from "lucide-react";
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

type MediaKind = "image" | "video";

type MosaicPrompt = {
  kind: MediaKind;
  prompt: TMediaPrompt;
};

type CardTheme = {
  gradient: string;
  textClass: string;
  mutedClass: string;
  chipClass: string;
};

const CARD_THEMES: CardTheme[] = [
  {
    gradient: "linear-gradient(135deg, #1b1f2a 0%, #3d2a5c 55%, #9a4d42 100%)",
    textClass: "text-white",
    mutedClass: "text-white/75",
    chipClass: "border-white/25 bg-white/15 text-white",
  },
  {
    gradient: "linear-gradient(135deg, #bfe0ff 0%, #6ab7ff 100%)",
    textClass: "text-[#1d2a3a]",
    mutedClass: "text-[#1d2a3a]/70",
    chipClass: "border-[#1d2a3a]/15 bg-white/55 text-[#1d2a3a]",
  },
  {
    gradient: "linear-gradient(135deg, #e6f2d5 0%, #c7e3a8 100%)",
    textClass: "text-[#24412a]",
    mutedClass: "text-[#24412a]/70",
    chipClass: "border-[#24412a]/12 bg-white/55 text-[#24412a]",
  },
  {
    gradient: "linear-gradient(135deg, #ffd9b0 0%, #ffb37d 100%)",
    textClass: "text-[#4c2415]",
    mutedClass: "text-[#4c2415]/70",
    chipClass: "border-[#4c2415]/12 bg-white/60 text-[#4c2415]",
  },
  {
    gradient: "linear-gradient(135deg, #10151f 0%, #1d2a3a 100%)",
    textClass: "text-white",
    mutedClass: "text-white/70",
    chipClass: "border-white/20 bg-white/12 text-white",
  },
];

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  }
  return hash;
}

function pickTheme(seed: string): CardTheme {
  return CARD_THEMES[hashString(seed) % CARD_THEMES.length] ?? CARD_THEMES[0]!;
}

function stripUrl(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveCardTitle(value: string) {
  const cleaned = stripUrl(value);
  const parts = cleaned
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const tail = parts.length > 1 ? parts[parts.length - 1] : cleaned;

  const normalized = tail
    .replace(/\bAspect\s*[:=]\s*(1:1|9:16|16:9)\b/gi, "")
    .replace(/\bAspect ratio\s*[:=]\s*(1:1|9:16|16:9)\b/gi, "")
    .replace(/\bMood\s*[:=][^.|!?\n]+/gi, "")
    .replace(/\bCTA\s*[:=][^.|!?\n]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const cueMatch = normalized.match(
    /(Hero key visual|Lifestyle scene|Create a tight|Cinematic|Founders?|UGC|Product)\b/i,
  );
  const cueIndex = cueMatch?.index;
  const cueFocused =
    typeof cueIndex === "number" && cueIndex >= 0
      ? normalized.slice(cueIndex)
      : normalized;

  const sentences = cueFocused
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const last = sentences[sentences.length - 1] ?? cueFocused;
  const withoutVerb = last.replace(/^(create|generate|make)\s+/i, "").trim();

  const title = withoutVerb.length > 0 ? withoutVerb : cueFocused;
  if (title.length <= 78) return title;
  return `${title.slice(0, 78).trim()}...`;
}

function deriveCardSubtitle(prompt: TMediaPrompt) {
  const chips = [
    prompt.aspectRatio ? prompt.aspectRatio : null,
    typeof prompt.durationSec === "number" ? `${prompt.durationSec}s` : null,
    prompt.style ? prompt.style : null,
  ].filter(Boolean) as string[];
  return chips.join(" • ");
}

function formatErrorMessage(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{"))
    return { title: "Generation error", body: trimmed };

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: string;
      correlationId?: string;
      details?: { message?: string };
    };

    const detail = parsed.details?.message;
    const correlation = parsed.correlationId;
    const base = parsed.error ?? "Internal server error";
    const extra = [detail, correlation ? `Correlation: ${correlation}` : null]
      .filter(Boolean)
      .join("\n");
    return {
      title: base,
      body: extra || trimmed,
    };
  } catch {
    return { title: "Generation error", body: trimmed };
  }
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

  const mediaCounts = useMemo(() => {
    const videoCount = mediaPlan?.prompts.videos.length ?? 0;
    const imageCount = mediaPlan?.prompts.images.length ?? 0;
    return { videoCount, imageCount };
  }, [mediaPlan]);

  const mosaicPrompts = useMemo<MosaicPrompt[]>(() => {
    if (!mediaPlan) return [];
    const images = mediaPlan.prompts.images.map((prompt) => ({
      kind: "image" as const,
      prompt,
    }));
    const videos = mediaPlan.prompts.videos.map((prompt) => ({
      kind: "video" as const,
      prompt,
    }));

    const ordered: MosaicPrompt[] = [];
    if (videos[0]) ordered.push(videos[0]);

    let i = 0;
    let v = videos[0] ? 1 : 0;
    while (i < images.length || v < videos.length) {
      if (images[i]) ordered.push(images[i]);
      if (videos[v]) ordered.push(videos[v]);
      i += 1;
      v += 1;
    }

    return ordered;
  }, [mediaPlan]);

  const pendingQueue = useMemo<MosaicPrompt[]>(() => {
    if (!mediaPlan) return [];
    const pendingImages = mediaPlan.prompts.images
      .filter((item) => !item.asset?.url)
      .map((prompt) => ({ kind: "image" as const, prompt }));
    const pendingVideos = mediaPlan.prompts.videos
      .filter((item) => !item.asset?.url)
      .map((prompt) => ({ kind: "video" as const, prompt }));
    return [...pendingImages, ...pendingVideos];
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
    <div className="ds-light relative min-h-screen overflow-hidden bg-[#f6f7fb] pb-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-48 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,221,189,0.65),rgba(255,221,189,0))] blur-3xl" />
        <div className="absolute -right-44 top-24 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(190,215,255,0.5),rgba(190,215,255,0))] blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(215,227,170,0.4),rgba(215,227,170,0))] blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 py-10">
        <header className="flex flex-wrap items-end justify-between gap-6">
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
              <p className="text-xs font-semibold uppercase tracking-[0.5em] text-[color:var(--ds-muted-light)]">
                Project
              </p>
              <h1 className="display-font text-3xl font-semibold leading-tight text-[color:var(--ds-text-light)] sm:text-4xl">
                {projectTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[color:var(--ds-border-light)] bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)] shadow-[var(--ds-shadow-soft)]">
              {mediaCounts.videoCount} video • {mediaCounts.imageCount} images
            </div>
            <div className="rounded-full border border-[color:var(--ds-border-light)] bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-text-light)] shadow-[var(--ds-shadow-soft)]">
              {pendingCount} pending
            </div>
          </div>
        </header>

        {error && <ErrorCard className="mt-6" error={error} />}

        <main className="mt-8">
          <div className="grid grid-flow-dense auto-rows-[140px] grid-cols-2 gap-4 md:auto-rows-[160px] md:grid-cols-3 lg:auto-rows-[170px] lg:grid-cols-4">
            {mosaicPrompts.map((item, index) => (
              <MosaicPromptTile
                key={`${item.kind}-${item.prompt.id}`}
                item={item}
                index={index}
                overrideUrl={assetOverrides[item.prompt.id]?.url}
                highlight={assetOverrides[item.prompt.id]?.isNew}
                isGenerating={activePromptId === item.prompt.id}
              />
            ))}
          </div>
        </main>
      </div>

      <GenerationDock
        pendingCount={pendingCount}
        isGenerating={isGenerating}
        generationProgress={generationProgress}
        nextUp={pendingQueue[0] ?? null}
        onGenerate={() => void startGeneration()}
      />
    </div>
  );
}

function ErrorCard({
  error,
  className,
}: {
  error: string;
  className?: string;
}) {
  const formatted = formatErrorMessage(error);
  return (
    <div
      className={[
        "rounded-[28px] border border-[#f58d39]/40 bg-[#f58d39]/12 p-5 shadow-[var(--ds-shadow-soft)]",
        className ?? "",
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)]">
        Issue
      </p>
      <p className="mt-2 text-base font-semibold text-[color:var(--ds-text-light)]">
        {formatted.title}
      </p>
      <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-[color:var(--ds-border-light)] bg-white/60 p-4 text-xs text-[color:var(--ds-text-light)]">
        {formatted.body}
      </pre>
    </div>
  );
}

function GenerationDock({
  pendingCount,
  isGenerating,
  generationProgress,
  nextUp,
  onGenerate,
}: {
  pendingCount: number;
  isGenerating: boolean;
  generationProgress: GenerationProgress[];
  nextUp: MosaicPrompt | null;
  onGenerate: () => void;
}) {
  const latest = generationProgress[generationProgress.length - 1];
  const rawProgress =
    typeof latest?.progress === "number"
      ? latest.progress
      : pendingCount === 0
        ? 100
        : 0;
  const progress = Math.max(0, Math.min(100, rawProgress));

  const message = isGenerating
    ? (latest?.message ?? "Generating media")
    : pendingCount === 0
      ? "All assets are ready"
      : nextUp
        ? `Next: ${deriveCardTitle(nextUp.prompt.prompt)}`
        : `${pendingCount} assets ready to generate`;

  return (
    <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-3xl overflow-hidden rounded-[34px] border border-[color:var(--ds-border-light)] bg-white/80 shadow-[var(--ds-shadow-strong)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ds-border-light)] bg-white/65 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)]">
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--ds-accent-warm)]" />
                {isGenerating
                  ? "Generating"
                  : pendingCount === 0
                    ? "Complete"
                    : "Ready"}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-text-light)]">
                {pendingCount} pending
              </span>
            </div>

            <p className="mt-2 truncate text-sm font-semibold text-[color:var(--ds-text-light)]">
              {message}
            </p>

            <div className="mt-3 h-2 rounded-full bg-[color:var(--ds-bg-light-2)]">
              <div
                className="h-full rounded-full bg-[color:var(--ds-accent)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="accent"
            className="h-11 rounded-full px-6 text-sm font-semibold"
            disabled={isGenerating || pendingCount === 0}
            onClick={onGenerate}
          >
            {isGenerating
              ? "Generating…"
              : pendingCount === 0
                ? "Done"
                : "Generate"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function spanClassForPrompt(item: MosaicPrompt, index: number) {
  const ratio =
    item.prompt.aspectRatio ?? (item.kind === "video" ? "9:16" : "1:1");
  const seed = hashString(item.prompt.id + String(index));
  const widen = seed % 11 === 0;

  if (item.kind === "video" && index === 0) {
    return "col-span-2 row-span-2";
  }

  if (ratio === "16:9") {
    return "col-span-2 row-span-1";
  }

  if (ratio === "9:16") {
    return widen ? "col-span-2 row-span-2" : "row-span-2";
  }

  return widen ? "col-span-2 row-span-1" : "row-span-1";
}

function MosaicPromptTile({
  item,
  index,
  overrideUrl,
  highlight,
  isGenerating,
}: {
  item: MosaicPrompt;
  index: number;
  overrideUrl?: string;
  highlight?: boolean;
  isGenerating?: boolean;
}) {
  const theme = pickTheme(item.prompt.id);
  const assetUrl = overrideUrl ?? item.prompt.asset?.url;
  const title = deriveCardTitle(item.prompt.prompt);
  const subtitle = deriveCardSubtitle(item.prompt);
  const spanClass = spanClassForPrompt(item, index);

  const showMediaOverlay = Boolean(assetUrl);
  const textClass = assetUrl ? "text-white" : theme.textClass;
  const mutedClass = assetUrl ? "text-white/75" : theme.mutedClass;
  const chipClass = assetUrl
    ? "border-white/25 bg-white/15 text-white"
    : theme.chipClass;

  return (
    <article
      className={[
        spanClass,
        "group relative overflow-hidden rounded-[32px] border border-[color:var(--ds-border-light)] shadow-[var(--ds-shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-strong)]",
        highlight ? "ring-2 ring-[color:var(--ds-accent-warm)]" : "",
      ].join(" ")}
      style={{ animationDelay: `${Math.min(index * 40, 560)}ms` }}
    >
      <div className="relative h-full w-full overflow-hidden">
        {assetUrl ? (
          item.kind === "video" ? (
            <video
              src={assetUrl}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          )
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: theme.gradient }}
          />
        )}

        {showMediaOverlay && (
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.25)_55%,rgba(0,0,0,0.72))]" />
        )}

        {!assetUrl && (
          <div className="absolute inset-0 opacity-70">
            <div className="absolute inset-0 animate-pulse bg-[linear-gradient(120deg,rgba(255,255,255,0.35),rgba(255,255,255,0.12),rgba(255,255,255,0.35))]" />
            <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/25 blur-2xl" />
          </div>
        )}

        <div
          className={
            "relative flex h-full flex-col justify-between p-5 " + textClass
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] " +
                  chipClass
                }
              >
                {item.kind === "video" ? (
                  <Film className="h-3.5 w-3.5" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                {item.kind}
              </span>
              {subtitle && (
                <span
                  className={
                    "hidden rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] sm:inline-flex " +
                    chipClass
                  }
                >
                  {subtitle}
                </span>
              )}
            </div>

            <span
              className={
                "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] " +
                chipClass
              }
            >
              {assetUrl ? "Ready" : isGenerating ? "Generating" : "Queued"}
            </span>
          </div>

          <div>
            <h3
              className={
                "display-font text-2xl font-semibold leading-tight " + textClass
              }
            >
              {title}
            </h3>
            <p
              className={
                "mt-2 text-xs uppercase tracking-[0.35em] " + mutedClass
              }
            >
              {item.kind === "video" ? "Motion" : "Still"} prompt
            </p>

            {!assetUrl && (
              <div className="mt-3 space-y-2">
                <div className="h-2 w-3/4 rounded-full bg-white/35" />
                <div className="h-2 w-2/3 rounded-full bg-white/25" />
              </div>
            )}
          </div>
        </div>

        {isGenerating && (
          <div className="absolute inset-0 ring-2 ring-[color:var(--ds-accent-warm)]" />
        )}
      </div>
    </article>
  );
}
