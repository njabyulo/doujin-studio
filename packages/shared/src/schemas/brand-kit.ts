import { z } from "zod";

export const SBrandKit = z.object({
  version: z.string(),
  productName: z.string(),
  tagline: z.string(),
  benefits: z.array(z.string()),
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  tone: z.string(),
  pricing: z.string().optional(),
  testimonials: z.array(z.string()).optional(),
  logoUrl: z.string().url().optional(),
});
