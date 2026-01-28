"use client";

import type { TStoryboard } from "@a-ds/remotion";
import { useState } from "react";
import { UrlInput } from "~/components/domain/url-input";
import { Editor } from "../components/domain/editor";

export default function Home() {
  const [storyboard, setStoryboard] = useState<TStoryboard | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleGenerate = async (url: string) => {
    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);
    setRenderError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate storyboard");
      }

      const text = await response.text();
      const storyboardData = JSON.parse(text);
      setStoryboard(storyboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRender = async () => {
    if (!storyboard) return;

    setIsRendering(true);
    setRenderError(null);
    setDownloadUrl(null);

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storyboard),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to render video");
      }

      const { renderId } = await response.json();

      // Poll for completion (simplified - in production, use websockets or better polling)
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Get download URL
      const downloadResponse = await fetch(`/api/download/${renderId}`);

      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json();
        throw new Error(errorData.error || "Failed to get download URL");
      }

      const { url } = await downloadResponse.json();
      setDownloadUrl(url);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsRendering(false);
    }
  };

  const handleRetryRender = () => {
    setRenderError(null);
    handleRender();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Ad Creation Tool
          </h1>
          <p className="text-gray-600">
            Generate video advertisements from any URL
          </p>
        </header>

        <div className="mb-6">
          <UrlInput onGenerate={handleGenerate} isGenerating={isGenerating} />
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </div>

        {storyboard && <Editor storyboard={storyboard} />}

        {!storyboard && !isGenerating && (
          <div className="text-center py-16">
            <p className="text-gray-500">
              Enter a URL above to generate your first ad
            </p>
          </div>
        )}

        {isGenerating && (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Generating storyboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}
