import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AwsRegion } from "@remotion/lambda";
import { Resource } from "sst";

const getAwsRegion = (): AwsRegion => {
  return (process.env.AWS_REGION as AwsRegion) || "us-east-1";
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "Render ID is required" }, { status: 400 });
    }

    const s3 = new S3Client({
      region: getAwsRegion(),
    });

    const command = new GetObjectCommand({
      Bucket: Resource.VideoBucket.name,
      Key: `${id}.mp4`,
    });

    // Generate pre-signed URL with 1 hour expiration
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return Response.json({ url }, { status: 200 });
  } catch (error) {
    console.error("Download URL generation error:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("NoSuchKey") ||
        error.message.includes("NotFound")
      ) {
        return Response.json(
          {
            error: "Video not found. It may still be rendering or has expired.",
          },
          { status: 404 },
        );
      }

      if (error.message.includes("AccessDenied")) {
        return Response.json(
          { error: "Access denied to video file." },
          { status: 403 },
        );
      }
    }

    return Response.json(
      { error: "Failed to generate download URL. Please try again." },
      { status: 500 },
    );
  }
}
