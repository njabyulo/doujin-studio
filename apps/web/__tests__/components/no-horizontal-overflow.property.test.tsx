import type { TStoryboard } from "@doujin/shared";
import { render } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GeneratedState } from "~/components/domain/generated-state";

/**
 * Property 4: No Horizontal Overflow
 * Validates: Requirements 3.4
 *
 * For any viewport width, the Remotion Player should not cause horizontal scrolling.
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

const generateViewportWidth = (): fc.Arbitrary<number> => {
  return fc.integer({ min: 320, max: 3840 });
};

describe("Property 4: No Horizontal Overflow", () => {
  it("should not cause horizontal overflow for any viewport width", () => {
    fc.assert(
      fc.property(
        generateStoryboard(),
        generateViewportWidth(),
        (storyboard, viewportWidth) => {
          const { container } = render(
            <GeneratedState
              storyboard={storyboard}
              messages={[]}
              onSendMessage={() => {}}
            />,
          );

          Object.defineProperty(window, "innerWidth", {
            writable: true,
            configurable: true,
            value: viewportWidth,
          });

          const playerContainer = container.querySelector(
            'div[style*="width: 100%"]',
          );

          expect(playerContainer).toBeTruthy();

          if (playerContainer) {
            const computedStyle = window.getComputedStyle(playerContainer);
            const width = parseFloat(computedStyle.width);

            expect(width).toBeLessThanOrEqual(viewportWidth * 0.6);
          }

          const hasHorizontalScroll = document.body.scrollWidth > viewportWidth;
          expect(hasHorizontalScroll).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
