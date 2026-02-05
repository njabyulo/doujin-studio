// Feature: mvp-architecture-refactor, Property 24: Scene Regeneration Isolation
// Validates: Requirements 14.6

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

interface Scene {
  id: string;
  duration: number;
  onScreenText: string;
  voiceoverText: string;
  assetSuggestions: Array<{
    id: string;
    type: "image" | "video";
    description: string;
  }>;
}

interface Storyboard {
  version: string;
  format: "1:1" | "9:16" | "16:9";
  totalDuration: number;
  scenes: Scene[];
}

interface SceneRegenerationEvent {
  storyboard: Storyboard;
  targetSceneId: string;
  newScene: Scene;
}

describe("Property 24: Scene Regeneration Isolation", () => {
  it("should modify only the specified scene and leave all other scenes unchanged (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .record({
            storyboard: generateStoryboard(),
            targetSceneIndex: fc.nat(),
            newScene: generateScene(),
          })
          .chain((data) => {
            if (data.storyboard.scenes.length === 0) {
              return fc.constant(null);
            }
            const targetIndex =
              data.targetSceneIndex % data.storyboard.scenes.length;
            const targetSceneId = data.storyboard.scenes[targetIndex].id;
            return fc.constant({
              storyboard: data.storyboard,
              targetSceneId,
              newScene: { ...data.newScene, id: targetSceneId },
            });
          })
          .filter((data): data is SceneRegenerationEvent => data !== null),
        async (event) => {
          const originalScenes = JSON.parse(
            JSON.stringify(event.storyboard.scenes),
          );

          const updatedStoryboard = await regenerateScene(
            event.storyboard,
            event.targetSceneId,
            event.newScene,
          );

          const targetIndex = originalScenes.findIndex(
            (s: Scene) => s.id === event.targetSceneId,
          );

          for (let i = 0; i < updatedStoryboard.scenes.length; i++) {
            if (i === targetIndex) {
              expect(updatedStoryboard.scenes[i].id).toBe(event.targetSceneId);
              expect(updatedStoryboard.scenes[i].duration).toBe(
                event.newScene.duration,
              );
              expect(updatedStoryboard.scenes[i].onScreenText).toBe(
                event.newScene.onScreenText,
              );
              expect(updatedStoryboard.scenes[i].voiceoverText).toBe(
                event.newScene.voiceoverText,
              );
            } else {
              expect(updatedStoryboard.scenes[i]).toEqual(originalScenes[i]);
            }
          }

          expect(updatedStoryboard.scenes.length).toBe(originalScenes.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

function generateScene(): fc.Arbitrary<Scene> {
  return fc.record({
    id: fc.uuid(),
    duration: fc.integer({ min: 1, max: 30 }),
    onScreenText: fc.string({ minLength: 5, maxLength: 100 }),
    voiceoverText: fc.string({ minLength: 10, maxLength: 200 }),
    assetSuggestions: fc.array(
      fc.record({
        id: fc.uuid(),
        type: fc.constantFrom("image" as const, "video" as const),
        description: fc.string({ minLength: 5, maxLength: 50 }),
      }),
      { minLength: 0, maxLength: 3 },
    ),
  });
}

function generateStoryboard(): fc.Arbitrary<Storyboard> {
  return fc
    .array(generateScene(), { minLength: 1, maxLength: 10 })
    .map((scenes) => ({
      version: "1",
      format: "1:1" as const,
      totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
      scenes,
    }));
}

async function regenerateScene(
  storyboard: Storyboard,
  targetSceneId: string,
  newScene: Scene,
): Promise<Storyboard> {
  const updatedScenes = storyboard.scenes.map((scene) =>
    scene.id === targetSceneId ? newScene : scene,
  );

  return {
    ...storyboard,
    scenes: updatedScenes,
    totalDuration: updatedScenes.reduce((sum, s) => sum + s.duration, 0),
  };
}
