import { z } from "zod";

// Zod Schemas
export const SScene = z.object({
  textOverlay: z.string().min(1).max(200),
  voiceoverScript: z.string().min(1).max(500),
  imagePrompt: z.string().min(1).max(300),
  durationInSeconds: z.number().min(1).max(10).default(5),
});

export const SStoryboard = z.object({
  adTitle: z.string().min(1).max(100),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    fontFamily: z.enum(["Inter", "Roboto", "Montserrat"]),
  }),
  scenes: z.array(SScene).min(1).max(6),
});

// TypeScript Types
export type TScene = z.infer<typeof SScene>;
export type TStoryboard = z.infer<typeof SStoryboard>;

// Validation Helpers
export function validateStoryboard(data: unknown): TStoryboard {
  return SStoryboard.parse(data);
}

export function validateTotalDuration(storyboard: TStoryboard): boolean {
  const total = storyboard.scenes.reduce(
    (acc, scene) => acc + scene.durationInSeconds,
    0,
  );
  return total <= 30;
}
