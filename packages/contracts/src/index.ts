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

export const projectRoleSchema = z.enum(["owner"]);

export const createProjectRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  role: projectRoleSchema,
});

export const projectListResponseSchema = z.object({
  projects: z.array(projectSchema),
});

export const projectResponseSchema = z.object({
  project: projectSchema,
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type VersionResponse = z.infer<typeof versionResponseSchema>;
export type MeUser = z.infer<typeof meUserSchema>;
export type MeTenant = z.infer<typeof meTenantSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type ProjectRole = z.infer<typeof projectRoleSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
