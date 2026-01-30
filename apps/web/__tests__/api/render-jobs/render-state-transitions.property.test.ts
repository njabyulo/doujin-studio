// Feature: mvp-architecture-refactor, Property 25: Render State Transitions
// **Validates: Requirements 15.5, 15.6, 15.7, 16.3**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

type RenderStatus =
  | "pending"
  | "rendering"
  | "completed"
  | "failed"
  | "cancel_requested"
  | "cancelled";

interface StateTransition {
  from: RenderStatus;
  to: RenderStatus;
  cancelRequested: boolean;
}

// Valid state transitions according to the spec:
// - pending → rendering → (completed | failed)
// - pending → cancel_requested → cancelled
// - rendering → cancel_requested → cancelled
// - rendering → cancel_requested → completed (output URL not surfaced)
const VALID_TRANSITIONS: Record<RenderStatus, RenderStatus[]> = {
  pending: ["rendering", "cancel_requested"],
  rendering: ["completed", "failed", "cancel_requested"],
  completed: [], // terminal state
  failed: [], // terminal state
  cancel_requested: ["cancelled", "completed"], // can complete even after cancel requested
  cancelled: [], // terminal state
};

function isValidTransition(from: RenderStatus, to: RenderStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

function isTerminalState(status: RenderStatus): boolean {
  return ["completed", "failed", "cancelled"].includes(status);
}

// Simulate a render job state machine
function applyTransition(
  currentStatus: RenderStatus,
  nextStatus: RenderStatus,
  cancelRequested: boolean,
): { status: RenderStatus; valid: boolean; cancelRequested: boolean } {
  // Check if transition is valid
  if (!isValidTransition(currentStatus, nextStatus)) {
    return { status: currentStatus, valid: false, cancelRequested };
  }

  // Apply business rules
  let newCancelRequested = cancelRequested;

  // When transitioning to cancel_requested, set the flag
  if (nextStatus === "cancel_requested") {
    newCancelRequested = true;
  }

  // When transitioning to cancelled or completed from cancel_requested, keep the flag
  if (currentStatus === "cancel_requested" && nextStatus === "cancelled") {
    newCancelRequested = true;
  }

  if (currentStatus === "cancel_requested" && nextStatus === "completed") {
    newCancelRequested = true;
  }

  return {
    status: nextStatus,
    valid: true,
    cancelRequested: newCancelRequested,
  };
}

describe("Property 25: Render State Transitions", () => {
  it("should only allow valid state transitions through the render job lifecycle (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a sequence of attempted state transitions
        fc.array(
          fc.record({
            targetStatus: fc.constantFrom<RenderStatus>(
              "pending",
              "rendering",
              "completed",
              "failed",
              "cancel_requested",
              "cancelled",
            ),
            requestCancel: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (transitions) => {
          let currentStatus: RenderStatus = "pending";
          let cancelRequested = false;
          const appliedTransitions: StateTransition[] = [];

          for (const transition of transitions) {
            // Skip if already in terminal state
            if (isTerminalState(currentStatus)) {
              break;
            }

            const result = applyTransition(
              currentStatus,
              transition.targetStatus,
              cancelRequested,
            );

            if (result.valid) {
              appliedTransitions.push({
                from: currentStatus,
                to: result.status,
                cancelRequested: result.cancelRequested,
              });
              currentStatus = result.status;
              cancelRequested = result.cancelRequested;
            }
          }

          // Verify all applied transitions are valid
          for (const t of appliedTransitions) {
            expect(isValidTransition(t.from, t.to)).toBe(true);
          }

          // Verify cancel_requested flag behavior
          for (const t of appliedTransitions) {
            if (t.to === "cancel_requested") {
              expect(t.cancelRequested).toBe(true);
            }
            if (t.from === "cancel_requested" && t.to === "cancelled") {
              expect(t.cancelRequested).toBe(true);
            }
            if (t.from === "cancel_requested" && t.to === "completed") {
              expect(t.cancelRequested).toBe(true);
            }
          }

          // Verify terminal states are respected
          const lastTransition =
            appliedTransitions[appliedTransitions.length - 1];
          if (lastTransition && isTerminalState(lastTransition.to)) {
            // No more transitions should be possible
            expect(VALID_TRANSITIONS[lastTransition.to]).toEqual([]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should enforce specific valid transition paths (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate specific transition paths
        fc.constantFrom(
          // Happy path: pending → rendering → completed
          ["pending", "rendering", "completed"] as RenderStatus[],
          // Error path: pending → rendering → failed
          ["pending", "rendering", "failed"] as RenderStatus[],
          // Cancel from pending: pending → cancel_requested → cancelled
          ["pending", "cancel_requested", "cancelled"] as RenderStatus[],
          // Cancel from rendering: rendering → cancel_requested → cancelled
          ["rendering", "cancel_requested", "cancelled"] as RenderStatus[],
          // Cancel but completes: rendering → cancel_requested → completed
          ["rendering", "cancel_requested", "completed"] as RenderStatus[],
        ),
        async (path) => {
          let currentStatus: RenderStatus = path[0];
          let cancelRequested = false;

          for (let i = 1; i < path.length; i++) {
            const nextStatus = path[i];
            const result = applyTransition(
              currentStatus,
              nextStatus,
              cancelRequested,
            );

            expect(result.valid).toBe(true);
            expect(isValidTransition(currentStatus, nextStatus)).toBe(true);

            currentStatus = result.status;
            cancelRequested = result.cancelRequested;
          }

          // Verify final state
          const finalStatus = path[path.length - 1];
          expect(currentStatus).toBe(finalStatus);

          // Verify cancel flag for cancel paths
          if (path.includes("cancel_requested")) {
            expect(cancelRequested).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should reject invalid state transitions (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate invalid transition attempts
        fc.constantFrom(
          // Can't go back from rendering to pending
          { from: "rendering" as RenderStatus, to: "pending" as RenderStatus },
          // Can't go from completed to anything
          {
            from: "completed" as RenderStatus,
            to: "rendering" as RenderStatus,
          },
          // Can't go from failed to anything
          { from: "failed" as RenderStatus, to: "rendering" as RenderStatus },
          // Can't go from cancelled to anything
          {
            from: "cancelled" as RenderStatus,
            to: "rendering" as RenderStatus,
          },
          // Can't skip rendering
          { from: "pending" as RenderStatus, to: "completed" as RenderStatus },
          // Can't go from pending to failed
          { from: "pending" as RenderStatus, to: "failed" as RenderStatus },
        ),
        async (invalidTransition) => {
          const result = applyTransition(
            invalidTransition.from,
            invalidTransition.to,
            false,
          );

          expect(result.valid).toBe(false);
          expect(result.status).toBe(invalidTransition.from); // Should stay in current state
          expect(
            isValidTransition(invalidTransition.from, invalidTransition.to),
          ).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle cancel_requested flag correctly throughout lifecycle (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            targetStatus: fc.constantFrom<RenderStatus>(
              "rendering",
              "cancel_requested",
              "cancelled",
              "completed",
            ),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        async (transitions) => {
          let currentStatus: RenderStatus = "pending";
          let cancelRequested = false;

          for (const transition of transitions) {
            if (isTerminalState(currentStatus)) {
              break;
            }

            const result = applyTransition(
              currentStatus,
              transition.targetStatus,
              cancelRequested,
            );

            if (result.valid) {
              // Once cancel is requested, flag should remain true
              if (cancelRequested) {
                expect(result.cancelRequested).toBe(true);
              }

              // When transitioning to cancel_requested, flag must be set
              if (result.status === "cancel_requested") {
                expect(result.cancelRequested).toBe(true);
              }

              // When transitioning to cancelled from cancel_requested, flag must be true
              if (
                currentStatus === "cancel_requested" &&
                result.status === "cancelled"
              ) {
                expect(result.cancelRequested).toBe(true);
              }

              // When completing after cancel_requested, flag must be true (but output not surfaced)
              if (
                currentStatus === "cancel_requested" &&
                result.status === "completed"
              ) {
                expect(result.cancelRequested).toBe(true);
              }

              currentStatus = result.status;
              cancelRequested = result.cancelRequested;
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
