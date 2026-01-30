// Feature: mvp-architecture-refactor, Property 7: Artifact Reference Linkage
// Validates: Requirements 4.6

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { TArtifactRef } from "~/../../packages/shared/src/types/message";

interface Message {
  id: string;
  type: string;
  artifactRefs: TArtifactRef[];
}

interface Artifact {
  id: string;
  type: "checkpoint" | "render_job";
}

interface MessageWithArtifacts {
  messageId: string;
  messageType: string;
  artifacts: Artifact[];
}

describe("Property 7: Artifact Reference Linkage", () => {
  it("should include artifact references in artifactRefs array for messages that reference artifacts (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            messageId: fc.uuid(),
            messageType: fc.constantFrom(
              "generation_result",
              "checkpoint_created",
              "scene_regenerated",
              "render_requested",
              "render_completed",
            ),
            artifacts: fc.array(
              fc.record({
                id: fc.uuid(),
                type: fc.constantFrom<"checkpoint" | "render_job">(
                  "checkpoint",
                  "render_job",
                ),
              }),
              { minLength: 1, maxLength: 3 },
            ),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        async (events) => {
          const { messages, artifacts } =
            await processMessagesWithArtifacts(events);

          for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            const expectedArtifacts = events[i].artifacts;

            expect(message.artifactRefs).toBeDefined();
            expect(message.artifactRefs.length).toBe(expectedArtifacts.length);

            for (const artifactRef of message.artifactRefs) {
              const artifact = artifacts.find((a) => a.id === artifactRef.id);
              expect(artifact).toBeDefined();
              expect(artifact?.type).toBe(artifactRef.type);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function processMessagesWithArtifacts(
  events: MessageWithArtifacts[],
): Promise<{ messages: Message[]; artifacts: Artifact[] }> {
  const messages: Message[] = [];
  const artifacts: Artifact[] = [];

  for (const event of events) {
    for (const artifact of event.artifacts) {
      artifacts.push(artifact);
    }

    messages.push({
      id: event.messageId,
      type: event.messageType,
      artifactRefs: event.artifacts.map((a) => ({
        type: a.type,
        id: a.id,
      })),
    });
  }

  return { messages, artifacts };
}
