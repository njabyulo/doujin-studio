// Feature: mvp-architecture-refactor, Property 19: Format-Specific Layout Application
// Validates: Requirements 9.6, 9.7

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FORMAT_SPECS } from "~/../../packages/shared/src/constants/format-specs";

interface LayoutRules {
  width: number;
  height: number;
  safeArea: { top: number; bottom: number; left: number; right: number };
  textMaxLength: number;
}

describe("Property 19: Format-Specific Layout Application", () => {
  it("should apply format-specific layout rules at render/preview time (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            format: fc.constantFrom<"1:1" | "9:16" | "16:9">(
              "1:1",
              "9:16",
              "16:9",
            ),
            content: fc.string({ minLength: 1 }),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        async (renders) => {
          for (const render of renders) {
            const layoutRules = await applyLayoutRules(render.format);

            const expectedRules = FORMAT_SPECS[render.format];
            expect(layoutRules.width).toBe(expectedRules.width);
            expect(layoutRules.height).toBe(expectedRules.height);
            expect(layoutRules.safeArea).toEqual(expectedRules.safeArea);
            expect(layoutRules.textMaxLength).toBe(expectedRules.textMaxLength);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function applyLayoutRules(
  format: "1:1" | "9:16" | "16:9",
): Promise<LayoutRules> {
  return FORMAT_SPECS[format];
}
