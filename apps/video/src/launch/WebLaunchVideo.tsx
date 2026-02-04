import React, { useMemo } from "react";
import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
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

export const WebLaunchVideo: React.FC<WebLaunchVideoProps> = ({
  voiceoverSrc,
}) => {
  const { fps, durationInFrames: totalFrames } = useVideoConfig();

  const scenes = useMemo(
    () => [
      { id: "intro", seconds: 4 },
      { id: "landing", seconds: 8 },
      { id: "editor", seconds: 9 },
      { id: "features", seconds: 7 },
      { id: "outro", seconds: 2 },
    ],
    [],
  );

  const starts = useMemo(() => {
    const baseDurations = scenes.map((s) =>
      Math.max(1, Math.round(s.seconds * fps)),
    );
    const baseTotal = baseDurations.reduce((sum, d) => sum + d, 0);
    const scale = totalFrames / baseTotal;

    let acc = 0;
    return scenes.map((s, i) => {
      const start = acc;
      const isLast = i === scenes.length - 1;
      const remainingScenes = scenes.length - i - 1;
      const remainingBudget = Math.max(0, totalFrames - acc);

      const raw = Math.max(1, Math.round(baseDurations[i] * scale));
      const maxThis = Math.max(1, remainingBudget - remainingScenes);
      const durationInFrames = isLast
        ? Math.max(1, remainingBudget)
        : Math.min(raw, maxThis);

      acc += durationInFrames;
      return { ...s, start, durationInFrames };
    });
  }, [fps, scenes, totalFrames]);

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont.fontFamily }}>
      <Audio src={voiceoverSrc} />
      <Sequence
        from={starts[0].start}
        durationInFrames={starts[0].durationInFrames}
      >
        <IntroScene durationInFrames={starts[0].durationInFrames} />
      </Sequence>
      <CutFlash atFrame={starts[1].start} />
      <Sequence
        from={starts[1].start}
        durationInFrames={starts[1].durationInFrames}
      >
        <LandingScene durationInFrames={starts[1].durationInFrames} />
      </Sequence>
      <CutFlash atFrame={starts[2].start} />
      <Sequence
        from={starts[2].start}
        durationInFrames={starts[2].durationInFrames}
      >
        <EditorScene durationInFrames={starts[2].durationInFrames} />
      </Sequence>
      <CutFlash atFrame={starts[3].start} />
      <Sequence
        from={starts[3].start}
        durationInFrames={starts[3].durationInFrames}
      >
        <FeaturesScene durationInFrames={starts[3].durationInFrames} />
      </Sequence>
      <CutFlash atFrame={starts[4].start} />
      <Sequence
        from={starts[4].start}
        durationInFrames={starts[4].durationInFrames}
      >
        <OutroScene durationInFrames={starts[4].durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

const springIn = (p: {
  frame: number;
  fps: number;
  delay?: number;
  config?: Parameters<typeof spring>[0]["config"];
}) => {
  const { frame, fps, delay = 0, config } = p;
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {
      damping: 200,
      mass: 0.9,
      stiffness: 180,
      ...config,
    },
  });
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const SceneShell: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = springIn({
    frame,
    fps,
    config: { damping: 210, stiffness: 190 },
  });
  const opacity = enter;

  const y = (1 - enter) * 18;

  return (
    <AbsoluteFill style={{ opacity, transform: `translate3d(0, ${y}px, 0)` }}>
      <AbsoluteFill>
        {children}
        <StudioLightSweep />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity: interpolate(
            frame,
            [durationInFrames - 12, durationInFrames],
            [0, 1],
            {
              extrapolateLeft: "clamp",
            },
          ),
          background:
            "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.12))",
        }}
      />
    </AbsoluteFill>
  );
};

const IntroScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = springIn({ frame, fps, config: { damping: 190, stiffness: 200 } });
  const pop = 0.98 + 0.02 * t;

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <Backdrop variant="landing" />
      <AbsoluteFill
        style={{
          padding: 96,
          justifyContent: "center",
          transform: `scale(${pop})`,
        }}
      >
        <div
          style={{
            maxWidth: 980,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <Pill text="LAUNCH VIDEO + 1 CUTDOWN" />
          <WordRevealHeadline
            text="Doujin Studio makes brand-ready launch videos feel cinematic."
            fontSize={78}
          />
          <p
            style={{
              margin: 0,
              fontSize: 32,
              lineHeight: 1.3,
              color: "rgba(31, 26, 21, 0.78)",
              maxWidth: 860,
              fontWeight: 600,
            }}
          >
            Brand-ready launch videos feel cinematic, without the production
            slog.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
            <Tag text="Drop a URL" />
            <Tag text="Generate a storyboard" />
            <Tag text="Render social cutdowns" />
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

const LandingScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn({
    frame,
    fps,
    config: { damping: 210, stiffness: 190 },
  });

  const titleOpacity = springIn({
    frame,
    fps,
    delay: 6,
    config: { damping: 220 },
  });

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <Backdrop variant="landing" />
      <AbsoluteFill style={{ padding: 72 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div style={{ maxWidth: 780 }}>
            <h2
              style={{
                margin: 0,
                fontFamily: displayFont.fontFamily,
                fontSize: 56,
                lineHeight: 1.05,
                color: dsTheme.textLight,
                opacity: titleOpacity,
              }}
            >
              From brief to edit plan.
            </h2>
            <p
              style={{
                margin: "14px 0 0",
                fontSize: 24,
                lineHeight: 1.35,
                color: dsTheme.mutedLight,
                fontWeight: 600,
                opacity: titleOpacity,
              }}
            >
              Extract brand cues, draft a storyboard, and prep the cut list in
              minutes.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              opacity: titleOpacity,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: dsTheme.accentWarm,
                boxShadow: "0 10px 26px rgba(245, 141, 57, 0.35)",
              }}
            />
            <span
              style={{
                fontSize: 14,
                letterSpacing: 4,
                fontWeight: 700,
                color: dsTheme.mutedLight,
              }}
            >
              LIVE PREVIEW
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: 34,
            borderRadius: 40,
            border: `1px solid ${dsTheme.borderLight}`,
            background: "rgba(255,255,255,0.55)",
            padding: 18,
            boxShadow: "0 18px 60px rgba(11, 12, 18, 0.12)",
            transform: `translate3d(0, ${18 * (1 - enter)}px, 0)`,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 22,
              top: 22,
              width: 420,
              zIndex: 10,
            }}
          >
            <ComposeBriefCard />
          </div>
          <div
            style={{
              borderRadius: 30,
              overflow: "hidden",
              background: dsTheme.bgDark,
            }}
          >
            <div style={{ width: "100%", aspectRatio: "16 / 9" }}>
              <BrowserFrame
                assetPath="assets/web-landing.png"
                cornerRadius={30}
                cropTop={0}
                zoomFrom={1.05}
                zoomTo={1.0}
                panY={-18}
              />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

const EditorScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn({
    frame,
    fps,
    config: { damping: 210, stiffness: 190 },
  });
  const glow = interpolate(frame, [0, 40], [0.0, 1.0], {
    extrapolateRight: "clamp",
  });

  const progress = clamp01(
    interpolate(frame, [0, durationInFrames - 18], [0, 1], {
      extrapolateRight: "clamp",
    }),
  );
  const atTen = Math.round((durationInFrames - 18) * 0.1);

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <Backdrop variant="editor" />
      <AbsoluteFill style={{ padding: 72 }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 40 }}
        >
          <div style={{ maxWidth: 720 }}>
            <Pill text="EDITING WORKSPACE" dark />
            <h2
              style={{
                margin: "18px 0 0",
                fontFamily: displayFont.fontFamily,
                fontSize: 60,
                lineHeight: 1.05,
                color: dsTheme.textDark,
              }}
            >
              Timeline, scenes, and a live player.
            </h2>
            <p
              style={{
                margin: "16px 0 0",
                fontSize: 24,
                lineHeight: 1.4,
                color: dsTheme.mutedDark,
                fontWeight: 600,
              }}
            >
              Iterate scene-by-scene, keep brand styling consistent, and render
              when it feels right.
            </p>
          </div>

          <div
            style={{
              width: 420,
              flexShrink: 0,
              borderRadius: 28,
              border: `1px solid ${dsTheme.borderDark}`,
              background: "rgba(0,0,0,0.22)",
              padding: 18,
              boxShadow: "0 30px 90px rgba(11, 12, 18, 0.24)",
              transform: `translate3d(0, ${14 * (1 - enter)}px, 0)`,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: dsTheme.accent,
                }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  letterSpacing: 3,
                  fontWeight: 800,
                  color: dsTheme.mutedDark,
                }}
              >
                WHAT YOU GET
              </p>
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <ChecklistRow text="Hero launch video" />
              <ChecklistRow text="One social cutdown" />
              <ChecklistRow text="Scene-level controls" />
              <ChecklistRow text="Render progress + download" />
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 34,
            borderRadius: 40,
            border: `1px solid ${dsTheme.borderDark}`,
            background: dsTheme.glassDark,
            padding: 18,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 40px 100px rgba(0,0,0,0.35)`,
            position: "relative",
          }}
        >
          <ProgressPill progress={progress} />
          <div
            style={{
              borderRadius: 30,
              overflow: "hidden",
              boxShadow: `0 0 50px rgba(216, 221, 90, ${0.18 * glow})`,
              position: "relative",
            }}
          >
            <ExtractionBurst localFrame={frame - atTen} />
            <EditorCallouts delay={18} />
            <div style={{ width: "100%", aspectRatio: "16 / 9" }}>
              <BrowserFrame
                assetPath="assets/web-editor.png"
                cornerRadius={30}
                cropTop={90}
                cropLeft={0}
                zoomFrom={1.07}
                zoomTo={1.0}
                panX={-22}
                panY={-10}
              />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

const FeaturesScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = springIn({
    frame,
    fps,
    config: { damping: 210, stiffness: 190 },
  });

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <Backdrop variant="landing" />
      <AbsoluteFill style={{ padding: 84 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ maxWidth: 900 }}>
            <Pill text="WORKFLOW" />
            <h2
              style={{
                margin: "18px 0 0",
                fontFamily: displayFont.fontFamily,
                fontSize: 62,
                lineHeight: 1.05,
                color: dsTheme.textLight,
              }}
            >
              Make launch content feel intentional.
            </h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: dsTheme.mutedLight,
              }}
            >
              30 seconds.
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 18,
                fontWeight: 700,
                color: dsTheme.mutedLight,
              }}
            >
              Multiple formats.
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: 44,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 22,
          }}
        >
          <FeatureCard
            index={0}
            title="Brief"
            body="URL + mood + CTA. That's enough to start."
            tone="warm"
          />
          <FeatureCard
            index={1}
            title="Storyboard"
            body="Scenes, pacing, and on-screen text in one pass."
            tone="accent"
          />
          <FeatureCard
            index={2}
            title="Render"
            body="Export a hero cut and a social cutdown."
            tone="dark"
          />
        </div>

        <div
          style={{
            marginTop: 28,
            transform: `translate3d(0, ${(1 - enter) * 10}px, 0)`,
            opacity: enter,
          }}
        >
          <MultiFormatFanOut />
        </div>

        <div
          style={{ marginTop: 26, display: "flex", justifyContent: "center" }}
        >
          <div
            style={{
              borderRadius: 999,
              padding: "14px 22px",
              background: dsTheme.accent,
              color: "#1a1a14",
              fontWeight: 900,
              letterSpacing: 0.8,
              boxShadow: "0 12px 30px rgba(216, 221, 90, 0.35)",
              fontSize: 18,
            }}
          >
            Start a project
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

const OutroScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn({
    frame,
    fps,
    config: { damping: 190, stiffness: 200 },
  });
  const shine = interpolate(frame, [0, durationInFrames], [0, 1]);

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <Backdrop variant="editor" />
      <AbsoluteFill
        style={{
          padding: 96,
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 1000 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: displayFont.fontFamily,
              fontSize: 78,
              lineHeight: 1.02,
              color: dsTheme.textDark,
              transform: `translate3d(0, ${16 * (1 - enter)}px, 0)`,
            }}
          >
            Ship the launch.
          </h2>
          <p
            style={{
              margin: "18px 0 0",
              fontSize: 26,
              lineHeight: 1.35,
              color: dsTheme.mutedDark,
              fontWeight: 650,
            }}
          >
            Turn a link into a cinematic edit plan — and export the social kit.
          </p>
          <div
            style={{ marginTop: 34, display: "flex", justifyContent: "center" }}
          >
            <div
              style={{
                borderRadius: 999,
                padding: "16px 26px",
                background: dsTheme.accent,
                color: "#1a1a14",
                fontWeight: 900,
                fontSize: 20,
                boxShadow: "0 16px 42px rgba(216, 221, 90, 0.35)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: -80,
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)",
                  transform: `translate3d(${(shine * 900 - 450).toFixed(2)}px, 0, 0) rotate(15deg)`,
                  opacity: 0.35,
                }}
              />
              <span style={{ position: "relative" }}>Doujin Studio</span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

const Pill: React.FC<{ text: string; dark?: boolean }> = ({ text, dark }) => {
  return (
    <div
      style={{
        width: "fit-content",
        padding: "10px 16px",
        borderRadius: 999,
        border: `1px solid ${dark ? dsTheme.borderDark : dsTheme.borderLight}`,
        background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.72)",
        color: dark ? dsTheme.mutedDark : dsTheme.mutedLight,
        fontWeight: 900,
        fontSize: 13,
        letterSpacing: 4.2,
      }}
    >
      {text}
    </div>
  );
};

const Tag: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div
      style={{
        borderRadius: 999,
        padding: "10px 14px",
        background: "rgba(255,255,255,0.7)",
        border: `1px solid ${dsTheme.borderLight}`,
        color: dsTheme.textLight,
        fontSize: 16,
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  );
};

const ChecklistRow: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 6,
          background: "rgba(216, 221, 90, 0.18)",
          border: `1px solid rgba(216, 221, 90, 0.4)`,
          boxShadow: "0 0 20px rgba(216, 221, 90, 0.22)",
        }}
      />
      <p
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 650,
          color: dsTheme.textDark,
        }}
      >
        {text}
      </p>
    </div>
  );
};

const FeatureCard: React.FC<{
  index: number;
  title: string;
  body: string;
  tone: "warm" | "accent" | "dark";
}> = ({ index, title, body, tone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = index * 10;
  const t = springIn({
    frame,
    fps,
    delay,
    config: { damping: 190, stiffness: 195 },
  });

  const y = (1 - t) * 18;
  const opacity = t;

  const floatY = Math.sin((frame + index * 18) / 28) * 4;
  const floatScale = 1 + Math.sin((frame + index * 22) / 42) * 0.004;

  const border = tone === "dark" ? dsTheme.borderLight : dsTheme.borderLight;
  const bg =
    tone === "warm"
      ? "linear-gradient(135deg, rgba(255,217,176,0.85), rgba(255,179,125,0.75))"
      : tone === "accent"
        ? "linear-gradient(135deg, rgba(230,242,213,0.9), rgba(199,227,168,0.82))"
        : "linear-gradient(135deg, rgba(16,21,31,0.92), rgba(29,42,58,0.88))";
  const textColor =
    tone === "dark" ? "rgba(255,255,255,0.94)" : dsTheme.textLight;
  const bodyColor =
    tone === "dark" ? "rgba(255,255,255,0.72)" : dsTheme.mutedLight;

  return (
    <div
      style={{
        borderRadius: 32,
        border: `1px solid ${border}`,
        backgroundImage: bg,
        padding: 26,
        boxShadow: "0 18px 60px rgba(11, 12, 18, 0.12)",
        transform: `translate3d(0, ${(y + floatY).toFixed(2)}px, 0) scale(${floatScale.toFixed(4)})`,
        opacity,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -120,
          background:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35), transparent 45%)",
          opacity: tone === "dark" ? 0.18 : 0.32,
          transform: "rotate(8deg)",
        }}
      />
      <div style={{ position: "relative" }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: 4,
            color:
              tone === "dark" ? "rgba(255,255,255,0.65)" : dsTheme.mutedLight,
          }}
        >
          {index + 1 < 10 ? `0${index + 1}` : String(index + 1)}
        </p>
        <h3
          style={{
            margin: "12px 0 0",
            fontSize: 34,
            lineHeight: 1.1,
            fontWeight: 900,
            color: textColor,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 20,
            lineHeight: 1.35,
            color: bodyColor,
            fontWeight: 650,
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
};

const StudioLightSweep: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const sweep = (Math.sin(t / 1.6) * 0.5 + 0.5) * 1;
  const x = (sweep * (width + 900) - 450).toFixed(2);
  const y = (Math.cos(t / 2.2) * 60).toFixed(2);

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "soft-light",
        opacity: 0.55,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -300,
          background:
            "linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.14) 48%, rgba(245,141,57,0.08) 56%, rgba(255,255,255,0) 68%)",
          transform: `translate3d(${x}px, ${y}px, 0) rotate(10deg)`,
          filter: "blur(1px)",
        }}
      />
    </AbsoluteFill>
  );
};

const WordRevealHeadline: React.FC<{ text: string; fontSize: number }> = ({
  text,
  fontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <h1
      style={{
        fontFamily: displayFont.fontFamily,
        fontSize,
        lineHeight: 1.04,
        letterSpacing: -0.8,
        color: dsTheme.textLight,
        margin: 0,
        maxWidth: 1040,
      }}
    >
      {words.map((w, i) => {
        const delay = 6 + i * 3;
        const t = springIn({ frame, fps, delay, config: { damping: 220 } });
        const opacity = t;
        const blur = (1 - t) * 14;
        const y = (1 - t) * 18;
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: "inline-block",
              marginRight: 10,
              opacity,
              transform: `translate3d(0, ${y.toFixed(2)}px, 0)`,
              filter: `blur(${blur.toFixed(2)}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </h1>
  );
};

const ComposeBriefCard: React.FC = () => {
  return (
    <div
      style={{
        borderRadius: 26,
        border: "1px solid rgba(31, 26, 21, 0.14)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.44))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 18px 60px rgba(11, 12, 18, 0.14)",
        padding: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              letterSpacing: 3.6,
              fontWeight: 900,
              color: "rgba(31, 26, 21, 0.58)",
            }}
          >
            COMPOSE YOUR BRIEF
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 18,
              fontWeight: 800,
              color: dsTheme.textLight,
            }}
          >
            Drop a link. We\'ll match the brand.
          </p>
        </div>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: dsTheme.accentWarm,
            boxShadow: "0 10px 26px rgba(245, 141, 57, 0.35)",
            marginTop: 2,
          }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <TypeUrlInput url="https://withlillian.com/" />
      </div>
    </div>
  );
};

const TypeUrlInput: React.FC<{ url: string }> = ({ url }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const typeT = springIn({
    frame,
    fps,
    delay: 20,
    config: { damping: 220, stiffness: 210 },
  });
  const typedCount = Math.max(
    0,
    Math.min(url.length, Math.round(typeT * url.length)),
  );
  const typed = url.slice(0, typedCount);
  const typingDone = typedCount >= url.length;

  const loadingT = springIn({
    frame,
    fps,
    delay: 20 + 24,
    config: { damping: 200, stiffness: 180 },
  });

  const blink = frame % 18 < 9;
  const pulse = typingDone ? 0.5 + 0.5 * Math.sin((frame / fps) * 5.2) : 0;
  const glow = typingDone ? 0.18 + 0.22 * pulse * loadingT : 0.08;

  return (
    <div
      style={{
        borderRadius: 18,
        border: `1px solid rgba(31, 26, 21, ${0.14 + glow})`,
        background: "rgba(255,255,255,0.72)",
        padding: "12px 14px",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.32) inset, 0 14px 40px rgba(245, 141, 57, ${0.12 * glow})`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -120,
          background:
            "radial-gradient(circle at 22% 40%, rgba(245,141,57,0.18), transparent 55%), radial-gradient(circle at 75% 20%, rgba(216,221,90,0.16), transparent 55%)",
          opacity: 0.55,
          filter: "blur(10px)",
          transform: `translate3d(${(pulse * 6).toFixed(2)}px, ${(pulse * -4).toFixed(2)}px, 0)`,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          position: "relative",
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 4,
            background: "rgba(31, 26, 21, 0.12)",
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 750,
            color: "rgba(31, 26, 21, 0.84)",
            fontFamily: bodyFont.fontFamily,
            letterSpacing: -0.2,
          }}
        >
          {typed}
          <span
            style={{ opacity: blink && !typingDone ? 1 : typingDone ? 0 : 0 }}
          >
            |
          </span>
        </p>
        {typingDone ? (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: dsTheme.accentWarm,
                opacity: 0.5 + 0.5 * pulse,
              }}
            />
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 2.8,
                color: "rgba(31, 26, 21, 0.55)",
              }}
            >
              LOADING
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const ProgressPill: React.FC<{ progress: number }> = ({ progress }) => {
  const pct = Math.round(progress * 100);
  return (
    <div
      style={{
        position: "absolute",
        right: 22,
        top: 22,
        zIndex: 10,
        borderRadius: 999,
        border: `1px solid rgba(255,255,255,0.12)`,
        background: "rgba(0,0,0,0.32)",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          width: 150,
          height: 10,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(progress * 100).toFixed(2)}%`,
            background:
              "linear-gradient(90deg, rgba(216,221,90,0.72), rgba(245,141,57,0.75))",
            boxShadow: "0 10px 30px rgba(216, 221, 90, 0.18)",
          }}
        />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: 2.6,
          color: "rgba(246, 242, 238, 0.62)",
          width: 56,
          textAlign: "right",
        }}
      >
        {pct}%
      </p>
    </div>
  );
};

const ExtractionBurst: React.FC<{ localFrame: number }> = ({ localFrame }) => {
  const { fps } = useVideoConfig();
  if (localFrame < 0) return null;
  const t = springIn({
    frame: localFrame,
    fps,
    config: { damping: 160, stiffness: 220, mass: 0.8 },
  });
  const fade = clamp01(
    interpolate(localFrame, [0, Math.round(1.1 * fps)], [1, 0], {
      extrapolateRight: "clamp",
    }),
  );

  const particles = new Array(14).fill(0).map((_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const r = 60 + 260 * t;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.7;
    const s = 4 + (1 - t) * 3;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: "50%",
          top: "52%",
          width: s,
          height: s,
          borderRadius: 999,
          transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
          background:
            i % 3 === 0 ? "rgba(245,141,57,0.95)" : "rgba(216,221,90,0.95)",
          opacity: 0.7 * fade,
          filter: "blur(0.3px)",
        }}
      />
    );
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 5 }}>
      <div
        style={{
          position: "absolute",
          inset: -200,
          background:
            "radial-gradient(600px 420px at 50% 52%, rgba(216,221,90,0.42), transparent 60%), radial-gradient(520px 380px at 50% 52%, rgba(245,141,57,0.22), transparent 60%)",
          opacity: 0.7 * fade,
          transform: `scale(${(0.92 + 0.22 * t).toFixed(4)})`,
          filter: "blur(10px)",
          mixBlendMode: "screen",
        }}
      />
      {particles}
    </AbsoluteFill>
  );
};

const EditorCallouts: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = springIn({
    frame,
    fps,
    delay,
    config: { damping: 220, stiffness: 200 },
  });
  const opacity = t;

  // Coordinates are expressed in a 1000x562 (16:9) viewBox.
  const from = { x: 245, y: 120 };
  const to = { x: 520, y: 178 };

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 6, opacity }}>
      <div
        style={{
          position: "absolute",
          left: 22,
          top: 22,
          padding: "12px 14px",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.26)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 22px 70px rgba(0,0,0,0.35)",
          transform: `translate3d(0, ${((1 - t) * 10).toFixed(2)}px, 0)`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 3.2,
            color: "rgba(246,242,238,0.62)",
          }}
        >
          EXTRACT BRAND CUES
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 16,
            fontWeight: 800,
            color: "rgba(246,242,238,0.92)",
            maxWidth: 240,
            lineHeight: 1.25,
          }}
        >
          Colors, type, and voice pulled straight from the URL.
        </p>
      </div>

      <svg
        viewBox="0 0 1000 562"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
      >
        <LeaderLinePath from={from} to={to} progress={t} />
      </svg>

      <div
        style={{
          position: "absolute",
          left: `${(to.x / 1000) * 100}%`,
          top: `${(to.y / 562) * 100}%`,
          width: 120,
          height: 120,
          transform: "translate3d(-50%, -50%, 0)",
          borderRadius: 999,
          background:
            "radial-gradient(circle, rgba(216,221,90,0.26), transparent 62%)",
          filter: "blur(2px)",
          opacity: 0.8,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};

const LeaderLinePath: React.FC<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  progress: number;
}> = ({ from, to, progress }) => {
  const midX = (from.x + to.x) / 2;
  const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  const dash = 900;
  const offset = ((1 - progress) * dash).toFixed(2);

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="rgba(216,221,90,0.62)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={offset}
      />
      <circle cx={to.x} cy={to.y} r={4} fill="rgba(216,221,90,0.95)" />
    </g>
  );
};

const MultiFormatFanOut: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const baseDelay = 20;
  const tA = springIn({
    frame,
    fps,
    delay: baseDelay + 0,
    config: { damping: 200, stiffness: 190 },
  });
  const tB = springIn({
    frame,
    fps,
    delay: baseDelay + 6,
    config: { damping: 200, stiffness: 190 },
  });
  const tC = springIn({
    frame,
    fps,
    delay: baseDelay + 12,
    config: { damping: 200, stiffness: 190 },
  });

  const cardShadow = "0 26px 70px rgba(11, 12, 18, 0.18)";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 980, position: "relative", height: 320 }}>
        <FormatCard
          label="9:16"
          t={tA}
          style={{
            width: 220,
            height: 320,
            left: 220,
            top: 0,
            transform: `translate3d(${(-120 * (1 - tA)).toFixed(2)}px, ${(16 * (1 - tA)).toFixed(2)}px, 0) rotate(${(-10 * (1 - tA)).toFixed(2)}deg)`,
            boxShadow: cardShadow,
            zIndex: 1,
          }}
          inner={
            <div style={{ width: "100%", height: "100%" }}>
              <BrowserFrame
                assetPath="assets/web-landing-scroll.png"
                cornerRadius={22}
                cropTop={40}
                zoomFrom={1.05}
                zoomTo={1.0}
                panY={-10}
              />
            </div>
          }
        />

        <FormatCard
          label="1:1"
          t={tB}
          style={{
            width: 300,
            height: 300,
            left: 350,
            top: 10,
            transform: `translate3d(${(0).toFixed(2)}px, ${(-26 * (1 - tB)).toFixed(2)}px, 0) rotate(${(7 * (1 - tB)).toFixed(2)}deg)`,
            boxShadow: cardShadow,
            zIndex: 2,
          }}
          inner={
            <div style={{ width: "100%", height: "100%" }}>
              <BrowserFrame
                assetPath="assets/web-landing.png"
                cornerRadius={22}
                cropTop={0}
                zoomFrom={1.03}
                zoomTo={1.0}
              />
            </div>
          }
        />

        <FormatCard
          label="16:9"
          t={tC}
          style={{
            width: 520,
            height: 292,
            left: 390,
            top: 14,
            transform: `translate3d(${(160 * (1 - tC)).toFixed(2)}px, ${(18 * (1 - tC)).toFixed(2)}px, 0) rotate(${(0).toFixed(2)}deg)`,
            boxShadow: "0 30px 90px rgba(11, 12, 18, 0.22)",
            zIndex: 3,
          }}
          inner={
            <div style={{ width: "100%", height: "100%" }}>
              <BrowserFrame
                assetPath="assets/web-editor.png"
                cornerRadius={22}
                cropTop={90}
                zoomFrom={1.05}
                zoomTo={1.0}
                panX={-18}
                panY={-8}
              />
            </div>
          }
        />
      </div>
    </div>
  );
};

const FormatCard: React.FC<{
  label: string;
  t: number;
  style: React.CSSProperties;
  inner: React.ReactNode;
}> = ({ label, t, style, inner }) => {
  return (
    <div
      style={{
        position: "absolute",
        borderRadius: 26,
        border: `1px solid rgba(25, 27, 36, 0.14)`,
        background: "rgba(255,255,255,0.55)",
        padding: 10,
        opacity: t,
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: 12, top: 12, zIndex: 5 }}>
        <div
          style={{
            borderRadius: 999,
            padding: "8px 10px",
            background: "rgba(0,0,0,0.28)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            color: "rgba(246,242,238,0.78)",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 2.8,
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {inner}
      </div>
    </div>
  );
};

const CutFlash: React.FC<{ atFrame: number }> = ({ atFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = atFrame;
  const local = frame - start;
  const dur = Math.round(0.42 * fps);
  if (local < 0 || local > dur) return null;

  const opacity = interpolate(
    local,
    [0, Math.round(dur / 2), dur],
    [0, 0.55, 0],
    {
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill
      style={{
        opacity,
        background:
          "radial-gradient(900px 600px at 30% 40%, rgba(216, 221, 90, 0.7), transparent 60%), radial-gradient(900px 600px at 70% 45%, rgba(245, 141, 57, 0.65), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.15), rgba(255,255,255,0))",
        filter: "blur(6px)",
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
};
