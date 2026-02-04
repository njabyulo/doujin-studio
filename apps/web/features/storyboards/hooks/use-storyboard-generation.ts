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

type Format = "1:1" | "9:16" | "16:9";

function extractBrief(prompt: string): {
  url: string;
  format: Format;
  tone?: string;
  title: string;
} | null {
  const urlMatch = prompt.match(/https?:\/\/[^\s|]+/);
  if (!urlMatch) return null;

  const url = urlMatch[0];
  const formatMatch = prompt.match(/\b(16:9|9:16|1:1)\b/);
  const format = (formatMatch?.[1] as Format | undefined) ?? "9:16";

  const toneRaw = prompt.replace(url, "").trim().replace(/^\|+/, "").trim();
  const tone = toneRaw.length > 0 ? toneRaw : undefined;

  let title = "Untitled project";
  try {
    const hostname = new URL(url).hostname;
    title = hostname.replace(/^www\./, "");
  } catch {
    // ignore
  }

  return { url, format, tone, title };
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

        const brief = extractBrief(trimmed);
        if (!brief) {
          throw new Error(
            "Include a URL in your brief (starting with http:// or https://).",
          );
        }

        const projectResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: brief.title }),
        });

        if (!projectResponse.ok) {
          const message = await projectResponse.text();
          throw new Error(message || "Failed to create project");
        }

        const created = (await projectResponse.json()) as { id: string };
        const urlParams = new URLSearchParams();
        urlParams.set("url", brief.url);
        urlParams.set("format", brief.format);
        if (brief.tone) urlParams.set("tone", brief.tone);

        router.push(`/projects/${created.id}?${urlParams.toString()}`);
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
