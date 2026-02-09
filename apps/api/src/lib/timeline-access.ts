import {
  and,
  createDb,
  desc,
  eq,
  inArray,
} from "@doujin/database";
import {
  asset,
  projectMember,
  timeline,
  timelineVersion,
} from "@doujin/database/schema";
import { timelineDataSchema, type TimelineData } from "@doujin/contracts";
import { ApiError } from "../errors";

type Database = ReturnType<typeof createDb>;

export async function requireTimelineMembership(
  db: Database,
  timelineId: string,
  userId: string,
) {
  const [row] = await db
    .select({
      id: timeline.id,
      projectId: timeline.projectId,
      name: timeline.name,
      latestVersion: timeline.latestVersion,
      createdAt: timeline.createdAt,
      updatedAt: timeline.updatedAt,
    })
    .from(timeline)
    .innerJoin(
      projectMember,
      and(
        eq(projectMember.projectId, timeline.projectId),
        eq(projectMember.userId, userId),
      ),
    )
    .where(eq(timeline.id, timelineId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Timeline not found");
  }

  return row;
}

export async function requireProjectTimelineMembership(
  db: Database,
  projectId: string,
  userId: string,
) {
  const [row] = await db
    .select({
      id: timeline.id,
      projectId: timeline.projectId,
      name: timeline.name,
      latestVersion: timeline.latestVersion,
      createdAt: timeline.createdAt,
      updatedAt: timeline.updatedAt,
    })
    .from(timeline)
    .innerJoin(
      projectMember,
      and(
        eq(projectMember.projectId, timeline.projectId),
        eq(projectMember.userId, userId),
      ),
    )
    .where(eq(timeline.projectId, projectId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Timeline not found");
  }

  return row;
}

export async function requireLatestTimelineVersion(
  db: Database,
  timelineId: string,
) {
  const [row] = await db
    .select({
      id: timelineVersion.id,
      timelineId: timelineVersion.timelineId,
      version: timelineVersion.version,
      source: timelineVersion.source,
      createdByUserId: timelineVersion.createdByUserId,
      createdAt: timelineVersion.createdAt,
      data: timelineVersion.data,
    })
    .from(timelineVersion)
    .where(eq(timelineVersion.timelineId, timelineId))
    .orderBy(desc(timelineVersion.version))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Timeline not found");
  }

  return {
    ...row,
    data: timelineDataSchema.parse(row.data),
  };
}

export function collectTimelineAssetIds(data: TimelineData) {
  const ids = new Set<string>();
  for (const track of data.tracks) {
    for (const clip of track.clips) {
      if (clip.assetId) {
        ids.add(clip.assetId);
      }
    }
  }

  return [...ids];
}

export async function validateTimelineAssetReferences(
  db: Database,
  projectId: string,
  data: TimelineData,
) {
  const referencedAssetIds = collectTimelineAssetIds(data);
  if (referencedAssetIds.length === 0) {
    return;
  }

  const rows = await db
    .select({
      id: asset.id,
      status: asset.status,
    })
    .from(asset)
    .where(
      and(
        eq(asset.projectId, projectId),
        inArray(asset.id, referencedAssetIds),
      ),
    );

  if (rows.length !== referencedAssetIds.length) {
    throw new ApiError(400, "BAD_REQUEST", "Timeline references invalid assets");
  }

  if (rows.some((row) => row.status !== "uploaded")) {
    throw new ApiError(
      400,
      "BAD_REQUEST",
      "Timeline references assets that are not uploaded",
    );
  }
}
