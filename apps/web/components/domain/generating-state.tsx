"use client";

import { Player } from "@remotion/player";
import { AbsoluteFill } from "remotion";

interface GeneratingStateProps {
  progressMessages: Array<{ message: string; progress: number }>;
  partialStoryboard?: {
    adTitle?: string;
    branding?: {
      primaryColor?: string;
      fontFamily?: string;
    };
    scenes?: Array<{
      textOverlay?: string;
      voiceoverScript?: string;
    }>;
  };
}

const LoadingComposition = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: "#fff",
          fontSize: 24,
          fontFamily: "Inter, sans-serif",
        }}
      >
        Generating media...
      </div>
    </AbsoluteFill>
  );
};

const SceneSkeleton = () => (
  <div className="p-4 border rounded-lg bg-muted/50 animate-pulse">
    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
    <div className="h-3 bg-muted rounded w-1/2" />
  </div>
);

export function GeneratingState({
  progressMessages,
  partialStoryboard,
}: GeneratingStateProps) {
  const latestMessage =
    progressMessages.length > 0
      ? progressMessages[progressMessages.length - 1]
      : null;

  return (
    <div className="flex h-screen">
      <div className="w-1/2 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Generating media...</span>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            <Player
              component={LoadingComposition}
              durationInFrames={90}
              fps={30}
              compositionWidth={1920}
              compositionHeight={1080}
              controls={false}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Prompts
            </h3>
            {partialStoryboard?.scenes && partialStoryboard.scenes.length > 0
              ? partialStoryboard.scenes.map((scene, idx) => (
                  <div
                    key={idx}
                    className="p-4 border rounded-lg bg-card opacity-50"
                  >
                    <div className="text-sm font-medium mb-1">
                      {scene.textOverlay || "Loading..."}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {scene.voiceoverScript || "Loading..."}
                    </div>
                  </div>
                ))
              : Array.from({ length: 3 }).map((_, idx) => (
                  <SceneSkeleton key={idx} />
                ))}
          </div>
        </div>
      </div>

      <div className="w-1/2 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Generation Progress</h2>
        </div>

        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {progressMessages.map((msg, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-blue-500">{msg.progress}%</span>
              </div>
              <div className="flex-1">
                <p className="text-sm">{msg.message}</p>
              </div>
            </div>
          ))}

          {latestMessage && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Progress</span>
                <span className="text-xs">{latestMessage.progress}%</span>
              </div>
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${latestMessage.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
