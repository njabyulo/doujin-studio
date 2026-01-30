"use client";

import type { TStoryboard } from "@a-ds/remotion";
import { useState } from "react";
import { AiChatInput } from "~/components/domain/ai-chat-input";
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

        <div className="mb-6">
          {!storyboard && (
            <AiChatInput
              onSubmit={handleGenerate}
              disabled={isGenerating}
              variant="main"
            />
          )}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </div>

        {storyboard && (
          <div className="fixed inset-0 flex">
            <div className="w-[80%] h-full">
              <Editor storyboard={storyboard} />
            </div>
            <div className="w-[20%] h-full bg-white border-l border-gray-200 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div className="text-sm text-gray-500">Chat history</div>
                </div>
              </div>
              <div className="p-3">
                <AiChatInput />
              </div>
            </div>
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
