"use client";
import { Composition } from "remotion";
import { Master } from "./Master";
import { TStoryboard } from "./types";

export const RemotionRoot = () => {
  return (
    <Composition
      id="Master"
      component={Master}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={
        {
          adTitle: "Sample Ad",
          branding: {
            primaryColor: "#3B82F6",
            fontFamily: "Inter" as const,
          },
          scenes: [
            {
              textOverlay: "Scene 1",
              voiceoverScript: "This is scene 1",
              imagePrompt: "A beautiful landscape",
              durationInSeconds: 5,
            },
          ],
        } as TStoryboard
      }
    />
  );
};
