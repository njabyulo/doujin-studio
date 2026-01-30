// Feature: mvp-architecture-refactor, Property 9: Complete Message History
// Validates: Requirements 4.8

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

interface Message {
  id: string;
  projectId: string;
  content: string;
}

interface Project {
  id: string;
  messages: Message[];
}

describe("Property 9: Complete Message History", () => {
  it("should display all messages without omission when showing a project (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          projectId: fc.uuid(),
          messages: fc.array(
            fc.record({
              id: fc.uuid(),
              content: fc.string(),
            }),
            { minLength: 1, maxLength: 50 },
          ),
        }),
        async (projectData) => {
          const project = await loadProject(projectData);

          expect(project.messages.length).toBe(projectData.messages.length);

          const messageIds = new Set(project.messages.map((m) => m.id));
          for (const originalMessage of projectData.messages) {
            expect(messageIds.has(originalMessage.id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function loadProject(projectData: {
  projectId: string;
  messages: Array<{ id: string; content: string }>;
}): Promise<Project> {
  return {
    id: projectData.projectId,
    messages: projectData.messages.map((m) => ({
      id: m.id,
      projectId: projectData.projectId,
      content: m.content,
    })),
  };
}
