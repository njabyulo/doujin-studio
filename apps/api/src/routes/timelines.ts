import {
  and,
  createDb,
  eq,
} from "@doujin/database";
import { timeline, timelineVersion } from "@doujin/database/schema";
import {
  SSaveTimelineVersionRequest,
  STimelineVersionSource,
} from "@doujin/core";
import { Hono } from "hono";
import { ApiError } from "../errors";
import {
  requireLatestTimelineVersion,
  requireTimelineMembership,
  validateTimelineAssetReferences,
} from "../lib/timeline-access";
import { toTTimelineWithLatestResponse } from "../lib/timeline-response";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

function throwTimelineConflict() {
  throw new ApiError(400, "BAD_REQUEST", "Timeline version conflict");
}

function resolveTimelineSource(
  requested: string | undefined,
  fallback: "autosave" | "manual",
) {
  const source = requested ?? fallback;
  const parsed = STimelineVersionSource.safeParse(source);
  if (!parsed.success) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid timeline payload");
  }

  return parsed.data;
}

export function createTimelineRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/:id", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const db = createDb(c.env.DB);
    const timelineId = c.req.param("id");
    const foundTimeline = await requireTimelineMembership(db, timelineId, user.id);
    const latestVersion = await requireLatestTimelineVersion(db, timelineId);
    return c.json(
      toTTimelineWithLatestResponse(foundTimeline, latestVersion),
      200,
    );
  });

  app.patch("/:id", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Invalid timeline payload");
    }

    const input = SSaveTimelineVersionRequest.parse(body);
    const db = createDb(c.env.DB);
    const timelineId = c.req.param("id");
    const foundTimeline = await requireTimelineMembership(db, timelineId, user.id);

    if (foundTimeline.latestVersion !== input.baseVersion) {
      throwTimelineConflict();
    }

    await validateTimelineAssetReferences(db, foundTimeline.projectId, input.data);
    const nextVersion = input.baseVersion + 1;
    const nextSource = resolveTimelineSource(input.source, "autosave");

    try {
      await db.insert(timelineVersion).values({
        id: crypto.randomUUID(),
        timelineId: foundTimeline.id,
        version: nextVersion,
        source: nextSource,
        createdByUserId: user.id,
        data: input.data,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throwTimelineConflict();
      }

      throw error;
    }

    await db
      .update(timeline)
      .set({
        latestVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(timeline.id, foundTimeline.id),
          eq(timeline.latestVersion, input.baseVersion),
        ),
      );

    const refreshedTimeline = await requireTimelineMembership(db, timelineId, user.id);
    const latestVersion = await requireLatestTimelineVersion(db, timelineId);

    return c.json(
      toTTimelineWithLatestResponse(refreshedTimeline, latestVersion),
      200,
    );
  });

  app.post("/:id/versions", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Invalid timeline payload");
    }

    const input = SSaveTimelineVersionRequest.parse(body);
    const db = createDb(c.env.DB);
    const timelineId = c.req.param("id");
    const foundTimeline = await requireTimelineMembership(db, timelineId, user.id);

    if (foundTimeline.latestVersion !== input.baseVersion) {
      throwTimelineConflict();
    }

    await validateTimelineAssetReferences(db, foundTimeline.projectId, input.data);
    const nextVersion = input.baseVersion + 1;
    const nextSource = resolveTimelineSource(input.source, "manual");

    try {
      await db.insert(timelineVersion).values({
        id: crypto.randomUUID(),
        timelineId: foundTimeline.id,
        version: nextVersion,
        source: nextSource,
        createdByUserId: user.id,
        data: input.data,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throwTimelineConflict();
      }

      throw error;
    }

    await db
      .update(timeline)
      .set({
        latestVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(timeline.id, foundTimeline.id),
          eq(timeline.latestVersion, input.baseVersion),
        ),
      );

    const refreshedTimeline = await requireTimelineMembership(db, timelineId, user.id);
    const latestVersion = await requireLatestTimelineVersion(db, timelineId);

    return c.json(
      toTTimelineWithLatestResponse(refreshedTimeline, latestVersion),
      200,
    );
  });

  return app;
}
