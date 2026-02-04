"use client";
import { Composition } from "remotion";
import { FORMAT_SPECS } from "../../shared/src/constants";
import { Master } from "./Master";
import type { TRenderInput } from "./types";

export const RemotionRoot = () => {
  return (
    <Composition
      id="Master"
      component={Master}
      fps={30}
      durationInFrames={30}
      width={FORMAT_SPECS["16:9"].width}
      height={FORMAT_SPECS["16:9"].height}
      calculateMetadata={({ props }) => {
        const input = props as TRenderInput;
        const spec = FORMAT_SPECS[input.storyboard.format];
        return {
          durationInFrames: Math.max(
            1,
            Math.round(input.storyboard.totalDuration * 30),
          ),
          fps: 30,
          width: spec.width,
          height: spec.height,
        };
      }}
      defaultProps={
        {
          storyboard: {
            version: "1",
            format: "16:9",
            totalDuration: 5,
            scenes: [
              {
                id: "00000000-0000-0000-0000-000000000000",
                duration: 5,
                onScreenText: "Sample scene",
                voiceoverText: "This is a sample scene.",
                assetSuggestions: [],
              },
            ],
          },
          brandKit: {
            version: "1",
            productName: "Sample Product",
            tagline: "Sample tagline",
            benefits: ["Benefit 1"],
            colors: {
              primary: "#3B82F6",
              secondary: "#1E40AF",
              accent: "#F97316",
            },
            fonts: {
              heading: "Inter",
              body: "Inter",
            },
            tone: "Professional",
          },
        } as TRenderInput
      }
    />
  );
};
