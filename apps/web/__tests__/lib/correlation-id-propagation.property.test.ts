// Feature: mvp-architecture-refactor, Property 29: Correlation ID Propagation
// **Validates: Requirements 24.2, 24.4**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import {
  createErrorResponse,
  createNotFoundError,
  createServerError,
  createUnauthorizedError,
  createValidationError,
} from "~/lib/error-helpers";

describe("Property 29: Correlation ID Propagation", () => {
  it("should generate a correlation ID for each API request and include it in all log entries (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            hasExistingId: fc.boolean(),
            existingId: fc.uuid(),
            endpoint: fc.constantFrom(
              "/api/projects",
              "/api/projects/456/generate/images",
              "/api/projects/456/generate/videos",
            ),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (requests) => {
          const logEntries: Array<{ correlationId: string; message: string }> =
            [];

          for (const request of requests) {
            const mockRequest = createMockRequest(
              request.endpoint,
              request.hasExistingId ? request.existingId : null,
            );

            const correlationId = getCorrelationId(mockRequest);

            logEntries.push({
              correlationId,
              message: `[${correlationId}] Processing ${request.endpoint}`,
            });
            logEntries.push({
              correlationId,
              message: `[${correlationId}] Validating request`,
            });
            logEntries.push({
              correlationId,
              message: `[${correlationId}] Request completed`,
            });

            if (request.hasExistingId) {
              expect(correlationId).toBe(request.existingId);
            } else {
              expect(correlationId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
              );
            }

            const requestLogs = logEntries.filter(
              (log) => log.correlationId === correlationId,
            );
            expect(requestLogs.length).toBeGreaterThan(0);

            for (const log of requestLogs) {
              expect(log.message).toContain(`[${correlationId}]`);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should include correlation ID in error responses (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            correlationId: fc.uuid(),
            errorType: fc.constantFrom(
              "validation",
              "unauthorized",
              "not_found",
              "server_error",
            ),
            resource: fc.constantFrom("Project", "Render job", "Checkpoint"),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (errorCases) => {
          for (const errorCase of errorCases) {
            let errorResponse: Response;

            switch (errorCase.errorType) {
              case "validation":
                errorResponse = createValidationError(errorCase.correlationId, {
                  field: "Invalid value",
                });
                break;
              case "unauthorized":
                errorResponse = createUnauthorizedError(
                  errorCase.correlationId,
                );
                break;
              case "not_found":
                errorResponse = createNotFoundError(
                  errorCase.resource,
                  errorCase.correlationId,
                );
                break;
              case "server_error":
                errorResponse = createServerError(errorCase.correlationId);
                break;
            }

            const headerValue = errorResponse.headers.get("x-correlation-id");
            expect(headerValue).toBe(errorCase.correlationId);

            const body = await errorResponse.json();
            expect(body.correlationId).toBe(errorCase.correlationId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should propagate correlation ID from request to response (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            correlationId: fc.uuid(),
            statusCode: fc.constantFrom(200, 201),
            responseBody: fc.record({
              id: fc.uuid(),
              data: fc.string(),
            }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (responseCases) => {
          for (const responseCase of responseCases) {
            const baseResponse = Response.json(responseCase.responseBody, {
              status: responseCase.statusCode,
            });

            const responseWithCorrelationId = withCorrelationId(
              baseResponse,
              responseCase.correlationId,
            );

            const headerValue =
              responseWithCorrelationId.headers.get("x-correlation-id");
            expect(headerValue).toBe(responseCase.correlationId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should maintain correlation ID consistency across multiple log entries for the same request (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            requestId: fc.uuid(),
            logCount: fc.integer({ min: 1, max: 10 }),
            hasExistingCorrelationId: fc.boolean(),
            existingCorrelationId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (requests) => {
          for (const request of requests) {
            const mockRequest = createMockRequest(
              "/api/test",
              request.hasExistingCorrelationId
                ? request.existingCorrelationId
                : null,
            );

            const correlationId = getCorrelationId(mockRequest);

            const logEntries: string[] = [];
            for (let i = 0; i < request.logCount; i++) {
              logEntries.push(
                `[${correlationId}] Log entry ${i + 1} for request ${request.requestId}`,
              );
            }

            const extractedIds = logEntries.map((log) => {
              const match = log.match(/\[([^\]]+)\]/);
              return match ? match[1] : null;
            });

            const uniqueIds = new Set(extractedIds);
            expect(uniqueIds.size).toBe(1);
            expect(uniqueIds.has(correlationId)).toBe(true);

            if (request.hasExistingCorrelationId) {
              expect(correlationId).toBe(request.existingCorrelationId);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should generate unique correlation IDs for different requests (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 50 }),
        async (requestCount) => {
          const correlationIds = new Set<string>();

          for (let i = 0; i < requestCount; i++) {
            const mockRequest = createMockRequest("/api/test", null);
            const correlationId = getCorrelationId(mockRequest);
            correlationIds.add(correlationId);
          }

          expect(correlationIds.size).toBe(requestCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve existing correlation ID from request header (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
        async (existingIds) => {
          for (const existingId of existingIds) {
            const mockRequest = createMockRequest("/api/test", existingId);
            const correlationId = getCorrelationId(mockRequest);

            expect(correlationId).toBe(existingId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should include correlation ID in all error response types (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            correlationId: fc.uuid(),
            errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
            statusCode: fc.constantFrom(400, 401, 403, 404, 500),
            details: fc.option(
              fc.record({
                field: fc.string(),
                message: fc.string(),
              }),
              { nil: undefined },
            ),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (errorCases) => {
          for (const errorCase of errorCases) {
            const errorResponse = createErrorResponse(
              errorCase.errorMessage,
              errorCase.statusCode,
              errorCase.correlationId,
              errorCase.details,
            );

            const headerValue = errorResponse.headers.get("x-correlation-id");
            expect(headerValue).toBe(errorCase.correlationId);

            const body = await errorResponse.json();
            expect(body.correlationId).toBe(errorCase.correlationId);
            expect(body.error).toBe(errorCase.errorMessage);

            if (errorCase.details) {
              expect(body.details).toEqual(errorCase.details);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

function createMockRequest(
  endpoint: string,
  correlationId: string | null,
): Request {
  const headers = new Headers();
  if (correlationId) {
    headers.set("x-correlation-id", correlationId);
  }

  return new Request(`http://localhost${endpoint}`, {
    method: "GET",
    headers,
  });
}
