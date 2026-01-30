import { eq } from "@a-ds/database";
import { db } from "@a-ds/database/client";
import { project, renderJob } from "@a-ds/database/schema";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: renderJobId } = await params;
  console.log(
    `[${correlationId}] GET /api/render-jobs/${renderJobId}/download-url`,
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

    if (existingRenderJob.renderJob.status !== "completed") {
      console.log(
        `[${correlationId}] Render not completed: ${existingRenderJob.renderJob.status}`,
      );
      return createValidationError(correlationId, {
        status: ["Render not completed"],
      });
    }

    if (
      existingRenderJob.renderJob.cancelRequested ||
      !existingRenderJob.renderJob.outputS3Key
    ) {
      console.log(`[${correlationId}] No output available`);
      return createNotFoundError("Output", correlationId);
    }

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: existingRenderJob.renderJob.outputS3Key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    console.log(`[${correlationId}] Generated signed URL`);
    return withCorrelationId(
      Response.json({
        downloadUrl: signedUrl,
        expiresIn: 3600,
      }),
      correlationId,
    );
  } catch (error) {
    console.error(`[${correlationId}] Download URL generation error:`, error);
    return createServerError(correlationId);
  }
}
