import { z } from "zod";

export const SApiErrorCode = z.enum([
  "UNAUTHORIZED",
  "BAD_REQUEST",
  "NOT_FOUND",
  "RATE_LIMITED",
  "AI_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

export const SApiError = z.object({
  error: z.object({
    code: SApiErrorCode,
    message: z.string().min(1),
    requestId: z.string().min(1),
  }),
});

export const SHealthResponse = z.object({
  ok: z.literal(true),
});

export const SVersionResponse = z.object({
  version: z.string().min(1),
  commitSha: z.string().min(1),
});

export const SMeUser = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

export const SMeTenant = z.object({
  type: z.literal("user"),
  id: z.string().min(1),
});

export const SMeResponse = z.object({
  user: SMeUser,
  tenant: SMeTenant,
});

export type TApiErrorCode = z.infer<typeof SApiErrorCode>;
export type TApiErrorResponse = z.infer<typeof SApiError>;
export type THealthResponse = z.infer<typeof SHealthResponse>;
export type TVersionResponse = z.infer<typeof SVersionResponse>;
export type TMeUser = z.infer<typeof SMeUser>;
export type TMeTenant = z.infer<typeof SMeTenant>;
export type TMeResponse = z.infer<typeof SMeResponse>;
