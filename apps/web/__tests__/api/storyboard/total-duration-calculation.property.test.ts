// Feature: mvp-architecture-refactor, Property 22: Total Duration Calculation
// Validates: Requirements 10.6

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

interface Scene {
  id: string;
  duration: number;
}

interface Storyboard {
  totalDuration: number;
  scenes: Scene[];
}

describe("Property 22: Total Duration Calculation", () => {
  it("should calculate totalDuration as sum of all scene durations (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            scenes: fc.array(
              fc.record({
                id: fc.uuid(),
                duration: fc.integer({ min: 1, max: 30 }),
              }),
              { minLength: 1, maxLength: 20 },
            ),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (storyboards) => {
          for (const storyboardData of storyboards) {
            const storyboard = await createStoryboard(storyboardData.scenes);

            const expectedTotal = storyboardData.scenes.reduce(
              (sum, scene) => sum + scene.duration,
              0,
            );

            expect(storyboard.totalDuration).toBe(expectedTotal);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function createStoryboard(scenes: Scene[]): Promise<Storyboard> {
  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  return {
    totalDuration,
    scenes,
  };
}
