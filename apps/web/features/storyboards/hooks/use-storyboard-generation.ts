"use client";

import type { TStoryboard } from "@a-ds/remotion";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

interface GenerateOptions {
  prompt: string;
  model: string;
}

interface UseStoryboardGeneration {
  handleGenerate: (options: GenerateOptions) => Promise<void>;
  isGenerating: boolean;
  isTransitioning: boolean;
  error: string | null;
  clearError: () => void;
}

const projectStorageKey = (id: string) => `project:${id}`;

export function useStoryboardGeneration(): UseStoryboardGeneration {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const handleGenerate = useCallback(
    async ({ prompt, model }: GenerateOptions) => {
      const trimmed = prompt.trim();
      if (!trimmed || isGenerating) return;

      setIsGenerating(true);
      setIsTransitioning(true);
      setError(null);

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed, model }),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to generate storyboard");
        }

        const raw = await response.text();
        const storyboard = JSON.parse(raw) as TStoryboard & { id?: string };
        const projectId = storyboard.id ?? crypto.randomUUID();

        try {
          sessionStorage.setItem(
            projectStorageKey(projectId),
            JSON.stringify({ ...storyboard, id: projectId }),
          );
        } catch (storageError) {
          console.error("Failed to persist storyboard", storageError);
        }

        router.push(`/projects/${projectId}`);
      } catch (generationError) {
        console.error("Storyboard generation failed", generationError);
        setIsTransitioning(false);
        setError(
          generationError instanceof Error
            ? generationError.message
            : "An unexpected error occurred",
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, router],
  );

  return { handleGenerate, isGenerating, isTransitioning, error, clearError };
}

export function readStoryboardFromStorage(id: string): TStoryboard | null {
  if (typeof window === "undefined") return null;
  const payload = sessionStorage.getItem(projectStorageKey(id));
  if (!payload) return null;
  try {
    return JSON.parse(payload) as TStoryboard;
  } catch (error) {
    console.error("Failed to parse storyboard", error);
    return null;
  }
}
