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
  SAssetStatus,
  SAssetType,
  SCreateTimelineRequest,
  SCreateProjectRequest,
  SProjectAssetListResponse,
  SProjectListResponse,
  SProjectResponse,
  STimelineData
} from "@doujin/core";
import { Hono } from "hono";
import { ApiError } from "../errors";
import { toTAssetResponse } from "../lib/asset-response";
import { requireProjectMembership } from "../lib/project-access";
import { requireLatestTimelineVersion } from "../lib/timeline-access";
import { toTTimelineWithLatestResponse } from "../lib/timeline-response";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

const DEFAULT_TIMELINE_NAME = "Main Timeline";
const DEFAULT_TIMELINE_DURATION_MS = 10_000;

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

    const input = SCreateProjectRequest.parse(body);
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
      SProjectResponse.parse({
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

    return c.json(SProjectListResponse.parse({ projects }), 200);
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
      SProjectResponse.parse({
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

    const input = SCreateTimelineRequest.parse(body);
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
      return c.json(
        toTTimelineWithLatestResponse(existingTimeline, latestVersion),
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
    const initialData = STimelineData.parse({
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
        }),
      ]);
    } catch (error) {
      // ignore unique constraint
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
    return c.json(
      toTTimelineWithLatestResponse(createdTimeline, latestVersion),
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
    return c.json(
      toTTimelineWithLatestResponse(foundTimeline, latestVersion),
      200,
    );
  });

  // upload-session route removed as R2 is deprecated

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
      ? SAssetType.safeParse(requestedType).data
      : null;
    const status = requestedStatus
      ? SAssetStatus.safeParse(requestedStatus).data
      : null;

    const db = createDb(c.env.DB);
    await requireProjectMembership(db, projectId, user.id);

    const filters = [eq(asset.projectId, projectId)];
    if (type) {
      filters.push(eq(asset.type, type));
    }
    if (status) {
      filters.push(eq(asset.status, status));
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
      SProjectAssetListResponse.parse({
        assets: assets.map(toTAssetResponse),
      }),
      200,
    );
  });

  return app;
}
