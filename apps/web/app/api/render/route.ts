import { SBrandKit, SStoryboard } from "@a-ds/shared";
import type { AwsRegion } from "@remotion/lambda";
import { renderMediaOnLambda } from "@remotion/lambda/client";
import { Resource } from "sst";
import { z } from "zod";
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

    const input = z
      .object({
        storyboard: SStoryboard,
        brandKit: SBrandKit,
      })
      .safeParse(body);

    if (!input.success) {
      console.log(`[${correlationId}] Invalid render input`);
      return createValidationError(correlationId, {
        input: input.error.issues.map((issue) => issue.message),
      });
    }

    console.log(`[${correlationId}] Starting render`);

    const { renderId, bucketName } = await renderMediaOnLambda({
      region: getAwsRegion(),
      functionName: Resource.RemotionFunction.name,
      composition: "Master",
      serveUrl: process.env.REMOTION_SERVE_URL!,
      codec: "h264",
      inputProps: input.data,
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
