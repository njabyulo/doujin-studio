import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AwsRegion } from "@remotion/lambda";
import { Resource } from "sst";
import { requireAuth } from "~/lib/auth-middleware";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import { createServerError, createValidationError } from "~/lib/error-helpers";

const getAwsRegion = (): AwsRegion => {
  return (process.env.AWS_REGION as AwsRegion) || "us-east-1";
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(req);
  const { id } = await params;
  console.log(`[${correlationId}] GET /api/download/${id}`);

  const { error } = await requireAuth(req, correlationId);
  if (error) return error;

  try {
    if (!id || typeof id !== "string") {
      console.log(`[${correlationId}] Invalid render ID`);
      return createValidationError(correlationId, {
        id: ["Render ID is required"],
      });
    }

    const s3 = new S3Client({
      region: getAwsRegion(),
    });

    const command = new GetObjectCommand({
      Bucket: Resource.VideoBucket.name,
      Key: `${id}.mp4`,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    console.log(`[${correlationId}] Generated download URL`);
    return withCorrelationId(
      Response.json({ url }, { status: 200 }),
      correlationId,
    );
  } catch (error) {
    console.error(`[${correlationId}] Download URL generation error:`, error);

    if (error instanceof Error) {
      if (
        error.message.includes("NoSuchKey") ||
        error.message.includes("NotFound")
      ) {
        return createValidationError(correlationId, {
          video: ["Video not found. It may still be rendering or has expired."],
        });
      }

      if (error.message.includes("AccessDenied")) {
        return createValidationError(correlationId, {
          access: ["Access denied to video file."],
        });
      }
    }

    return createServerError(correlationId);
  }
}
