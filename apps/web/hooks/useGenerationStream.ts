"use client";

import { useState } from "react";
import { consumeGenerationStream } from "~/lib/stream-consumer";

type ProgressMessage = {
  message: string;
  progress: number;
};

type PartialStoryboard = {
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

type GenerationState = {
  isGenerating: boolean;
  progressMessages: ProgressMessage[];
  partialStoryboard?: PartialStoryboard;
  checkpointId?: string;
  error?: string;
};

export function useGenerationStream() {
  const [state, setState] = useState<GenerationState>({
    isGenerating: false,
    progressMessages: [],
  });

  const startGeneration = async (
    projectId: string,
    url: string,
    format: "1:1" | "9:16" | "16:9",
    tone?: string,
  ) => {
    setState({
      isGenerating: true,
      progressMessages: [],
    });

    try {
      const response = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          format,
          tone,
          idempotencyKey: `${projectId}-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      for await (const event of consumeGenerationStream(response)) {
        if (event.type === "generation_progress") {
          setState((prev) => ({
            ...prev,
            progressMessages: [
              ...prev.progressMessages,
              { message: event.message, progress: event.progress },
            ],
          }));
        } else if (event.type === "generation_partial") {
          setState((prev) => ({
            ...prev,
            partialStoryboard: event.storyboard as PartialStoryboard,
          }));
        } else if (event.type === "generation_complete") {
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            checkpointId: event.checkpointId,
          }));
          return event.checkpointId;
        } else if (event.type === "generation_error") {
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            error: event.error,
          }));
          throw new Error(event.error);
        }
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
      throw error;
    }
  };

  return {
    ...state,
    startGeneration,
  };
}
