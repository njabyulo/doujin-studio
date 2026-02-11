"use client";

import {
  AudioLines,
  Camera,
  Clapperboard,
  Layers,
  Mic,
  Scissors,
  Type,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

import { useTimelineState } from "../hooks/useTimelineState";
import { useProjectMedia } from "../hooks/useProjectMedia";
import { EditorHeader } from "./EditorHeader";
import { EditorPlayer } from "./EditorPlayer";
import { EditorTimeline } from "./EditorTimeline";
import { EditorProps, ToolItem, ClipItem } from "../types";
import { deriveTitle, formatTimestamp } from "../utils";
import {
  interpretTPlaybackCommand,
  executeTPlaybackCommand,
  PlaybackCommandError,
} from "~/lib/playback-commands";
import { buildAuthHref } from "~/lib/auth-navigation";
import { PlaybackPanel } from "./PlaybackPanel";
import { toast } from "sonner";

const LOCAL_ASSET_ID = "local-video";

export const Editor = ({ projectId }: EditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    timelineState,
    timelineError,
    setTimelineError,
    dispatchCommand,
    handleManualSave,
  } = useTimelineState(projectId);

  const {
    upload,
    videoError,
    isBackgroundUploading,
    uploadNotice,
    handleUpload,
    handleVideoError,
  } = useProjectMedia(projectId);

  const [commandInput, setCommandInput] = useState("");
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [lastReasoning, setLastReasoning] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState("select");

  const handleSendCommand = useCallback(async () => {
    const prompt = commandInput.trim();
    if (!prompt || !videoRef.current || isInterpreting) return;

    setIsInterpreting(true);
    setLastReasoning(null);

    try {
      const { command, reasoning } = await interpretTPlaybackCommand({
        prompt,
        currentMs: Math.round(videoRef.current.currentTime * 1000),
        durationMs: Math.round(videoRef.current.duration * 1000),
      });

      setLastReasoning(reasoning || null);
      executeTPlaybackCommand(videoRef.current, command);
      setCommandInput("");
    } catch (error) {
      if (error instanceof PlaybackCommandError) {
        if (error.code === "RATE_LIMITED" || error.status === 429) {
          const reset = error.creditsResetIso
            ? new Date(error.creditsResetIso)
            : null;
          const resetLabel = reset
            ? `Resets at ${reset.toUTCString()}`
            : "Resets at 00:00 UTC";
          const limitLabel =
            typeof error.creditsLimit === "number"
              ? `${error.creditsLimit} calls/day`
              : "daily credits";

          toast.error("Daily credits used up", {
            description: `${limitLabel}. ${resetLabel}.`,
          });
          return;
        }

        if (error.code === "AI_UNAVAILABLE" || error.status === 503) {
          toast.error("AI temporarily unavailable", {
            description: "Try again in a moment.",
          });
          return;
        }
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Playback assistant failed", { description: message });
    } finally {
      setIsInterpreting(false);
    }
  }, [commandInput, isInterpreting]);

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
    () =>
      timelineState?.data.tracks.find((track) => track.kind === "video") ??
      null,
    [timelineState?.data.tracks],
  );
  const subtitleTrack = useMemo(
    () =>
      timelineState?.data.tracks.find((track) => track.kind === "subtitle") ??
      null,
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
        (clip) =>
          `${formatTimestamp(clip.startMs)} - ${formatTimestamp(clip.endMs)}`,
      ),
    [clips],
  );

  const firstVideoClip = videoTrack?.clips[0] ?? null;

  const handleAddClip = useCallback(() => {
    if (!videoTrack) return;
    if (!upload?.url) {
      setTimelineError("Select a local video to add clips.");
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
        assetId: LOCAL_ASSET_ID,
        startMs,
        durationMs: 5_000,
      },
    });
    setTimelineError(null);
  }, [dispatchCommand, upload?.url, videoTrack, setTimelineError]);

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
    const midpoint = Math.round(
      (firstVideoClip.startMs + firstVideoClip.endMs) / 2,
    );
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
    const nextVolume =
      firstVideoClip.volume && firstVideoClip.volume > 0.8 ? 0.6 : 1;
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
        return "Unsaved";
      case "saving":
        return "Saving...";
      case "saved":
        return "Saved";
      case "conflict":
        return "Conflict";
      case "error":
        return "Error";
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
        <div className="grid w-full gap-6 lg:grid-cols-[72px_minmax(0,1fr)] xl:grid-cols-[72px_minmax(0,1fr)_420px]">
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
            <EditorHeader
              title={title}
              timelineStatusLabel={timelineStatusLabel}
              timelineState={timelineState}
              upload={upload}
              handleAddClip={handleAddClip}
              handleManualSave={handleManualSave}
            />

            <EditorPlayer
              upload={upload}
              videoRef={videoRef}
              videoError={videoError}
              isBackgroundUploading={isBackgroundUploading}
              uploadNotice={uploadNotice}
              signInHref={signInHref}
              handleVideoError={handleVideoError}
              onFileSelect={() => inputRef.current?.click()}
              inputRef={inputRef}
              onInputChange={(e) => {
                handleUpload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <EditorTimeline
              clips={clips}
              timeChips={timeChips}
              handleAddClip={handleAddClip}
              handleSplitClip={handleSplitClip}
              handleTrimClip={handleTrimClip}
              handleMoveClip={handleMoveClip}
              handleSetVolume={handleSetVolume}
              handleAddSubtitle={handleAddSubtitle}
              handleRemoveClip={handleRemoveClip}
              isAddClipDisabled={!upload?.url}
              isActionDisabled={!firstVideoClip}
              isSubtitleDisabled={!subtitleTrack}
            />

            {timelineError && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-[color:var(--editor-accent)]">
                  {timelineError}
                </p>
                {timelineError.toLowerCase().includes("authentication") && (
                  <Button
                    variant="glass"
                    size="sm"
                    className="rounded-full px-4"
                    asChild
                  >
                    <Link href={signInHref}>Sign in</Link>
                  </Button>
                )}
              </div>
            )}

            <div className="xl:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="accent"
                    className="fixed bottom-6 right-6 z-40 rounded-full px-5 shadow-[0_25px_60px_rgba(216,221,90,0.45)]"
                  >
                    Ask AI
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-[420px] max-w-[92vw] p-0"
                >
                  <div className="p-6">
                    <PlaybackPanel
                      commandInput={commandInput}
                      isInterpreting={isInterpreting}
                      lastReasoning={lastReasoning}
                      onCommandInputChange={setCommandInput}
                      onSendCommand={handleSendCommand}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </section>

          <aside className="hidden xl:block">
            <div className="sticky top-8">
              <PlaybackPanel
                commandInput={commandInput}
                isInterpreting={isInterpreting}
                lastReasoning={lastReasoning}
                onCommandInputChange={setCommandInput}
                onSendCommand={handleSendCommand}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
