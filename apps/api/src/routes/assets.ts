import { and, createDb, eq } from "@doujin/database";
import { asset, projectMember } from "@doujin/database/schema";
import {
  assetResponseSchema,
  completeAssetUploadRequestSchema,
} from "@doujin/contracts";
import { Hono } from "hono";
import { ApiError } from "../errors";
import { toAssetResponse } from "../lib/asset-response";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

async function parseCompleteUploadInput(rawBody: unknown) {
  const parsed = completeAssetUploadRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid asset completion payload");
  }

  return parsed.data;
}

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

function parseRequestedRange(headerValue: string, totalSize: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(headerValue.trim());
  if (!match) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid range header");
  }

  const [, startRaw, endRaw] = match;

  if (!startRaw && !endRaw) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid range header");
  }

  if (!startRaw && endRaw) {
    const suffixLength = Number.parseInt(endRaw, 10);
    if (Number.isNaN(suffixLength) || suffixLength <= 0) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid range header");
    }

    const length = Math.min(suffixLength, totalSize);
    const start = totalSize - length;
    const end = totalSize - 1;
    return { start, end, length };
  }

  const parsedStart = Number.parseInt(startRaw, 10);
  const parsedEnd = endRaw ? Number.parseInt(endRaw, 10) : totalSize - 1;
  if (Number.isNaN(parsedStart) || Number.isNaN(parsedEnd)) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid range header");
  }

  const start = Math.max(0, parsedStart);
  const end = Math.min(totalSize - 1, parsedEnd);
  if (start > end || start >= totalSize) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid range header");
  }

  return { start, end, length: end - start + 1 };
}

export function createAssetRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/:id/complete", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Invalid asset completion payload");
    }

    const input = await parseCompleteUploadInput(body);
    const assetId = c.req.param("id");
    const db = createDb(c.env.DB);
    const currentAsset = await getAuthorizedAsset(db, assetId, user.id);
    const uploadedObject = await c.env.MEDIA_BUCKET.head(currentAsset.r2Key);

    if (!uploadedObject) {
      throw new ApiError(400, "BAD_REQUEST", "Uploaded object not found");
    }

    if (uploadedObject.size !== input.size) {
      throw new ApiError(400, "BAD_REQUEST", "Uploaded object size mismatch");
    }

    let posterAssetId: string | null = null;
    if (currentAsset.type === "video") {
      if (input.posterAssetId) {
        const [poster] = await db
          .select({
            id: asset.id,
          })
          .from(asset)
          .where(
            and(
              eq(asset.id, input.posterAssetId),
              eq(asset.projectId, currentAsset.projectId),
              eq(asset.type, "poster"),
              eq(asset.status, "uploaded"),
            ),
          )
          .limit(1);

        if (!poster) {
          throw new ApiError(400, "BAD_REQUEST", "Invalid poster asset");
        }

        posterAssetId = poster.id;
      }
    }

    await db
      .update(asset)
      .set({
        status: "uploaded",
        size: input.size,
        checksumSha256: input.checksumSha256 ?? null,
        durationMs: input.durationMs ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        posterAssetId,
      })
      .where(eq(asset.id, currentAsset.id));

    const updatedAsset = await getAuthorizedAsset(db, assetId, user.id);

    return c.json(
      assetResponseSchema.parse({
        asset: toAssetResponse(updatedAsset),
      }),
      200,
    );
  });

  app.get("/:id", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const db = createDb(c.env.DB);
    const foundAsset = await getAuthorizedAsset(db, c.req.param("id"), user.id);

    return c.json(
      assetResponseSchema.parse({
        asset: toAssetResponse(foundAsset),
      }),
      200,
    );
  });

  app.get("/:id/file", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const db = createDb(c.env.DB);
    const foundAsset = await getAuthorizedAsset(db, c.req.param("id"), user.id);
    const rangeHeader = c.req.header("range");
    const requestedRange = rangeHeader
      ? parseRequestedRange(rangeHeader, foundAsset.size)
      : null;
    const storageObject = await c.env.MEDIA_BUCKET.get(
      foundAsset.r2Key,
      requestedRange
        ? {
            range: {
              offset: requestedRange.start,
              length: requestedRange.length,
            },
          }
        : undefined,
    );

    if (!storageObject) {
      throw new ApiError(404, "NOT_FOUND", "Asset file not found");
    }

    const headers = new Headers();
    headers.set("accept-ranges", "bytes");
    headers.set("content-type", foundAsset.mime);
    headers.set("etag", storageObject.httpEtag);
    const responseBody = storageObject.body as unknown as BodyInit;

    if (requestedRange) {
      headers.set(
        "content-range",
        `bytes ${requestedRange.start}-${requestedRange.end}/${foundAsset.size}`,
      );
      headers.set("content-length", String(requestedRange.length));

      return new Response(responseBody, {
        status: 206,
        headers,
      });
    }

    headers.set("content-length", String(foundAsset.size));
    return new Response(responseBody, {
      status: 200,
      headers,
    });
  });

  return app;
}
