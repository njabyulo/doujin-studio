import { z } from "zod";


export const SApiErrorCode = z.enum([
  "UNAUTHORIZED",
  "BAD_REQUEST",
  "NOT_FOUND",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);

export const SApiError = z.object({
  error: z.object({
    code: SApiErrorCode,
    message: z.string().min(1),
    requestId: z.string().min(1),
  }),
});

export const SHealthResponse = z.object({
  ok: z.literal(true),
});

export const SVersionResponse = z.object({
  version: z.string().min(1),
  commitSha: z.string().min(1),
});

export const SMeUser = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

export const SMeTenant = z.object({
  type: z.literal("user"),
  id: z.string().min(1),
});

export const SMeResponse = z.object({
  user: SMeUser,
  tenant: SMeTenant,
});

export const SProjectRole = z.enum(["owner"]);

export const SCreateProjectRequest = z.object({
  title: z.string().trim().min(1).max(120),
});

export const SProject = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  role: SProjectRole,
});

export const SProjectListResponse = z.object({
  projects: z.array(SProject),
});

export const SProjectResponse = z.object({
  project: SProject,
});

export const SAssetType = z.enum(["video", "poster"]);

export const SAssetStatus = z.enum([
  "pending_upload",
  "uploaded",
  "upload_failed",
]);

export const SCreateAssetUploadSessionRequest = z.object({
  fileName: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  type: SAssetType,
});

export const SAssetUploadSessionResponse = z.object({
  assetId: z.string().min(1),
  putUrl: z.string().url(),
  r2Key: z.string().min(1),
});

export const SCompleteAssetUploadRequest = z.object({
  size: z.number().int().nonnegative(),
  checksumSha256: z.string().trim().min(1).max(255).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  posterAssetId: z.string().min(1).optional(),
});

export const SAsset = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: SAssetType,
  status: SAssetStatus,
  r2Key: z.string().min(1),
  size: z.number().int().nonnegative(),
  mime: z.string().min(1),
  checksumSha256: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  posterAssetId: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  fileUrl: z.string().min(1),
  posterUrl: z.string().nullable(),
});

export const SAssetResponse = z.object({
  asset: SAsset,
});

export const SProjectAssetListResponse = z.object({
  assets: z.array(SAsset),
});

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

    for (let trackIndex = 0; trackIndex < timeline.tracks.length; trackIndex += 1) {
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

const SEditorAddClipInput = z.object({
  id: z.string().min(1).optional(),
  assetId: z.string().min(1),
  startMs: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().positive(),
  sourceStartMs: z.number().int().nonnegative().optional(),
  volume: z.number().min(0).max(2).optional(),
});

export const SEditorCommand = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addClip"),
    trackId: z.string().min(1),
    clip: SEditorAddClipInput,
  }),
  z
    .object({
      type: z.literal("trimClip"),
      clipId: z.string().min(1),
      startMs: z.number().int().nonnegative().optional(),
      endMs: z.number().int().nonnegative().optional(),
    })
    .refine((value) => value.startMs !== undefined || value.endMs !== undefined, {
      message: "trimClip requires startMs or endMs",
      path: ["startMs"],
    }),
  z.object({
    type: z.literal("splitClip"),
    clipId: z.string().min(1),
    atMs: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("moveClip"),
    clipId: z.string().min(1),
    trackId: z.string().min(1),
    startMs: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("setVolume"),
    clipId: z.string().min(1),
    volume: z.number().min(0).max(2),
  }),
  z.object({
    type: z.literal("addSubtitle"),
    trackId: z.string().min(1),
    text: z.string().trim().min(1).max(500),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("removeClip"),
    clipId: z.string().min(1),
  }),
]);

export const SPlaybackCommand = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("play"),
  }),
  z.object({
    type: z.literal("pause"),
  }),
  z.object({
    type: z.literal("seek"),
    toMs: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("none"),
    message: z.string().optional(),
  }),
]);

export const SInterpretPlaybackRequest = z.object({
  prompt: z.string().min(1),
  currentMs: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export const SInterpretPlaybackResponse = z.object({
  command: SPlaybackCommand,
  reasoning: z.string().optional(),
});

export const SApplyEditorCommandsInput = z.object({
  timelineId: z.string().min(1),
  commands: z.array(SEditorCommand).min(1),
});

export const SApplyEditorCommandsResult = z.object({
  status: z.enum(["applied", "no_change", "error"]),
  timelineId: z.string().min(1),
  newVersion: z.number().int().positive().nullable(),
  appliedCommandCount: z.number().int().nonnegative(),
  changedClipIds: z.array(z.string().min(1)),
  message: z.string().min(1),
});

export type TApiErrorCode = z.infer<typeof SApiErrorCode>;
export type TApiErrorResponse = z.infer<typeof SApiError>;
export type THealthResponse = z.infer<typeof SHealthResponse>;
export type TVersionResponse = z.infer<typeof SVersionResponse>;
export type TMeUser = z.infer<typeof SMeUser>;
export type TMeTenant = z.infer<typeof SMeTenant>;
export type TMeResponse = z.infer<typeof SMeResponse>;
export type TProjectRole = z.infer<typeof SProjectRole>;
export type TCreateProjectRequest = z.infer<typeof SCreateProjectRequest>;
export type TProject = z.infer<typeof SProject>;
export type TProjectListResponse = z.infer<typeof SProjectListResponse>;
export type TProjectResponse = z.infer<typeof SProjectResponse>;
export type TAssetType = z.infer<typeof SAssetType>;
export type TAssetStatus = z.infer<typeof SAssetStatus>;
export type TCreateAssetUploadSessionRequest = z.infer<
  typeof SCreateAssetUploadSessionRequest
>;
export type TAssetUploadSessionResponse = z.infer<
  typeof SAssetUploadSessionResponse
>;
export type TCompleteAssetUploadRequest = z.infer<
  typeof SCompleteAssetUploadRequest
>;
export type TAsset = z.infer<typeof SAsset>;
export type TAssetResponse = z.infer<typeof SAssetResponse>;
export type TProjectAssetListResponse = z.infer<typeof SProjectAssetListResponse>;
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
export type TEditorCommand = z.infer<typeof SEditorCommand>;
export type TApplyEditorCommandsInput = z.infer<typeof SApplyEditorCommandsInput>;
export type TApplyEditorCommandsResult = z.infer<typeof SApplyEditorCommandsResult>;
export type TPlaybackCommand = z.infer<typeof SPlaybackCommand>;
export type TInterpretPlaybackRequest = z.infer<typeof SInterpretPlaybackRequest>;
export type TInterpretPlaybackResponse = z.infer<typeof SInterpretPlaybackResponse>;

export {
  applyEditorCommand,
  applyEditorCommands,
  createDefaultTimelineData,
} from "./editor-command-engine";
