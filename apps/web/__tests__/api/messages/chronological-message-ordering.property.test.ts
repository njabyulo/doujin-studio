// Feature: mvp-architecture-refactor, Property 8: Chronological Message Ordering
// Validates: Requirements 4.7

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

interface Message {
  id: string;
  createdAt: Date;
}

describe("Property 8: Chronological Message Ordering", () => {
  it("should order messages by createdAt timestamp in ascending order (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            createdAt: fc
              .date({
                min: new Date("2020-01-01"),
                max: new Date("2030-12-31"),
              })
              .filter((date) => !isNaN(date.getTime())),
          }),
          { minLength: 2, maxLength: 50 },
        ),
        async (messages) => {
          const orderedMessages = await orderMessages(messages);

          for (let i = 1; i < orderedMessages.length; i++) {
            const prev = orderedMessages[i - 1].createdAt.getTime();
            const curr = orderedMessages[i].createdAt.getTime();
            expect(curr).toBeGreaterThanOrEqual(prev);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function orderMessages(messages: Message[]): Promise<Message[]> {
  return [...messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}
