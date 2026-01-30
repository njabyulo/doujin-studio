import { validateStoryboard, validateTotalDuration } from "@a-ds/remotion";
import type { AwsRegion } from "@remotion/lambda";
import { renderMediaOnLambda } from "@remotion/lambda/client";
import { Resource } from "sst";
import { requireAuth } from "~/lib/auth-middleware";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import { createServerError, createValidationError } from "~/lib/error-helpers";

export const maxDuration = 900;

const getAwsRegion = (): AwsRegion => {
  return (process.env.AWS_REGION as AwsRegion) || "us-east-1";
};

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req);
  console.log(`[${correlationId}] POST /api/render`);

  const { error } = await requireAuth(req, correlationId);
  if (error) return error;

  try {
    const body = await req.json();

    let storyboard;
    try {
      storyboard = validateStoryboard(body);
    } catch (error) {
      console.log(`[${correlationId}] Invalid storyboard format`);
      return createValidationError(correlationId, {
        storyboard: [
          error instanceof Error ? error.message : "Validation failed",
        ],
      });
    }

    if (!validateTotalDuration(storyboard)) {
      console.log(`[${correlationId}] Total duration exceeds 30 seconds`);
      return createValidationError(correlationId, {
        duration: ["Total duration exceeds 30 seconds"],
      });
    }

    console.log(`[${correlationId}] Starting render`);

    const { renderId, bucketName } = await renderMediaOnLambda({
      region: getAwsRegion(),
      functionName: Resource.RemotionFunction.name,
      composition: "Master",
      serveUrl: process.env.REMOTION_SERVE_URL!,
      codec: "h264",
      inputProps: storyboard,
    });

    console.log(`[${correlationId}] Render started: ${renderId}`);
    return withCorrelationId(
      Response.json({ renderId, bucketName }, { status: 200 }),
      correlationId,
    );
  } catch (error) {
    console.error(`[${correlationId}] Render error:`, error);

    if (error instanceof Error) {
      if (error.message.includes("Lambda")) {
        return createValidationError(correlationId, {
          service: ["Video rendering service unavailable. Please try again."],
        });
      }

      if (error.message.includes("timeout")) {
        return createValidationError(correlationId, {
          timeout: ["Render request timed out. Please try again."],
        });
      }
    }

    return createServerError(correlationId);
  }
}
