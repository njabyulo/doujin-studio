import { eq } from "@a-ds/database";
import { db } from "@a-ds/database/client";
import { project, renderJob } from "@a-ds/database/schema";
import { requireAuth } from "~/lib/auth-middleware";
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: renderJobId } = await params;
  console.log(`[${correlationId}] POST /api/render-jobs/${renderJobId}/cancel`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  try {
    const [existingRenderJob] = await db
      .select({
        renderJob,
        project,
      })
      .from(renderJob)
      .innerJoin(project, eq(renderJob.projectId, project.id))
      .where(eq(renderJob.id, renderJobId))
      .limit(1);

    if (!existingRenderJob) {
      console.log(`[${correlationId}] Render job not found`);
      return createNotFoundError("Render job", correlationId);
    }

    if (existingRenderJob.project.userId !== authResult.user.id) {
      console.log(`[${correlationId}] Forbidden: user does not own render job`);
      return createForbiddenError(correlationId);
    }

    const currentStatus = existingRenderJob.renderJob.status;
    if (
      currentStatus === "completed" ||
      currentStatus === "failed" ||
      currentStatus === "cancelled" ||
      currentStatus === "cancel_requested"
    ) {
      console.log(
        `[${correlationId}] Cannot cancel job with status: ${currentStatus}`,
      );
      return createValidationError(correlationId, {
        status: [`Cannot cancel job with status: ${currentStatus}`],
      });
    }

    const [updatedJob] = await db
      .update(renderJob)
      .set({
        cancelRequested: true,
        status: "cancel_requested",
        updatedAt: new Date(),
      })
      .where(eq(renderJob.id, renderJobId))
      .returning();

    console.log(`[${correlationId}] Render job cancelled: ${updatedJob.id}`);
    return withCorrelationId(
      Response.json({
        id: updatedJob.id,
        status: updatedJob.status,
        cancelRequested: updatedJob.cancelRequested,
        progress: updatedJob.progress,
      }),
      correlationId,
    );
  } catch (error) {
    console.error(`[${correlationId}] Cancel render job error:`, error);
    return createServerError(correlationId);
  }
}
