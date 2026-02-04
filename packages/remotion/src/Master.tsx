"use client";
import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Scene } from "./Scene";
import type { TRenderInput } from "./types";

export const Master: React.FC<TRenderInput> = ({ storyboard, brandKit }) => {
  const { fps } = useVideoConfig();

  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {storyboard.scenes.map((scene, index) => {
        const durationInFrames = Math.round(scene.duration * fps);
        const from = currentFrame;
        currentFrame += durationInFrames;

        return (
          <Sequence key={index} from={from} durationInFrames={durationInFrames}>
            <Scene scene={scene} brandKit={brandKit} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
