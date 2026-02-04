import { and, eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { checkpoint, message, project } from "@doujin/database/schema";
import type { TBrandKit, TScript, TStoryboard } from "@doujin/shared";
import { SStoryboard } from "@doujin/shared";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireAuth } from "~/lib/auth-middleware";
import { createCheckpoint } from "~/lib/checkpoint-helpers";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import {
  createForbiddenError,
  createNotFoundError,
  createServerError,
  createValidationError,
} from "~/lib/error-helpers";
import {
  checkIdempotency,
  storeIdempotencyKey,
} from "~/lib/idempotency-helpers";
import { checkRateLimit } from "~/lib/rate-limit-middleware";

export const runtime = "nodejs";
export const maxDuration = 60;

const SRegenerateSceneInput = z.object({
  checkpointId: z.string(),
  sceneId: z.string(),
  instruction: z.string().min(1),
  idempotencyKey: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(
    `[${correlationId}] POST /api/projects/${projectId}/regenerate-scene`,
  );

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  const rateLimitError = await checkRateLimit(
    authResult.user.id,
    "regenerate_scene",
    correlationId,
  );
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const input = SRegenerateSceneInput.parse(body);

    if (input.idempotencyKey) {
      const { existing } = await checkIdempotency(
        input.idempotencyKey,
        authResult.user.id,
        "regenerate_scene",
      );

      if (existing) {
        console.log(
          `[${correlationId}] Idempotent request, returning existing`,
        );
        return withCorrelationId(Response.json(existing), correlationId);
      }
    }

    const [existingProject] = await db
      .select()
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

    if (!existingProject) {
      console.log(`[${correlationId}] Project not found`);
      return createNotFoundError("Project", correlationId);
    }

    if (existingProject.userId !== authResult.user.id) {
      console.log(`[${correlationId}] Forbidden: user does not own project`);
      return createForbiddenError(correlationId);
    }

    const [existingCheckpoint] = await db
      .select()
      .from(checkpoint)
      .where(
        and(
          eq(checkpoint.id, input.checkpointId),
          eq(checkpoint.projectId, projectId),
        ),
      )
      .limit(1);

    if (!existingCheckpoint) {
      console.log(`[${correlationId}] Checkpoint not found`);
      return createNotFoundError("Checkpoint", correlationId);
    }

    const storyboard = existingCheckpoint.storyboardJson as TStoryboard;
    const sceneIndex = storyboard.scenes.findIndex(
      (s) => s.id === input.sceneId,
    );

    if (sceneIndex === -1) {
      console.log(`[${correlationId}] Scene not found`);
      return createNotFoundError("Scene", correlationId);
    }

    const currentScene = storyboard.scenes[sceneIndex];

    console.log(`[${correlationId}] Regenerating scene ${sceneIndex + 1}`);

    const { output: regeneratedScene } = await generateText({
      model: google("gemini-2.0-flash-exp"),
      output: Output.object({
        schema: z.object({
          duration: z.number().positive(),
          onScreenText: z.string(),
          voiceoverText: z.string(),
          assetSuggestions: z.array(
            z.object({
              type: z.enum(["image", "video"]),
              description: z.string(),
            }),
          ),
        }),
      }),
      prompt: `Regenerate this scene based on the instruction.

Current scene:
- Duration: ${currentScene.duration}s
- On-screen text: ${currentScene.onScreenText}
- Voiceover: ${currentScene.voiceoverText}

Instruction: ${input.instruction}

Generate an improved version of this scene that follows the instruction while maintaining the overall ad structure.`,
    });

    const updatedScene = {
      id: input.sceneId,
      ...regeneratedScene,
    };

    const updatedScenes = [...storyboard.scenes];
    updatedScenes[sceneIndex] = updatedScene;

    const updatedStoryboard: TStoryboard = {
      ...storyboard,
      scenes: updatedScenes,
      totalDuration: updatedScenes.reduce((sum, s) => sum + s.duration, 0),
    };

    SStoryboard.parse(updatedStoryboard);

    const newCheckpoint = await createCheckpoint({
      projectId,
      sourceMessageId: existingCheckpoint.sourceMessageId,
      parentCheckpointId: input.checkpointId,
      storyboard: updatedStoryboard,
      script: existingCheckpoint.scriptJson as TScript,
      brandKit: existingCheckpoint.brandKitJson as TBrandKit,
      name: `Regenerated scene ${sceneIndex + 1}`,
      reason: "scene_regeneration",
    });

    const sceneRegeneratedContent = {
      version: "1",
      type: "scene_regenerated" as const,
      checkpointId: newCheckpoint.id,
      sceneId: input.sceneId,
      instruction: input.instruction,
      artifactRefs: [{ type: "checkpoint" as const, id: newCheckpoint.id }],
    };

    const [newMessage] = await db
      .insert(message)
      .values({
        projectId,
        role: "assistant",
        type: "scene_regenerated",
        contentJson: sceneRegeneratedContent,
      })
      .returning();

    if (input.idempotencyKey) {
      await storeIdempotencyKey(
        input.idempotencyKey,
        projectId,
        authResult.user.id,
        "regenerate_scene",
        newMessage.id,
      );
    }

    console.log(
      `[${correlationId}] Scene regenerated, checkpoint: ${newCheckpoint.id}`,
    );
    return withCorrelationId(
      Response.json({
        checkpoint: newCheckpoint,
        scene: updatedScene,
      }),
      correlationId,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(`[${correlationId}] Validation error:`, error.issues);
      return createValidationError(
        correlationId,
        error.issues.reduce(
          (acc, issue) => ({
            ...acc,
            [issue.path.join(".")]: [issue.message],
          }),
          {},
        ),
      );
    }

    console.error(`[${correlationId}] Scene regeneration error:`, error);
    return createServerError(correlationId);
  }
}
