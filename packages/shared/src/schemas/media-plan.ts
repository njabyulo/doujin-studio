import { z } from "zod";

export const SMediaPrompt = z.object({
  id: z.string().uuid(),
  prompt: z.string(),
  aspectRatio: z.enum(["1:1", "9:16", "16:9"]).optional(),
  durationSec: z.number().positive().optional(),
  style: z.string().optional(),
  asset: z
    .object({
      url: z.string().url().optional(),
      mimeType: z.string().optional(),
    })
    .optional(),
});

export const SMediaPlan = z.object({
  version: z.string(),
  project: z.object({
    title: z.string(),
    summary: z.string().optional(),
    sourceUrl: z.string().url().optional(),
  }),
  prompts: z.object({
    videos: z.array(SMediaPrompt),
    images: z.array(SMediaPrompt),
  }),
});
