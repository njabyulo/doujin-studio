"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface UrlInputProps {
  onGenerate: (url: string) => void;
  isGenerating: boolean;
}

export function UrlInput({ onGenerate, isGenerating }: UrlInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) onGenerate(url);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="url"
        placeholder="Enter URL to analyze..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={isGenerating}
        required
        className="flex-1"
      />
      <Button type="submit" disabled={isGenerating || !url}>
        {isGenerating ? "Generating..." : "Generate"}
      </Button>
    </form>
  );
}
