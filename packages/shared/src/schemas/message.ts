import { z } from "zod";

export const SArtifactRef = z.object({
  type: z.enum(["checkpoint", "render_job"]),
  id: z.string().uuid(),
});

export const SMessageBase = z.object({
  version: z.string(),
  artifactRefs: z.array(SArtifactRef),
});

export const SUrlSubmitted = SMessageBase.extend({
  type: z.literal("url_submitted"),
  url: z.string().url(),
  format: z.enum(["1:1", "9:16", "16:9"]),
  tone: z.string().optional(),
});

export const SGenerationProgress = SMessageBase.extend({
  type: z.literal("generation_progress"),
  message: z.string(),
  progress: z.number().min(0).max(100),
});

export const SGenerationResult = SMessageBase.extend({
  type: z.literal("generation_result"),
  checkpointId: z.string().uuid(),
  summary: z.string(),
});

export const SCheckpointCreated = SMessageBase.extend({
  type: z.literal("checkpoint_created"),
  checkpointId: z.string().uuid(),
  reason: z.enum([
    "generation",
    "manual_edit",
    "scene_regeneration",
    "brand_kit_update",
  ]),
});

export const SCheckpointApplied = SMessageBase.extend({
  type: z.literal("checkpoint_applied"),
  checkpointId: z.string().uuid(),
  previousCheckpointId: z.string().uuid().nullable(),
});

export const SSceneRegenerated = SMessageBase.extend({
  type: z.literal("scene_regenerated"),
  checkpointId: z.string().uuid(),
  sceneId: z.string().uuid(),
  instruction: z.string(),
});

export const SRenderRequested = SMessageBase.extend({
  type: z.literal("render_requested"),
  renderJobId: z.string().uuid(),
  format: z.enum(["1:1", "9:16", "16:9"]),
});

export const SRenderProgress = SMessageBase.extend({
  type: z.literal("render_progress"),
  renderJobId: z.string().uuid(),
  progress: z.number().min(0).max(100),
  status: z.string(),
});

export const SRenderCompleted = SMessageBase.extend({
  type: z.literal("render_completed"),
  renderJobId: z.string().uuid(),
  outputUrl: z.string().url().nullable(),
  status: z.enum(["completed", "failed", "cancelled"]),
});

export const SMessageContent = z.discriminatedUnion("type", [
  SUrlSubmitted,
  SGenerationProgress,
  SGenerationResult,
  SCheckpointCreated,
  SCheckpointApplied,
  SSceneRegenerated,
  SRenderRequested,
  SRenderProgress,
  SRenderCompleted,
]);
