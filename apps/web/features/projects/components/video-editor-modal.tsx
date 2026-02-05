"use client";

import { ClipPreview } from "@doujin/remotion";
import { Player, type PlayerRef } from "@remotion/player";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Film,
  Layers,
  Mic,
  Music2,
  Pause,
  Play,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  Type,
} from "lucide-react";
import { useMemo, useRef, useState, type MouseEvent } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import type { AssetItem } from "./assets-panel";

type TimelineSegment = {
  id: string;
  label: string;
  duration: number;
};

interface VideoEditorModalProps {
  open: boolean;
  asset: AssetItem | null;
  projectTitle?: string;
  segments?: TimelineSegment[];
  totalDuration?: number;
  onClose: () => void;
}

const FPS = 30;

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VideoEditorModal({
  open,
  asset,
  projectTitle,
  segments = [],
  totalDuration,
  onClose,
}: VideoEditorModalProps) {
  const playerRef = useRef<PlayerRef>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    segments[0]?.id ?? null,
  );

  const totalDurationSeconds = useMemo(() => {
    if (typeof totalDuration === "number" && totalDuration > 0) {
      return totalDuration;
    }
    const fallback = segments.reduce((sum, seg) => sum + seg.duration, 0);
    return fallback > 0 ? fallback : 10;
  }, [segments, totalDuration]);

  const durationInFrames = Math.max(1, Math.round(totalDurationSeconds * FPS));

  const timelineSegments = useMemo(() => {
    if (segments.length > 0) return segments;
    return [
      {
        id: "main",
        label: "Main clip",
        duration: totalDurationSeconds,
      },
    ];
  }, [segments, totalDurationSeconds]);

  if (!open || !asset) return null;

  const assetUrl =
    asset.outputUrl ?? (asset.type === "image" ? asset.placeholderUrl : null);
  const assetType = asset.type === "image" ? "image" : "video";

  const handleTogglePlayback = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  };

  const handleSeek = (frame: number) => {
    const clamped = Math.max(0, Math.min(durationInFrames - 1, frame));
    playerRef.current?.seekTo(clamped);
    setCurrentFrame(clamped);
  };

  const handleTimelineClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const frame = Math.round(ratio * durationInFrames);
    handleSeek(frame);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="relative h-[92vh] w-[96vw] max-w-[1600px] overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0c11] text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-[#f7e9c6]/12 to-transparent blur-[90px]" />
          <div className="absolute -right-32 -bottom-32 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-[#d8dd5a]/10 to-transparent blur-[110px]" />
        </div>

        <div className="relative flex h-full flex-col">
          <header className="flex items-center justify-between gap-4 px-8 py-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
                <span className="font-semibold">{projectTitle ?? "Project"}</span>
                <span className="text-white/40">•</span>
                <span className="text-white/60">{asset.title}</span>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#d8dd5a]" />
                Ready
              </div>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
              >
                <Save className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex flex-1 gap-6 px-8 pb-6">
            <aside className="hidden h-full w-16 flex-col items-center gap-3 md:flex">
              {[
                { icon: Sparkles, label: "AI" },
                { icon: Film, label: "Clips" },
                { icon: Type, label: "Text" },
                { icon: Music2, label: "Audio" },
                { icon: Layers, label: "Layers" },
                { icon: SlidersHorizontal, label: "FX" },
              ].map(({ icon: Icon, label }, idx) => (
                <button
                  key={label}
                  type="button"
                  className={[
                    "flex h-11 w-11 items-center justify-center rounded-2xl border text-white/70 transition",
                    idx === 0
                      ? "border-[#d8dd5a]/50 bg-[#d8dd5a]/20 text-[#d8dd5a]"
                      : "border-white/10 bg-white/5 hover:bg-white/10",
                  ].join(" ")}
                  aria-label={label}
                  title={label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </aside>

            <section className="flex flex-1 flex-col gap-5">
              <div className="flex flex-1 items-center justify-center rounded-[28px] border border-white/10 bg-black/30 p-4">
                <div className="relative w-full max-w-[1080px] overflow-hidden rounded-[24px] border border-white/10 bg-black">
                  <Player
                    ref={playerRef}
                    component={ClipPreview}
                    durationInFrames={durationInFrames}
                    compositionWidth={1920}
                    compositionHeight={1080}
                    fps={FPS}
                    inputProps={{
                      assetUrl,
                      assetType,
                      title: asset.title,
                      durationInSeconds: totalDurationSeconds,
                    }}
                    style={{ width: "100%", height: "100%" }}
                    controls={false}
                    autoPlay={false}
                    onFrameUpdate={(frame) => setCurrentFrame(frame)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    acknowledgeRemotionLicense
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-black/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <Camera className="h-4 w-4" />
                    Preview
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <span>{formatTime(currentFrame / FPS)}</span>
                    <span>•</span>
                    <span>{formatTime(durationInFrames / FPS)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <Button
                    type="button"
                    variant="glass"
                    className="h-10 w-10 rounded-full p-0"
                    onClick={() => handleSeek(0)}
                  >
                    <Mic className="h-4 w-4 text-white/70" />
                  </Button>
                  <Button
                    type="button"
                    variant="glass"
                    className="h-12 w-12 rounded-full p-0"
                    onClick={handleTogglePlayback}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5 text-white" />
                    ) : (
                      <Play className="h-5 w-5 text-white" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="glass"
                    className="h-10 w-10 rounded-full p-0"
                    onClick={() => handleSeek(durationInFrames - 1)}
                  >
                    <Film className="h-4 w-4 text-white/70" />
                  </Button>
                  <div className="ml-auto flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                    100%
                  </div>
                </div>
              </div>
            </section>

            <aside className="hidden h-full w-[320px] flex-col gap-4 rounded-[28px] border border-white/10 bg-black/30 p-5 lg:flex">
              <div className="flex items-center justify-between text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#d8dd5a]" />
                  Director
                </div>
                <span className="text-xs text-white/40">Ready</span>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
                  Planning the next cut…
                </div>
                <Textarea
                  id="directorPrompt"
                  name="directorPrompt"
                  placeholder="What story do you want to tell?"
                  className="min-h-[160px] border-white/10 bg-white/5 text-white placeholder:text-white/40"
                />
                <Button className="w-full rounded-full" variant="accent">
                  Send direction
                </Button>
              </div>
            </aside>
          </div>

          <div className="relative border-t border-white/10 bg-black/60 px-8 py-5">
            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.4em] text-white/40">
              Timeline
            </div>
            <div className="mt-4 rounded-[20px] border border-white/10 bg-black/50 p-4">
              <div className="relative grid gap-3">
                <div
                  className="relative grid grid-cols-[120px_1fr] gap-3"
                  onClick={handleTimelineClick}
                >
                  <div className="text-xs uppercase tracking-[0.3em] text-white/45">
                    Main
                  </div>
                  <div className="relative h-14 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    <div className="absolute inset-2 flex gap-2">
                      {timelineSegments.map((segment) => {
                        const width =
                          (segment.duration / totalDurationSeconds) * 100;
                        const isSelected = selectedSegmentId === segment.id;
                        return (
                          <button
                            key={segment.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedSegmentId(segment.id);
                            }}
                            className={[
                              "relative h-full rounded-lg border px-3 text-left text-[11px] font-semibold transition",
                              isSelected
                                ? "border-[#d8dd5a]/60 bg-[#d8dd5a]/20 text-[#d8dd5a]"
                                : "border-white/10 bg-white/5 text-white/70",
                            ].join(" ")}
                            style={{ width: `${width}%` }}
                          >
                            <span className="line-clamp-1">{segment.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {[
                  { label: "B-roll", icon: Film },
                  { label: "Music", icon: Music2 },
                ].map(({ label, icon: Icon }) => (
                  <div
                    key={label}
                    className="grid grid-cols-[120px_1fr] gap-3"
                  >
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/35">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </div>
                    <div className="h-10 rounded-xl border border-dashed border-white/10 bg-white/5" />
                  </div>
                ))}

                <div className="pointer-events-none absolute left-[120px] right-0 top-0 h-full">
                  <div
                    className="absolute top-0 h-full w-0.5 bg-[#d8dd5a] shadow-[0_0_20px_rgba(216,221,90,0.8)]"
                    style={{
                      left: `${(currentFrame / durationInFrames) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
