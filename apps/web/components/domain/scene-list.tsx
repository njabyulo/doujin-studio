"use client";

import type { TScene } from "@doujin/shared";

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
          Scenes
        </h3>
        <span className="text-xs text-white/40">{scenes.length} total</span>
      </div>
      {scenes.map((scene, idx) => {
        const isSelected = selectedSceneId === scene.id;
        return (
          <button
            key={scene.id}
            onClick={() => onSceneSelect(scene.id)}
            className={[
              "group relative w-full overflow-hidden rounded-2xl border p-3 text-left transition",
              isSelected
                ? "border-[#d8dd5a]/40 bg-white/10 shadow-[0_0_30px_rgba(216,221,90,0.18)]"
                : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5",
            ].join(" ")}
          >
            <div className="absolute inset-0 opacity-60">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%)]" />
            </div>
            <div className="relative flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-white/80">
                Scene {idx + 1}
              </span>
              <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white/70">
                {scene.duration}s
              </span>
            </div>
            <div className="relative mt-2 text-sm text-white/85">
              {scene.onScreenText}
            </div>
            <div className="relative mt-1 line-clamp-2 text-xs text-white/60">
              {scene.voiceoverText}
            </div>
          </button>
        );
      })}
    </div>
  );
}
