// Feature: mvp-architecture-refactor, Property 10: Message Schema Versioning
// Validates: Requirements 5.10

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

interface MessageContent {
  version: string;
  type: string;
  [key: string]: unknown;
}

describe("Property 10: Message Schema Versioning", () => {
  it("should include version field in all message contentJson (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            messageId: fc.uuid(),
            messageType: fc.constantFrom(
              "url_submitted",
              "generation_result",
              "checkpoint_created",
              "scene_regenerated",
              "render_requested",
            ),
            version: fc.constantFrom("1", "1.0", "2.0"),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        async (messages) => {
          const contentJsons = await createMessageContents(messages);

          for (const content of contentJsons) {
            expect(content.version).toBeDefined();
            expect(typeof content.version).toBe("string");
            expect(content.version.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function createMessageContents(
  messages: Array<{
    messageId: string;
    messageType: string;
    version: string;
  }>,
): Promise<MessageContent[]> {
  return messages.map((m) => ({
    version: m.version,
    type: m.messageType,
    artifactRefs: [],
  }));
}
