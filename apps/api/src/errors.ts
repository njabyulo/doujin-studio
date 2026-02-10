import {
  SApiError,
  type TApiErrorCode,
  type TApiErrorResponse,
} from "@doujin/core";

export type ApiErrorStatus = 400 | 401 | 404 | 429 | 500;

export class ApiError extends Error {
  public readonly status: ApiErrorStatus;
  public readonly code: TApiErrorCode;

  constructor(status: ApiErrorStatus, code: TApiErrorCode, message: string) {
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
  code: TApiErrorCode,
  message: string,
  requestId: string,
): TApiErrorResponse {
  return SApiError.parse({
    error: {
      code,
      message,
      requestId,
    },
  });
}
