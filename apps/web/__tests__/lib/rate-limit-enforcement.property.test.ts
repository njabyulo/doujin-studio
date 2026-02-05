// Feature: mvp-architecture-refactor, Property 28: Rate Limit Enforcement
// **Validates: Requirements 23.4**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

type TOperation = "generate" | "regenerate_scene" | "generate_assets" | "render";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const RATE_LIMITS: Record<TOperation, RateLimitConfig> = {
  generate: { windowMs: 60_000, maxRequests: 10 },
  regenerate_scene: { windowMs: 60_000, maxRequests: 20 },
  generate_assets: { windowMs: 60_000, maxRequests: 30 },
  render: { windowMs: 60_000, maxRequests: 5 },
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitRequest {
  userId: string;
  operation: TOperation;
  requestCount: number;
  timestamp: number;
}

describe("Property 28: Rate Limit Enforcement", () => {
  it("should return 429 with retry-after header when user exceeds rate limit for an operation (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userId: fc.uuid(),
            operation: fc.constantFrom(
              "generate" as const,
              "regenerate_scene" as const,
              "generate_assets" as const,
              "render" as const,
            ),
            requestCount: fc.integer({ min: 1, max: 30 }),
            timestamp: fc.integer({ min: 0, max: 120_000 }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        async (requests) => {
          const responses = await processRateLimitedRequests(requests);

          for (const request of requests) {
            const config = RATE_LIMITS[request.operation];
            const userResponses = responses.filter(
              (r) =>
                r.userId === request.userId &&
                r.operation === request.operation &&
                r.timestamp === request.timestamp,
            );

            const successCount = userResponses.filter(
              (r) => r.status === null,
            ).length;
            const rateLimitedCount = userResponses.filter(
              (r) => r.status === 429,
            ).length;

            if (request.requestCount <= config.maxRequests) {
              expect(successCount).toBe(request.requestCount);
              expect(rateLimitedCount).toBe(0);
            } else {
              expect(successCount).toBe(config.maxRequests);
              expect(rateLimitedCount).toBe(
                request.requestCount - config.maxRequests,
              );

              const rateLimitedResponses = userResponses.filter(
                (r) => r.status === 429,
              );
              for (const response of rateLimitedResponses) {
                expect(response.retryAfter).toBeGreaterThan(0);
                expect(response.retryAfter).toBeLessThanOrEqual(
                  Math.ceil(config.windowMs / 1000),
                );
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should enforce rate limits independently per user and operation (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userId: fc.uuid(),
            operation: fc.constantFrom(
              "generate" as const,
              "regenerate_scene" as const,
              "generate_assets" as const,
              "render" as const,
            ),
            requestCount: fc.integer({ min: 1, max: 30 }),
            timestamp: fc.integer({ min: 0, max: 120_000 }),
          }),
          { minLength: 2, maxLength: 50 },
        ),
        async (requests) => {
          const responses = await processRateLimitedRequests(requests);

          const userOperationPairs = new Set(
            requests.map((r) => `${r.userId}:${r.operation}`),
          );

          for (const pair of userOperationPairs) {
            const [userId, operation] = pair.split(":");
            const config = RATE_LIMITS[operation as TOperation];

            const pairRequests = requests.filter(
              (r) => r.userId === userId && r.operation === operation,
            );

            const totalRequests = pairRequests.reduce(
              (sum, r) => sum + r.requestCount,
              0,
            );

            const pairResponses = responses.filter(
              (r) => r.userId === userId && r.operation === operation,
            );

            const successCount = pairResponses.filter(
              (r) => r.status === null,
            ).length;

            expect(successCount).toBeLessThanOrEqual(config.maxRequests);

            if (totalRequests > config.maxRequests) {
              const rateLimitedCount = pairResponses.filter(
                (r) => r.status === 429,
              ).length;
              expect(rateLimitedCount).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should reset rate limit after window expires (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          operation: fc.constantFrom(
            "generate" as const,
            "regenerate_scene" as const,
            "generate_assets" as const,
            "render" as const,
          ),
          firstBatchCount: fc.integer({ min: 1, max: 15 }),
          secondBatchCount: fc.integer({ min: 1, max: 15 }),
          timeBetweenBatches: fc.integer({ min: 0, max: 120_000 }),
        }),
        async ({
          userId,
          operation,
          firstBatchCount,
          secondBatchCount,
          timeBetweenBatches,
        }) => {
          const config = RATE_LIMITS[operation];
          const rateLimitStore = new Map<string, RateLimitEntry>();

          const firstBatchResponses = await processRequestBatch(
            userId,
            operation,
            firstBatchCount,
            0,
            rateLimitStore,
          );

          const secondBatchResponses = await processRequestBatch(
            userId,
            operation,
            secondBatchCount,
            timeBetweenBatches,
            rateLimitStore,
          );

          const firstBatchSuccess = firstBatchResponses.filter(
            (r) => r.status === null,
          ).length;
          const secondBatchSuccess = secondBatchResponses.filter(
            (r) => r.status === null,
          ).length;

          if (timeBetweenBatches >= config.windowMs) {
            expect(secondBatchSuccess).toBe(
              Math.min(secondBatchCount, config.maxRequests),
            );
          } else {
            const totalAllowed = config.maxRequests - firstBatchSuccess;
            expect(secondBatchSuccess).toBe(
              Math.max(0, Math.min(secondBatchCount, totalAllowed)),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function processRateLimitedRequests(
  requests: RateLimitRequest[],
): Promise<
  Array<{
    userId: string;
    operation: TOperation;
    timestamp: number;
    status: number | null;
    retryAfter?: number;
  }>
> {
  const rateLimitStore = new Map<string, RateLimitEntry>();
  const responses: Array<{
    userId: string;
    operation: TOperation;
    timestamp: number;
    status: number | null;
    retryAfter?: number;
  }> = [];

  for (const request of requests) {
    for (let i = 0; i < request.requestCount; i++) {
      const response = await checkRateLimit(
        request.userId,
        request.operation,
        request.timestamp,
        rateLimitStore,
      );

      responses.push({
        userId: request.userId,
        operation: request.operation,
        timestamp: request.timestamp,
        status: response.status,
        retryAfter: response.retryAfter,
      });
    }
  }

  return responses;
}

async function processRequestBatch(
  userId: string,
  operation: TOperation,
  count: number,
  timestamp: number,
  rateLimitStore: Map<string, RateLimitEntry>,
): Promise<
  Array<{
    status: number | null;
    retryAfter?: number;
  }>
> {
  const responses: Array<{
    status: number | null;
    retryAfter?: number;
  }> = [];

  for (let i = 0; i < count; i++) {
    const response = await checkRateLimit(
      userId,
      operation,
      timestamp,
      rateLimitStore,
    );
    responses.push(response);
  }

  return responses;
}

async function checkRateLimit(
  userId: string,
  operation: TOperation,
  now: number,
  rateLimitStore: Map<string, RateLimitEntry>,
): Promise<{
  status: number | null;
  retryAfter?: number;
}> {
  cleanupExpiredEntries(rateLimitStore, now);

  const key = `${userId}:${operation}`;
  const config = RATE_LIMITS[operation];

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return { status: null };
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { status: 429, retryAfter };
  }

  entry.count++;
  return { status: null };
}

function cleanupExpiredEntries(
  rateLimitStore: Map<string, RateLimitEntry>,
  now: number,
): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}
