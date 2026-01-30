import { z } from "zod";
import {
  SArtifactRef,
  SCheckpointApplied,
  SCheckpointCreated,
  SGenerationProgress,
  SGenerationResult,
  SMessageContent,
  SRenderCompleted,
  SRenderProgress,
  SRenderRequested,
  SSceneRegenerated,
  SUrlSubmitted,
} from "../schemas/message";

export type TArtifactRef = z.infer<typeof SArtifactRef>;

export type TUrlSubmitted = z.infer<typeof SUrlSubmitted>;
export type TGenerationProgress = z.infer<typeof SGenerationProgress>;
export type TGenerationResult = z.infer<typeof SGenerationResult>;
export type TCheckpointCreated = z.infer<typeof SCheckpointCreated>;
export type TCheckpointApplied = z.infer<typeof SCheckpointApplied>;
export type TSceneRegenerated = z.infer<typeof SSceneRegenerated>;
export type TRenderRequested = z.infer<typeof SRenderRequested>;
export type TRenderProgress = z.infer<typeof SRenderProgress>;
export type TRenderCompleted = z.infer<typeof SRenderCompleted>;

export type TMessageContent = z.infer<typeof SMessageContent>;
