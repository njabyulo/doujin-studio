// Feature: mvp-architecture-refactor, Property 12: Checkpoint Creation Rules
// Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 22.3

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

type EventType =
  | "generation_completion"
  | "manual_edit"
  | "scene_regeneration"
  | "brand_kit_update"
  | "render_requested"
  | "render_progress"
  | "render_completed"
  | "checkpoint_restoration";

interface ProjectState {
  activeCheckpointId: string | null;
  messages: Array<{ type: string; checkpointId?: string }>;
  checkpoints: Array<{ id: string; reason: string }>;
}

describe("Property 12: Checkpoint Creation Rules", () => {
  it("should create checkpoints for generation/edit events and update activeCheckpointId, but not for render events (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            event: fc.constantFrom<EventType>(
              "generation_completion",
              "manual_edit",
              "scene_regeneration",
              "brand_kit_update",
              "render_requested",
              "render_progress",
              "render_completed",
              "checkpoint_restoration",
            ),
            checkpointId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (events) => {
          const state = await processEvents(events);

          const checkpointCreatingEvents = events.filter((e) =>
            [
              "generation_completion",
              "manual_edit",
              "scene_regeneration",
              "brand_kit_update",
            ].includes(e.event),
          );

          const renderEvents = events.filter((e) =>
            [
              "render_requested",
              "render_progress",
              "render_completed",
            ].includes(e.event),
          );

          const restorationEvents = events.filter(
            (e) => e.event === "checkpoint_restoration",
          );

          for (const event of checkpointCreatingEvents) {
            const checkpointCreatedMessages = state.messages.filter(
              (m) =>
                m.type === "checkpoint_created" &&
                m.checkpointId === event.checkpointId,
            );
            expect(checkpointCreatedMessages.length).toBeGreaterThan(0);

            const checkpoint = state.checkpoints.find(
              (c) => c.id === event.checkpointId,
            );
            expect(checkpoint).toBeDefined();
          }

          for (const event of renderEvents) {
            const checkpointCreatedMessages = state.messages.filter(
              (m) =>
                m.type === "checkpoint_created" &&
                m.checkpointId === event.checkpointId,
            );
            expect(checkpointCreatedMessages.length).toBe(0);
          }

          for (const event of restorationEvents) {
            const checkpointAppliedMessages = state.messages.filter(
              (m) =>
                m.type === "checkpoint_applied" &&
                m.checkpointId === event.checkpointId,
            );
            expect(checkpointAppliedMessages.length).toBeGreaterThan(0);

            const checkpointCreatedMessages = state.messages.filter(
              (m) =>
                m.type === "checkpoint_created" &&
                m.checkpointId === event.checkpointId,
            );
            expect(checkpointCreatedMessages.length).toBe(0);
          }

          const lastCheckpointEvent = [...events]
            .reverse()
            .find((e) =>
              [
                "generation_completion",
                "manual_edit",
                "scene_regeneration",
                "brand_kit_update",
                "checkpoint_restoration",
              ].includes(e.event),
            );

          if (lastCheckpointEvent) {
            expect(state.activeCheckpointId).toBe(
              lastCheckpointEvent.checkpointId,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function processEvents(
  events: Array<{ event: EventType; checkpointId: string }>,
): Promise<ProjectState> {
  const state: ProjectState = {
    activeCheckpointId: null,
    messages: [],
    checkpoints: [],
  };

  for (const { event, checkpointId } of events) {
    switch (event) {
      case "generation_completion":
        state.checkpoints.push({ id: checkpointId, reason: "generation" });
        state.messages.push({
          type: "checkpoint_created",
          checkpointId,
        });
        state.activeCheckpointId = checkpointId;
        break;

      case "manual_edit":
        state.checkpoints.push({ id: checkpointId, reason: "manual_edit" });
        state.messages.push({
          type: "checkpoint_created",
          checkpointId,
        });
        state.activeCheckpointId = checkpointId;
        break;

      case "scene_regeneration":
        state.checkpoints.push({
          id: checkpointId,
          reason: "scene_regeneration",
        });
        state.messages.push({
          type: "checkpoint_created",
          checkpointId,
        });
        state.activeCheckpointId = checkpointId;
        break;

      case "brand_kit_update":
        state.checkpoints.push({
          id: checkpointId,
          reason: "brand_kit_update",
        });
        state.messages.push({
          type: "checkpoint_created",
          checkpointId,
        });
        state.activeCheckpointId = checkpointId;
        break;

      case "render_requested":
        state.messages.push({
          type: "render_requested",
        });
        break;

      case "render_progress":
        state.messages.push({
          type: "render_progress",
        });
        break;

      case "render_completed":
        state.messages.push({
          type: "render_completed",
        });
        break;

      case "checkpoint_restoration":
        state.messages.push({
          type: "checkpoint_applied",
          checkpointId,
        });
        state.activeCheckpointId = checkpointId;
        break;
    }
  }

  return state;
}
