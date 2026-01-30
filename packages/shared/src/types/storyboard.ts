import { z } from "zod";
import { SAssetSuggestion, SScene, SStoryboard } from "../schemas/storyboard";

export type TAssetSuggestion = z.infer<typeof SAssetSuggestion>;
export type TScene = z.infer<typeof SScene>;
export type TStoryboard = z.infer<typeof SStoryboard>;
