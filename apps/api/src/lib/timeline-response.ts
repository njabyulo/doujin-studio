import {
  STimeline,
  STimelineVersion,
  STimelineWithLatestResponse,
  type TTimelineData,
  type TTimelineVersionSource,
} from "@doujin/core";

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
  source: TTimelineVersionSource;
  createdByUserId: string;
  createdAt: Timestamp;
  data: TTimelineData;
};

function toTimestamp(value: Timestamp) {
  return value instanceof Date ? value.getTime() : value;
}

export function toTimelineResponse(record: TimelineRecord) {
  return STimeline.parse({
    id: record.id,
    projectId: record.projectId,
    name: record.name,
    latestVersion: record.latestVersion,
    createdAt: toTimestamp(record.createdAt),
    updatedAt: toTimestamp(record.updatedAt),
  });
}

export function toTimelineTVersionResponse(record: TimelineVersionRecord) {
  return STimelineVersion.parse({
    id: record.id,
    timelineId: record.timelineId,
    version: record.version,
    source: record.source,
    createdByUserId: record.createdByUserId,
    createdAt: toTimestamp(record.createdAt),
    data: record.data,
  });
}

export function toTTimelineWithLatestResponse(
  timeline: TimelineRecord,
  latestVersion: TimelineVersionRecord,
) {
  return STimelineWithLatestResponse.parse({
    timeline: toTimelineResponse(timeline),
    latestVersion: toTimelineTVersionResponse(latestVersion),
  });
}
