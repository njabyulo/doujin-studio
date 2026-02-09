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

export const assetTypeSchema = z.enum(["video", "poster"]);

export const assetStatusSchema = z.enum([
  "pending_upload",
  "uploaded",
  "upload_failed",
]);

export const createAssetUploadSessionRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  type: assetTypeSchema,
});

export const assetUploadSessionResponseSchema = z.object({
  assetId: z.string().min(1),
  putUrl: z.string().url(),
  r2Key: z.string().min(1),
});

export const completeAssetUploadRequestSchema = z.object({
  size: z.number().int().nonnegative(),
  checksumSha256: z.string().trim().min(1).max(255).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  posterAssetId: z.string().min(1).optional(),
});

export const assetSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: assetTypeSchema,
  status: assetStatusSchema,
  r2Key: z.string().min(1),
  size: z.number().int().nonnegative(),
  mime: z.string().min(1),
  checksumSha256: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  posterAssetId: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  fileUrl: z.string().min(1),
  posterUrl: z.string().nullable(),
});

export const assetResponseSchema = z.object({
  asset: assetSchema,
});

export const projectAssetListResponseSchema = z.object({
  assets: z.array(assetSchema),
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
export type AssetType = z.infer<typeof assetTypeSchema>;
export type AssetStatus = z.infer<typeof assetStatusSchema>;
export type CreateAssetUploadSessionRequest = z.infer<
  typeof createAssetUploadSessionRequestSchema
>;
export type AssetUploadSessionResponse = z.infer<
  typeof assetUploadSessionResponseSchema
>;
export type CompleteAssetUploadRequest = z.infer<
  typeof completeAssetUploadRequestSchema
>;
export type Asset = z.infer<typeof assetSchema>;
export type AssetResponse = z.infer<typeof assetResponseSchema>;
export type ProjectAssetListResponse = z.infer<typeof projectAssetListResponseSchema>;
