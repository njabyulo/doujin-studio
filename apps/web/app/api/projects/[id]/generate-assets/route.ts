import { and, eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { checkpoint, project } from "@doujin/database/schema";
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

const SGenerateAssetsInput = z.object({
  checkpointId: z.string(),
  sceneId: z.string(),
  prompt: z.string().min(1),
  idempotencyKey: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(
    `[${correlationId}] POST /api/projects/${projectId}/generate-assets`,
  );

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  const rateLimitError = await checkRateLimit(
    authResult.user.id,
    "generate_assets",
    correlationId,
  );
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const input = SGenerateAssetsInput.parse(body);

    if (input.idempotencyKey) {
      const { existing } = await checkIdempotency(
        input.idempotencyKey,
        authResult.user.id,
        "generate_assets",
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

    console.log(`[${correlationId}] Generating assets for scene ${sceneIndex + 1}`);

    const { output } = await generateText({
      model: google("gemini-2.5-flash"),
      output: Output.object({
        schema: z.object({
          assetSuggestions: z.array(
            z.object({
              id: z.string().uuid().optional(),
              type: z.enum(["image", "video"]),
              description: z.string(),
              placeholderUrl: z.string().url().optional(),
            }),
          ),
        }),
      }),
      prompt: `Generate asset suggestions for the scene below.

Scene:
- Duration: ${currentScene.duration}s
- On-screen text: ${currentScene.onScreenText}
- Voiceover: ${currentScene.voiceoverText}

User prompt: ${input.prompt}

Return 4-8 asset suggestions. Keep descriptions short, specific, and cinematic.`,
    });

    const updatedScene = {
      ...currentScene,
      assetSuggestions: output.assetSuggestions.map((asset) => ({
        ...asset,
        id: asset.id ?? crypto.randomUUID(),
      })),
    };

    const updatedScenes = [...storyboard.scenes];
    updatedScenes[sceneIndex] = updatedScene;

    const updatedStoryboard: TStoryboard = {
      ...storyboard,
      scenes: updatedScenes,
    };

    SStoryboard.parse(updatedStoryboard);

    const newCheckpoint = await createCheckpoint({
      projectId,
      sourceMessageId: existingCheckpoint.sourceMessageId,
      parentCheckpointId: input.checkpointId,
      storyboard: updatedStoryboard,
      script: existingCheckpoint.scriptJson as TScript,
      brandKit: existingCheckpoint.brandKitJson as TBrandKit,
      name: `Generated assets for scene ${sceneIndex + 1}`,
      reason: "asset_generation",
    });

    if (input.idempotencyKey) {
      await storeIdempotencyKey(
        input.idempotencyKey,
        projectId,
        authResult.user.id,
        "generate_assets",
        newCheckpoint.id,
      );
    }

    console.log(
      `[${correlationId}] Asset generation complete, checkpoint: ${newCheckpoint.id}`,
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

    console.error(`[${correlationId}] Asset generation error:`, error);
    return createServerError(correlationId);
  }
}
