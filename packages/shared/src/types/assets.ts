import { z } from "zod";

export const SAssetType = z.enum(["video", "poster"]);

export const SAssetStatus = z.enum([
  "pending_upload",
  "uploaded",
  "upload_failed",
]);

export const SCreateAssetUploadSessionRequest = z.object({
  fileName: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  type: SAssetType,
});

export const SAssetUploadSessionResponse = z.object({
  assetId: z.string().min(1),
  putUrl: z.string().url(),
  r2Key: z.string().min(1),
});

export const SCompleteAssetUploadRequest = z.object({
  size: z.number().int().nonnegative(),
  checksumSha256: z.string().trim().min(1).max(255).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  posterAssetId: z.string().min(1).optional(),
});

export const SAsset = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: SAssetType,
  status: SAssetStatus,
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

export const SAssetResponse = z.object({
  asset: SAsset,
});

export const SProjectAssetListResponse = z.object({
  assets: z.array(SAsset),
});

export type TAssetType = z.infer<typeof SAssetType>;
export type TAssetStatus = z.infer<typeof SAssetStatus>;
export type TCreateAssetUploadSessionRequest = z.infer<
  typeof SCreateAssetUploadSessionRequest
>;
export type TAssetUploadSessionResponse = z.infer<
  typeof SAssetUploadSessionResponse
>;
export type TCompleteAssetUploadRequest = z.infer<
  typeof SCompleteAssetUploadRequest
>;
export type TAsset = z.infer<typeof SAsset>;
export type TAssetResponse = z.infer<typeof SAssetResponse>;
export type TProjectAssetListResponse = z.infer<
  typeof SProjectAssetListResponse
>;
