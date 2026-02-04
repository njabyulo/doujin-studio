"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface UrlInputProps {
  onGenerate: (url: string) => void;
  isGenerating: boolean;
}

export function UrlInput({ onGenerate, isGenerating }: UrlInputProps) {
  const [url, setUrl] = useState("https://example.com");
  const isValid = url.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) onGenerate(url);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 rounded-2xl border border-[color:var(--ds-border)] bg-[color:var(--ds-glass)] p-2 shadow-[var(--ds-shadow-soft)] backdrop-blur-xl"
    >
      <Input
        type="url"
        placeholder="Enter URL to analyze..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={isGenerating}
        required
        className="flex-1 border-none bg-transparent text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-muted)] shadow-none focus-visible:ring-0"
      />
      <Button type="submit" disabled={isGenerating || !isValid} variant="accent">
        {isGenerating ? "Generating..." : "Generate"}
      </Button>
    </form>
  );
}
