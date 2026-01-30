import { z } from "zod";

export const SAssetSuggestion = z.object({
  type: z.enum(["image", "video"]),
  description: z.string(),
  placeholderUrl: z.string().url().optional(),
});

export const SScene = z.object({
  id: z.string().uuid(),
  duration: z.number().positive(),
  onScreenText: z.string(),
  voiceoverText: z.string(),
  assetSuggestions: z.array(SAssetSuggestion),
});

export const SStoryboard = z.object({
  version: z.string(),
  format: z.enum(["1:1", "9:16", "16:9"]),
  totalDuration: z.number().positive(),
  scenes: z.array(SScene),
});
