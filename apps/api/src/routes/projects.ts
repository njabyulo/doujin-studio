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
  timeline,
  timelineVersion,
} from "@doujin/database/schema";
import {
  assetStatusSchema,
  assetTypeSchema,
  assetUploadSessionResponseSchema,
  deriveEdlFromTimelineData,
  createTimelineRequestSchema,
  createAssetUploadSessionRequestSchema,
  createProjectRequestSchema,
  projectAssetListResponseSchema,
  projectListResponseSchema,
  projectResponseSchema,
  timelineDataSchema,
} from "@doujin/contracts";
import { Hono } from "hono";
import { ApiError } from "../errors";
import { toAssetResponse } from "../lib/asset-response";
import { resolveEdlForTimelineVersion, toStoredEdlData } from "../lib/edl-access";
import { requireProjectMembership } from "../lib/project-access";
import { createR2PresignedPutUrl } from "../lib/r2-presign";
import { requireLatestTimelineVersion } from "../lib/timeline-access";
import { toTimelineWithLatestResponse } from "../lib/timeline-response";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

const DEFAULT_TIMELINE_NAME = "Main Timeline";
const DEFAULT_TIMELINE_DURATION_MS = 10_000;

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

async function parseCreateTimelineInput(rawBody: unknown) {
  const parsed = createTimelineRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid timeline payload");
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

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
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

  app.post("/:id/timelines", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    let body: unknown = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const input = await parseCreateTimelineInput(body);
    const projectId = c.req.param("id");
    const db = createDb(c.env.DB);
    await requireProjectMembership(db, projectId, user.id);

    const [existingTimeline] = await db
      .select({
        id: timeline.id,
        projectId: timeline.projectId,
        name: timeline.name,
        latestVersion: timeline.latestVersion,
        createdAt: timeline.createdAt,
        updatedAt: timeline.updatedAt,
      })
      .from(timeline)
      .where(eq(timeline.projectId, projectId))
      .limit(1);

    if (existingTimeline) {
      const latestVersion = await requireLatestTimelineVersion(db, existingTimeline.id);
      const latestEdl = resolveEdlForTimelineVersion({
        timelineId: latestVersion.timelineId,
        version: latestVersion.version,
        source: latestVersion.source,
        data: latestVersion.data,
        edlData: latestVersion.edlData,
      });
      return c.json(
        toTimelineWithLatestResponse(existingTimeline, latestVersion, {
          latestEdl,
        }),
        200,
      );
    }

    let seedDurationMs: number | null = null;
    let seedAssetId: string | null = null;
    if (input.seedAssetId) {
      const [seedAsset] = await db
        .select({
          id: asset.id,
          durationMs: asset.durationMs,
          status: asset.status,
        })
        .from(asset)
        .where(and(eq(asset.id, input.seedAssetId), eq(asset.projectId, projectId)))
        .limit(1);

      if (!seedAsset || seedAsset.status !== "uploaded") {
        throw new ApiError(400, "BAD_REQUEST", "Invalid seed asset");
      }

      seedAssetId = seedAsset.id;
      seedDurationMs =
        seedAsset.durationMs && seedAsset.durationMs > 0
          ? seedAsset.durationMs
          : DEFAULT_TIMELINE_DURATION_MS;
    }

    const timelineId = crypto.randomUUID();
    const videoTrackId = crypto.randomUUID();
    const subtitleTrackId = crypto.randomUUID();
    const initialDurationMs = seedDurationMs ?? DEFAULT_TIMELINE_DURATION_MS;
    const initialData = timelineDataSchema.parse({
      schemaVersion: 1,
      fps: 30,
      durationMs: initialDurationMs,
      tracks: [
        {
          id: videoTrackId,
          kind: "video",
          name: "Video",
          clips: seedAssetId
            ? [
                {
                  id: crypto.randomUUID(),
                  type: "video",
                  trackId: videoTrackId,
                  assetId: seedAssetId,
                  startMs: 0,
                  endMs: initialDurationMs,
                  sourceStartMs: 0,
                  volume: 1,
                  text: null,
                },
              ]
            : [],
        },
        {
          id: subtitleTrackId,
          kind: "subtitle",
          name: "Subtitles",
          clips: [],
        },
      ],
    });
    const initialEdl = deriveEdlFromTimelineData({
      timelineId,
      baseVersion: 1,
      data: initialData,
      source: "system",
    });

    try {
      await db.batch([
        db.insert(timeline).values({
          id: timelineId,
          projectId,
          name: input.name ?? DEFAULT_TIMELINE_NAME,
          latestVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        db.insert(timelineVersion).values({
          id: crypto.randomUUID(),
          timelineId,
          version: 1,
          source: "system",
          createdByUserId: user.id,
          data: initialData,
          edlData: toStoredEdlData(initialEdl),
        }),
      ]);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }

    const [createdTimeline] = await db
      .select({
        id: timeline.id,
        projectId: timeline.projectId,
        name: timeline.name,
        latestVersion: timeline.latestVersion,
        createdAt: timeline.createdAt,
        updatedAt: timeline.updatedAt,
      })
      .from(timeline)
      .where(eq(timeline.projectId, projectId))
      .limit(1);

    if (!createdTimeline) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to create timeline");
    }

    const latestVersion = await requireLatestTimelineVersion(db, createdTimeline.id);
    const latestEdl = resolveEdlForTimelineVersion({
      timelineId: latestVersion.timelineId,
      version: latestVersion.version,
      source: latestVersion.source,
      data: latestVersion.data,
      edlData: latestVersion.edlData,
    });
    return c.json(
      toTimelineWithLatestResponse(createdTimeline, latestVersion, {
        latestEdl,
      }),
      201,
    );
  });

  app.get("/:id/timelines/latest", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const projectId = c.req.param("id");
    const db = createDb(c.env.DB);
    await requireProjectMembership(db, projectId, user.id);

    const [foundTimeline] = await db
      .select({
        id: timeline.id,
        projectId: timeline.projectId,
        name: timeline.name,
        latestVersion: timeline.latestVersion,
        createdAt: timeline.createdAt,
        updatedAt: timeline.updatedAt,
      })
      .from(timeline)
      .where(eq(timeline.projectId, projectId))
      .limit(1);

    if (!foundTimeline) {
      throw new ApiError(404, "NOT_FOUND", "Timeline not found");
    }

    const latestVersion = await requireLatestTimelineVersion(db, foundTimeline.id);
    const latestEdl = resolveEdlForTimelineVersion({
      timelineId: latestVersion.timelineId,
      version: latestVersion.version,
      source: latestVersion.source,
      data: latestVersion.data,
      edlData: latestVersion.edlData,
    });
    return c.json(
      toTimelineWithLatestResponse(foundTimeline, latestVersion, {
        latestEdl,
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
