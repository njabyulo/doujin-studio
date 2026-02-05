"use client";

import React from "react";
import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type ClipPreviewProps = {
  assetUrl?: string | null;
  assetType?: "video" | "image";
  title?: string;
  durationInSeconds?: number;
  backgroundColor?: string;
};

export const ClipPreview: React.FC<ClipPreviewProps> = ({
  assetUrl,
  assetType = "video",
  title,
  backgroundColor = "#0b0c11",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 0.65 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleLift = interpolate(frame, [0, 0.65 * fps], [18, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {assetUrl && assetType === "video" ? (
        <Video
          src={assetUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : assetUrl ? (
        <Img
          src={assetUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(1200px 900px at 20% 10%, rgba(210, 198, 180, 0.35), transparent 55%), radial-gradient(900px 700px at 85% 70%, rgba(120, 160, 200, 0.28), transparent 60%), linear-gradient(135deg, #14151a, #0b0c11)",
          }}
        />
      )}

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(8, 9, 13, 0.2) 0%, rgba(8, 9, 13, 0.45) 55%, rgba(8, 9, 13, 0.7) 100%)",
        }}
      />

      {title ? (
        <div
          style={{
            position: "absolute",
            left: 60,
            bottom: 52,
            maxWidth: "60%",
            color: "#f6f2ee",
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: "0.04em",
            fontFamily: "Sora, system-ui, sans-serif",
            opacity: titleOpacity,
            transform: `translateY(${titleLift}px)`,
          }}
        >
          {title}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
