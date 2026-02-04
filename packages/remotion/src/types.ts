import type { TBrandKit, TStoryboard } from "../../shared/src/types";

export interface TRenderInput extends Record<string, unknown> {
  storyboard: TStoryboard;
  brandKit: TBrandKit;
}
