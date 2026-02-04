"use client";

import type { TScene } from "@doujin/shared";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface SceneEditorProps {
  scene: TScene;
  onSave: (updates: {
    duration: number;
    onScreenText: string;
    voiceoverText: string;
  }) => void;
  onCancel: () => void;
}

export function SceneEditor({ scene, onSave, onCancel }: SceneEditorProps) {
  const [duration, setDuration] = useState(scene.duration.toString());
  const [onScreenText, setOnScreenText] = useState(scene.onScreenText);
  const [voiceoverText, setVoiceoverText] = useState(scene.voiceoverText);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const durationNum = parseFloat(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      return;
    }

    onSave({
      duration: durationNum,
      onScreenText,
      voiceoverText,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glassPanel space-y-4 p-4 text-white/90"
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
        Edit Scene
      </h3>

      <div className="space-y-2">
        <Label htmlFor="duration" className="text-white/70">
          Duration (seconds)
        </Label>
        <Input
          id="duration"
          type="number"
          step="0.1"
          min="0.1"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          required
          className="border-white/10 bg-black/30 text-white placeholder:text-white/40"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onScreenText" className="text-white/70">
          On-Screen Text
        </Label>
        <Input
          id="onScreenText"
          value={onScreenText}
          onChange={(e) => setOnScreenText(e.target.value)}
          required
          className="border-white/10 bg-black/30 text-white placeholder:text-white/40"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="voiceoverText" className="text-white/70">
          Voiceover Text
        </Label>
        <Input
          id="voiceoverText"
          value={voiceoverText}
          onChange={(e) => setVoiceoverText(e.target.value)}
          required
          className="border-white/10 bg-black/30 text-white placeholder:text-white/40"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="accent" className="rounded-full">
          Save Changes
        </Button>
        <Button
          type="button"
          variant="glass"
          className="rounded-full"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
