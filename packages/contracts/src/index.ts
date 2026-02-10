import { z } from "zod";


export const apiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "BAD_REQUEST",
  "NOT_FOUND",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1),
  }),
});

export const healthResponseSchema = z.object({
  ok: z.literal(true),
});

export const versionResponseSchema = z.object({
  version: z.string().min(1),
  commitSha: z.string().min(1),
});

export const meUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

export const meTenantSchema = z.object({
  type: z.literal("user"),
  id: z.string().min(1),
});

export const meResponseSchema = z.object({
  user: meUserSchema,
  tenant: meTenantSchema,
});

export const projectRoleSchema = z.enum(["owner"]);

export const createProjectRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  role: projectRoleSchema,
});

export const projectListResponseSchema = z.object({
  projects: z.array(projectSchema),
});

export const projectResponseSchema = z.object({
  project: projectSchema,
});

export const assetTypeSchema = z.enum(["video", "poster"]);

export const assetStatusSchema = z.enum([
  "pending_upload",
  "uploaded",
  "upload_failed",
]);

export const createAssetUploadSessionRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  type: assetTypeSchema,
});

export const assetUploadSessionResponseSchema = z.object({
  assetId: z.string().min(1),
  putUrl: z.string().url(),
  r2Key: z.string().min(1),
});

export const completeAssetUploadRequestSchema = z.object({
  size: z.number().int().nonnegative(),
  checksumSha256: z.string().trim().min(1).max(255).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  posterAssetId: z.string().min(1).optional(),
});

export const assetSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: assetTypeSchema,
  status: assetStatusSchema,
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

export const assetResponseSchema = z.object({
  asset: assetSchema,
});

export const projectAssetListResponseSchema = z.object({
  assets: z.array(assetSchema),
});

export const timelineTrackKindSchema = z.enum(["video", "audio", "subtitle"]);

export const timelineClipTypeSchema = z.enum(["video", "audio", "subtitle"]);

export const timelineVersionSourceSchema = z.enum([
  "system",
  "autosave",
  "manual",
  "ai",
]);

export const timelineClipSchema = z
  .object({
    id: z.string().min(1),
    type: timelineClipTypeSchema,
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

export const timelineTrackSchema = z.object({
  id: z.string().min(1),
  kind: timelineTrackKindSchema,
  name: z.string().trim().min(1).max(120),
  clips: z.array(timelineClipSchema),
});

export const timelineDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    fps: z.number().int().positive(),
    durationMs: z.number().int().nonnegative(),
    tracks: z.array(timelineTrackSchema).min(1),
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

export const timelineSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  latestVersion: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const timelineVersionSchema = z.object({
  id: z.string().min(1),
  timelineId: z.string().min(1),
  version: z.number().int().positive(),
  source: timelineVersionSourceSchema,
  createdByUserId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  data: timelineDataSchema,
});

export const timelineWithLatestResponseSchema = z.object({
  timeline: timelineSchema,
  latestVersion: timelineVersionSchema,
});

export const createTimelineRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  seedAssetId: z.string().min(1).optional(),
});

export const saveTimelineVersionRequestSchema = z.object({
  baseVersion: z.number().int().positive(),
  source: timelineVersionSourceSchema.optional(),
  data: timelineDataSchema,
});

const editorAddClipInputSchema = z.object({
  id: z.string().min(1).optional(),
  assetId: z.string().min(1),
  startMs: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().positive(),
  sourceStartMs: z.number().int().nonnegative().optional(),
  volume: z.number().min(0).max(2).optional(),
});

export const editorCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addClip"),
    trackId: z.string().min(1),
    clip: editorAddClipInputSchema,
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

export const playbackCommandSchema = z.discriminatedUnion("type", [
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

export const interpretPlaybackRequestSchema = z.object({
  prompt: z.string().min(1),
  currentMs: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export const interpretPlaybackResponseSchema = z.object({
  command: playbackCommandSchema,
  reasoning: z.string().optional(),
});

export const applyEditorCommandsInputSchema = z.object({
  timelineId: z.string().min(1),
  commands: z.array(editorCommandSchema).min(1),
});

export const applyEditorCommandsResultSchema = z.object({
  status: z.enum(["applied", "no_change", "error"]),
  timelineId: z.string().min(1),
  newVersion: z.number().int().positive().nullable(),
  appliedCommandCount: z.number().int().nonnegative(),
  changedClipIds: z.array(z.string().min(1)),
  message: z.string().min(1),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type VersionResponse = z.infer<typeof versionResponseSchema>;
export type MeUser = z.infer<typeof meUserSchema>;
export type MeTenant = z.infer<typeof meTenantSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type ProjectRole = z.infer<typeof projectRoleSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type AssetType = z.infer<typeof assetTypeSchema>;
export type AssetStatus = z.infer<typeof assetStatusSchema>;
export type CreateAssetUploadSessionRequest = z.infer<
  typeof createAssetUploadSessionRequestSchema
>;
export type AssetUploadSessionResponse = z.infer<
  typeof assetUploadSessionResponseSchema
>;
export type CompleteAssetUploadRequest = z.infer<
  typeof completeAssetUploadRequestSchema
>;
export type Asset = z.infer<typeof assetSchema>;
export type AssetResponse = z.infer<typeof assetResponseSchema>;
export type ProjectAssetListResponse = z.infer<typeof projectAssetListResponseSchema>;
export type TimelineTrackKind = z.infer<typeof timelineTrackKindSchema>;
export type TimelineClipType = z.infer<typeof timelineClipTypeSchema>;
export type TimelineVersionSource = z.infer<typeof timelineVersionSourceSchema>;
export type TimelineClip = z.infer<typeof timelineClipSchema>;
export type TimelineTrack = z.infer<typeof timelineTrackSchema>;
export type TimelineData = z.infer<typeof timelineDataSchema>;
export type Timeline = z.infer<typeof timelineSchema>;
export type TimelineVersion = z.infer<typeof timelineVersionSchema>;
export type TimelineWithLatestResponse = z.infer<
  typeof timelineWithLatestResponseSchema
>;
export type CreateTimelineRequest = z.infer<typeof createTimelineRequestSchema>;
export type SaveTimelineVersionRequest = z.infer<
  typeof saveTimelineVersionRequestSchema
>;
export type EditorCommand = z.infer<typeof editorCommandSchema>;
export type ApplyEditorCommandsInput = z.infer<typeof applyEditorCommandsInputSchema>;
export type ApplyEditorCommandsResult = z.infer<typeof applyEditorCommandsResultSchema>;
export type PlaybackCommand = z.infer<typeof playbackCommandSchema>;
export type InterpretPlaybackRequest = z.infer<typeof interpretPlaybackRequestSchema>;
export type InterpretPlaybackResponse = z.infer<typeof interpretPlaybackResponseSchema>;

export {
  applyEditorCommand,
  applyEditorCommands,
  createDefaultTimelineData,
} from "./editor-command-engine";

