"use client";
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TScene, TStoryboard } from "./types";

interface SceneProps {
  scene: TScene;
  branding: TStoryboard["branding"];
}

export const Scene: React.FC<SceneProps> = ({ scene, branding }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15, 135, 150], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: branding?.primaryColor || "#000",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <h1
        style={{
          fontFamily: branding?.fontFamily || "Arial",
          fontSize: 80,
          color: "#fff",
          textAlign: "center",
          padding: "0 100px",
        }}
      >
        {scene.textOverlay}
      </h1>
    </AbsoluteFill>
  );
};
