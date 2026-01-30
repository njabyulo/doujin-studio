import * as fc from "fast-check";
import { describe, it } from "vitest";
import {
  SBrandKit,
  SCheckpointApplied,
  SCheckpointCreated,
  SGenerationProgress,
  SGenerationResult,
  SRenderCompleted,
  SRenderProgress,
  SRenderRequested,
  SSceneRegenerated,
  SScript,
  SStoryboard,
  SUrlSubmitted,
} from "../src/schemas";

describe("Property 31: Schema Version Presence", () => {
  it("message schemas should require version field", () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constant("url_submitted"),
          url: fc.webUrl(),
          format: fc.constantFrom("1:1", "9:16", "16:9"),
          artifactRefs: fc.constant([]),
        }),
        (data) => {
          const withoutVersion = { ...data };
          const parseResult = SUrlSubmitted.safeParse(withoutVersion);
          return !parseResult.success;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("all message types should have version field", () => {
    const messageSchemas = [
      { schema: SUrlSubmitted, type: "url_submitted" },
      { schema: SGenerationProgress, type: "generation_progress" },
      { schema: SGenerationResult, type: "generation_result" },
      { schema: SCheckpointCreated, type: "checkpoint_created" },
      { schema: SCheckpointApplied, type: "checkpoint_applied" },
      { schema: SSceneRegenerated, type: "scene_regenerated" },
      { schema: SRenderRequested, type: "render_requested" },
      { schema: SRenderProgress, type: "render_progress" },
      { schema: SRenderCompleted, type: "render_completed" },
    ];

    messageSchemas.forEach(({ schema, type }) => {
      fc.assert(
        fc.property(fc.record({}), (data) => {
          const withoutVersion = { ...data, type, artifactRefs: [] };
          const parseResult = schema.safeParse(withoutVersion);
          return !parseResult.success;
        }),
        { numRuns: 100 },
      );
    });
  });

  it("storyboard schema should require version field", () => {
    fc.assert(
      fc.property(
        fc.record({
          format: fc.constantFrom("1:1", "9:16", "16:9"),
          totalDuration: fc.integer({ min: 1, max: 60 }),
          scenes: fc.constant([]),
        }),
        (data) => {
          const withoutVersion = { ...data };
          const parseResult = SStoryboard.safeParse(withoutVersion);
          return !parseResult.success;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("script schema should require version field", () => {
    fc.assert(
      fc.property(
        fc.record({
          tone: fc.string(),
          scenes: fc.constant([]),
        }),
        (data) => {
          const withoutVersion = { ...data };
          const parseResult = SScript.safeParse(withoutVersion);
          return !parseResult.success;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("brand kit schema should require version field", () => {
    fc.assert(
      fc.property(
        fc.record({
          productName: fc.string(),
          tagline: fc.string(),
          benefits: fc.array(fc.string()),
          colors: fc.record({
            primary: fc.string(),
            secondary: fc.string(),
            accent: fc.string(),
          }),
          fonts: fc.record({
            heading: fc.string(),
            body: fc.string(),
          }),
          tone: fc.string(),
        }),
        (data) => {
          const withoutVersion = { ...data };
          const parseResult = SBrandKit.safeParse(withoutVersion);
          return !parseResult.success;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("schemas should accept valid version field", () => {
    fc.assert(
      fc.property(
        fc.record({
          version: fc.string({ minLength: 1 }),
          type: fc.constant("url_submitted"),
          url: fc.webUrl(),
          format: fc.constantFrom("1:1", "9:16", "16:9"),
          artifactRefs: fc.constant([]),
        }),
        (data) => {
          const parseResult = SUrlSubmitted.safeParse(data);
          return parseResult.success;
        },
      ),
      { numRuns: 100 },
    );
  });
});
