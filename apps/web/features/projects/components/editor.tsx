"use client";

import {
  ArrowLeft,
  AudioLines,
  Camera,
  Clapperboard,
  Layers,
  Mic,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Save,
  Scissors,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { buildAuthHref } from "~/lib/auth-navigation";
import {
  ApiClientError,
  listProjectAssets,
  resolveApiAssetUrl,
  type AssetRecord,
} from "~/lib/assets-api";
import { uploadVideoWithPoster } from "~/lib/asset-upload";
import {
  claimPendingUpload,
  clearPendingUpload,
  setPendingUpload,
} from "~/lib/pending-upload";
import {
  clearUpload,
  loadUpload,
  saveUpload,
  type UploadSession,
} from "~/lib/upload-session";
import {
  createProjectTimeline,
  createTimelineVersion,
  patchTimeline,
  type TimelineWithLatestResponse,
} from "~/lib/timelines-api";
import {
  applyEditorCommand,
  loadEditorTimelineCache,
  saveEditorTimelineCache,
  type EditorCommand,
  type EditorSaveStatus,
  type EditorTimelineState,
} from "~/lib/timeline-state";
import { interpretPlaybackCommand, executePlaybackCommand } from "~/lib/playback-commands";

interface EditorProps {
  projectId?: string;
}

type ToolItem = {
  id: string;
  label: string;
  icon: React.ElementType;
};

type ClipItem = {
  id: string;
  label: string;
  gradient: string;
  startMs: number;
  endMs: number;
};

function deriveTitle(name?: string | null) {
  if (!name) return "Untitled Edit";
  return name.replace(/\.[^/.]+$/, "");
}

function formatDuration(durationMs: number | null | undefined) {
  if (!durationMs || durationMs <= 0) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatTimestamp(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function Editor({ projectId }: EditorProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timelineStateRef = useRef<EditorTimelineState | null>(null);
  const [upload, setUpload] = useState<UploadSession | null>(() =>
    projectId ? loadUpload(projectId) : null,
  );
  const [videoError, setVideoError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState("select");
  const [isBackgroundUploading, setIsBackgroundUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineState, setTimelineState] = useState<EditorTimelineState | null>(() => {
    if (!projectId) return null;
    const cached = loadEditorTimelineCache(projectId);
    if (!cached) return null;

    return {
      timelineId: cached.timelineId,
      baseVersion: cached.baseVersion,
      data: cached.data,
      saveStatus: "idle",
      lastSavedAt: null,
      source: "system",
      error: null,
    };
  });

  const [commandInput, setCommandInput] = useState("");
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [lastReasoning, setLastReasoning] = useState<string | null>(null);

  const handleSendCommand = useCallback(async () => {
    const prompt = commandInput.trim();
    if (!prompt || !videoRef.current || isInterpreting) return;

    setIsInterpreting(true);
    setLastReasoning(null);

    try {
      const { command, reasoning } = await interpretPlaybackCommand({
        prompt,
        currentMs: Math.round(videoRef.current.currentTime * 1000),
        durationMs: Math.round(videoRef.current.duration * 1000),
      });

      setLastReasoning(reasoning || null);
      executePlaybackCommand(videoRef.current, command);
      setCommandInput("");
    } catch (error) {
      console.error("Playback command failed:", error);
    } finally {
      setIsInterpreting(false);
    }
  }, [commandInput, isInterpreting]);

  const toEditorTimelineState = useCallback(
    (
      payload: TimelineWithLatestResponse,
      saveStatus: EditorSaveStatus = "saved",
    ): EditorTimelineState => ({
      timelineId: payload.timeline.id,
      baseVersion: payload.latestVersion.version,
      data: payload.latestVersion.data,
      saveStatus,
      lastSavedAt: Date.now(),
      source: payload.latestVersion.source,
      error: null,
    }),
    [],
  );

  const persistTimelineCache = useCallback(
    (nextState: EditorTimelineState) => {
      if (!projectId) return;

      saveEditorTimelineCache(projectId, {
        timelineId: nextState.timelineId,
        baseVersion: nextState.baseVersion,
        data: nextState.data,
      });
    },
    [projectId],
  );

  useEffect(() => {
    timelineStateRef.current = timelineState;
  }, [timelineState]);

  const queueAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      const snapshot = timelineStateRef.current;
      if (!snapshot || snapshot.saveStatus !== "dirty") {
        return;
      }

      setTimelineState((current) =>
        current
          ? {
            ...current,
            saveStatus: "saving",
            error: null,
          }
          : current,
      );

      try {
        const response = await patchTimeline(snapshot.timelineId, {
          baseVersion: snapshot.baseVersion,
          source: "autosave",
          data: snapshot.data,
        });
        const nextState = toEditorTimelineState(response, "saved");
        setTimelineState(nextState);
        persistTimelineCache(nextState);
        setTimelineError(null);
      } catch (caughtError) {
        if (
          caughtError instanceof ApiClientError &&
          caughtError.status === 400
        ) {
          setTimelineState((current) =>
            current
              ? {
                ...current,
                saveStatus: "conflict",
                error: "Timeline version conflict. Refresh to sync the latest edits.",
              }
              : current,
          );
          setTimelineError("Timeline version conflict. Refresh to sync.");
          return;
        }

        if (
          caughtError instanceof ApiClientError &&
          caughtError.status === 401
        ) {
          setTimelineState((current) =>
            current
              ? {
                ...current,
                saveStatus: "error",
                error: "Authentication required to save timeline edits.",
              }
              : current,
          );
          setTimelineError("Authentication required to save timeline edits.");
          return;
        }

        setTimelineState((current) =>
          current
            ? {
              ...current,
              saveStatus: "error",
              error: "Autosave failed. Try manual Save.",
            }
            : current,
        );
        setTimelineError("Autosave failed. Try manual Save.");
      }
    }, 1200);
  }, [persistTimelineCache, toEditorTimelineState]);

  const applyUploadedAsset = useCallback(
    (asset: AssetRecord, fallbackName?: string) => {
      if (!projectId) return;

      const resolvedFileUrl = resolveApiAssetUrl(asset.fileUrl);
      const resolvedPosterUrl = asset.posterUrl
        ? resolveApiAssetUrl(asset.posterUrl)
        : null;
      const nextUpload: UploadSession = {
        url: resolvedFileUrl,
        cloudUrl: resolvedFileUrl,
        posterUrl: resolvedPosterUrl,
        name: fallbackName ?? asset.r2Key.split("/").pop() ?? "upload.mp4",
        size: asset.size,
        type: asset.mime,
        assetId: asset.id,
        posterAssetId: asset.posterAssetId,
        createdAt: Date.now(),
        status: "uploaded",
        durationMs: asset.durationMs,
        width: asset.width,
        height: asset.height,
      };

      saveUpload(projectId, nextUpload);
      setUpload(nextUpload);
    },
    [projectId],
  );

  const attachUploadedAssetToTimeline = useCallback(
    (asset: AssetRecord) => {
      setTimelineState((current) => {
        if (!current) {
          return current;
        }

        const videoTrack = current.data.tracks.find((track) => track.kind === "video");
        if (!videoTrack) {
          return current;
        }

        const alreadyReferenced = current.data.tracks.some((track) =>
          track.clips.some((clip) => clip.assetId === asset.id),
        );
        if (alreadyReferenced) {
          return current;
        }

        const startMs = videoTrack.clips.reduce(
          (maxEnd, clip) => Math.max(maxEnd, clip.endMs),
          0,
        );
        const nextData = applyEditorCommand(current.data, {
          type: "addClip",
          trackId: videoTrack.id,
          clip: {
            assetId: asset.id,
            startMs,
            durationMs: asset.durationMs ?? 10_000,
          },
        });
        if (nextData === current.data) {
          return current;
        }

        const nextState: EditorTimelineState = {
          ...current,
          data: nextData,
          saveStatus: "dirty",
          error: null,
          source: "autosave",
        };
        persistTimelineCache(nextState);
        return nextState;
      });
      queueAutosave();
    },
    [persistTimelineCache, queueAutosave],
  );

  const runBackgroundUpload = useCallback(
    async (file: File) => {
      if (!projectId) return;

      setIsBackgroundUploading(true);
      setUploadNotice("Uploading to cloud...");

      try {
        const result = await uploadVideoWithPoster(projectId, file);
        applyUploadedAsset(result.videoAsset, file.name);
        attachUploadedAssetToTimeline(result.videoAsset);
        setVideoError(null);
        setUploadNotice("Cloud upload complete");
      } catch (caughtError) {
        console.error(caughtError);
        setVideoError(
          "Cloud upload failed. Local preview is still available; upload again to retry.",
        );
        setUploadNotice(null);
      } finally {
        clearPendingUpload(projectId);
        setIsBackgroundUploading(false);
      }
    },
    [applyUploadedAsset, attachUploadedAssetToTimeline, projectId],
  );

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    const hydrateProjectState = async () => {
      try {
        const assetsResponse = await listProjectAssets(projectId, {
          type: "video",
          status: "uploaded",
          limit: 1,
        });

        if (cancelled) return;

        const latestAsset = assetsResponse.assets[0];
        if (latestAsset) {
          const local = loadUpload(projectId);
          applyUploadedAsset(latestAsset, local?.name);
        }

        const hydratedTimeline = await createProjectTimeline(projectId, {
          name: "Main Timeline",
          seedAssetId: latestAsset?.id,
        });

        if (cancelled) return;

        const nextTimelineState = toEditorTimelineState(hydratedTimeline, "saved");
        setTimelineState(nextTimelineState);
        persistTimelineCache(nextTimelineState);
        setTimelineError(null);

        if (!latestAsset) {
          const claimedUpload = claimPendingUpload(projectId);
          if (claimedUpload) {
            void runBackgroundUpload(claimedUpload);
          }
        }
      } catch (caughtError) {
        if (cancelled) return;

        if (
          caughtError instanceof ApiClientError &&
          caughtError.status === 401
        ) {
          setVideoError("Authentication required to load project media.");
          setTimelineError("Authentication required to load timeline data.");
          return;
        }

        setVideoError("Could not load uploaded media for this project.");
        setTimelineError("Could not load timeline for this project.");
      }
    };

    void hydrateProjectState();

    return () => {
      cancelled = true;
    };
  }, [
    applyUploadedAsset,
    persistTimelineCache,
    projectId,
    runBackgroundUpload,
    toEditorTimelineState,
  ]);

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    },
    [],
  );

  const dispatchCommand = useCallback(
    (command: EditorCommand) => {
      setTimelineState((current) => {
        if (!current) {
          return current;
        }

        const nextData = applyEditorCommand(current.data, command);
        if (nextData === current.data) {
          return current;
        }

        const nextState: EditorTimelineState = {
          ...current,
          data: nextData,
          saveStatus: "dirty",
          error: null,
          source: "autosave",
        };
        persistTimelineCache(nextState);
        return nextState;
      });

      queueAutosave();
    },
    [persistTimelineCache, queueAutosave],
  );

  const tools = useMemo<ToolItem[]>(
    () => [
      { id: "select", label: "Select", icon: Clapperboard },
      { id: "cut", label: "Cut", icon: Scissors },
      { id: "type", label: "Type", icon: Type },
      { id: "audio", label: "Audio", icon: AudioLines },
      { id: "voice", label: "Voice", icon: Mic },
      { id: "layers", label: "Layers", icon: Layers },
      { id: "camera", label: "Cameras", icon: Camera },
      { id: "magic", label: "AI", icon: Wand2 },
    ],
    [],
  );

  const videoTrack = useMemo(
    () => timelineState?.data.tracks.find((track) => track.kind === "video") ?? null,
    [timelineState?.data.tracks],
  );
  const subtitleTrack = useMemo(
    () => timelineState?.data.tracks.find((track) => track.kind === "subtitle") ?? null,
    [timelineState?.data.tracks],
  );

  const clipGradients = useMemo(
    () => [
      "linear-gradient(135deg, #f5d8b2 0%, #caa47f 100%)",
      "linear-gradient(135deg, #e0e8f5 0%, #9bb2d3 100%)",
      "linear-gradient(135deg, #f1d2d4 0%, #bf7a7f 100%)",
      "linear-gradient(135deg, #e6f0d2 0%, #a5b97c 100%)",
      "linear-gradient(135deg, #e1d7ff 0%, #9f8ddb 100%)",
    ],
    [],
  );

  const clips = useMemo<ClipItem[]>(
    () =>
      (videoTrack?.clips ?? []).map((clip, index) => ({
        id: clip.id,
        label: `Clip ${index + 1}`,
        gradient: clipGradients[index % clipGradients.length] as string,
        startMs: clip.startMs,
        endMs: clip.endMs,
      })),
    [clipGradients, videoTrack?.clips],
  );

  const timeChips = useMemo(
    () =>
      clips.map(
        (clip) => `${formatTimestamp(clip.startMs)} - ${formatTimestamp(clip.endMs)}`,
      ),
    [clips],
  );

  const handleUpload = useCallback(
    (file?: File | null) => {
      if (!file) return;
      if (!projectId) {
        setVideoError("Open a saved project before uploading footage.");
        return;
      }

      const url = URL.createObjectURL(file);
      const nextUpload: UploadSession = {
        url,
        name: file.name,
        size: file.size,
        type: file.type || "video/mp4",
        createdAt: Date.now(),
        status: "local",
        cloudUrl: null,
        posterUrl: null,
        durationMs: null,
        width: null,
        height: null,
      };
      saveUpload(projectId, nextUpload);
      setUpload(nextUpload);
      setVideoError(null);
      setUploadNotice("Preparing upload...");
      setPendingUpload(projectId, file);

      const claimedUpload = claimPendingUpload(projectId);
      if (claimedUpload) {
        void runBackgroundUpload(claimedUpload);
      }
    },
    [projectId, runBackgroundUpload],
  );

  const handleManualSave = useCallback(async () => {
    const snapshot = timelineStateRef.current;
    if (!snapshot) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setTimelineState((current) =>
      current
        ? {
          ...current,
          saveStatus: "saving",
          error: null,
        }
        : current,
    );

    try {
      const response = await createTimelineVersion(snapshot.timelineId, {
        baseVersion: snapshot.baseVersion,
        source: "manual",
        data: snapshot.data,
      });
      const nextState = toEditorTimelineState(response, "saved");
      setTimelineState(nextState);
      persistTimelineCache(nextState);
      setTimelineError(null);
      setUploadNotice("Timeline saved");
    } catch (caughtError) {
      if (
        caughtError instanceof ApiClientError &&
        caughtError.status === 400
      ) {
        setTimelineState((current) =>
          current
            ? {
              ...current,
              saveStatus: "conflict",
              error: "Timeline version conflict. Refresh to sync the latest edits.",
            }
            : current,
        );
        setTimelineError("Timeline version conflict. Refresh to sync.");
        return;
      }

      if (
        caughtError instanceof ApiClientError &&
        caughtError.status === 401
      ) {
        setTimelineError("Authentication required to save timeline edits.");
        setTimelineState((current) =>
          current
            ? {
              ...current,
              saveStatus: "error",
              error: "Authentication required to save timeline edits.",
            }
            : current,
        );
        return;
      }

      setTimelineError("Manual save failed. Please try again.");
      setTimelineState((current) =>
        current
          ? {
            ...current,
            saveStatus: "error",
            error: "Manual save failed. Please try again.",
          }
          : current,
      );
    }
  }, [persistTimelineCache, toEditorTimelineState]);

  const handleVideoError = useCallback(() => {
    if (!projectId) return;
    if (upload?.cloudUrl) {
      setVideoError("Video playback failed. Try refreshing the project.");
      return;
    }

    clearUpload(projectId);
    setUpload(null);
    setVideoError("Video preview expired. Upload again to continue.");
  }, [projectId, upload?.cloudUrl]);

  const firstVideoClip = videoTrack?.clips[0] ?? null;

  const handleAddClip = useCallback(() => {
    if (!videoTrack) return;
    if (!upload?.assetId) {
      setTimelineError("Upload must complete before adding clips.");
      return;
    }

    const startMs = videoTrack.clips.reduce(
      (maxEnd, clip) => Math.max(maxEnd, clip.endMs),
      0,
    );
    dispatchCommand({
      type: "addClip",
      trackId: videoTrack.id,
      clip: {
        assetId: upload.assetId,
        startMs,
        durationMs: upload.durationMs ?? 5_000,
      },
    });
    setTimelineError(null);
  }, [dispatchCommand, upload?.assetId, upload?.durationMs, videoTrack]);

  const handleTrimClip = useCallback(() => {
    if (!firstVideoClip) return;
    dispatchCommand({
      type: "trimClip",
      clipId: firstVideoClip.id,
      endMs: Math.max(firstVideoClip.startMs + 100, firstVideoClip.endMs - 500),
    });
  }, [dispatchCommand, firstVideoClip]);

  const handleSplitClip = useCallback(() => {
    if (!firstVideoClip) return;
    const midpoint = Math.round((firstVideoClip.startMs + firstVideoClip.endMs) / 2);
    dispatchCommand({
      type: "splitClip",
      clipId: firstVideoClip.id,
      atMs: midpoint,
    });
  }, [dispatchCommand, firstVideoClip]);

  const handleMoveClip = useCallback(() => {
    if (!firstVideoClip || !videoTrack) return;
    dispatchCommand({
      type: "moveClip",
      clipId: firstVideoClip.id,
      trackId: videoTrack.id,
      startMs: firstVideoClip.startMs + 500,
    });
  }, [dispatchCommand, firstVideoClip, videoTrack]);

  const handleSetVolume = useCallback(() => {
    if (!firstVideoClip) return;
    const nextVolume = firstVideoClip.volume && firstVideoClip.volume > 0.8 ? 0.6 : 1;
    dispatchCommand({
      type: "setVolume",
      clipId: firstVideoClip.id,
      volume: nextVolume,
    });
  }, [dispatchCommand, firstVideoClip]);

  const handleAddSubtitle = useCallback(() => {
    if (!subtitleTrack) return;
    const startMs = firstVideoClip?.startMs ?? 0;
    dispatchCommand({
      type: "addSubtitle",
      trackId: subtitleTrack.id,
      text: "Subtitle cue",
      startMs,
      endMs: startMs + 2_000,
    });
  }, [dispatchCommand, firstVideoClip?.startMs, subtitleTrack]);

  const handleRemoveClip = useCallback(() => {
    if (!firstVideoClip) return;
    dispatchCommand({
      type: "removeClip",
      clipId: firstVideoClip.id,
    });
  }, [dispatchCommand, firstVideoClip]);

  const timelineStatusLabel = useMemo(() => {
    switch (timelineState?.saveStatus) {
      case "dirty":
        return "Unsaved edits";
      case "saving":
        return "Saving...";
      case "saved":
        return "Saved";
      case "conflict":
        return "Conflict";
      case "error":
        return "Save failed";
      default:
        return "Idle";
    }
  }, [timelineState?.saveStatus]);

  const title = deriveTitle(upload?.name);
  const signInHref = buildAuthHref(
    "/auth/sign-in",
    projectId ? `/projects/${projectId}` : "/",
  );

  return (
    <div className="ds-editor min-h-screen">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-6 py-8">
        <div className="grid w-full gap-6 lg:grid-cols-[72px_minmax(0,1fr)]">
          <aside className="editor-rail hidden flex-col items-center gap-3 lg:flex">
            <TooltipProvider>
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "editor-tool",
                          activeTool === tool.id && "editor-tool-active",
                        )}
                        onClick={() => setActiveTool(tool.id)}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{tool.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </aside>

          <section className="flex flex-col gap-6">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
              <Button
                variant="glass"
                size="icon"
                className="rounded-full"
                onClick={() => router.push("/")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="flex justify-center">
                <div className="editor-pill pill-float flex items-center gap-2 text-sm font-semibold">
                  <span>Project: {title}</span>
                  <Badge variant="subtle" className="normal-case">
                    {timelineStatusLabel}
                  </Badge>
                  <button
                    type="button"
                    className="rounded-full bg-white/10 p-1 text-white/70 transition hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="glass"
                      size="icon"
                      className="rounded-full"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Project</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Rename</DropdownMenuItem>
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem>Export still</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="glass"
                  size="icon"
                  className="rounded-full"
                  onClick={handleAddClip}
                  disabled={!upload?.assetId}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="glass"
                  size="icon"
                  className="rounded-full"
                  onClick={() => void handleManualSave()}
                  disabled={!timelineState || timelineState.saveStatus === "saving"}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="editor-stage aspect-[16/9]">
              {upload ? (
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  src={upload.url}
                  poster={upload.posterUrl ?? undefined}
                  controls
                  onError={handleVideoError}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
                    <Clapperboard className="h-7 w-7 text-white/70" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-white">
                      Upload a clip to begin
                    </p>
                    <p className="text-sm text-white/60">
                      Local preview starts instantly while cloud upload runs.
                    </p>
                  </div>
                  <Button
                    variant="accent"
                    className="rounded-full px-6"
                    disabled={isBackgroundUploading}
                    onClick={() => inputRef.current?.click()}
                  >
                    {isBackgroundUploading ? "Uploading..." : "Choose a video"}
                  </Button>
                  {videoError ? (
                    <div className="space-y-2">
                      <p className="text-sm text-[color:var(--editor-accent)]">
                        {videoError}
                      </p>
                      {videoError.toLowerCase().includes("authentication") ? (
                        <Button variant="glass" size="sm" className="rounded-full px-4" asChild>
                          <Link href={signInHref}>Sign in to continue</Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}

              {upload ? (
                <div className="absolute left-6 top-6 flex items-center gap-3 rounded-full bg-black/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
                  <span>Footage</span>
                  {upload.durationMs ? (
                    <span>{formatDuration(upload.durationMs)}</span>
                  ) : null}
                  {upload.width && upload.height ? (
                    <span>
                      {upload.width}x{upload.height}
                    </span>
                  ) : null}
                  <Button
                    variant="glass"
                    size="sm"
                    className="rounded-full px-4"
                    disabled={isBackgroundUploading}
                    onClick={() => inputRef.current?.click()}
                  >
                    Replace
                  </Button>
                </div>
              ) : null}

              {upload ? (
                <div className="absolute right-6 bottom-6 flex items-center gap-2 rounded-full bg-[color:var(--editor-accent)] px-4 py-3 text-[#1a1a14] shadow-[0_20px_45px_rgba(216,221,90,0.45)]">
                  <button
                    type="button"
                    className="rounded-full bg-black/10 p-2"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-black/10 p-2"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-black/10 p-2"
                  >
                    <AudioLines className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              {uploadNotice ? (
                <div className="absolute left-6 bottom-6 rounded-full bg-black/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/75 backdrop-blur">
                  {uploadNotice}
                </div>
              ) : null}

              <Input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => {
                  handleUpload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>

            <div className="timelineDock px-6 py-5">
              <div className="flex items-center gap-4">
                <Button
                  variant="glass"
                  size="icon"
                  className="rounded-full"
                  onClick={handleAddClip}
                  disabled={!upload?.assetId}
                >
                  <Plus className="h-4 w-4" />
                </Button>

                <div className="relative flex-1 overflow-hidden">
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {clips.map((clip) => (
                      <div
                        key={clip.id}
                        className="timeline-clip"
                        style={{ backgroundImage: clip.gradient }}
                      >
                        <span className="absolute bottom-2 left-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                          {clip.label} · {formatTimestamp(clip.startMs)}-
                          {formatTimestamp(clip.endMs)}
                        </span>
                      </div>
                    ))}
                    <div className="timeline-clip flex items-center justify-center text-white/70">
                      <Plus className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="timeline-playhead absolute left-1/2 top-0 h-full" />
                </div>

                <Button
                  variant="glass"
                  size="icon"
                  className="rounded-full"
                  onClick={handleSplitClip}
                  disabled={!firstVideoClip}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="glass"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={handleTrimClip}
                  disabled={!firstVideoClip}
                >
                  Trim
                </Button>
                <Button
                  variant="glass"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={handleSplitClip}
                  disabled={!firstVideoClip}
                >
                  Split
                </Button>
                <Button
                  variant="glass"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={handleMoveClip}
                  disabled={!firstVideoClip}
                >
                  Move
                </Button>
                <Button
                  variant="glass"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={handleSetVolume}
                  disabled={!firstVideoClip}
                >
                  Volume
                </Button>
                <Button
                  variant="glass"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={handleAddSubtitle}
                  disabled={!subtitleTrack}
                >
                  Subtitle
                </Button>
                <Button
                  variant="glass"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={handleRemoveClip}
                  disabled={!firstVideoClip}
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {timeChips.map((chip, index) => (
                <button
                  key={`${chip}-${index}`}
                  type="button"
                  className={cn(
                    "time-chip",
                    index === 4 && "time-chip-active",
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
            {timelineError ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-[color:var(--editor-accent)]">
                  {timelineError}
                </p>
                {timelineError.toLowerCase().includes("authentication") ? (
                  <Button variant="glass" size="sm" className="rounded-full px-4" asChild>
                    <Link href={signInHref}>Sign in</Link>
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                <Sparkles className="h-4 w-4 text-[color:var(--editor-accent)]" />
                Playback Control
              </div>
              <div className="flex gap-3">
                <Input
                  className="bg-white/10 text-white placeholder:text-white/40"
                  placeholder="Type a command (e.g., 'go to middle', 'restart', 'pause')"
                  value={commandInput}
                  disabled={isInterpreting}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendCommand();
                  }}
                />
                <Button
                  variant="accent"
                  onClick={handleSendCommand}
                  disabled={isInterpreting || !commandInput.trim()}
                >
                  {isInterpreting ? "..." : "Send"}
                </Button>
              </div>
              {lastReasoning && (
                <p className="text-xs italic text-white/40">AI: {lastReasoning}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
