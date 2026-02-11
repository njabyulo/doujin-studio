import { z } from "zod";

export const STimelineTrackKind = z.enum(["video", "audio", "subtitle"]);

export const STimelineClipType = z.enum(["video", "audio", "subtitle"]);

export const STimelineVersionSource = z.enum([
  "system",
  "autosave",
  "manual",
  "ai",
]);

export const STimelineClip = z
  .object({
    id: z.string().min(1),
    type: STimelineClipType,
    trackId: z.string().min(1),
    assetId: z.string().min(1).nullable(),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    sourceStartMs: z.number().int().nonnegative(),
    volume: z.number().min(0).max(2).nullable(),
    text: z.string().trim().min(1).max(500).nullable(),
  })
  .superRefine((clip, ctx) => {
    if (clip.endMs <= clip.startMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Clip endMs must be greater than startMs",
      });
    }

    if (clip.type === "subtitle") {
      if (!clip.text) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Subtitle clips require text",
          path: ["text"],
        });
      }
      if (clip.assetId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Subtitle clips cannot reference assetId",
          path: ["assetId"],
        });
      }
      return;
    }

    if (!clip.assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Media clips require assetId",
        path: ["assetId"],
      });
    }
  });

export const STimelineTrack = z.object({
  id: z.string().min(1),
  kind: STimelineTrackKind,
  name: z.string().trim().min(1).max(120),
  clips: z.array(STimelineClip),
});

export const STimelineData = z
  .object({
    schemaVersion: z.literal(1),
    fps: z.number().int().positive(),
    durationMs: z.number().int().nonnegative(),
    tracks: z.array(STimelineTrack).min(1),
  })
  .superRefine((timeline, ctx) => {
    const seenTrackIds = new Set<string>();
    const seenClipIds = new Set<string>();

    for (
      let trackIndex = 0;
      trackIndex < timeline.tracks.length;
      trackIndex += 1
    ) {
      const track = timeline.tracks[trackIndex];
      if (seenTrackIds.has(track.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Track IDs must be unique",
          path: ["tracks", trackIndex, "id"],
        });
      }
      seenTrackIds.add(track.id);

      for (let clipIndex = 0; clipIndex < track.clips.length; clipIndex += 1) {
        const clip = track.clips[clipIndex];
        if (seenClipIds.has(clip.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Clip IDs must be unique",
            path: ["tracks", trackIndex, "clips", clipIndex, "id"],
          });
        }
        seenClipIds.add(clip.id);

        if (clip.type !== track.kind) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Clip type must match track kind",
            path: ["tracks", trackIndex, "clips", clipIndex, "type"],
          });
        }

        if (clip.endMs > timeline.durationMs) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Clip exceeds timeline duration",
            path: ["tracks", trackIndex, "clips", clipIndex, "endMs"],
          });
        }
      }
    }
  });

export const STimeline = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  latestVersion: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const STimelineVersion = z.object({
  id: z.string().min(1),
  timelineId: z.string().min(1),
  version: z.number().int().positive(),
  source: STimelineVersionSource,
  createdByUserId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  data: STimelineData,
});

export const STimelineWithLatestResponse = z.object({
  timeline: STimeline,
  latestVersion: STimelineVersion,
});

export const SCreateTimelineRequest = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  seedAssetId: z.string().min(1).optional(),
});

export const SSaveTimelineVersionRequest = z.object({
  baseVersion: z.number().int().positive(),
  source: STimelineVersionSource.optional(),
  data: STimelineData,
});

export type TTimelineTrackKind = z.infer<typeof STimelineTrackKind>;
export type TTimelineClipType = z.infer<typeof STimelineClipType>;
export type TTimelineVersionSource = z.infer<typeof STimelineVersionSource>;
export type TTimelineClip = z.infer<typeof STimelineClip>;
export type TTimelineTrack = z.infer<typeof STimelineTrack>;
export type TTimelineData = z.infer<typeof STimelineData>;
export type TTimeline = z.infer<typeof STimeline>;
export type TTimelineVersion = z.infer<typeof STimelineVersion>;
export type TTimelineWithLatestResponse = z.infer<
  typeof STimelineWithLatestResponse
>;
export type TCreateTimelineRequest = z.infer<typeof SCreateTimelineRequest>;
export type TSaveTimelineVersionRequest = z.infer<
  typeof SSaveTimelineVersionRequest
>;
