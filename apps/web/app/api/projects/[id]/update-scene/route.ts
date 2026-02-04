import { and, eq } from "@a-ds/database";
import { db } from "@a-ds/database/client";
import { checkpoint, project } from "@a-ds/database/schema";
import type { TBrandKit, TScript, TStoryboard } from "@a-ds/shared";
import { SStoryboard } from "@a-ds/shared";
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
import { checkRateLimit } from "~/lib/rate-limit-middleware";

export const runtime = "nodejs";

const SUpdateSceneInput = z.object({
  checkpointId: z.string(),
  sceneId: z.string(),
  duration: z.number().positive(),
  onScreenText: z.string().min(1),
  voiceoverText: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(`[${correlationId}] POST /api/projects/${projectId}/update-scene`);

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
    const input = SUpdateSceneInput.parse(body);

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
    const sceneIndex = storyboard.scenes.findIndex((s) => s.id === input.sceneId);
    if (sceneIndex === -1) {
      console.log(`[${correlationId}] Scene not found`);
      return createNotFoundError("Scene", correlationId);
    }

    const updatedScenes = [...storyboard.scenes];
    updatedScenes[sceneIndex] = {
      ...updatedScenes[sceneIndex],
      duration: input.duration,
      onScreenText: input.onScreenText,
      voiceoverText: input.voiceoverText,
    };

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
      name: `Manual edit scene ${sceneIndex + 1}`,
      reason: "manual_edit",
    });

    console.log(
      `[${correlationId}] Scene updated, checkpoint: ${newCheckpoint.id}`,
    );
    return withCorrelationId(
      Response.json({
        checkpoint: newCheckpoint,
        scene: updatedScenes[sceneIndex],
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

    console.error(`[${correlationId}] Scene update error:`, error);
    return createServerError(correlationId);
  }
}

