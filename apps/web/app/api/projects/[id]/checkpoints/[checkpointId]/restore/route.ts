import { and, eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { checkpoint, message, project } from "@doujin/database/schema";
import { SCheckpointApplied } from "@doujin/shared";
import { requireAuth } from "~/lib/auth-middleware";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import {
  createForbiddenError,
  createNotFoundError,
  createServerError,
} from "~/lib/error-helpers";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; checkpointId: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId, checkpointId } = await params;
  console.log(
    `[${correlationId}] POST /api/projects/${projectId}/checkpoints/${checkpointId}/restore`,
  );

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  try {
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
          eq(checkpoint.id, checkpointId),
          eq(checkpoint.projectId, projectId),
        ),
      )
      .limit(1);

    if (!existingCheckpoint) {
      console.log(`[${correlationId}] Checkpoint not found`);
      return createNotFoundError("Checkpoint", correlationId);
    }

    const previousCheckpointId = existingProject.activeCheckpointId;

    await db
      .update(project)
      .set({
        activeCheckpointId: checkpointId,
        updatedAt: new Date(),
      })
      .where(eq(project.id, projectId));

    const checkpointAppliedContent = SCheckpointApplied.parse({
      version: "1",
      type: "checkpoint_applied",
      checkpointId,
      previousCheckpointId,
      artifactRefs: [{ type: "checkpoint", id: checkpointId }],
    });

    await db.insert(message).values({
      projectId,
      role: "system",
      type: "checkpoint_applied",
      contentJson: checkpointAppliedContent,
    });

    console.log(`[${correlationId}] Checkpoint restored: ${checkpointId}`);
    return withCorrelationId(
      Response.json({
        checkpoint: existingCheckpoint,
        previousCheckpointId,
      }),
      correlationId,
    );
  } catch (error) {
    console.error(`[${correlationId}] Checkpoint restore error:`, error);
    return createServerError(correlationId);
  }
}
