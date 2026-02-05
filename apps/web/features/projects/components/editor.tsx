"use client";

import { Master } from "@doujin/remotion";
import type { TBrandKit, TMessageContent, TStoryboard } from "@doujin/shared";
import { FORMAT_SPECS, SMessageContent } from "@doujin/shared";
import { Player } from "@remotion/player";
import {
  ArrowLeft,
  Film,
  LayoutGrid,
  Music,
  Palette,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RenderProgress } from "~/components/domain/render-progress";
import { SceneEditor } from "~/components/domain/scene-editor";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { consumeGenerationStream } from "~/lib/stream-consumer";
import { AssetsChat } from "./assets-chat";
import { AssetsPanel, type AssetFilter, type AssetItem } from "./assets-panel";
import { CollageTile, ProjectCollage } from "./project-collage";

const VideoEditorModal = dynamic(
  () => import("./video-editor-modal").then((mod) => mod.VideoEditorModal),
  { ssr: false },
);

type Format = "1:1" | "9:16" | "16:9";

interface EditorProps {
  projectId?: string;
  initialGenerate?: {
    url?: string;
    format?: Format;
    tone?: string;
  };
}

interface ProjectRow {
  id: string;
  title: string;
  activeCheckpointId: string | null;
}

interface MessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  type: string;
  contentJson: unknown;
  createdAt: string;
}

interface CheckpointRow {
  id: string;
  name: string;
  parentCheckpointId: string | null;
  storyboardJson: unknown;
  scriptJson: unknown;
  brandKitJson: unknown;
  createdAt: string;
}

interface ProjectPayload {
  project: ProjectRow;
  messages: MessageRow[];
  checkpoints: CheckpointRow[];
}

type RenderStatus =
  | "pending"
  | "rendering"
  | "completed"
  | "failed"
  | "cancel_requested"
  | "cancelled";

interface RenderState {
  renderJobId: string;
  status: RenderStatus;
  progress: number;
  outputUrl?: string | null;
}

const defaultBrandKit: TBrandKit = {
  version: "1",
  productName: "Untitled",
  tagline: "",
  benefits: [],
  colors: { primary: "#215E61", secondary: "#233D4D", accent: "#FE7F2D" },
  fonts: { heading: "Inter", body: "Inter" },
  tone: "professional",
};

type EditorView = "editor" | "assets";

function base64ToBlob(base64: string, mimeType: string) {
  const byteString = atob(base64);
  const buffer = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i += 1) {
    buffer[i] = byteString.charCodeAt(i);
  }
  return new Blob([buffer], { type: mimeType });
}

export function Editor({ projectId, initialGenerate }: EditorProps) {
  const [payload, setPayload] = useState<ProjectPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editorView] = useState<EditorView>("editor");

  const [generateUrl, setGenerateUrl] = useState(initialGenerate?.url ?? "");
  const [generateTone, setGenerateTone] = useState(initialGenerate?.tone ?? "");
  const [generateFormat, setGenerateFormat] = useState<Format>(
    initialGenerate?.format ?? "9:16",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<
    Array<{ message: string; progress: number }>
  >([]);

  const [selectedSceneId, setSelectedSceneId] = useState<string | undefined>(
    undefined,
  );
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [sceneInstruction, setSceneInstruction] = useState("");
  const [assetPrompt, setAssetPrompt] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [assetError, setAssetError] = useState<string | null>(null);
  const [isAssetGenerating, setIsAssetGenerating] = useState(false);
  const [assetOverrides, setAssetOverrides] = useState<
    Record<
      string,
      {
        placeholderUrl?: string;
        outputUrl?: string | null;
        isNew?: boolean;
      }
    >
  >({});
  const [activeAsset, setActiveAsset] = useState<AssetItem | null>(null);
  const [isVideoEditorOpen, setIsVideoEditorOpen] = useState(false);

  const [renderState, setRenderState] = useState<RenderState | null>(null);

  const didAutoGenerate = useRef(false);
  const mediaStreamStarted = useRef(false);
  const shouldRenderPlayer = process.env.NODE_ENV !== "test";

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
      setPayload(data);
      if (!selectedSceneId) {
        const checkpointId = data.project.activeCheckpointId;
        const active = checkpointId
          ? data.checkpoints.find((c) => c.id === checkpointId)
          : data.checkpoints[data.checkpoints.length - 1];
        const storyboard = active?.storyboardJson as TStoryboard | undefined;
        const firstScene = storyboard?.scenes?.[0]?.id;
        if (firstScene) setSelectedSceneId(firstScene);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, selectedSceneId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const activeCheckpoint = useMemo(() => {
    if (!payload) return null;
    const activeId = payload.project.activeCheckpointId;
    if (activeId) {
      return payload.checkpoints.find((c) => c.id === activeId) ?? null;
    }
    return payload.checkpoints[payload.checkpoints.length - 1] ?? null;
  }, [payload]);

  const storyboard = activeCheckpoint?.storyboardJson as TStoryboard | undefined;
  const brandKit = (activeCheckpoint?.brandKitJson as TBrandKit | undefined) ??
    defaultBrandKit;

  const parsedMessages = useMemo(() => {
    if (!payload) return [];
    return payload.messages
      .map((msg) => {
        const parsed = SMessageContent.safeParse(msg.contentJson);
        if (!parsed.success) return null;
        return {
          id: msg.id,
          role: msg.role,
          createdAt: msg.createdAt,
          content: parsed.data as TMessageContent,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      role: MessageRow["role"];
      createdAt: string;
      content: TMessageContent;
    }>;
  }, [payload]);

  const sceneOptions = useMemo(() => {
    if (!storyboard) return [];
    return storyboard.scenes.map((scene, index) => ({
      id: scene.id,
      label: `Scene ${index + 1} — ${scene.onScreenText}`,
    }));
  }, [storyboard]);

  const selectedScene = useMemo(() => {
    if (!storyboard || !selectedSceneId) return null;
    return storyboard.scenes.find((s) => s.id === selectedSceneId) ?? null;
  }, [selectedSceneId, storyboard]);

  const selectedSceneIndex = useMemo(() => {
    if (!storyboard || !selectedSceneId) return null;
    const index = storyboard.scenes.findIndex((scene) => scene.id === selectedSceneId);
    return index >= 0 ? index : null;
  }, [selectedSceneId, storyboard]);

  const formatSpec = useMemo(() => {
    const f = storyboard?.format ?? generateFormat;
    return FORMAT_SPECS[f];
  }, [generateFormat, storyboard?.format]);

  const durationInFrames = useMemo(() => {
    const total = storyboard?.totalDuration ?? 1;
    return Math.max(1, Math.round(total * 30));
  }, [storyboard?.totalDuration]);

  const timelineSegments = useMemo(() => {
    if (!storyboard) return [];
    return storyboard.scenes.map((scene, index) => ({
      id: scene.id,
      label: `Scene ${index + 1}`,
      duration: scene.duration,
    }));
  }, [storyboard]);

  const sceneTimeline = useMemo(() => {
    if (!storyboard) return [];
    let cursor = 0;
    return storyboard.scenes.map((scene, index) => {
      const start = cursor;
      const end = cursor + scene.duration;
      cursor = end;
      return {
        id: scene.id,
        index,
        label: `Scene ${index + 1}`,
        title: scene.onScreenText,
        start,
        end,
        duration: scene.duration,
      };
    });
  }, [storyboard]);

  const previewNode = useMemo(() => {
    if (!storyboard) {
      return (
        <div className="flex h-full w-full items-center justify-center text-sm text-[#6d5f54]">
          Generate media to see a live preview.
        </div>
      );
    }

    if (!shouldRenderPlayer) {
      return (
        <div
          style={{ width: "100%", height: "100%" }}
          aria-label="Remotion player placeholder"
        />
      );
    }

    return (
      <Player
        component={Master}
        compositionWidth={formatSpec.width}
        compositionHeight={formatSpec.height}
        durationInFrames={durationInFrames}
        fps={30}
        style={{ width: "100%", height: "100%" }}
        inputProps={{ storyboard, brandKit }}
        acknowledgeRemotionLicense
        controls
      />
    );
  }, [
    brandKit,
    durationInFrames,
    formatSpec.height,
    formatSpec.width,
    shouldRenderPlayer,
    storyboard,
  ]);

  const assetItems = useMemo<AssetItem[]>(() => {
    if (!storyboard) return [];
    return storyboard.scenes.flatMap((scene, sceneIndex) =>
      scene.assetSuggestions.map((asset) => ({
        id: asset.id,
        type: asset.type,
        title: asset.description,
        description: asset.description,
        sceneId: scene.id,
        sceneIndex,
        placeholderUrl: asset.placeholderUrl,
        outputUrl: asset.type === "video" ? asset.placeholderUrl ?? null : undefined,
      })),
    );
  }, [storyboard]);

  const mergedAssetItems = useMemo(() => {
    if (assetItems.length === 0) return [];
    return assetItems.map((asset) => {
      const override = assetOverrides[asset.id];
      if (!override) return asset;
      const placeholderUrl = override.placeholderUrl ?? asset.placeholderUrl;
      return {
        ...asset,
        placeholderUrl,
        outputUrl:
          override.outputUrl ??
          asset.outputUrl ??
          (asset.type === "video" ? placeholderUrl ?? null : undefined),
        isNew: override.isNew,
      };
    });
  }, [assetItems, assetOverrides]);

  const sceneTileSizes = useMemo(
    () => ["tall", "medium", "short", "tall", "short", "medium"] as const,
    [],
  );

  const sceneTiles = useMemo(() => {
    if (!storyboard) return [];
    return storyboard.scenes.map((scene, index) => {
      const imageAsset = mergedAssetItems.find(
        (asset) =>
          asset.sceneId === scene.id &&
          asset.type === "image" &&
          asset.placeholderUrl,
      );
      const videoAsset = mergedAssetItems.find(
        (asset) => asset.sceneId === scene.id && asset.type === "video",
      );
      return {
        id: scene.id,
        index,
        title: scene.onScreenText,
        subtitle: scene.voiceoverText,
        imageUrl: imageAsset?.placeholderUrl ?? null,
        size: sceneTileSizes[index % sceneTileSizes.length],
        videoAsset,
      };
    });
  }, [mergedAssetItems, sceneTileSizes, storyboard]);

  const renderItems = useMemo<AssetItem[]>(() => {
    const items: AssetItem[] = [];
    const seen = new Set<string>();
    parsedMessages.forEach((msg) => {
      if (msg.content.type !== "render_completed") return;
      if (!msg.content.outputUrl) return;
      if (seen.has(msg.content.outputUrl)) return;
      seen.add(msg.content.outputUrl);
      items.push({
        id: msg.id,
        type: "render",
        title: "Rendered video",
        description: `Render ${msg.content.renderJobId.slice(0, 8)}…`,
        outputUrl: msg.content.outputUrl,
      });
    });

    if (renderState?.outputUrl && !seen.has(renderState.outputUrl)) {
      items.push({
        id: renderState.renderJobId,
        type: "render",
        title: "Latest render",
        description: "New render output",
        outputUrl: renderState.outputUrl,
      });
    }

    return items;
  }, [parsedMessages, renderState?.outputUrl, renderState?.renderJobId]);

  const filteredAssets = useMemo(() => {
    const term = assetSearch.trim().toLowerCase();
    const matchesFilter = (asset: AssetItem) => {
      if (assetFilter === "all") return true;
      if (assetFilter === "render") return asset.type === "render";
      return asset.type === assetFilter;
    };

    const matchesSearch = (asset: AssetItem) =>
      term.length === 0 ||
      asset.title.toLowerCase().includes(term) ||
      asset.description.toLowerCase().includes(term);

    return mergedAssetItems.filter(
      (asset) => matchesFilter(asset) && matchesSearch(asset),
    );
  }, [assetFilter, assetSearch, mergedAssetItems]);

  const filteredRenders = useMemo(() => {
    if (assetFilter !== "all" && assetFilter !== "render") return [];
    const term = assetSearch.trim().toLowerCase();
    if (!term) return renderItems;
    return renderItems.filter(
      (asset) =>
        asset.title.toLowerCase().includes(term) ||
        asset.description.toLowerCase().includes(term),
    );
  }, [assetFilter, assetSearch, renderItems]);

  const pendingAssets = useMemo(
    () =>
      mergedAssetItems.filter(
        (asset) => asset.type !== "render" && !asset.placeholderUrl,
      ),
    [mergedAssetItems],
  );

  const markAssetOverride = useCallback((assetId: string, update: {
    placeholderUrl?: string;
    outputUrl?: string | null;
  }) => {
    setAssetOverrides((prev) => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        ...update,
        isNew: true,
      },
    }));

    setTimeout(() => {
      setAssetOverrides((prev) => {
        const current = prev[assetId];
        if (!current) return prev;
        return {
          ...prev,
          [assetId]: { ...current, isNew: false },
        };
      });
    }, 1200);
  }, []);

  const requestUploadUrl = useCallback(
    async (assetId: string, contentType: string) => {
      const res = await fetch(`/api/projects/${projectId}/assets/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, contentType }),
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

  const confirmAssetUpload = useCallback(
    async (assetId: string, sceneId: string, s3Key: string) => {
      const res = await fetch(`/api/projects/${projectId}/assets/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, sceneId, s3Key }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to confirm asset upload");
      }
    },
    [projectId],
  );

  const uploadAssetBlob = useCallback(
    async (
      assetId: string,
      sceneId: string,
      assetType: "image" | "video",
      blob: Blob,
    ) => {
      const contentType =
        blob.type ||
        (assetType === "video" ? "video/mp4" : "image/png");
      const { uploadUrl, s3Key, publicUrl } = await requestUploadUrl(
        assetId,
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

      await confirmAssetUpload(assetId, sceneId, s3Key);
      markAssetOverride(
        assetId,
        assetType === "video"
          ? { placeholderUrl: publicUrl, outputUrl: publicUrl }
          : { placeholderUrl: publicUrl },
      );
    },
    [confirmAssetUpload, markAssetOverride, requestUploadUrl],
  );

  const startGeneration = useCallback(async () => {
    if (!projectId) return;
    if (isGenerating) return;
    if (pendingAssets.length === 0) {
      setGenerationProgress([
        { message: "All assets are already generated.", progress: 100 },
      ]);
      return;
    }

    mediaStreamStarted.current = true;
    setIsGenerating(true);
    setError(null);
    setGenerationProgress([
      { message: "Starting media generation", progress: 5 },
    ]);

    try {
      const res = await fetch(`/api/projects/${projectId}/media-stream`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Generation failed");
      }

      for await (const event of consumeGenerationStream(res)) {
        if (event.type === "generation_progress") {
          setGenerationProgress([{ message: event.message, progress: event.progress }]);
        } else if (event.type === "asset_generated") {
          if (event.assetType === "image" && event.base64 && event.mimeType) {
            const blob = base64ToBlob(event.base64, event.mimeType);
            const previewUrl = URL.createObjectURL(blob);
            markAssetOverride(event.assetId, { placeholderUrl: previewUrl });
            await uploadAssetBlob(event.assetId, event.sceneId, "image", blob);
          }

          if (event.assetType === "video" && event.sourceUrl) {
            const proxyUrl = `/api/projects/${projectId}/assets/video-proxy?uri=${encodeURIComponent(
              event.sourceUrl,
            )}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
              throw new Error("Failed to download generated video");
            }
            const blob = await response.blob();
            const previewUrl = URL.createObjectURL(blob);
            markAssetOverride(event.assetId, { placeholderUrl: previewUrl, outputUrl: previewUrl });
            await uploadAssetBlob(event.assetId, event.sceneId, "video", blob);
          }
        } else if (event.type === "generation_error") {
          throw new Error(event.error);
        } else if (event.type === "asset_generation_complete") {
          setGenerationProgress([
            { message: "Media generation complete", progress: 100 },
          ]);
        }
      }

      await loadProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [
    isGenerating,
    loadProject,
    markAssetOverride,
    pendingAssets.length,
    projectId,
    uploadAssetBlob,
  ]);

  useEffect(() => {
    if (!payload || didAutoGenerate.current || mediaStreamStarted.current) return;
    if (pendingAssets.length === 0) return;
    didAutoGenerate.current = true;
    mediaStreamStarted.current = true;
    void startGeneration();
  }, [payload, pendingAssets.length, startGeneration]);

  const handleManualSceneSave = useCallback(
    async (updates: { duration: number; onScreenText: string; voiceoverText: string }) => {
      if (!projectId || !activeCheckpoint || !editingSceneId) return;
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/update-scene`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkpointId: activeCheckpoint.id,
            sceneId: editingSceneId,
            ...updates,
          }),
        });
        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || "Failed to update scene");
        }
        setEditingSceneId(null);
        await loadProject();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update scene");
      }
    },
    [activeCheckpoint, editingSceneId, loadProject, projectId],
  );

  const handleRegenerateScene = useCallback(async () => {
    if (!projectId || !activeCheckpoint || !selectedSceneId) return;
    if (!sceneInstruction.trim()) return;
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/regenerate-scene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointId: activeCheckpoint.id,
          sceneId: selectedSceneId,
          instruction: sceneInstruction.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to regenerate scene");
      }

      setSceneInstruction("");
      await loadProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to regenerate scene");
    }
  }, [activeCheckpoint, loadProject, projectId, sceneInstruction, selectedSceneId]);

  const handleGenerateAssets = useCallback(async () => {
    if (!projectId || !activeCheckpoint || !selectedSceneId) {
      setAssetError("Select a scene before generating assets.");
      return;
    }
    if (!assetPrompt.trim()) return;
    setAssetError(null);
    setIsAssetGenerating(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/generate-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointId: activeCheckpoint.id,
          sceneId: selectedSceneId,
          prompt: assetPrompt.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to generate assets");
      }

      setAssetPrompt("");
      await loadProject();
    } catch (e) {
      setAssetError(e instanceof Error ? e.message : "Failed to generate assets");
    } finally {
      setIsAssetGenerating(false);
    }
  }, [
    activeCheckpoint,
    assetPrompt,
    loadProject,
    projectId,
    selectedSceneId,
  ]);

  const startRender = useCallback(async () => {
    if (!projectId || !activeCheckpoint) return;
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointId: activeCheckpoint.id,
          format: (storyboard?.format ?? generateFormat) as Format,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to start render");
      }
      const json = (await res.json()) as { renderJobId: string; status: RenderStatus };
      setRenderState({
        renderJobId: json.renderJobId,
        status: json.status,
        progress: 0,
        outputUrl: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start render");
    }
  }, [activeCheckpoint, generateFormat, projectId, storyboard?.format]);

  const pollRender = useCallback(async (renderJobId: string) => {
    const res = await fetch(`/api/render-jobs/${renderJobId}/progress`);
    if (!res.ok) return null;
    return (await res.json()) as {
      id: string;
      status: RenderStatus;
      progress: number;
      outputS3Key?: string | null;
      lastError?: string | null;
    };
  }, []);

  const fetchDownloadUrl = useCallback(async (renderJobId: string) => {
    const res = await fetch(`/api/render-jobs/${renderJobId}/download-url`);
    if (!res.ok) return null;
    const json = (await res.json()) as { downloadUrl: string };
    return json.downloadUrl;
  }, []);

  useEffect(() => {
    if (!renderState) return;
    const terminal =
      renderState.status === "completed" ||
      renderState.status === "failed" ||
      renderState.status === "cancelled";
    if (terminal && renderState.outputUrl) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      const progress = await pollRender(renderState.renderJobId);
      if (!progress) return;

      setRenderState((prev) =>
        prev
          ? {
              ...prev,
              status: progress.status,
              progress: progress.progress,
            }
          : prev,
      );

      if (progress.status === "completed") {
        const url = await fetchDownloadUrl(renderState.renderJobId);
        if (!url) return;
        setRenderState((prev) => (prev ? { ...prev, outputUrl: url } : prev));
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchDownloadUrl, pollRender, renderState]);

  const cancelRender = useCallback(() => {
    if (!renderState) return;
    setError(null);
    void fetch(`/api/render-jobs/${renderState.renderJobId}/cancel`, {
      method: "POST",
    });
  }, [renderState]);

  const downloadRender = useCallback(() => {
    if (!renderState?.outputUrl) return;
    window.open(renderState.outputUrl, "_blank", "noopener,noreferrer");
  }, [renderState?.outputUrl]);

  const handleOpenAsset = useCallback((asset: AssetItem) => {
    if (asset.type !== "video" && asset.type !== "render") return;
    setActiveAsset(asset);
    setIsVideoEditorOpen(true);
  }, []);

  const handleCloseVideoEditor = useCallback(() => {
    setIsVideoEditorOpen(false);
    setActiveAsset(null);
  }, []);

  if (!projectId) {
    return (
      <div className="ds-dark ds-editor flex min-h-screen items-center justify-center text-[color:var(--muted)]">
        Project id missing.
      </div>
    );
  }

  if (isLoading && !payload) {
    return (
      <div className="ds-dark ds-editor flex min-h-screen items-center justify-center text-[color:var(--muted)]">
        Loading project…
      </div>
    );
  }

  return (
    <div className="ds-dark ds-editor min-h-screen">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-emerald-400/25 via-sky-400/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[560px] w-[560px] rounded-full bg-gradient-to-tr from-orange-500/25 via-fuchsia-500/10 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="glass"
              className="h-10 w-10 rounded-full p-0 text-[color:var(--text)]"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.5em] text-[color:var(--muted)]">
                Doujin Studio
              </p>
              <p className="truncate text-xl font-semibold text-[color:var(--text)]">
                {payload?.project.title ?? "Project"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="accent"
              className="rounded-full px-5 text-sm font-semibold"
              onClick={() => void startGeneration()}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating…" : "Generate Media"}
            </Button>
            <Button
              variant="accent"
              className="rounded-full px-5 text-sm font-semibold"
              onClick={() => void startRender()}
              disabled={!activeCheckpoint || isGenerating}
            >
              Render
            </Button>
          </div>
        </header>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="mt-6 flex-1">
          {editorView === "editor" ? (
            <div className="space-y-6">
              <ProjectCollage>
                <CollageTile tone="dark" size="hero" className="p-5">
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.4em] text-white/60">
                      <span>Preview</span>
                      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[9px] tracking-[0.3em] text-white/70">
                        {storyboard?.format ?? generateFormat}
                      </span>
                    </div>
                    <div className="flex-1 overflow-hidden rounded-[22px] border border-white/10 bg-black/30">
                      <div className="h-full w-full">{previewNode}</div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/55">
                      <span>
                        {storyboard
                          ? `${storyboard.scenes.length} scenes`
                          : "Awaiting scenes"}
                      </span>
                      <span>
                        {storyboard
                          ? `${Math.round(storyboard.totalDuration)}s total`
                          : "Generate to begin"}
                      </span>
                    </div>
                  </div>
                </CollageTile>

                {sceneTiles.length > 0 ? (
                  sceneTiles.map((tile) => {
                    const videoAsset = tile.videoAsset
                    return (
                      <CollageTile
                        key={tile.id}
                        size={tile.size}
                        tone="dark"
                        className="relative p-4"
                        onClick={() => {
                          setSelectedSceneId(tile.id)
                          setEditingSceneId(null)
                          setAssetError(null)
                        }}
                      >
                        <div className="absolute inset-0">
                          {tile.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={tile.imageUrl}
                              alt={tile.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-[color:var(--ds-bg-dark)] via-[color:var(--ds-bg-dark-2)] to-[color:var(--ds-bg)]" />
                          )}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
                        <div className="relative flex h-full flex-col justify-between">
                          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
                            <span>Scene {tile.index + 1}</span>
                            {videoAsset && (
                              <button
                                type="button"
                                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.25em] text-white/85 transition hover:border-white/40"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleOpenAsset(videoAsset)
                                }}
                              >
                                Preview
                              </button>
                            )}
                          </div>
                          <div>
                            <p className="display-font text-lg text-white">
                              {tile.title || "Untitled scene"}
                            </p>
                            {tile.subtitle && (
                              <p className="mt-1 text-xs text-white/70">
                                {tile.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </CollageTile>
                    )
                  })
                ) : (
                  <CollageTile size="short" className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)]">
                      Start here
                    </p>
                    <p className="mt-3 text-sm text-[color:var(--ds-text-light)]">
                      Add a product URL and tone to begin generating your first collage.
                    </p>
                  </CollageTile>
                )}

                <CollageTile size="medium" className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)]">
                      Brief
                    </p>
                    <span className="rounded-full border border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--ds-text-light)]">
                      {generateFormat}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="generateUrl" className="text-[color:var(--ds-muted-light)]">
                        Source URL
                      </Label>
                      <Input
                        id="generateUrl"
                        value={generateUrl}
                        onChange={(e) => setGenerateUrl(e.target.value)}
                        placeholder="https://example.com/product"
                        disabled={isGenerating}
                        className="border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] text-[color:var(--ds-text-light)] placeholder:text-[color:var(--ds-muted-light)]"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="generateFormat" className="text-[color:var(--ds-muted-light)]">
                          Format
                        </Label>
                        <Select
                          value={generateFormat}
                          onValueChange={(v) => setGenerateFormat(v as Format)}
                          disabled={isGenerating}
                        >
                          <SelectTrigger
                            id="generateFormat"
                            className="border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] text-[color:var(--ds-text-light)]"
                          >
                            <SelectValue placeholder="Format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="9:16">9:16</SelectItem>
                            <SelectItem value="16:9">16:9</SelectItem>
                            <SelectItem value="1:1">1:1</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="generateTone" className="text-[color:var(--ds-muted-light)]">
                          Tone
                        </Label>
                        <Input
                          id="generateTone"
                          value={generateTone}
                          onChange={(e) => setGenerateTone(e.target.value)}
                          placeholder="cinematic, neon, fast hook"
                          disabled={isGenerating}
                          className="border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] text-[color:var(--ds-text-light)] placeholder:text-[color:var(--ds-muted-light)]"
                        />
                      </div>
                    </div>
                  </div>

                  {isGenerating && generationProgress.length > 0 && (
                    <div className="mt-4 rounded-xl border border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] p-3">
                      <p className="text-xs text-[color:var(--ds-muted-light)]">
                        {generationProgress[generationProgress.length - 1]?.progress}% — {" "}
                        {generationProgress[generationProgress.length - 1]?.message}
                      </p>
                      <div className="mt-2 h-1.5 rounded-full bg-[color:var(--ds-bg-light-2)]">
                        <div
                          className="h-full rounded-full bg-[color:var(--ds-accent)] transition-all"
                          style={{
                            width: `${generationProgress[generationProgress.length - 1]?.progress ?? 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CollageTile>

                <CollageTile tone="dark" size="tall" className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/55">
                        Director
                      </p>
                      <p className="mt-2 text-sm text-white/70">
                        {selectedScene
                          ? selectedSceneIndex !== null
                            ? `Direct edits for Scene ${selectedSceneIndex + 1}.`
                            : "Direct edits for the selected scene."
                          : "Select a scene to give direction."}
                      </p>
                    </div>
                    {selectedScene && (
                      <Button
                        variant="glass"
                        className="rounded-full px-3 text-white/80"
                        onClick={() => setEditingSceneId(selectedScene.id)}
                      >
                        Manual edit
                      </Button>
                    )}
                  </div>

                  {selectedScene ? (
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="sceneInstruction" className="text-white/70">
                        Director prompt
                      </Label>
                      <Input
                        id="sceneInstruction"
                        value={sceneInstruction}
                        onChange={(e) => setSceneInstruction(e.target.value)}
                        placeholder='e.g. "Make it more cinematic, tighter pacing"'
                        className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
                      />
                      <div className="flex flex-wrap gap-2 pt-1">
                        {[
                          "Make a 60-second cut",
                          "Music doesn't hit, warm it up",
                          "Punchier opening hook",
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setSceneInstruction(chip)}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 transition hover:border-white/20 hover:text-white"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                      <Button
                        variant="accent"
                        className="w-full rounded-full"
                        onClick={() => void handleRegenerateScene()}
                        disabled={!sceneInstruction.trim()}
                      >
                        Update scene
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                      Scene notes appear once you select a tile in the collage.
                    </div>
                  )}

                  {editingSceneId && selectedScene && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-1">
                      <SceneEditor
                        scene={selectedScene}
                        onSave={(updates) => void handleManualSceneSave(updates)}
                        onCancel={() => setEditingSceneId(null)}
                      />
                    </div>
                  )}
                </CollageTile>

                <CollageTile size="short" className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)]">
                    Brand kit
                  </p>
                  <p className="mt-3 text-lg font-semibold text-[color:var(--ds-text-light)]">
                    {brandKit.productName}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--ds-muted-light)]">
                    {brandKit.tagline || "Add a tagline to guide the creative."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {Object.values(brandKit.colors).map((color) => (
                      <span
                        key={color}
                        className="h-6 w-6 rounded-full border border-[color:var(--ds-border-light)] shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </CollageTile>

                <CollageTile size="short" className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted-light)]">
                      Timeline
                    </p>
                    <span className="text-xs text-[color:var(--ds-muted-light)]">
                      Tap to focus
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sceneTimeline.map((segment) => {
                      const isSelected = segment.id === selectedSceneId
                      const label = `${Math.round(segment.start)}s — ${Math.round(segment.end)}s`
                      return (
                        <button
                          key={segment.id}
                          type="button"
                          onClick={() => {
                            setSelectedSceneId(segment.id)
                            setEditingSceneId(null)
                            setAssetError(null)
                          }}
                          className={[
                            "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition",
                            isSelected
                              ? "border-[color:var(--ds-accent-warm)] bg-[color:var(--ds-bg-light-2)] text-[color:var(--ds-text-light)]"
                              : "border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] text-[color:var(--ds-muted-light)] hover:border-[color:var(--ds-accent-warm)]",
                          ].join(" ")}
                        >
                          <span className="text-[10px] uppercase tracking-[0.25em]">
                            {segment.label}
                          </span>
                          <span className="text-[11px]">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                </CollageTile>

                {renderState && (
                  <CollageTile
                    tone="dark"
                    size="short"
                    className="border-none bg-transparent p-0 shadow-none"
                  >
                    <RenderProgress
                      renderJobId={renderState.renderJobId}
                      status={renderState.status}
                      progress={renderState.progress}
                      outputUrl={renderState.outputUrl}
                      onCancel={cancelRender}
                      onDownload={downloadRender}
                    />
                  </CollageTile>
                )}
              </ProjectCollage>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[56px_minmax(0,1fr)_420px]">
              <div className="hidden lg:flex">
                <div className="glassPanel flex h-[640px] w-14 flex-col items-center gap-2 p-2 shadow-[var(--shadow-strong)]">
                  <RailButton icon={LayoutGrid} label="Assets" active />
                  <RailButton icon={Film} label="Clips" />
                  <RailButton icon={Palette} label="Style" />
                  <RailButton icon={Music} label="Audio" />
                  <div className="my-2 h-px w-full bg-white/10" />
                  <RailButton icon={SlidersHorizontal} label="Tuning" />
                </div>
              </div>

              <section className="glassPanel flex flex-col gap-4 p-4 shadow-[var(--shadow-strong)] sm:p-5">
                <AssetsPanel
                  search={assetSearch}
                  onSearchChange={setAssetSearch}
                  filter={assetFilter}
                  onFilterChange={setAssetFilter}
                  assets={filteredAssets}
                  renders={filteredRenders}
                  selectedSceneId={selectedSceneId}
                  onAssetClick={handleOpenAsset}
                />
              </section>

              <aside className="glassPanel flex flex-col gap-4 p-4 shadow-[var(--shadow-strong)] sm:p-5">
                <AssetsChat
                  prompt={assetPrompt}
                  onPromptChange={setAssetPrompt}
                  isSubmitting={isAssetGenerating}
                  error={assetError}
                  sceneOptions={sceneOptions}
                  selectedSceneId={selectedSceneId}
                  onSceneChange={(id) => {
                    setSelectedSceneId(id);
                    setEditingSceneId(null);
                    setAssetError(null);
                  }}
                  onSubmit={() => void handleGenerateAssets()}
                />
              </aside>
            </div>
          )}
        </div>
      </div>

      <VideoEditorModal
        open={isVideoEditorOpen}
        asset={activeAsset}
        projectTitle={payload?.project.title}
        segments={timelineSegments}
        totalDuration={storyboard?.totalDuration ?? undefined}
        onClose={handleCloseVideoEditor}
      />
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  active,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "group flex h-10 w-10 items-center justify-center rounded-2xl border transition",
        active
          ? "border-[#d8dd5a]/40 bg-[#d8dd5a]/15 text-[#d8dd5a]"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/85",
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
