import { checkpoint, db, eq, message, renderJob } from "@doujin/database";
import type { AwsRegion } from "@remotion/lambda";
import {
  getRenderProgress,
  renderMediaOnLambda,
} from "@remotion/lambda/client";
import type { SQSHandler } from "aws-lambda";
import { Resource } from "sst";

const AWS_REGION = (process.env.AWS_REGION || "us-east-1") as AwsRegion;
const POLL_INTERVAL_MS = 3000;

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const { renderJobId } = JSON.parse(record.body);
      console.log(`Processing render job: ${renderJobId}`);

      const [job] = await db
        .select()
        .from(renderJob)
        .where(eq(renderJob.id, renderJobId))
        .limit(1);

      if (!job) {
        console.error(`Render job not found: ${renderJobId}`);
        continue;
      }

      const [checkpointData] = await db
        .select()
        .from(checkpoint)
        .where(eq(checkpoint.id, job.sourceCheckpointId))
        .limit(1);

      if (!checkpointData) {
        await updateJobStatus(renderJobId, "failed", 0, "Checkpoint not found");
        await createRenderCompletedMessage(job, "failed", null);
        continue;
      }

      await updateJobStatus(renderJobId, "rendering", 0, null);

      const { renderId, bucketName } = await renderMediaOnLambda({
        region: AWS_REGION,
        functionName: Resource.RemotionFunction.name,
        composition: "Master",
        serveUrl: process.env.REMOTION_SERVE_URL!,
        codec: "h264",
        inputProps: {
          storyboard: checkpointData.storyboardJson,
          brandKit: checkpointData.brandKitJson,
        },
      });

      let completed = false;
      let lastProgress = 0;

      while (!completed) {
        await sleep(POLL_INTERVAL_MS);

        const [currentJob] = await db
          .select()
          .from(renderJob)
          .where(eq(renderJob.id, renderJobId))
          .limit(1);

        if (currentJob?.cancelRequested) {
          console.log(`Cancel requested for render job: ${renderJobId}`);
          await updateJobStatus(renderJobId, "cancelled", lastProgress, null);
          await createRenderCompletedMessage(currentJob, "cancelled", null);
          completed = true;
          break;
        }

        const progress = await getRenderProgress({
          renderId,
          bucketName,
          functionName: Resource.RemotionFunction.name,
          region: AWS_REGION,
        });

        if (progress.overallProgress !== lastProgress) {
          lastProgress = Math.round(progress.overallProgress * 100);
          await updateJobStatus(renderJobId, "rendering", lastProgress, null);
        }

        if (progress.done) {
          const [finalJob] = await db
            .select()
            .from(renderJob)
            .where(eq(renderJob.id, renderJobId))
            .limit(1);

          if (finalJob?.cancelRequested) {
            await updateJobStatus(renderJobId, "cancelled", 100, null);
            await createRenderCompletedMessage(finalJob, "cancelled", null);
          } else {
            const outputS3Key = `renders/${renderId}.mp4`;
            await updateJobStatus(
              renderJobId,
              "completed",
              100,
              null,
              outputS3Key,
            );
            await createRenderCompletedMessage(finalJob!, "completed", null);
          }
          completed = true;
        }

        if (progress.fatalErrorEncountered) {
          const errorMessage =
            progress.errors?.[0]?.message || "Unknown render error";
          await updateJobStatus(
            renderJobId,
            "failed",
            lastProgress,
            errorMessage,
          );
          await createRenderCompletedMessage(job, "failed", null);
          completed = true;
        }
      }
    } catch (error) {
      console.error("Render worker error:", error);
      const { renderJobId } = JSON.parse(record.body);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await updateJobStatus(renderJobId, "failed", 0, errorMessage);

      const [job] = await db
        .select()
        .from(renderJob)
        .where(eq(renderJob.id, renderJobId))
        .limit(1);
      if (job) {
        await createRenderCompletedMessage(job, "failed", null);
      }
    }
  }
};

async function updateJobStatus(
  jobId: string,
  status: string,
  progress: number,
  error: string | null,
  outputS3Key?: string,
): Promise<void> {
  await db
    .update(renderJob)
    .set({
      status: status as any,
      progress,
      lastError: error,
      outputS3Key: outputS3Key || undefined,
      updatedAt: new Date(),
    })
    .where(eq(renderJob.id, jobId));
}

async function createRenderCompletedMessage(
  job: any,
  status: "completed" | "failed" | "cancelled",
  outputUrl: string | null,
): Promise<void> {
  await db.insert(message).values({
    projectId: job.projectId,
    role: "system",
    type: "render_completed",
    contentJson: {
      version: "1",
      type: "render_completed",
      renderJobId: job.id,
      outputUrl,
      status,
      artifactRefs: [{ type: "render_job", id: job.id }],
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
