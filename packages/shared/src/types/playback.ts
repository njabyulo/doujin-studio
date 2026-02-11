import { z } from "zod";

export const SPlaybackCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("play") }),
  z.object({ type: z.literal("pause") }),
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

export type TPlaybackCommand = z.infer<typeof SPlaybackCommand>;
export type TInterpretPlaybackRequest = z.infer<
  typeof SInterpretPlaybackRequest
>;
export type TInterpretPlaybackResponse = z.infer<
  typeof SInterpretPlaybackResponse
>;
