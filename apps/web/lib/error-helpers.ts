export function createErrorResponse(
  error: string,
  status: number,
  correlationId: string,
  details?: Record<string, unknown>,
) {
  const response: Record<string, unknown> = { error, correlationId };
  if (details) response.details = details;

  return Response.json(response, {
    status,
    headers: { "x-correlation-id": correlationId },
  });
}

export function createValidationError(
  correlationId: string,
  details: Record<string, unknown>,
) {
  return createErrorResponse("Validation failed", 400, correlationId, details);
}

export function createUnauthorizedError(correlationId: string) {
  return createErrorResponse("Unauthorized", 401, correlationId);
}

export function createForbiddenError(correlationId: string) {
  return createErrorResponse("Forbidden", 403, correlationId);
}

export function createNotFoundError(resource: string, correlationId: string) {
  return createErrorResponse(`${resource} not found`, 404, correlationId);
}

export function createRateLimitError(
  retryAfter: number,
  correlationId: string,
) {
  const body = {
    error: "Rate limit exceeded",
    retryAfter,
    correlationId,
  };

  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      "Retry-After": retryAfter.toString(),
      "Content-Type": "application/json",
      "x-correlation-id": correlationId,
    },
  });
}

export function createServerError(correlationId: string) {
  return createErrorResponse("Internal server error", 500, correlationId);
}
