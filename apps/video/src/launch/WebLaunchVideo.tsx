import React, { useMemo } from "react";
import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Backdrop } from "./components/Backdrop";
import { BrowserFrame } from "./components/BrowserFrame";
import { bodyFont, displayFont } from "./fonts";
import { dsTheme } from "./theme";

type WebLaunchVideoProps = {
  voiceoverSrc: string;
};

type SceneId = "home" | "upload" | "editor" | "versions" | "outro";

type SceneConfig = {
  id: SceneId;
  seconds: number;
  variant: "landing" | "editor";
};

type SceneTiming = SceneConfig & {
  start: number;
  durationInFrames: number;
};

const sceneConfigs: SceneConfig[] = [
  { id: "home", seconds: 7, variant: "landing" },
  { id: "upload", seconds: 7, variant: "landing" },
  { id: "editor", seconds: 8, variant: "editor" },
  { id: "versions", seconds: 6, variant: "editor" },
  { id: "outro", seconds: 3, variant: "landing" },
];

const commandOrder = [
  "addClip",
  "trimClip",
  "splitClip",
  "moveClip",
  "setVolume",
  "addSubtitle",
  "removeClip",
] as const;

const pipelineSteps = [
  {
    label: "GET /api/me",
    detail: "Validate session before upload",
  },
  {
    label: "POST /api/projects",
    detail: "Create a project and owner membership",
  },
  {
    label: "POST /api/projects/:id/assets/upload-session",
    detail: "Create pending asset + return presigned PUT",
  },
  {
    label: "PUT <r2-presigned-url>",
    detail: "Browser uploads bytes directly to R2",
  },
  {
    label: "POST /api/assets/:id/complete",
    detail: "Verify object + set status to uploaded",
  },
  {
    label: "GET /api/assets/:id/file",
    detail: "Auth-checked stream with Range support",
  },
] as const;

const stepBadges = [
  "Describe intent",
  "Auto cut plan",
  "Iterate fast",
] as const;

const versionCards = [
  {
    version: "v1",
    source: "system",
    copy: "Timeline bootstrapped from project context.",
  },
  {
    version: "v2",
    source: "autosave",
    copy: "Reducer command applied and autosaved with baseVersion.",
  },
  {
    version: "v3",
    source: "manual",
    copy: "Manual Save creates explicit version checkpoint.",
  },
] as const;

const allocateSceneTimings = (
  fps: number,
  totalFrames: number,
  scenes: SceneConfig[],
): SceneTiming[] => {
  const baseDurations = scenes.map((scene) =>
    Math.max(1, Math.round(scene.seconds * fps)),
  );
  const baseTotal = baseDurations.reduce((sum, duration) => sum + duration, 0);
  const scale = totalFrames / baseTotal;

  let frameCursor = 0;

  return scenes.map((scene, index) => {
    const start = frameCursor;
    const isLast = index === scenes.length - 1;
    const remainingScenes = scenes.length - index - 1;
    const remainingBudget = Math.max(0, totalFrames - frameCursor);
    const raw = Math.max(1, Math.round(baseDurations[index] * scale));
    const maxDuration = Math.max(1, remainingBudget - remainingScenes);

    const durationInFrames = isLast
      ? Math.max(1, remainingBudget)
      : Math.min(raw, maxDuration);

    frameCursor += durationInFrames;

    return {
      ...scene,
      start,
      durationInFrames,
    } satisfies SceneTiming;
  });
};

const springIn = (frame: number, fps: number, delay = 0) => {
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {
      damping: 200,
      stiffness: 170,
      mass: 0.9,
    },
  });
};

const clamp01 = (value: number) => {
  return Math.min(1, Math.max(0, value));
};

export const WebLaunchVideo: React.FC<WebLaunchVideoProps> = ({
  voiceoverSrc,
}) => {
  const { fps, durationInFrames } = useVideoConfig();

  const sceneTimings = useMemo(
    () => allocateSceneTimings(fps, durationInFrames, sceneConfigs),
    [fps, durationInFrames],
  );

  const lookup = useMemo(() => {
    return sceneTimings.reduce<Record<SceneId, SceneTiming>>(
      (acc, scene) => {
        acc[scene.id] = scene;
        return acc;
      },
      {} as Record<SceneId, SceneTiming>,
    );
  }, [sceneTimings]);

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont.fontFamily }}>
      <Audio src={voiceoverSrc} />

      <Sequence
        from={lookup.home.start}
        durationInFrames={lookup.home.durationInFrames}
        premountFor={15}
      >
        <HomeScene durationInFrames={lookup.home.durationInFrames} />
      </Sequence>

      <CutFlash atFrame={lookup.upload.start} />
      <Sequence
        from={lookup.upload.start}
        durationInFrames={lookup.upload.durationInFrames}
        premountFor={15}
      >
        <UploadPipelineScene
          durationInFrames={lookup.upload.durationInFrames}
        />
      </Sequence>

      <CutFlash atFrame={lookup.editor.start} />
      <Sequence
        from={lookup.editor.start}
        durationInFrames={lookup.editor.durationInFrames}
        premountFor={15}
      >
        <TEditorCommandScene
          durationInFrames={lookup.editor.durationInFrames}
        />
      </Sequence>

      <CutFlash atFrame={lookup.versions.start} />
      <Sequence
        from={lookup.versions.start}
        durationInFrames={lookup.versions.durationInFrames}
        premountFor={15}
      >
        <VersioningScene durationInFrames={lookup.versions.durationInFrames} />
      </Sequence>

      <CutFlash atFrame={lookup.outro.start} />
      <Sequence
        from={lookup.outro.start}
        durationInFrames={lookup.outro.durationInFrames}
        premountFor={15}
      >
        <OutroScene durationInFrames={lookup.outro.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

const SceneShell: React.FC<{
  variant: "landing" | "editor";
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ variant, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = springIn(frame, fps, 0);
  const travelY = interpolate(enter, [0, 1], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOut,
        transform: `translate3d(0, ${travelY}px, 0)`,
      }}
    >
      <Backdrop variant={variant} />
      <AbsoluteFill style={{ padding: 72 }}>{children}</AbsoluteFill>
      <StudioLightSweep />
    </AbsoluteFill>
  );
};

const HomeScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftIn = springIn(frame, fps, 2);
  const rightIn = springIn(frame, fps, 8);

  return (
    <SceneShell variant="landing" durationInFrames={durationInFrames}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.02fr 0.98fr",
          gap: 36,
          height: "100%",
          alignItems: "center",
        }}
      >
        <div
          style={{
            opacity: leftIn,
            transform: `translate3d(0, ${interpolate(leftIn, [0, 1], [20, 0])}px, 0)`,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <Pill text="UPDATED WEB FLOW" />
          <Headline text="Upload a clip. Direct the edit. Ship a cinematic cut." />
          <p
            style={{
              margin: 0,
              maxWidth: 780,
              color: dsTheme.mutedLight,
              fontWeight: 600,
              fontSize: 31,
              lineHeight: 1.24,
            }}
          >
            Start with a single video. We validate auth, create a real project,
            preview locally, and upload securely to cloud storage in the
            background.
          </p>

          <div
            style={{
              marginTop: 6,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            {stepBadges.map((step, index) => (
              <FeatureCard
                key={step}
                title={step}
                body={
                  index === 0
                    ? "Tell the editor how the cut should feel."
                    : index === 1
                      ? "Apply reducer commands to timeline state immediately."
                      : "Autosave and manual versions keep edits durable."
                }
                delay={index * 4}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            opacity: rightIn,
            transform: `translate3d(0, ${interpolate(rightIn, [0, 1], [18, 0])}px, 0)`,
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ flex: 1, minHeight: 0 }}>
            <BrowserFrame
              assetPath="assets/web-home-current.png"
              cornerRadius={34}
              cropTop={0}
              cropLeft={0}
              zoomFrom={1.03}
              zoomTo={1}
              panX={-6}
              panY={6}
            />
          </div>
          <InlineNotice text="Auth gate is strict: unauthenticated uploads are blocked before project creation." />
        </div>
      </div>
    </SceneShell>
  );
};

const UploadPipelineScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  const stepProgress = interpolate(frame, [2, durationInFrames - 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const activeIndex = Math.min(
    pipelineSteps.length - 1,
    Math.floor(stepProgress * pipelineSteps.length),
  );

  return (
    <SceneShell variant="landing" durationInFrames={durationInFrames}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.02fr 0.98fr",
          gap: 34,
          height: "100%",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Pill text="R2 + ASSET REGISTRY" />
          <Headline text="Direct upload to R2. Preview through an authorized stream." />
          <p
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.3,
              color: dsTheme.mutedLight,
              fontWeight: 600,
            }}
          >
            The browser uploads directly with a presigned PUT URL. The API then
            verifies the object, marks it uploaded, and streams bytes only for
            project members.
          </p>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {pipelineSteps.map((step, index) => (
              <FlowStep
                key={step.label}
                label={step.label}
                detail={step.detail}
                state={
                  index < activeIndex
                    ? "done"
                    : index === activeIndex
                      ? "active"
                      : "pending"
                }
              />
            ))}
          </div>
        </div>

        <div
          style={{
            background: "rgba(255, 255, 255, 0.66)",
            border: `1px solid ${dsTheme.borderLight}`,
            borderRadius: 28,
            padding: 24,
            boxShadow: "0 26px 70px rgba(11, 12, 18, 0.14)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <EndpointCard
            title="POST /api/projects/:id/assets/upload-session"
            body="{ assetId, putUrl, r2Key }"
            active={activeIndex >= 2}
          />
          <EndpointCard
            title="PUT https://<account>.r2.cloudflarestorage.com/..."
            body="File bytes go directly from browser to bucket."
            active={activeIndex >= 3}
          />
          <EndpointCard
            title="POST /api/assets/:id/complete"
            body="Status moves pending_upload -> uploaded with metadata."
            active={activeIndex >= 4}
          />
          <EndpointCard
            title="GET /api/assets/:id/file"
            body="Member-only stream with Content-Range for scrubbing."
            active={activeIndex >= 5}
          />

          <div
            style={{
              marginTop: 8,
              height: 10,
              borderRadius: 999,
              background: "rgba(31, 26, 21, 0.12)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(stepProgress * 100)}%`,
                height: "100%",
                background:
                  "linear-gradient(90deg, rgba(245,141,57,0.95), rgba(216,221,90,0.95))",
                boxShadow: "0 8px 20px rgba(245,141,57,0.25)",
              }}
            />
          </div>
        </div>
      </div>
    </SceneShell>
  );
};

const TEditorCommandScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  const normalized = clamp01(frame / Math.max(1, durationInFrames - 1));
  const commandIndex = Math.min(
    commandOrder.length - 1,
    Math.floor(normalized * commandOrder.length),
  );

  const timelineStatus =
    normalized < 0.36
      ? "Unsaved edits"
      : normalized < 0.66
        ? "Saving..."
        : "Saved";

  return (
    <SceneShell variant="editor" durationInFrames={durationInFrames}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.12fr 0.88fr",
          gap: 32,
          height: "100%",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <BrowserFrame
              assetPath="assets/web-editor-current.png"
              cornerRadius={34}
              cropTop={0}
              cropLeft={0}
              zoomFrom={1.03}
              zoomTo={1}
              panX={-3}
              panY={4}
            />
          </div>

          <div
            style={{
              borderRadius: 24,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(8, 10, 18, 0.72)",
              padding: 14,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            {commandOrder.map((command, index) => (
              <CommandChip
                key={command}
                label={command}
                active={index === commandIndex}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <Pill text="EDITOR COMMAND BUS" dark />
          <Headline
            text="One reducer path for buttons today and AI actions next."
            dark
          />
          <p
            style={{
              margin: 0,
              color: dsTheme.mutedDark,
              fontSize: 28,
              lineHeight: 1.3,
              fontWeight: 600,
            }}
          >
            Controls dispatch typed commands, update state instantly, then sync
            via debounced PATCH. Manual Save creates explicit timeline versions.
          </p>

          <div
            style={{
              marginTop: 8,
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <StatusRow label="Timeline status" value={timelineStatus} />
            <StatusRow
              label="Active command"
              value={commandOrder[commandIndex] ?? "addClip"}
            />
            <StatusRow
              label="Save transport"
              value="PATCH /api/timelines/:id"
            />
            <StatusRow
              label="Version checkpoint"
              value="POST /api/timelines/:id/versions"
            />
          </div>
        </div>
      </div>
    </SceneShell>
  );
};

const VersioningScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const revealProgress = clamp01(frame / Math.max(1, durationInFrames - 1));
  const revealCount = Math.max(
    1,
    Math.floor(revealProgress * (versionCards.length + 1)),
  );

  const conflictPulse = spring({
    frame: Math.max(0, frame - Math.floor(fps * 0.5)),
    fps,
    config: {
      damping: 16,
      stiffness: 140,
      mass: 0.8,
    },
  });

  return (
    <SceneShell variant="editor" durationInFrames={durationInFrames}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 30,
          height: "100%",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Pill text="TIMELINE VERSIONING" dark />
          <Headline
            text="Reload restores exact state from latest committed version."
            dark
          />
          <p
            style={{
              margin: 0,
              color: dsTheme.mutedDark,
              fontSize: 29,
              lineHeight: 1.32,
              fontWeight: 600,
            }}
          >
            Every save carries baseVersion for optimistic locking. If a client
            is stale, API returns BAD_REQUEST and the editor surfaces conflict
            state.
          </p>

          <div
            style={{
              marginTop: 8,
              borderRadius: 22,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <StatusRow label="Conflict contract" value="400 BAD_REQUEST" />
            <StatusRow label="Privacy behavior" value="404 for non-members" />
            <StatusRow
              label="Time unit"
              value="Milliseconds in timeline data"
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {versionCards.map((card, index) => {
            const shown = index < revealCount;
            const offsetY = shown ? 0 : 24;
            const opacity = shown ? 1 : 0;
            return (
              <VersionCard
                key={card.version}
                version={card.version}
                source={card.source}
                copy={card.copy}
                opacity={opacity}
                offsetY={offsetY}
              />
            );
          })}

          <div
            style={{
              marginTop: 8,
              borderRadius: 18,
              border: "1px solid rgba(245,141,57,0.34)",
              background: "rgba(245,141,57,0.14)",
              padding: "12px 14px",
              color: "rgba(255,238,222,0.95)",
              fontWeight: 600,
              fontSize: 20,
              transform: `scale(${1 + conflictPulse * 0.025})`,
            }}
          >
            Stale baseVersion to conflict state to refresh and continue safely.
          </div>
        </div>
      </div>
    </SceneShell>
  );
};

const OutroScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  return (
    <SceneShell variant="landing" durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            maxWidth: 1260,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            textAlign: "center",
          }}
        >
          <Pill text="DOUJIN STUDIO" />
          <Headline text="Upload once. Edit by command. Keep every version." />
          <p
            style={{
              margin: 0,
              fontSize: 30,
              lineHeight: 1.3,
              fontWeight: 600,
              color: dsTheme.mutedLight,
              maxWidth: 980,
            }}
          >
            Storage, timeline persistence, and command dispatch now connect into
            one production-ready editing loop.
          </p>

          <div
            style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
              width: "100%",
            }}
          >
            <MiniMetric text="Direct R2 Upload" />
            <MiniMetric text="Secure Range Streaming" />
            <MiniMetric text="Versioned Timelines" />
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

const FeatureCard: React.FC<{
  title: string;
  body: string;
  delay: number;
}> = ({ title, body, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, delay);

  return (
    <div
      style={{
        borderRadius: 18,
        border: `1px solid ${dsTheme.borderLight}`,
        background: "rgba(255,255,255,0.72)",
        padding: "12px 14px",
        boxShadow: "0 14px 34px rgba(11, 12, 18, 0.1)",
        opacity: enter,
        transform: `translate3d(0, ${interpolate(enter, [0, 1], [12, 0])}px, 0)`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 12,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: dsTheme.mutedLight,
          fontWeight: 700,
        }}
      >
        {title}
      </p>
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 18,
          lineHeight: 1.3,
          color: dsTheme.textLight,
          fontWeight: 600,
        }}
      >
        {body}
      </p>
    </div>
  );
};

const FlowStep: React.FC<{
  label: string;
  detail: string;
  state: "pending" | "active" | "done";
}> = ({ label, detail, state }) => {
  const isDone = state === "done";
  const isActive = state === "active";

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${
          isActive
            ? "rgba(245,141,57,0.45)"
            : isDone
              ? "rgba(216,221,90,0.38)"
              : "rgba(31,26,21,0.12)"
        }`,
        background: isActive
          ? "rgba(245,141,57,0.16)"
          : isDone
            ? "rgba(216,221,90,0.14)"
            : "rgba(255,255,255,0.55)",
        padding: "10px 12px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontWeight: 700,
          color: dsTheme.textLight,
          fontSize: 17,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          color: dsTheme.mutedLight,
          fontSize: 15,
          lineHeight: 1.25,
        }}
      >
        {detail}
      </p>
    </div>
  );
};

const EndpointCard: React.FC<{
  title: string;
  body: string;
  active: boolean;
}> = ({ title, body, active }) => {
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${active ? "rgba(245,141,57,0.45)" : "rgba(31,26,21,0.12)"}`,
        background: active
          ? "rgba(255,255,255,0.84)"
          : "rgba(255,255,255,0.58)",
        padding: "11px 12px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontWeight: 700,
          fontSize: 16,
          color: dsTheme.textLight,
        }}
      >
        {title}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 14,
          lineHeight: 1.3,
          color: dsTheme.mutedLight,
        }}
      >
        {body}
      </p>
    </div>
  );
};

const CommandChip: React.FC<{ label: string; active: boolean }> = ({
  label,
  active,
}) => {
  return (
    <div
      style={{
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: active
          ? "linear-gradient(135deg, rgba(245,141,57,0.85), rgba(216,221,90,0.82))"
          : "rgba(255,255,255,0.06)",
        color: active ? "#1d180f" : "rgba(246,242,238,0.82)",
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: "0.02em",
        padding: "8px 12px",
      }}
    >
      {label}
    </div>
  );
};

const StatusRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span
        style={{
          color: "rgba(246,242,238,0.62)",
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: "rgba(246,242,238,0.92)",
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </div>
  );
};

const VersionCard: React.FC<{
  version: string;
  source: string;
  copy: string;
  opacity: number;
  offsetY: number;
}> = ({ version, source, copy, opacity, offsetY }) => {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        padding: "14px 16px",
        opacity,
        transform: `translate3d(0, ${offsetY}px, 0)`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 13,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "rgba(246,242,238,0.56)",
        }}
      >
        {version} · {source}
      </p>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 20,
          lineHeight: 1.3,
          color: "rgba(246,242,238,0.92)",
          fontWeight: 600,
        }}
      >
        {copy}
      </p>
    </div>
  );
};

const MiniMetric: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${dsTheme.borderLight}`,
        background: "rgba(255,255,255,0.66)",
        padding: "12px 14px",
        fontSize: 19,
        color: dsTheme.textLight,
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  );
};

const InlineNotice: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${dsTheme.borderLight}`,
        background: "rgba(255,255,255,0.66)",
        padding: "10px 12px",
        color: dsTheme.mutedLight,
        fontSize: 16,
        lineHeight: 1.35,
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  );
};

const Pill: React.FC<{ text: string; dark?: boolean }> = ({
  text,
  dark = false,
}) => {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        border: dark
          ? "1px solid rgba(255,255,255,0.14)"
          : `1px solid ${dsTheme.borderLight}`,
        background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.74)",
        color: dark ? "rgba(246,242,238,0.75)" : dsTheme.mutedLight,
        padding: "7px 14px",
        fontSize: 13,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        fontWeight: 700,
        width: "fit-content",
      }}
    >
      {text}
    </div>
  );
};

const Headline: React.FC<{ text: string; dark?: boolean }> = ({
  text,
  dark = false,
}) => {
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: displayFont.fontFamily,
        color: dark ? dsTheme.textDark : dsTheme.textLight,
        fontSize: 74,
        lineHeight: 1.06,
        letterSpacing: "-0.02em",
        maxWidth: 960,
      }}
    >
      {text}
    </h1>
  );
};

const StudioLightSweep: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(progress, [0, 1], [-720, 2120]);

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: 0.16,
        mixBlendMode: "screen",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -120,
          left: x,
          width: 520,
          height: 1360,
          transform: "rotate(15deg)",
          background:
            "linear-gradient(120deg, rgba(255,255,255,0), rgba(255,255,255,0.62), rgba(255,255,255,0))",
          filter: "blur(10px)",
        }}
      />
    </AbsoluteFill>
  );
};

const CutFlash: React.FC<{ atFrame: number }> = ({ atFrame }) => {
  const frame = useCurrentFrame();
  const distance = Math.abs(frame - atFrame);

  const opacity = interpolate(distance, [0, 3, 10], [0.22, 0.1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.02), rgba(0,0,0,0.1))",
      }}
    />
  );
};
