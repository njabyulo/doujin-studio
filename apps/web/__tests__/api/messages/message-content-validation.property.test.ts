// Feature: mvp-architecture-refactor, Property 11: Message Content Validation
// Validates: Requirements 5.11

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  SCheckpointCreated,
  SGenerationResult,
  SRenderRequested,
  SUrlSubmitted,
} from "~/../../packages/shared/src/schemas/message";

describe("Property 11: Message Content Validation", () => {
  it("should validate contentJson against type-specific Zod schema and reject invalid content (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({
              type: fc.constant("url_submitted" as const),
              version: fc.string({ minLength: 1 }),
              url: fc.webUrl(),
              format: fc.constantFrom("1:1", "9:16", "16:9"),
              artifactRefs: fc.constant([]),
            }),
            fc.record({
              type: fc.constant("generation_result" as const),
              version: fc.string({ minLength: 1 }),
              checkpointId: fc.uuid(),
              summary: fc.string(),
              artifactRefs: fc.constant([]),
            }),
            fc.record({
              type: fc.constant("checkpoint_created" as const),
              version: fc.string({ minLength: 1 }),
              checkpointId: fc.uuid(),
              reason: fc.constantFrom(
                "generation",
                "manual_edit",
                "scene_regeneration",
                "brand_kit_update",
              ),
              artifactRefs: fc.constant([]),
            }),
            fc.record({
              type: fc.constant("render_requested" as const),
              version: fc.string({ minLength: 1 }),
              renderJobId: fc.uuid(),
              format: fc.constantFrom("1:1", "9:16", "16:9"),
              artifactRefs: fc.constant([]),
            }),
          ),
          { minLength: 1, maxLength: 50 },
        ),
        async (messages) => {
          for (const message of messages) {
            const result = validateMessage(message);
            expect(result.success).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should reject invalid message content (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({
              type: fc.constant("url_submitted" as const),
              version: fc.string({ minLength: 1 }),
              url: fc.constant("not-a-url"),
              format: fc.constantFrom("1:1", "9:16", "16:9"),
              artifactRefs: fc.constant([]),
            }),
            fc.record({
              type: fc.constant("generation_result" as const),
              version: fc.string({ minLength: 1 }),
              checkpointId: fc.constant("not-a-uuid"),
              summary: fc.string(),
              artifactRefs: fc.constant([]),
            }),
          ),
          { minLength: 1, maxLength: 20 },
        ),
        async (messages) => {
          for (const message of messages) {
            const result = validateMessage(message);
            expect(result.success).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

function validateMessage(message: unknown): { success: boolean } {
  try {
    if (typeof message === "object" && message !== null && "type" in message) {
      switch (message.type) {
        case "url_submitted":
          SUrlSubmitted.parse(message);
          return { success: true };
        case "generation_result":
          SGenerationResult.parse(message);
          return { success: true };
        case "checkpoint_created":
          SCheckpointCreated.parse(message);
          return { success: true };
        case "render_requested":
          SRenderRequested.parse(message);
          return { success: true };
        default:
          return { success: false };
      }
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}
