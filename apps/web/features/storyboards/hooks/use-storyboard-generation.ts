"use client";

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
        void model;

        const projectResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
          }),
        });

        if (!projectResponse.ok) {
          const message = await projectResponse.text();
          throw new Error(message || "Failed to create project");
        }

        const created = (await projectResponse.json()) as {
          project: { id: string };
        };

        router.push(`/projects/${created.project.id}`);
      } catch (generationError) {
        console.error("Media generation failed", generationError);
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
