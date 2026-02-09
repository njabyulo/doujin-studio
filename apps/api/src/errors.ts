import {
  apiErrorSchema,
  type ApiErrorCode,
  type ApiErrorResponse,
} from "@doujin/contracts";

export type ApiErrorStatus = 400 | 401 | 404 | 429 | 500;

export class ApiError extends Error {
  public readonly status: ApiErrorStatus;
  public readonly code: ApiErrorCode;

  constructor(status: ApiErrorStatus, code: ApiErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(500, "INTERNAL_ERROR", "Internal server error");
}

export function createApiErrorBody(
  code: ApiErrorCode,
  message: string,
  requestId: string,
): ApiErrorResponse {
  return apiErrorSchema.parse({
    error: {
      code,
      message,
      requestId,
    },
  });
}
