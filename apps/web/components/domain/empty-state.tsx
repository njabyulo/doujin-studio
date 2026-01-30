"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface TProject {
  id: string;
  title: string;
  updatedAt: Date;
}

interface EmptyStateProps {
  recentProjects: TProject[];
  onUrlSubmit: (url: string) => void;
  onProjectSelect: (projectId: string) => void;
  onDemoProject: () => void;
}

const EXAMPLE_URLS = [
  "https://www.apple.com/iphone",
  "https://www.nike.com/running-shoes",
  "https://www.tesla.com/model3",
];

export function EmptyState({
  recentProjects,
  onUrlSubmit,
  onProjectSelect,
  onDemoProject,
}: EmptyStateProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onUrlSubmit(url.trim());
    }
  };

  const hasProjects = recentProjects.length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Create Your Ad</h1>
          <p className="text-muted-foreground">
            Enter a URL to generate a video ad with AI
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Product URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/product"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="text-lg h-12"
            />
          </div>
          <Button type="submit" size="lg" className="w-full">
            Generate Ad
          </Button>
        </form>

        {!hasProjects && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Try one of these examples:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {EXAMPLE_URLS.map((exampleUrl) => (
                  <Button
                    key={exampleUrl}
                    variant="outline"
                    size="sm"
                    onClick={() => setUrl(exampleUrl)}
                  >
                    {new URL(exampleUrl).hostname.replace("www.", "")}
                  </Button>
                ))}
              </div>
            </div>

            <div className="text-center">
              <Button variant="secondary" onClick={onDemoProject}>
                Try Demo Project
              </Button>
            </div>
          </div>
        )}

        {hasProjects && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Recent Projects</h2>
              <p className="text-sm text-muted-foreground">
                Continue where you left off
              </p>
            </div>

            <div className="space-y-2">
              {recentProjects.slice(0, 5).map((project) => (
                <button
                  key={project.id}
                  onClick={() => onProjectSelect(project.id)}
                  className="w-full text-left p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{project.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
