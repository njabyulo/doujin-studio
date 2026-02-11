import {
  SApiError,
  type TApiErrorCode,
  type TApiErrorResponse,
} from "@doujin/shared/types";

export type ApiErrorStatus = 400 | 401 | 404 | 429 | 500 | 503;

export class ApiError extends Error {
  public readonly status: ApiErrorStatus;
  public readonly code: TApiErrorCode;

  constructor(status: ApiErrorStatus, code: TApiErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const normalizeApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(500, "INTERNAL_ERROR", "Internal server error");
};

export const createApiErrorBody = (
  code: TApiErrorCode,
  message: string,
  requestId: string,
): TApiErrorResponse => {
  return SApiError.parse({
    error: {
      code,
      message,
      requestId,
    },
  });
};
