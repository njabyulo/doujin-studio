import React from "react";
import {
  AbsoluteFill,
  Img,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { dsTheme } from "../theme";

type BrowserFrameProps = {
  assetPath: string;
  cornerRadius?: number;
  cropTop?: number;
  cropLeft?: number;
  zoomFrom?: number;
  zoomTo?: number;
  panX?: number;
  panY?: number;
};

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  assetPath,
  cornerRadius = 34,
  cropTop = 0,
  cropLeft = 0,
  zoomFrom = 1.04,
  zoomTo = 1.0,
  panX = 0,
  panY = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: {
      damping: 200,
      mass: 0.9,
    },
  });

  const scale = zoomFrom + (zoomTo - zoomFrom) * enter;
  const tx = -cropLeft + panX * enter;
  const ty = -cropTop + panY * enter;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: cornerRadius,
        background: dsTheme.glassDark,
        border: `1px solid ${dsTheme.borderDark}`,
        boxShadow: "0 30px 90px rgba(11, 12, 18, 0.22)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 54,
          display: "flex",
          alignItems: "center",
          paddingLeft: 18,
          gap: 10,
          borderBottom: `1px solid ${dsTheme.borderDark}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        }}
      >
        <Dot color="#ff5f57" />
        <Dot color="#febc2e" />
        <Dot color="#28c840" />
        <div
          style={{
            marginLeft: 14,
            height: 28,
            flex: 1,
            maxWidth: 520,
            borderRadius: 999,
            border: `1px solid ${dsTheme.borderDark}`,
            background: "rgba(0,0,0,0.18)",
          }}
        />
      </div>
      <AbsoluteFill style={{ top: 54, height: "auto" }}>
        <Img
          src={staticFile(assetPath)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          }}
        />
        <AbsoluteFill
          style={{
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => {
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        background: color,
        boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
      }}
    />
  );
};
