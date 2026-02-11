export const FEATURE_EDITOR_INTERPRET = "editor_interpret" as const;

export const FEATURE_ASSET_ANALYZE = "asset_analyze" as const;

export const FEATURE_EDITOR_PLAN = "editor_plan" as const;

export type TFeatureId =
  | typeof FEATURE_EDITOR_INTERPRET
  | typeof FEATURE_ASSET_ANALYZE
  | typeof FEATURE_EDITOR_PLAN;
