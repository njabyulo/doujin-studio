"use client";

import { Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface SceneOption {
  id: string;
  label: string;
}

interface AssetsChatProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  isSubmitting: boolean;
  error?: string | null;
  sceneOptions: SceneOption[];
  selectedSceneId?: string;
  onSceneChange: (sceneId: string) => void;
  onSubmit: () => void;
}

export function AssetsChat({
  prompt,
  onPromptChange,
  isSubmitting,
  error,
  sceneOptions,
  selectedSceneId,
  onSceneChange,
  onSubmit,
}: AssetsChatProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/50">
          <Sparkles className="h-3.5 w-3.5 text-[#d8dd5a]" />
          Asset Director
        </div>
        <p className="mt-2 text-sm text-white/70">
          Describe what you need and we will generate more assets for the
          selected scene.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="space-y-2">
          <Label htmlFor="assetScene" className="text-white/70">
            Target scene
          </Label>
          <Select value={selectedSceneId} onValueChange={onSceneChange}>
            <SelectTrigger
              id="assetScene"
              className="border-white/10 bg-white/5 text-white"
            >
              <SelectValue placeholder="Select a scene" />
            </SelectTrigger>
            <SelectContent>
              {sceneOptions.map((scene) => (
                <SelectItem key={scene.id} value={scene.id}>
                  {scene.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="assetPrompt" className="text-white/70">
            Prompt
          </Label>
          <Input
            id="assetPrompt"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder='e.g. "sunset rooftop vibe, slow motion, soft grain"'
            className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
          />
        </div>

        <Button
          variant="accent"
          className="mt-4 w-full rounded-full"
          onClick={onSubmit}
          disabled={!prompt.trim() || !selectedSceneId || isSubmitting}
        >
          {isSubmitting ? "Generating…" : "Generate assets"}
        </Button>

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
        Try: “Search for bright product closeups”, “Find a cinematic hero shot”,
        “Add lifestyle B-roll with warm lighting”.
      </div>
    </div>
  );
}
