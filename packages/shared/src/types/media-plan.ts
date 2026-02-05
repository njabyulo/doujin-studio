import { z } from "zod";
import { SMediaPlan, SMediaPrompt } from "../schemas/media-plan";

export type TMediaPlan = z.infer<typeof SMediaPlan>;
export type TMediaPrompt = z.infer<typeof SMediaPrompt>;
