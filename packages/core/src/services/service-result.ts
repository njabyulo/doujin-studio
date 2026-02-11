import type { TApiErrorCode } from "@doujin/shared/types";

export type TServiceOkResult<TData> = {
  ok: true;
  data: TData;
  headers?: Record<string, string>;
};

export type TServiceErrorResult = {
  ok: false;
  status: number;
  code: TApiErrorCode;
  message: string;
  headers?: Record<string, string>;
};

export type TServiceResult<TData> =
  | TServiceOkResult<TData>
  | TServiceErrorResult;
