import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { dsTheme } from "../theme";

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const Backdrop: React.FC<{
  variant: "landing" | "editor";
}> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = frame / fps;
  const driftX = Math.sin(t / 2.4) * 22;
  const driftY = Math.cos(t / 2.9) * 18;
  const driftX2 = Math.cos(t / 3.1) * 26;
  const driftY2 = Math.sin(t / 2.2) * 20;

  const vignette = useMemo(() => {
    const isEditor = variant === "editor";
    const base = isEditor
      ? `linear-gradient(180deg, rgba(10, 11, 16, 0.88), rgba(10, 11, 16, 0.94)), ${dsTheme.bgDark}`
      : `linear-gradient(135deg, ${dsTheme.bgLight}, ${dsTheme.bgLight2})`;

    const a = isEditor
      ? "radial-gradient(1200px 800px at 20% 10%, rgba(75, 190, 160, 0.18), transparent 55%)"
      : "radial-gradient(1200px 800px at 15% 10%, rgba(255, 255, 255, 0.65), transparent 55%)";
    const b = isEditor
      ? "radial-gradient(1200px 800px at 85% 20%, rgba(230, 110, 70, 0.20), transparent 55%)"
      : "radial-gradient(1100px 700px at 85% 20%, rgba(250, 200, 170, 0.45), transparent 55%)";

    return [a, b, base].join(", ");
  }, [variant]);

  const grainOpacity = clamp(
    interpolate(frame, [0, 2 * fps, 10 * fps], [0.0, 0.18, 0.1], {
      extrapolateRight: "clamp",
    }),
    0,
    0.22,
  );

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundImage: vignette,
          backgroundSize: "cover",
          transform: `translate3d(${driftX}px, ${driftY}px, 0)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(520px 520px at 20% 25%, rgba(216, 221, 90, 0.16), transparent 60%), radial-gradient(560px 560px at 80% 35%, rgba(245, 141, 57, 0.14), transparent 60%)",
          transform: `translate3d(${driftX2}px, ${driftY2}px, 0)`,
          filter: "blur(6px)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, rgba(0,0,0,0.00) 2px, rgba(0,0,0,0.00) 4px)",
          opacity: grainOpacity,
          mixBlendMode: "multiply",
        }}
      />
    </AbsoluteFill>
  );
};
