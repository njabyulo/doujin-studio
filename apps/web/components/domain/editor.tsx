"use client";

import type { TStoryboard } from "@a-ds/remotion";
import { Player, type PlayerRef } from "@remotion/player";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AbsoluteFill } from "remotion";

type FloatingControlsProps = {
  onCamera?: () => void;
  onRecord?: () => void;
  onGamepad?: () => void;
};

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  onCamera,
  onRecord,
  onGamepad,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        right: 56,
        bottom: 170, // sits above the timeline like your screenshot
        zIndex: 20,
      }}
    >
      <div
        className="accent"
        style={{
          borderRadius: 999,
          padding: 10,
          display: "flex",
          gap: 10,
          alignItems: "center",
          boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
        }}
      >
        <Circle icon="📷" onClick={onCamera} ariaLabel="Camera" />
        <Circle icon="🎥" onClick={onRecord} ariaLabel="Record" />
        <Circle icon="🎮" onClick={onGamepad} ariaLabel="Controls" />
      </div>

      {/* the little “stem” + plus like in the screenshot */}
      <div style={{ display: "grid", placeItems: "center", marginTop: 8 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "var(--accent)",
          }}
        />
        <div
          style={{
            width: 6,
            height: 48,
            borderRadius: 999,
            background: "var(--accent)",
            marginTop: 6,
          }}
        />
        <button
          className="accent"
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            border: 0,
            cursor: "pointer",
            marginTop: 8,
            boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
            fontSize: 22,
          }}
          aria-label="Add clip"
          title="Add clip"
          onClick={() => {}}
        >
          +
        </button>
      </div>
    </div>
  );
};

const Circle: React.FC<{
  icon: string;
  onClick?: () => void;
  ariaLabel: string;
}> = ({ icon, onClick, ariaLabel }) => {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 46,
        height: 46,
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.35)",
        backdropFilter: "blur(12px)",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        fontSize: 18,
      }}
      title={ariaLabel}
    >
      {icon}
    </button>
  );
};

export const TopBar: React.FC<{ projectName: string }> = ({ projectName }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 18,
        left: 18,
        right: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <div style={{ pointerEvents: "auto" }}>
        <button
          className="pill"
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            border: 0,
            cursor: "pointer",
          }}
          aria-label="Back"
        >
          ←
        </button>
      </div>

      <div style={{ pointerEvents: "auto" }}>
        <div
          className="pillDim"
          style={{
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontWeight: 600 }}>Project: {projectName}</span>
          <span style={{ opacity: 0.85, cursor: "pointer" }} title="Rename">
            ✎
          </span>

          <button
            className="pill"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: 0,
              cursor: "pointer",
            }}
            aria-label="Add"
            title="Add"
          >
            +
          </button>
        </div>
      </div>

      <div style={{ pointerEvents: "auto" }}>
        <button
          className="pill"
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            border: 0,
            cursor: "pointer",
          }}
          aria-label="Save"
          title="Save"
        >
          💾
        </button>
      </div>
    </div>
  );
};

const LeftRail = () => {
  return (
    <aside
      style={{ position: "absolute", top: 90, left: 18 }}
      className="glassPanel"
    >
      <div style={{ padding: 10, display: "grid", gap: 10 }}>
        <CircleBtn active icon="✦" />
        <CircleBtn icon="Aa" />
        <CircleBtn icon="♪" />
        <CircleBtn icon="●" />
        <CircleBtn activeAccent icon="◼" />
        <CircleBtn icon="≡" />
      </div>
    </aside>
  );
};

const CircleBtn: React.FC<{
  icon: string;
  active?: boolean;
  activeAccent?: boolean;
}> = ({ icon, active, activeAccent }) => {
  const bg = activeAccent
    ? "var(--accent)"
    : active
      ? "rgba(0,0,0,0.45)"
      : "rgba(255,255,255,0.20)";
  const color = activeAccent ? "rgba(0,0,0,0.85)" : "var(--text)";
  return (
    <button
      style={{
        width: 48,
        height: 48,
        borderRadius: 999,
        background: bg,
        color,
        border: "1px solid rgba(255,255,255,0.12)",
        display: "grid",
        placeItems: "center",
      }}
    >
      {icon}
    </button>
  );
};

const BottomTimeline: React.FC<{
  playerRef: React.RefObject<PlayerRef | null>;
  durationInFrames: number;
}> = ({ playerRef, durationInFrames }) => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { current } = playerRef;
    if (!current) return;

    const onFrameUpdate = () => {
      setFrame(current.getCurrentFrame());
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    current.addEventListener("frameupdate", onFrameUpdate);
    current.addEventListener("play", onPlay);
    current.addEventListener("pause", onPause);

    return () => {
      current.removeEventListener("frameupdate", onFrameUpdate);
      current.removeEventListener("play", onPlay);
      current.removeEventListener("pause", onPause);
    };
  }, [playerRef]);

  const handleSeek = useCallback(
    (clientX: number) => {
      if (!containerRef.current || !playerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const targetFrame = Math.round(percentage * (durationInFrames - 1));

      playerRef.current.seekTo(targetFrame);
    },
    [durationInFrames, playerRef],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      setDragging(true);
      if (playerRef.current) {
        playerRef.current.pause();
      }
      handleSeek(e.clientX);
    },
    [handleSeek, playerRef],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging) return;
      handleSeek(e.clientX);
    },
    [dragging, handleSeek],
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragging, onPointerMove, onPointerUp]);

  const togglePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    if (playing) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  }, [playing, playerRef]);

  const progress = (frame / Math.max(1, durationInFrames - 1)) * 100;

  return (
    <div style={{ position: "absolute", left: 18, right: 18, bottom: 18 }}>
      <div className="glassPanel" style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={togglePlayPause}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: 0,
              cursor: "pointer",
              background: "rgba(255,255,255,0.2)",
              display: "grid",
              placeItems: "center",
              fontSize: 16,
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "⏸" : "▶"}
          </button>

          <div
            ref={containerRef}
            onPointerDown={onPointerDown}
            style={{
              flex: 1,
              height: 8,
              background: "rgba(0,0,0,0.25)",
              borderRadius: 4,
              cursor: "pointer",
              position: "relative",
              userSelect: "none",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "var(--accent)",
                borderRadius: 4,
                transition: dragging ? "none" : "width 0.1s",
              }}
            />
          </div>

          <span style={{ fontSize: 12, opacity: 0.75, minWidth: 60 }}>
            {Math.floor(frame / 30)}s / {Math.floor(durationInFrames / 30)}s
          </span>
        </div>
      </div>
    </div>
  );
};


const VideoComposition: React.FC<{ storyboard: TStoryboard }> = ({
  storyboard,
}) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: storyboard.branding.primaryColor }}
    >
      <div
        style={{
          fontFamily: storyboard.branding.fontFamily,
          color: "#fff",
          padding: 40,
          fontSize: 48,
          fontWeight: "bold",
        }}
      >
        {storyboard.adTitle}
      </div>
    </AbsoluteFill>
  );
};

export const Editor: React.FC<{ storyboard: TStoryboard }> = ({
  storyboard,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const durationInFrames = 300;

  return (
    <div className="editorRoot">
      <TopBar projectName={storyboard.adTitle} />
      <LeftRail />

      <main className="canvasStage">
        <div className="canvasFrame">
          <Player
            ref={playerRef}
            component={VideoComposition}
            durationInFrames={durationInFrames}
            fps={30}
            compositionWidth={1920}
            compositionHeight={1080}
            inputProps={{ storyboard }}
            controls={false}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        <FloatingControls />
      </main>

      <BottomTimeline
        playerRef={playerRef}
        durationInFrames={durationInFrames}
      />
    </div>
  );
};
