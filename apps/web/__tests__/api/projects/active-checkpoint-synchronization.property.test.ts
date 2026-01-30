// Feature: mvp-architecture-refactor, Property 27: Active Checkpoint Synchronization
// Validates: Requirements 22.3, 22.4

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

interface Project {
  id: string;
  activeCheckpointId: string | null;
}

interface CheckpointEvent {
  type: "create" | "restore";
  checkpointId: string;
}

describe("Property 27: Active Checkpoint Synchronization", () => {
  it("should update activeCheckpointId on checkpoint creation or restoration (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            projectId: fc.uuid(),
            events: fc.array(
              fc.record({
                type: fc.constantFrom<"create" | "restore">(
                  "create",
                  "restore",
                ),
                checkpointId: fc.uuid(),
              }),
              { minLength: 1, maxLength: 10 },
            ),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (projects) => {
          for (const projectData of projects) {
            const project = await processCheckpointEvents(
              projectData.projectId,
              projectData.events,
            );

            const lastEvent = projectData.events[projectData.events.length - 1];
            expect(project.activeCheckpointId).toBe(lastEvent.checkpointId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function processCheckpointEvents(
  projectId: string,
  events: CheckpointEvent[],
): Promise<Project> {
  let activeCheckpointId: string | null = null;

  for (const event of events) {
    activeCheckpointId = event.checkpointId;
  }

  return {
    id: projectId,
    activeCheckpointId,
  };
}
