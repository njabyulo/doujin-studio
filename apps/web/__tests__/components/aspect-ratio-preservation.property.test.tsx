import type { TStoryboard } from "@a-ds/shared";
import { FORMAT_SPECS } from "@a-ds/shared";
import { render } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GeneratedState } from "~/components/domain/generated-state";

/**
 * Property 5: Aspect Ratio Preservation
 * Validates: Requirements 3.5
 *
 * For any format (1:1, 9:16, 16:9), scaling the player should maintain the correct aspect ratio.
 */

const generateStoryboard = (): fc.Arbitrary<TStoryboard> => {
  return fc.record({
    version: fc.constant("1"),
    format: fc.constantFrom("1:1", "9:16", "16:9"),
    totalDuration: fc.integer({ min: 5, max: 60 }),
    scenes: fc
      .array(
        fc.record({
          id: fc.uuid(),
          duration: fc.integer({ min: 1, max: 10 }),
          onScreenText: fc.string({ minLength: 1, maxLength: 100 }),
          voiceoverText: fc.string({ minLength: 1, maxLength: 200 }),
          assetSuggestions: fc.array(
            fc.record({
              type: fc.constantFrom("image", "video"),
              description: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { maxLength: 3 },
          ),
        }),
        { minLength: 1, maxLength: 6 },
      )
      .map((scenes) => {
        const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
        return scenes.map((s) => ({
          ...s,
          duration: (s.duration / totalDuration) * 30,
        }));
      }),
  }) as fc.Arbitrary<TStoryboard>;
};

describe("Property 5: Aspect Ratio Preservation", () => {
  it("should maintain correct aspect ratio for any format", () => {
    fc.assert(
      fc.property(generateStoryboard(), (storyboard) => {
        const { container } = render(
          <GeneratedState
            storyboard={storyboard}
            messages={[]}
            onSendMessage={() => {}}
          />,
        );

        const playerContainer = container.querySelector(
          'div[style*="aspect-ratio"]',
        );

        expect(playerContainer).toBeTruthy();

        if (playerContainer) {
          const style = playerContainer.getAttribute("style");
          expect(style).toBeTruthy();

          const formatSpec = FORMAT_SPECS[storyboard.format];
          const expectedRatio = formatSpec.width / formatSpec.height;

          const aspectRatioMatch = style?.match(
            /aspect-ratio:\s*([0-9.]+)\s*\/\s*([0-9.]+)/,
          );

          if (aspectRatioMatch) {
            const [, width, height] = aspectRatioMatch;
            const actualRatio = parseFloat(width) / parseFloat(height);

            expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.01);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
