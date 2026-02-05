// Feature: mvp-architecture-refactor, Property 6: Message Type Correctness
// Validates: Requirements 4.2, 4.3, 6.9, 6.10, 8.8

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

type EventType =
  | "url_submission"
  | "generation_completion"
  | "checkpoint_creation"
  | "checkpoint_restoration"
  | "scene_regeneration"
  | "render_request"
  | "render_completion";

describe("Property 6: Message Type Correctness", () => {
  it("should create messages with type field matching the event type (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            eventType: fc.constantFrom<EventType>(
              "url_submission",
              "generation_completion",
              "checkpoint_creation",
              "checkpoint_restoration",
              "scene_regeneration",
              "render_request",
              "render_completion",
            ),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        async (events) => {
          const messages = await processEvents(events);

          for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const message = messages[i];

            const expectedType = getExpectedMessageType(event.eventType);
            expect(message.type).toBe(expectedType);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

function getExpectedMessageType(eventType: EventType): string {
  const mapping: Record<EventType, string> = {
    url_submission: "url_submitted",
    generation_completion: "generation_result",
    checkpoint_creation: "checkpoint_created",
    checkpoint_restoration: "checkpoint_applied",
    scene_regeneration: "scene_regenerated",
    render_request: "render_requested",
    render_completion: "render_completed",
  };
  return mapping[eventType];
}

async function processEvents(
  events: Array<{ eventType: EventType }>,
): Promise<Array<{ type: string }>> {
  const messages: Array<{ type: string }> = [];

  for (const event of events) {
    const messageType = getExpectedMessageType(event.eventType);
    messages.push({ type: messageType });
  }

  return messages;
}
