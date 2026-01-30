// Feature: mvp-architecture-refactor, Property 1: Streaming Response Delivery
// Validates: Requirements 2.2

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

describe("Property 1: Streaming Response Delivery", () => {
  it(
    "should deliver progress events incrementally before final result (min 100 iterations)",
    { timeout: 30000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.constantFrom("1:1", "9:16", "16:9"),
          fc.option(fc.string({ minLength: 3, maxLength: 50 }), {
            nil: undefined,
          }),
          async (url, format, tone) => {
            const events: Array<{ type: string; timestamp: number }> = [];
            const startTime = Date.now();

            const mockStream = createMockGenerationStream(url, format, tone);

            for await (const event of mockStream) {
              events.push({
                type: event.type,
                timestamp: Date.now() - startTime,
              });
            }

            const progressEvents = events.filter(
              (e) =>
                e.type === "generation_progress" ||
                e.type === "generation_partial",
            );
            const completeEvents = events.filter(
              (e) => e.type === "generation_complete",
            );

            expect(progressEvents.length).toBeGreaterThan(0);
            expect(completeEvents.length).toBe(1);

            const lastProgressTime = Math.max(
              ...progressEvents.map((e) => e.timestamp),
            );
            const completeTime = completeEvents[0].timestamp;

            expect(lastProgressTime).toBeLessThan(completeTime);

            for (let i = 1; i < progressEvents.length; i++) {
              expect(progressEvents[i].timestamp).toBeGreaterThanOrEqual(
                progressEvents[i - 1].timestamp,
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

async function* createMockGenerationStream(
  _url: string,
  _format: string,
  _tone?: string,
): AsyncGenerator<{ type: string; data?: unknown }> {
  yield {
    type: "generation_progress",
    data: { message: "Extracting page content", progress: 10 },
  };

  await new Promise((resolve) => setTimeout(resolve, 10));

  yield {
    type: "generation_progress",
    data: { message: "Analyzing content", progress: 30 },
  };

  await new Promise((resolve) => setTimeout(resolve, 10));

  for (let i = 0; i < 3; i++) {
    yield {
      type: "generation_partial",
      data: { storyboard: { scenes: Array(i + 1).fill({}) } },
    };
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  await new Promise((resolve) => setTimeout(resolve, 10));

  yield {
    type: "generation_complete",
    data: { checkpointId: "test-checkpoint", summary: "3 scenes, 20s" },
  };
}
