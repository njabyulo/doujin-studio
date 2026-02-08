import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "BAD_REQUEST",
  "NOT_FOUND",
  "INTERNAL_ERROR",
]);

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1),
  }),
});

export const healthResponseSchema = z.object({
  ok: z.literal(true),
});

export const versionResponseSchema = z.object({
  version: z.string().min(1),
  commitSha: z.string().min(1),
});

export const meUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

export const meTenantSchema = z.object({
  type: z.literal("user"),
  id: z.string().min(1),
});

export const meResponseSchema = z.object({
  user: meUserSchema,
  tenant: meTenantSchema,
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type VersionResponse = z.infer<typeof versionResponseSchema>;
export type MeUser = z.infer<typeof meUserSchema>;
export type MeTenant = z.infer<typeof meTenantSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
