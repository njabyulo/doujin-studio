import {
  createDb,
  desc,
  eq,
  and,
} from "@doujin/database";
import {
  asset,
  project,
  projectMember,
} from "@doujin/database/schema";
import {
  assetStatusSchema,
  assetTypeSchema,
  assetUploadSessionResponseSchema,
  createAssetUploadSessionRequestSchema,
  createProjectRequestSchema,
  projectAssetListResponseSchema,
  projectListResponseSchema,
  projectResponseSchema,
} from "@doujin/contracts";
import { Hono } from "hono";
import { ApiError } from "../errors";
import { toAssetResponse } from "../lib/asset-response";
import { requireProjectMembership } from "../lib/project-access";
import { createR2PresignedPutUrl } from "../lib/r2-presign";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

async function parseCreateProjectInput(rawBody: unknown) {
  const parsed = createProjectRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid project payload");
  }

  return parsed.data;
}

async function parseUploadSessionInput(rawBody: unknown) {
  const parsed = createAssetUploadSessionRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid asset upload payload");
  }

  return parsed.data;
}

function sanitizeFileName(value: string) {
  const trimmed = value.trim();
  const stripped = trimmed.replace(/[^\w.\-]+/g, "_");
  const normalized = stripped.replace(/_+/g, "_");
  return normalized || `upload-${Date.now()}`;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid assets query");
  }

  return value;
}

export function createProjectRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Invalid project payload");
    }

    const input = await parseCreateProjectInput(body);
    const db = createDb(c.env.DB);
    const projectId = crypto.randomUUID();

    await db.batch([
      db.insert(project).values({
        id: projectId,
        userId: user.id,
        title: input.title,
      }),
      db.insert(projectMember).values({
        projectId,
        userId: user.id,
        role: "owner",
      }),
    ]);

    return c.json(
      projectResponseSchema.parse({
        project: {
          id: projectId,
          title: input.title,
          role: "owner",
        },
      }),
      201,
    );
  });

  app.get("/", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const db = createDb(c.env.DB);
    const projects = await db
      .select({
        id: project.id,
        title: project.title,
        role: projectMember.role,
      })
      .from(projectMember)
      .innerJoin(project, eq(projectMember.projectId, project.id))
      .where(eq(projectMember.userId, user.id))
      .orderBy(desc(project.updatedAt));

    return c.json(projectListResponseSchema.parse({ projects }), 200);
  });

  app.get("/:id", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const id = c.req.param("id");
    const db = createDb(c.env.DB);
    const membership = await requireProjectMembership(db, id, user.id);
    const [projectRow] = await db
      .select({
        id: project.id,
        title: project.title,
      })
      .from(project)
      .where(eq(project.id, id))
      .limit(1);

    if (!projectRow) {
      throw new ApiError(404, "NOT_FOUND", "Project not found");
    }

    return c.json(
      projectResponseSchema.parse({
        project: {
          ...projectRow,
          role: membership.role,
        },
      }),
      200,
    );
  });

  app.post("/:id/assets/upload-session", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const projectId = c.req.param("id");
    const db = createDb(c.env.DB);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Invalid asset upload payload");
    }

    const input = await parseUploadSessionInput(body);
    await requireProjectMembership(db, projectId, user.id);

    const assetId = crypto.randomUUID();
    const safeFileName = sanitizeFileName(input.fileName);
    const r2Key = `projects/${projectId}/assets/${assetId}/${safeFileName}`;

    await db.insert(asset).values({
      id: assetId,
      projectId,
      type: input.type,
      status: "pending_upload",
      r2Key,
      size: input.size,
      mime: input.mime,
    });

    const putUrl = await createR2PresignedPutUrl(c.env, r2Key, input.mime);

    return c.json(
      assetUploadSessionResponseSchema.parse({
        assetId,
        putUrl,
        r2Key,
      }),
      201,
    );
  });

  app.get("/:id/assets", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const projectId = c.req.param("id");
    const requestedType = c.req.query("type");
    const requestedStatus = c.req.query("status");
    const limit = parsePositiveInt(c.req.query("limit"), 50);

    const type = requestedType
      ? assetTypeSchema.safeParse(requestedType)
      : null;
    if (requestedType && !type?.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid assets query");
    }

    const status = requestedStatus
      ? assetStatusSchema.safeParse(requestedStatus)
      : null;
    if (requestedStatus && !status?.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid assets query");
    }

    const db = createDb(c.env.DB);
    await requireProjectMembership(db, projectId, user.id);

    const filters = [eq(asset.projectId, projectId)];
    if (type?.success) {
      filters.push(eq(asset.type, type.data));
    }
    if (status?.success) {
      filters.push(eq(asset.status, status.data));
    }

    const assets = await db
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
      .where(and(...filters))
      .orderBy(desc(asset.createdAt))
      .limit(limit);

    return c.json(
      projectAssetListResponseSchema.parse({
        assets: assets.map(toAssetResponse),
      }),
      200,
    );
  });

  return app;
}
