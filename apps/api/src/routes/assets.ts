import { and, createDb, eq } from "@doujin/database";
import { asset, projectMember } from "@doujin/database/schema";
import {
  SAssetResponse,
} from "@doujin/core";
import { Hono } from "hono";
import { ApiError } from "../errors";
import { toTAssetResponse } from "../lib/asset-response";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

async function getAuthorizedAsset(
  db: ReturnType<typeof createDb>,
  assetId: string,
  userId: string,
) {
  const [row] = await db
    .select({
      id: asset.id,
      projectId: asset.projectId,
      type: asset.type,
      status: asset.status,
      r2Key: asset.r2Key,
      size: asset.size,
      mime: asset.mime,
      checksumSha256: asset.checksumSha256,
      durationMs: asset.durationMs,
      width: asset.width,
      height: asset.height,
      posterAssetId: asset.posterAssetId,
      createdAt: asset.createdAt,
    })
    .from(asset)
    .innerJoin(
      projectMember,
      and(
        eq(projectMember.projectId, asset.projectId),
        eq(projectMember.userId, userId),
      ),
    )
    .where(eq(asset.id, assetId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Asset not found");
  }

  return row;
}

export function createAssetRoutes() {
  const app = new Hono<AppEnv>();

  // complete route removed as R2 is deprecated

  app.get("/:id", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const db = createDb(c.env.DB);
    const foundAsset = await getAuthorizedAsset(db, c.req.param("id"), user.id);

    return c.json(
      SAssetResponse.parse({
        asset: toTAssetResponse(foundAsset),
      }),
      200,
    );
  });

  // file proxy route removed as R2 is deprecated

  return app;
}
