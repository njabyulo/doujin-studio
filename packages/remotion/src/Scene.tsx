"use client";
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { TBrandKit, TScene } from "../../shared/src/types";

interface SceneProps {
  scene: TScene;
  brandKit: TBrandKit;
}

export const Scene: React.FC<SceneProps> = ({ scene, brandKit }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15, 135, 150], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandKit.colors.primary || "#000",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <h1
        style={{
          fontFamily: brandKit.fonts.heading || "Arial",
          fontSize: 80,
          color: "#fff",
          textAlign: "center",
          padding: "0 100px",
        }}
      >
        {scene.onScreenText}
      </h1>
    </AbsoluteFill>
  );
};
