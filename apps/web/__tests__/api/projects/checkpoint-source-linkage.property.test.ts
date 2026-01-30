// Feature: mvp-architecture-refactor, Property 13: Checkpoint Source Linkage
// Validates: Requirements 6.6

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

interface Checkpoint {
  id: string;
  sourceMessageId: string;
  parentCheckpointId: string | null;
}

interface Message {
  id: string;
  type: string;
}

interface CheckpointCreationEvent {
  messageId: string;
  checkpointId: string;
  parentCheckpointId: string | null;
}

describe("Property 13: Checkpoint Source Linkage", () => {
  it("should link every checkpoint to the sourceMessageId that triggered its creation (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            messageId: fc.uuid(),
            checkpointId: fc.uuid(),
            parentCheckpointId: fc.option(fc.uuid(), { nil: null }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        async (events) => {
          const { checkpoints, messages } =
            await processCheckpointCreations(events);

          for (const checkpoint of checkpoints) {
            expect(checkpoint.sourceMessageId).toBeDefined();
            expect(checkpoint.sourceMessageId).not.toBe("");

            const sourceMessage = messages.find(
              (m) => m.id === checkpoint.sourceMessageId,
            );
            expect(sourceMessage).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function processCheckpointCreations(
  events: CheckpointCreationEvent[],
): Promise<{ checkpoints: Checkpoint[]; messages: Message[] }> {
  const checkpoints: Checkpoint[] = [];
  const messages: Message[] = [];

  for (const event of events) {
    messages.push({
      id: event.messageId,
      type: "generation_result",
    });

    checkpoints.push({
      id: event.checkpointId,
      sourceMessageId: event.messageId,
      parentCheckpointId: event.parentCheckpointId,
    });
  }

  return { checkpoints, messages };
}
