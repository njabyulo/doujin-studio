'use client';

import type { TStoryboard } from '@a-ds/remotion';
import { useState } from 'react';
import { StoryboardEditor } from '~/components/domain/storyboard-editor';
import { UrlInput } from '~/components/domain/url-input';
import { VideoPreview } from '~/components/domain/video-preview';

export default function Home() {
  const [storyboard, setStoryboard] = useState<TStoryboard | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (url: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate storyboard');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.chunk) {
              accumulatedText += data.chunk;
            }
          }
        }
      }

      // Parse the accumulated JSON
      const jsonMatch = accumulatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedStoryboard = JSON.parse(jsonMatch[0]);
        setStoryboard(parsedStoryboard);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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

        {storyboard && (
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="order-2 lg:order-1">
              <StoryboardEditor
                storyboard={storyboard}
                onChange={setStoryboard}
              />
            </div>
            <div className="order-1 lg:order-2">
              <VideoPreview storyboard={storyboard} />
            </div>
          </div>
        )}

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

