import { z } from "zod";

export const SEditorCommand = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addClip"),
    trackId: z.string().min(1),
    clip: z.object({
      id: z.string().min(1).optional(),
      assetId: z.string().min(1),
      startMs: z.number().int().nonnegative().optional(),
      durationMs: z.number().int().positive(),
      sourceStartMs: z.number().int().nonnegative().optional(),
      volume: z.number().min(0).max(2).optional(),
    }),
  }),
  z
    .object({
      type: z.literal("trimClip"),
      clipId: z.string().min(1),
      startMs: z.number().int().nonnegative().optional(),
      endMs: z.number().int().nonnegative().optional(),
    })
    .refine(
      (value) => value.startMs !== undefined || value.endMs !== undefined,
      {
        message: "trimClip requires startMs or endMs",
        path: ["startMs"],
      },
    ),
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

export type TEditorCommand = z.infer<typeof SEditorCommand>;
export type TApplyEditorCommandsInput = z.infer<
  typeof SApplyEditorCommandsInput
>;
export type TApplyEditorCommandsResult = z.infer<
  typeof SApplyEditorCommandsResult
>;
