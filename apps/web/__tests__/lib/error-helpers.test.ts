import { describe, expect, it } from "vitest";
import {
  createErrorResponse,
  createForbiddenError,
  createNotFoundError,
  createRateLimitError,
  createServerError,
  createUnauthorizedError,
  createValidationError,
} from "~/lib/error-helpers";

describe("error-helpers", () => {
  const correlationId = "test-correlation-id";

  describe("createErrorResponse", () => {
    it("should return error response with correct status and correlation ID", async () => {
      const response = createErrorResponse("Test error", 400, correlationId);

      expect(response.status).toBe(400);
      expect(response.headers.get("x-correlation-id")).toBe(correlationId);

      const body = await response.json();
      expect(body).toEqual({
        error: "Test error",
        correlationId,
      });
    });

    it("should include details when provided", async () => {
      const details = { field: "value" };
      const response = createErrorResponse(
        "Test error",
        400,
        correlationId,
        details,
      );

      const body = await response.json();
      expect(body).toEqual({
        error: "Test error",
        correlationId,
        details,
      });
    });
  });

  describe("createValidationError", () => {
    it("should return 400 status with validation details", async () => {
      const details = { email: "Invalid email format" };
      const response = createValidationError(correlationId, details);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Validation failed");
      expect(body.details).toEqual(details);
    });
  });

  describe("createUnauthorizedError", () => {
    it("should return 401 status", async () => {
      const response = createUnauthorizedError(correlationId);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });
  });

  describe("createForbiddenError", () => {
    it("should return 403 status", async () => {
      const response = createForbiddenError(correlationId);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Forbidden");
    });
  });

  describe("createNotFoundError", () => {
    it("should return 404 status with resource name", async () => {
      const response = createNotFoundError("Project", correlationId);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Project not found");
    });
  });

  describe("createRateLimitError", () => {
    it("should return 429 status with retry-after header", async () => {
      const retryAfter = 60;
      const response = createRateLimitError(retryAfter, correlationId);

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.headers.get("x-correlation-id")).toBe(correlationId);

      const body = await response.json();
      expect(body.error).toBe("Rate limit exceeded");
      expect(body.retryAfter).toBe(60);
    });
  });

  describe("createServerError", () => {
    it("should return 500 status", async () => {
      const response = createServerError(correlationId);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Internal server error");
    });
  });
});
