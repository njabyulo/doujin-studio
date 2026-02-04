"use client";

import { Master } from "@a-ds/remotion";
import type { TBrandKit, TMessageContent, TStoryboard } from "@a-ds/shared";
import { FORMAT_SPECS, SMessageContent } from "@a-ds/shared";
import { Player } from "@remotion/player";
import {
  ArrowLeft,
  Bot,
  Film,
  Music,
  Palette,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageRenderer } from "~/components/domain/message-renderers";
import { RenderProgress } from "~/components/domain/render-progress";
import { SceneEditor } from "~/components/domain/scene-editor";
import { SceneList } from "~/components/domain/scene-list";
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

type InspectorTab = "scenes" | "activity";

function hashToHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function Editor({ projectId, initialGenerate }: EditorProps) {
  const [payload, setPayload] = useState<ProjectPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("scenes");

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

  const [renderState, setRenderState] = useState<RenderState | null>(null);

  const didAutoGenerate = useRef(false);

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

  const selectedScene = useMemo(() => {
    if (!storyboard || !selectedSceneId) return null;
    return storyboard.scenes.find((s) => s.id === selectedSceneId) ?? null;
  }, [selectedSceneId, storyboard]);

  const formatSpec = useMemo(() => {
    const f = storyboard?.format ?? generateFormat;
    return FORMAT_SPECS[f];
  }, [generateFormat, storyboard?.format]);

  const durationInFrames = useMemo(() => {
    const total = storyboard?.totalDuration ?? 1;
    return Math.max(1, Math.round(total * 30));
  }, [storyboard?.totalDuration]);

  const sceneCards = useMemo(() => {
    if (!storyboard) return [];
    return storyboard.scenes.map((scene, index) => {
      const hue = hashToHue(scene.id);
      return {
        id: scene.id,
        index,
        duration: scene.duration,
        label: scene.onScreenText,
        hue,
      };
    });
  }, [storyboard]);

  const startGeneration = useCallback(async () => {
    if (!projectId) return;
    if (!generateUrl.trim()) {
      setError("Enter a URL to generate from.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationProgress([
      { message: "Starting generation", progress: 5 },
    ]);

    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: generateUrl.trim(),
          format: generateFormat,
          tone: generateTone.trim() || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Generation failed");
      }

      for await (const event of consumeGenerationStream(res)) {
        if (event.type === "generation_progress") {
          setGenerationProgress((prev) => [
            ...prev,
            { message: event.message, progress: event.progress },
          ]);
        } else if (event.type === "generation_error") {
          throw new Error(event.error);
        } else if (event.type === "generation_complete") {
          setGenerationProgress((prev) => [
            ...prev,
            { message: "Generation complete", progress: 100 },
          ]);
        }
      }

      await loadProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [generateFormat, generateTone, generateUrl, loadProject, projectId]);

  useEffect(() => {
    if (!payload || didAutoGenerate.current) return;
    if (payload.checkpoints.length > 0) return;
    if (!initialGenerate?.url) return;
    didAutoGenerate.current = true;
    void startGeneration();
  }, [initialGenerate?.url, payload, startGeneration]);

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

  if (!projectId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        Project id missing.
      </div>
    );
  }

  if (isLoading && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B1020] text-white/70">
        Loading project…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1020] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-emerald-400/25 via-sky-400/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[560px] w-[560px] rounded-full bg-gradient-to-tr from-orange-500/25 via-fuchsia-500/10 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-10 rounded-full border border-white/10 bg-white/5 p-0 text-white/80 hover:bg-white/10"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.5em] text-white/45">
                Doujin Studio
              </p>
              <p className="truncate text-xl font-semibold">
                {payload?.project.title ?? "Project"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full border border-white/10 bg-white/5 px-4 text-white/80 hover:bg-white/10"
              disabled
            >
              <Bot className="mr-2 h-4 w-4" />
              Ask AI
            </Button>
            <Button
              className="rounded-full bg-[#FE7F2D] px-5 text-sm font-semibold text-white hover:bg-[#e67123]"
              onClick={() => void startRender()}
              disabled={!activeCheckpoint || isGenerating}
            >
              Render
            </Button>
          </div>
        </header>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[56px_minmax(0,1fr)_420px]">
          {/* Left tool rail */}
          <div className="hidden lg:flex">
            <div className="flex h-[640px] w-14 flex-col items-center gap-2 rounded-3xl border border-white/10 bg-white/5 p-2 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <RailButton icon={Sparkles} label="AI" active />
              <RailButton icon={Film} label="Clips" />
              <RailButton icon={Palette} label="Style" />
              <RailButton icon={Music} label="Audio" />
              <div className="my-2 h-px w-full bg-white/10" />
              <RailButton icon={SlidersHorizontal} label="Tuning" />
            </div>
          </div>

          {/* Canvas */}
          <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-3 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
                  {storyboard?.format ?? generateFormat}
                </span>
                {storyboard && (
                  <span className="text-xs text-white/50">
                    {Math.round(storyboard.totalDuration)}s •{" "}
                    {storyboard.scenes.length} scenes
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full border border-white/10 bg-white/5 px-4 text-white/80 hover:bg-white/10"
                  onClick={() => setInspectorTab("activity")}
                >
                  Activity
                </Button>
                <Button
                  type="button"
                  className="rounded-full bg-[#215E61] px-4 text-sm font-semibold text-white hover:bg-[#1b4c4f]"
                  onClick={() => void startGeneration()}
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generating…" : "Generate"}
                </Button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-3">
              <div className="relative mx-auto w-full max-w-[980px]">
                {storyboard ? (
                  <div className="relative overflow-hidden rounded-2xl bg-black/30">
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
                  </div>
                ) : (
                  <div className="flex min-h-[460px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-white/60">
                    Generate a storyboard to start editing.
                  </div>
                )}
              </div>
            </div>

            {renderState && (
              <RenderProgress
                renderJobId={renderState.renderJobId}
                status={renderState.status}
                progress={renderState.progress}
                outputUrl={renderState.outputUrl}
                onCancel={cancelRender}
                onDownload={downloadRender}
              />
            )}

            {/* Filmstrip / timeline */}
            {storyboard && sceneCards.length > 0 && (
              <div className="mt-1 rounded-3xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/55">
                    Timeline
                  </p>
                  <span className="text-xs text-white/45">
                    Click a card to select.
                  </span>
                </div>
                <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                  {sceneCards.map((card) => {
                    const isSelected = card.id === selectedSceneId;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          setSelectedSceneId(card.id);
                          setEditingSceneId(null);
                          setInspectorTab("scenes");
                        }}
                        className={[
                          "group relative h-20 min-w-[220px] overflow-hidden rounded-2xl border p-3 text-left transition",
                          isSelected
                            ? "border-white/30 bg-white/10"
                            : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5",
                        ].join(" ")}
                      >
                        <div
                          className="absolute inset-0 opacity-80"
                          style={{
                            background: `radial-gradient(1200px circle at 10% 10%, hsla(${card.hue}, 85%, 65%, 0.25), transparent 45%), radial-gradient(1200px circle at 90% 80%, hsla(${
                              (card.hue + 60) % 360
                            }, 85%, 65%, 0.18), transparent 55%)`,
                          }}
                        />
                        <div className="relative flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white/80">
                              Scene {card.index + 1}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-white/70">
                              {card.label}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white/70">
                            {Math.round(card.duration)}s
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Inspector */}
          <aside className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => setInspectorTab("scenes")}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-semibold transition",
                    inspectorTab === "scenes"
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white/80",
                  ].join(" ")}
                >
                  Scenes
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("activity")}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-semibold transition",
                    inspectorTab === "activity"
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white/80",
                  ].join(" ")}
                >
                  Activity
                </button>
              </div>
              <span className="text-xs text-white/45">
                {storyboard ? "Live" : "Ready"}
              </span>
            </div>

            {/* Generation controls live in inspector too */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/55">
                Brief
              </p>
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="generateUrl" className="text-white/70">
                    Source URL
                  </Label>
                  <Input
                    id="generateUrl"
                    value={generateUrl}
                    onChange={(e) => setGenerateUrl(e.target.value)}
                    placeholder="https://example.com/product"
                    disabled={isGenerating}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/70">Format</Label>
                    <Select
                      value={generateFormat}
                      onValueChange={(v) => setGenerateFormat(v as Format)}
                      disabled={isGenerating}
                    >
                      <SelectTrigger className="border-white/10 bg-white/5 text-white">
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
                    <Label htmlFor="generateTone" className="text-white/70">
                      Tone
                    </Label>
                    <Input
                      id="generateTone"
                      value={generateTone}
                      onChange={(e) => setGenerateTone(e.target.value)}
                      placeholder="cinematic, neon, fast hook"
                      disabled={isGenerating}
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
                    />
                  </div>
                </div>
              </div>

              {isGenerating && generationProgress.length > 0 && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-white/70">
                    {generationProgress[generationProgress.length - 1]?.progress}
                    % —{" "}
                    {generationProgress[generationProgress.length - 1]?.message}
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-black/30">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all"
                      style={{
                        width: `${generationProgress[generationProgress.length - 1]?.progress ?? 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {inspectorTab === "scenes" ? (
              <>
                {storyboard ? (
                  <>
                    <SceneList
                      scenes={storyboard.scenes}
                      selectedSceneId={selectedSceneId}
                      onSceneSelect={(id) => {
                        setSelectedSceneId(id);
                        setEditingSceneId(null);
                      }}
                    />

                    {selectedScene && (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-white/90">
                            Scene actions
                          </p>
                          <Button
                            variant="ghost"
                            className="rounded-full border border-white/10 bg-white/5 px-3 text-white/80 hover:bg-white/10"
                            onClick={() => setEditingSceneId(selectedScene.id)}
                          >
                            Manual edit
                          </Button>
                        </div>

                        <div className="mt-4 space-y-2">
                          <Label
                            htmlFor="sceneInstruction"
                            className="text-white/70"
                          >
                            Regenerate prompt
                          </Label>
                          <Input
                            id="sceneInstruction"
                            value={sceneInstruction}
                            onChange={(e) => setSceneInstruction(e.target.value)}
                            placeholder='e.g. "make it more cinematic and shorter"'
                            className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
                          />
                          <Button
                            className="w-full rounded-full bg-[#215E61] text-white hover:bg-[#1b4c4f]"
                            onClick={() => void handleRegenerateScene()}
                            disabled={!sceneInstruction.trim()}
                          >
                            Regenerate scene
                          </Button>
                        </div>
                      </div>
                    )}

                    {editingSceneId && selectedScene && (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-1">
                        <SceneEditor
                          scene={selectedScene}
                          onSave={(updates) =>
                            void handleManualSceneSave(updates)
                          }
                          onCancel={() => setEditingSceneId(null)}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
                    Scenes appear after generation.
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/55">
                  Activity
                </p>
                <div className="mt-3 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {parsedMessages.length > 0 ? (
                    parsedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <MessageRenderer content={msg.content} />
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-white/60">
                      No activity yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof Sparkles;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "group flex h-10 w-10 items-center justify-center rounded-2xl border transition",
        active
          ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/85",
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
