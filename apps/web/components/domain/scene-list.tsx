"use client";

import type { TScene } from "@a-ds/shared";

interface SceneListProps {
  scenes: TScene[];
  selectedSceneId?: string;
  onSceneSelect: (sceneId: string) => void;
}

export function SceneList({
  scenes,
  selectedSceneId,
  onSceneSelect,
}: SceneListProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Scenes</h3>
      {scenes.map((scene, idx) => (
        <button
          key={scene.id}
          onClick={() => onSceneSelect(scene.id)}
          className={`w-full text-left p-4 border rounded-lg transition-colors ${
            selectedSceneId === scene.id
              ? "bg-blue-500/10 border-blue-500"
              : "bg-card hover:bg-accent"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Scene {idx + 1}</span>
            <span className="text-xs text-muted-foreground">
              {scene.duration}s
            </span>
          </div>
          <div className="text-sm mb-1">{scene.onScreenText}</div>
          <div className="text-xs text-muted-foreground line-clamp-2">
            {scene.voiceoverText}
          </div>
        </button>
      ))}
    </div>
  );
}
