import {
  timelineSchema,
  timelineVersionSchema,
  timelineWithLatestResponseSchema,
  type TimelineData,
  type TimelineVersionSource,
} from "@doujin/contracts";

type Timestamp = Date | number;

export type TimelineRecord = {
  id: string;
  projectId: string;
  name: string;
  latestVersion: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TimelineVersionRecord = {
  id: string;
  timelineId: string;
  version: number;
  source: TimelineVersionSource;
  createdByUserId: string;
  createdAt: Timestamp;
  data: TimelineData;
};

function toTimestamp(value: Timestamp) {
  return value instanceof Date ? value.getTime() : value;
}

export function toTimelineResponse(record: TimelineRecord) {
  return timelineSchema.parse({
    id: record.id,
    projectId: record.projectId,
    name: record.name,
    latestVersion: record.latestVersion,
    createdAt: toTimestamp(record.createdAt),
    updatedAt: toTimestamp(record.updatedAt),
  });
}

export function toTimelineVersionResponse(record: TimelineVersionRecord) {
  return timelineVersionSchema.parse({
    id: record.id,
    timelineId: record.timelineId,
    version: record.version,
    source: record.source,
    createdByUserId: record.createdByUserId,
    createdAt: toTimestamp(record.createdAt),
    data: record.data,
  });
}

export function toTimelineWithLatestResponse(
  timeline: TimelineRecord,
  latestVersion: TimelineVersionRecord,
) {
  return timelineWithLatestResponseSchema.parse({
    timeline: toTimelineResponse(timeline),
    latestVersion: toTimelineVersionResponse(latestVersion),
  });
}
