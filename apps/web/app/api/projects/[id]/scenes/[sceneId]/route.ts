import { and, eq } from "@a-ds/database";
import { db } from "@a-ds/database/client";
import { checkpoint, project } from "@a-ds/database/schema";
import type { TBrandKit, TScript, TStoryboard } from "@a-ds/shared";
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

export const runtime = "nodejs";

const SSceneUpdate = z.object({
  duration: z.number().positive().optional(),
  onScreenText: z.string().optional(),
  voiceoverText: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sceneId: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId, sceneId } = await params;
  console.log(
    `[${correlationId}] PATCH /api/projects/${projectId}/scenes/${sceneId}`,
  );

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const updates = SSceneUpdate.parse(body);

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

    if (!existingProject.activeCheckpointId) {
      console.log(`[${correlationId}] No active checkpoint`);
      return createValidationError(correlationId, {
        checkpoint: ["No active checkpoint"],
      });
    }

    const [activeCheckpoint] = await db
      .select()
      .from(checkpoint)
      .where(
        and(
          eq(checkpoint.id, existingProject.activeCheckpointId),
          eq(checkpoint.projectId, projectId),
        ),
      )
      .limit(1);

    if (!activeCheckpoint) {
      console.log(`[${correlationId}] Active checkpoint not found`);
      return createNotFoundError("Active checkpoint", correlationId);
    }

    const storyboard = activeCheckpoint.storyboardJson as TStoryboard;
    const sceneIndex = storyboard.scenes.findIndex((s) => s.id === sceneId);

    if (sceneIndex === -1) {
      console.log(`[${correlationId}] Scene not found`);
      return createNotFoundError("Scene", correlationId);
    }

    const updatedScene = {
      ...storyboard.scenes[sceneIndex],
      ...updates,
    };

    const updatedScenes = [...storyboard.scenes];
    updatedScenes[sceneIndex] = updatedScene;

    const updatedStoryboard: TStoryboard = {
      ...storyboard,
      scenes: updatedScenes,
      totalDuration: updatedScenes.reduce((sum, s) => sum + s.duration, 0),
    };

    const newCheckpoint = await createCheckpoint({
      projectId,
      sourceMessageId: activeCheckpoint.sourceMessageId,
      parentCheckpointId: activeCheckpoint.id,
      storyboard: updatedStoryboard,
      script: activeCheckpoint.scriptJson as TScript,
      brandKit: activeCheckpoint.brandKitJson as TBrandKit,
      name: `Edited scene ${sceneIndex + 1}`,
      reason: "manual_edit",
    });

    console.log(
      `[${correlationId}] Scene edited, checkpoint: ${newCheckpoint.id}`,
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

    console.error(`[${correlationId}] Scene edit error:`, error);
    return createServerError(correlationId);
  }
}
