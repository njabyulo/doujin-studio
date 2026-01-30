"use client";

import type { TScene } from "@a-ds/shared";
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
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">Edit Scene</h3>

      <div className="space-y-2">
        <Label htmlFor="duration">Duration (seconds)</Label>
        <Input
          id="duration"
          type="number"
          step="0.1"
          min="0.1"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onScreenText">On-Screen Text</Label>
        <Input
          id="onScreenText"
          value={onScreenText}
          onChange={(e) => setOnScreenText(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="voiceoverText">Voiceover Text</Label>
        <Input
          id="voiceoverText"
          value={voiceoverText}
          onChange={(e) => setVoiceoverText(e.target.value)}
          required
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit">Save Changes</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
