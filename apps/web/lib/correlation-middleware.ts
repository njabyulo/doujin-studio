import { randomUUID } from "crypto";

const CORRELATION_ID_HEADER = "x-correlation-id";

export function generateCorrelationId(): string {
  return randomUUID();
}

export function getCorrelationId(request: Request): string {
  const existingId = request.headers.get(CORRELATION_ID_HEADER);
  return existingId || generateCorrelationId();
}

export function withCorrelationId(
  response: Response,
  correlationId: string,
): Response {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}
