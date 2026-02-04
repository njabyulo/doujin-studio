import { eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { project, renderJob } from "@doujin/database/schema";
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: renderJobId } = await params;
  console.log(
    `[${correlationId}] GET /api/render-jobs/${renderJobId}/progress`,
  );

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

    console.log(
      `[${correlationId}] Progress: ${existingRenderJob.renderJob.status} ${existingRenderJob.renderJob.progress}%`,
    );
    return withCorrelationId(
      Response.json(
        {
          id: existingRenderJob.renderJob.id,
          status: existingRenderJob.renderJob.status,
          progress: existingRenderJob.renderJob.progress,
          outputS3Key: existingRenderJob.renderJob.outputS3Key,
          lastError: existingRenderJob.renderJob.lastError,
        },
        {
          headers: {
            "Cache-Control": "no-cache, no-transform",
          },
        },
      ),
      correlationId,
    );
  } catch (error) {
    console.error(`[${correlationId}] Progress check error:`, error);
    return createServerError(correlationId);
  }
}
