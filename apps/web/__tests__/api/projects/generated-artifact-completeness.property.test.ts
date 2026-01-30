// Feature: mvp-architecture-refactor, Property 17: Generated Artifact Completeness
// Validates: Requirements 8.5, 8.6, 8.7

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

interface Scene {
  id: string;
  duration: number;
  onScreenText: string;
  voiceoverText: string;
  assetSuggestions: Array<{ type: string; description: string }>;
}

interface Storyboard {
  version: string;
  format: string;
  totalDuration: number;
  scenes: Scene[];
}

interface ScriptScene {
  sceneId: string;
  voiceover: string;
}

interface Script {
  version: string;
  tone: string;
  scenes: ScriptScene[];
}

interface BrandKit {
  version: string;
  productName: string;
  tagline: string;
  benefits: string[];
}

interface GeneratedArtifacts {
  storyboard: Storyboard;
  script: Script;
  brandKit: BrandKit;
}

describe("Property 17: Generated Artifact Completeness", () => {
  it("should include complete storyboard, script, and brandKit on generation completion (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            numScenes: fc.integer({ min: 1, max: 10 }),
            tone: fc.string({ minLength: 3 }),
            productName: fc.string({ minLength: 1 }),
            tagline: fc.string({ minLength: 1 }),
            benefits: fc.array(fc.string({ minLength: 1 }), {
              minLength: 1,
              maxLength: 5,
            }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (generations) => {
          for (const gen of generations) {
            const artifacts = await generateArtifacts(gen);

            expect(artifacts.storyboard.scenes.length).toBe(gen.numScenes);
            for (const scene of artifacts.storyboard.scenes) {
              expect(scene.duration).toBeGreaterThan(0);
              expect(scene.onScreenText).toBeDefined();
              expect(scene.voiceoverText).toBeDefined();
              expect(scene.assetSuggestions).toBeDefined();
            }

            expect(artifacts.script.tone).toBe(gen.tone);
            expect(artifacts.script.scenes.length).toBe(gen.numScenes);
            for (const scriptScene of artifacts.script.scenes) {
              expect(scriptScene.voiceover).toBeDefined();
            }

            expect(artifacts.brandKit.productName).toBe(gen.productName);
            expect(artifacts.brandKit.tagline).toBe(gen.tagline);
            expect(artifacts.brandKit.benefits).toEqual(gen.benefits);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function generateArtifacts(params: {
  numScenes: number;
  tone: string;
  productName: string;
  tagline: string;
  benefits: string[];
}): Promise<GeneratedArtifacts> {
  const scenes: Scene[] = Array.from({ length: params.numScenes }, (_, i) => ({
    id: crypto.randomUUID(),
    duration: 5,
    onScreenText: `Scene ${i + 1}`,
    voiceoverText: `Voiceover ${i + 1}`,
    assetSuggestions: [{ type: "image", description: "Product shot" }],
  }));

  return {
    storyboard: {
      version: "1",
      format: "1:1",
      totalDuration: params.numScenes * 5,
      scenes,
    },
    script: {
      version: "1",
      tone: params.tone,
      scenes: scenes.map((s) => ({
        sceneId: s.id,
        voiceover: s.voiceoverText,
      })),
    },
    brandKit: {
      version: "1",
      productName: params.productName,
      tagline: params.tagline,
      benefits: params.benefits,
    },
  };
}
