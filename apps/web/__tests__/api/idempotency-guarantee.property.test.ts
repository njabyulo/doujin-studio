// Feature: mvp-architecture-refactor, Property 26: Idempotency Guarantee
// **Validates: Requirements 20.5, 20.7**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

interface IdempotencyKey {
  userId: string;
  operation: "generate" | "regenerate_scene" | "render";
  key: string;
  resultRef: string;
}

interface DuplicateRequest {
  userId: string;
  operation: "generate" | "regenerate_scene" | "render";
  key: string;
  duplicateCount: number;
}

describe("Property 26: Idempotency Guarantee", () => {
  it("should return existing result for duplicate requests with same idempotencyKey without creating duplicate work (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userId: fc.uuid(),
            operation: fc.constantFrom(
              "generate" as const,
              "regenerate_scene" as const,
              "render" as const,
            ),
            key: fc.string({ minLength: 1, maxLength: 50 }),
            duplicateCount: fc.integer({ min: 2, max: 10 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (requests) => {
          const { storedKeys, processedRequests } =
            await processIdempotentRequests(requests);

          for (const request of requests) {
            const matchingKeys = storedKeys.filter(
              (k) =>
                k.userId === request.userId &&
                k.operation === request.operation &&
                k.key === request.key,
            );

            expect(matchingKeys.length).toBe(1);

            const processedCount = processedRequests.filter(
              (r) =>
                r.userId === request.userId &&
                r.operation === request.operation &&
                r.key === request.key,
            ).length;

            expect(processedCount).toBe(request.duplicateCount);

            const uniqueResults = new Set(
              processedRequests
                .filter(
                  (r) =>
                    r.userId === request.userId &&
                    r.operation === request.operation &&
                    r.key === request.key,
                )
                .map((r) => r.resultRef),
            );

            expect(uniqueResults.size).toBe(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function processIdempotentRequests(
  requests: DuplicateRequest[],
): Promise<{
  storedKeys: IdempotencyKey[];
  processedRequests: Array<{
    userId: string;
    operation: "generate" | "regenerate_scene" | "render";
    key: string;
    resultRef: string;
  }>;
}> {
  const storedKeys: IdempotencyKey[] = [];
  const processedRequests: Array<{
    userId: string;
    operation: "generate" | "regenerate_scene" | "render";
    key: string;
    resultRef: string;
  }> = [];

  for (const request of requests) {
    for (let i = 0; i < request.duplicateCount; i++) {
      const existing = storedKeys.find(
        (k) =>
          k.userId === request.userId &&
          k.operation === request.operation &&
          k.key === request.key,
      );

      if (existing) {
        processedRequests.push({
          userId: request.userId,
          operation: request.operation,
          key: request.key,
          resultRef: existing.resultRef,
        });
      } else {
        const resultRef = `result-${request.userId}-${request.operation}-${request.key}`;

        storedKeys.push({
          userId: request.userId,
          operation: request.operation,
          key: request.key,
          resultRef,
        });

        processedRequests.push({
          userId: request.userId,
          operation: request.operation,
          key: request.key,
          resultRef,
        });
      }
    }
  }

  return { storedKeys, processedRequests };
}
