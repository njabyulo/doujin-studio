import { and, eq } from "@a-ds/database";
import { db } from "@a-ds/database/client";
import { checkpoint, message, project, renderJob } from "@a-ds/database/schema";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Resource } from "sst";
import { z } from "zod";
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
import {
  checkIdempotency,
  storeIdempotencyKey,
} from "~/lib/idempotency-helpers";
import { checkRateLimit } from "~/lib/rate-limit-middleware";

export const runtime = "nodejs";

const SRenderInput = z.object({
  checkpointId: z.string(),
  format: z.enum(["1:1", "9:16", "16:9"]),
  idempotencyKey: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(`[${correlationId}] POST /api/projects/${projectId}/render`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  const rateLimitError = await checkRateLimit(
    authResult.user.id,
    "render",
    correlationId,
  );
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const input = SRenderInput.parse(body);

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

    if (input.idempotencyKey) {
      const { existing } = await checkIdempotency(
        input.idempotencyKey,
        authResult.user.id,
        "render",
      );

      if (existing) {
        console.log(
          `[${correlationId}] Idempotent request, returning existing`,
        );
        return withCorrelationId(Response.json(existing), correlationId);
      }
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

    const [newRenderJob] = await db
      .insert(renderJob)
      .values({
        projectId,
        sourceCheckpointId: input.checkpointId,
        sourceMessageId: existingCheckpoint.sourceMessageId,
        format: input.format,
        status: "pending",
        progress: 0,
        cancelRequested: false,
        correlationId,
      })
      .returning();

    const renderRequestedContent = {
      version: "1",
      type: "render_requested" as const,
      renderJobId: newRenderJob.id,
      format: input.format,
      artifactRefs: [{ type: "render_job" as const, id: newRenderJob.id }],
    };

    await db.insert(message).values({
      projectId,
      role: "user",
      type: "render_requested",
      contentJson: renderRequestedContent,
    });

    const sqsClient = new SQSClient({});
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: Resource.RenderQueue.url,
        MessageBody: JSON.stringify({ renderJobId: newRenderJob.id }),
      }),
    );

    if (input.idempotencyKey) {
      await storeIdempotencyKey(
        input.idempotencyKey,
        projectId,
        authResult.user.id,
        "render",
        newRenderJob.id,
      );
    }

    console.log(`[${correlationId}] Render job created: ${newRenderJob.id}`);
    return withCorrelationId(
      Response.json({
        renderJobId: newRenderJob.id,
        status: newRenderJob.status,
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

    console.error(`[${correlationId}] Render request error:`, error);
    return createServerError(correlationId);
  }
}
