// Feature: mvp-architecture-refactor, Property 23: Storyboard Schema Validation
// Validates: Requirements 10.7

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SStoryboard } from "~/../../packages/shared/src/schemas/storyboard";

describe("Property 23: Storyboard Schema Validation", () => {
  it("should validate storyboard against Zod schema before saving (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            version: fc.string({ minLength: 1 }),
            format: fc.constantFrom("1:1", "9:16", "16:9"),
            totalDuration: fc.integer({ min: 1, max: 300 }),
            scenes: fc.array(
              fc.record({
                id: fc.uuid(),
                duration: fc.integer({ min: 1, max: 30 }),
                onScreenText: fc.string(),
                voiceoverText: fc.string(),
                assetSuggestions: fc.array(
                  fc.record({
                    id: fc.uuid(),
                    type: fc.constantFrom("image", "video"),
                    description: fc.string({ minLength: 1 }),
                  }),
                  { maxLength: 3 },
                ),
              }),
              { minLength: 1, maxLength: 10 },
            ),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (storyboards) => {
          for (const storyboard of storyboards) {
            const result = validateStoryboard(storyboard);
            expect(result.success).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should reject invalid storyboards (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({
              version: fc.string({ minLength: 1 }),
              format: fc.constant("invalid-format"),
              totalDuration: fc.integer({ min: 1, max: 300 }),
              scenes: fc.constant([]),
            }),
            fc.record({
              version: fc.string({ minLength: 1 }),
              format: fc.constantFrom("1:1", "9:16", "16:9"),
              totalDuration: fc.constant(-1),
              scenes: fc.constant([]),
            }),
          ),
          { minLength: 1, maxLength: 20 },
        ),
        async (storyboards) => {
          for (const storyboard of storyboards) {
            const result = validateStoryboard(storyboard);
            expect(result.success).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

function validateStoryboard(storyboard: unknown): { success: boolean } {
  try {
    SStoryboard.parse(storyboard);
    return { success: true };
  } catch {
    return { success: false };
  }
}
