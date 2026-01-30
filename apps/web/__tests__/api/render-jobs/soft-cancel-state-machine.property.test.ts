// Feature: mvp-architecture-refactor, Property 16: Soft-Cancel State Machine
// **Validates: Requirements 7.1, 7.2, 7.4, 7.5**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

type RenderStatus =
  | "pending"
  | "rendering"
  | "completed"
  | "failed"
  | "cancel_requested"
  | "cancelled";

interface RenderJob {
  id: string;
  status: RenderStatus;
  cancelRequested: boolean;
  outputUrl: string | null;
}

interface CancelAction {
  type: "cancel";
}

interface CompleteAction {
  type: "complete";
  outputUrl: string;
}

interface FailAction {
  type: "fail";
}

interface StartRenderingAction {
  type: "start_rendering";
}

type Action = CancelAction | CompleteAction | FailAction | StartRenderingAction;

// Simulate render job state machine with soft-cancel
function applyAction(job: RenderJob, action: Action): RenderJob {
  switch (action.type) {
    case "cancel":
      // Requirement 7.1: Set cancel_requested=true
      // Requirement 7.2: Update status to 'cancel_requested'
      if (job.status === "pending" || job.status === "rendering") {
        return {
          ...job,
          cancelRequested: true,
          status: "cancel_requested",
        };
      }
      return job;

    case "start_rendering":
      if (job.status === "pending") {
        return {
          ...job,
          status: "rendering",
        };
      }
      return job;

    case "complete":
      if (job.status === "rendering" || job.status === "cancel_requested") {
        // Requirement 7.4: When cancelled job completes, status should be 'cancelled'
        // Requirement 7.5: When cancelled job completes, outputUrl should NOT be surfaced
        if (job.cancelRequested) {
          return {
            ...job,
            status: "cancelled",
            outputUrl: null, // Don't surface output
          };
        }
        return {
          ...job,
          status: "completed",
          outputUrl: action.outputUrl,
        };
      }
      return job;

    case "fail":
      if (job.status === "rendering" || job.status === "cancel_requested") {
        return {
          ...job,
          status: "failed",
          outputUrl: null,
        };
      }
      return job;

    default:
      return job;
  }
}

describe("Property 16: Soft-Cancel State Machine", () => {
  it("should set cancel_requested=true and transition to cancel_requested status when cancellation is requested (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a sequence of actions leading to cancellation
        fc.constantFrom<"pending" | "rendering">("pending", "rendering"),
        async (initialStatus) => {
          const job: RenderJob = {
            id: "test-job",
            status: initialStatus,
            cancelRequested: false,
            outputUrl: null,
          };

          const cancelledJob = applyAction(job, { type: "cancel" });

          // Requirement 7.1: cancel_requested should be set to true
          expect(cancelledJob.cancelRequested).toBe(true);

          // Requirement 7.2: status should transition to 'cancel_requested'
          expect(cancelledJob.status).toBe("cancel_requested");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should transition to cancelled status when a cancelled job completes (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }), // Generate output URL
        async (outputUrl) => {
          // Start with a job in cancel_requested state
          const job: RenderJob = {
            id: "test-job",
            status: "cancel_requested",
            cancelRequested: true,
            outputUrl: null,
          };

          const completedJob = applyAction(job, {
            type: "complete",
            outputUrl,
          });

          // Requirement 7.4: When job completes, status should transition to 'cancelled'
          expect(completedJob.status).toBe("cancelled");

          // Requirement 7.5: outputUrl should NOT be surfaced to the client
          expect(completedJob.outputUrl).toBeNull();

          // Verify cancel flag remains true
          expect(completedJob.cancelRequested).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should not surface outputUrl when a cancelled job completes (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }), // Generate output URL
        async (outputUrl) => {
          // Simulate full cancel flow: pending → rendering → cancel_requested → cancelled
          let job: RenderJob = {
            id: "test-job",
            status: "pending",
            cancelRequested: false,
            outputUrl: null,
          };

          // Start rendering
          job = applyAction(job, { type: "start_rendering" });
          expect(job.status).toBe("rendering");

          // Request cancellation
          job = applyAction(job, { type: "cancel" });
          expect(job.status).toBe("cancel_requested");
          expect(job.cancelRequested).toBe(true);

          // Job completes (but was cancelled)
          job = applyAction(job, { type: "complete", outputUrl });

          // Requirement 7.4: Status should be 'cancelled'
          expect(job.status).toBe("cancelled");

          // Requirement 7.5: outputUrl should NOT be surfaced
          expect(job.outputUrl).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle cancel requests at different stages of the render lifecycle (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom<Action>(
            { type: "start_rendering" },
            { type: "cancel" },
            { type: "complete", outputUrl: "https://example.com/video.mp4" },
            { type: "fail" },
          ),
          { minLength: 1, maxLength: 10 },
        ),
        async (actions) => {
          let job: RenderJob = {
            id: "test-job",
            status: "pending",
            cancelRequested: false,
            outputUrl: null,
          };

          let cancelWasRequested = false;

          for (const action of actions) {
            const previousStatus = job.status;
            job = applyAction(job, action);

            // Track if cancel was ever requested
            if (action.type === "cancel" && job.cancelRequested) {
              cancelWasRequested = true;
            }

            // Once cancel is requested, flag should remain true
            if (cancelWasRequested) {
              expect(job.cancelRequested).toBe(true);
            }

            // If cancel was requested and job completes, verify correct behavior
            if (
              cancelWasRequested &&
              action.type === "complete" &&
              (previousStatus === "rendering" ||
                previousStatus === "cancel_requested")
            ) {
              // Requirement 7.4: Status should be 'cancelled'
              expect(job.status).toBe("cancelled");

              // Requirement 7.5: outputUrl should NOT be surfaced
              expect(job.outputUrl).toBeNull();
            }

            // If cancel was NOT requested and job completes normally
            if (
              !cancelWasRequested &&
              action.type === "complete" &&
              previousStatus === "rendering"
            ) {
              expect(job.status).toBe("completed");
              expect(job.outputUrl).not.toBeNull();
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve cancel_requested flag throughout the lifecycle (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          cancelAtStage: fc.constantFrom<"pending" | "rendering">(
            "pending",
            "rendering",
          ),
          completionType: fc.constantFrom<"complete" | "fail">(
            "complete",
            "fail",
          ),
        }),
        async ({ cancelAtStage, completionType }) => {
          let job: RenderJob = {
            id: "test-job",
            status: "pending",
            cancelRequested: false,
            outputUrl: null,
          };

          // Progress to the cancel stage
          if (cancelAtStage === "rendering") {
            job = applyAction(job, { type: "start_rendering" });
          }

          // Request cancellation
          job = applyAction(job, { type: "cancel" });

          // Requirement 7.1: cancel_requested should be true
          expect(job.cancelRequested).toBe(true);

          // Requirement 7.2: status should be 'cancel_requested'
          expect(job.status).toBe("cancel_requested");

          // Complete or fail the job
          if (completionType === "complete") {
            job = applyAction(job, {
              type: "complete",
              outputUrl: "https://example.com/video.mp4",
            });

            // Requirement 7.4: Status should be 'cancelled'
            expect(job.status).toBe("cancelled");

            // Requirement 7.5: outputUrl should NOT be surfaced
            expect(job.outputUrl).toBeNull();
          } else {
            job = applyAction(job, { type: "fail" });
            expect(job.status).toBe("failed");
          }

          // Cancel flag should remain true
          expect(job.cancelRequested).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should not allow cancellation of terminal states (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<RenderStatus>("completed", "failed", "cancelled"),
        async (terminalStatus) => {
          const job: RenderJob = {
            id: "test-job",
            status: terminalStatus,
            cancelRequested: false,
            outputUrl:
              terminalStatus === "completed"
                ? "https://example.com/video.mp4"
                : null,
          };

          const cancelledJob = applyAction(job, { type: "cancel" });

          // Terminal states should not be affected by cancel
          expect(cancelledJob.status).toBe(terminalStatus);
          expect(cancelledJob.cancelRequested).toBe(false);
          expect(cancelledJob.outputUrl).toBe(job.outputUrl);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle normal completion without cancellation correctly (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }), // Generate output URL
        async (outputUrl) => {
          let job: RenderJob = {
            id: "test-job",
            status: "pending",
            cancelRequested: false,
            outputUrl: null,
          };

          // Normal flow: pending → rendering → completed
          job = applyAction(job, { type: "start_rendering" });
          expect(job.status).toBe("rendering");

          job = applyAction(job, { type: "complete", outputUrl });

          // Should complete normally
          expect(job.status).toBe("completed");
          expect(job.outputUrl).toBe(outputUrl);
          expect(job.cancelRequested).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
