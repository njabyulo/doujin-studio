"use client";

import type { TStoryboard } from "@a-ds/remotion";
import { useState } from "react";
import { UrlInput } from "~/components/domain/url-input";
import { Editor } from "../components/domain/editor";

export default function Home() {
  const [storyboard, setStoryboard] = useState<TStoryboard | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (url: string) => {
    setIsGenerating(true);
    setError(null);

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
