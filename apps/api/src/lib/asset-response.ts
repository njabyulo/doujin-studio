import { assetSchema } from "@doujin/contracts";

export type AssetRecord = {
  id: string;
  projectId: string;
  type: "video" | "poster";
  status: "pending_upload" | "uploaded" | "upload_failed";
  r2Key: string;
  size: number;
  mime: string;
  checksumSha256: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  posterAssetId: string | null;
  createdAt: Date;
};

export function toAssetResponse(record: AssetRecord) {
  return assetSchema.parse({
    id: record.id,
    projectId: record.projectId,
    type: record.type,
    status: record.status,
    r2Key: record.r2Key,
    size: record.size,
    mime: record.mime,
    checksumSha256: record.checksumSha256,
    durationMs: record.durationMs,
    width: record.width,
    height: record.height,
    posterAssetId: record.posterAssetId,
    createdAt: record.createdAt.getTime(),
    fileUrl: `/api/assets/${record.id}/file`,
    posterUrl: record.posterAssetId
      ? `/api/assets/${record.posterAssetId}/file`
      : null,
  });
}
