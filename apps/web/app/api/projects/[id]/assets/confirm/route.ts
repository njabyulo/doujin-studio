import { and, desc, eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { checkpoint, project } from "@doujin/database/schema";
import type { TBrandKit, TScript, TStoryboard } from "@doujin/shared";
import { SStoryboard } from "@doujin/shared";
import { Resource } from "sst";
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

const SConfirmInput = z.object({
  assetId: z.string().uuid(),
  sceneId: z.string().uuid(),
  s3Key: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(`[${correlationId}] POST /api/projects/${projectId}/assets/confirm`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const input = SConfirmInput.parse(body);

    const [existingProject] = await db
      .select()
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

    if (!existingProject) {
      return createNotFoundError("Project", correlationId);
    }

    if (existingProject.userId !== authResult.user.id) {
      return createForbiddenError(correlationId);
    }

    const [existingCheckpoint] = existingProject.activeCheckpointId
      ? await db
          .select()
          .from(checkpoint)
          .where(
            and(
              eq(checkpoint.id, existingProject.activeCheckpointId),
              eq(checkpoint.projectId, projectId),
            ),
          )
          .limit(1)
      : await db
          .select()
          .from(checkpoint)
          .where(eq(checkpoint.projectId, projectId))
          .orderBy(desc(checkpoint.createdAt))
          .limit(1);

    if (!existingCheckpoint) {
      return createNotFoundError("Checkpoint", correlationId);
    }

    const storyboard = existingCheckpoint.storyboardJson as TStoryboard;
    const sceneIndex = storyboard.scenes.findIndex(
      (scene) => scene.id === input.sceneId,
    );
    if (sceneIndex === -1) {
      return createNotFoundError("Scene", correlationId);
    }

    const scene = storyboard.scenes[sceneIndex];
    const assetIndex = scene.assetSuggestions.findIndex(
      (asset) => asset.id === input.assetId,
    );
    if (assetIndex === -1) {
      return createNotFoundError("Asset", correlationId);
    }

    const region = process.env.AWS_REGION || "us-east-1";
    const publicUrl = `https://${Resource.VideoBucket.name}.s3.${region}.amazonaws.com/${input.s3Key}`;

    const updatedScene = {
      ...scene,
      assetSuggestions: scene.assetSuggestions.map((asset) =>
        asset.id === input.assetId
          ? {
              ...asset,
              placeholderUrl: publicUrl,
            }
          : asset,
      ),
    };

    const updatedStoryboard: TStoryboard = {
      ...storyboard,
      scenes: storyboard.scenes.map((item, index) =>
        index === sceneIndex ? updatedScene : item,
      ),
    };

    SStoryboard.parse(updatedStoryboard);

    const newCheckpoint = await createCheckpoint({
      projectId,
      sourceMessageId: existingCheckpoint.sourceMessageId,
      parentCheckpointId: existingProject.activeCheckpointId ?? null,
      storyboard: updatedStoryboard,
      script: existingCheckpoint.scriptJson as TScript,
      brandKit: existingCheckpoint.brandKitJson as TBrandKit,
      name: `Generated asset for scene ${sceneIndex + 1}`,
      reason: "asset_generation",
    });

    return withCorrelationId(
      Response.json({
        checkpointId: newCheckpoint.id,
        assetId: input.assetId,
        placeholderUrl: publicUrl,
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

    console.error(`[${correlationId}] Asset confirm error:`, error);
    return createServerError(correlationId);
  }
}
