import { z } from "zod";

export const SScriptScene = z.object({
  sceneId: z.string().uuid(),
  voiceover: z.string(),
  timing: z.object({
    start: z.number().nonnegative(),
    end: z.number().positive(),
  }),
});

export const SScript = z.object({
  version: z.string(),
  tone: z.string(),
  scenes: z.array(SScriptScene),
});
