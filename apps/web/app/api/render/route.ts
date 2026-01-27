import { validateStoryboard, validateTotalDuration } from "@a-ds/remotion";
import type { AwsRegion } from "@remotion/lambda";
import { renderMediaOnLambda } from "@remotion/lambda/client";
import { Resource } from "sst";

export const maxDuration = 900; // 15 minutes

const getAwsRegion = (): AwsRegion => {
  return (process.env.AWS_REGION as AwsRegion) || "us-east-1";
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate storyboard with Zod schema
    let storyboard;
    try {
      storyboard = validateStoryboard(body);
    } catch (error) {
      return Response.json(
        {
          error: "Invalid storyboard format",
          details: error instanceof Error ? error.message : "Validation failed",
        },
        { status: 400 },
      );
    }

    // Validate total duration constraint
    if (!validateTotalDuration(storyboard)) {
      return Response.json(
        { error: "Total duration exceeds 30 seconds" },
        { status: 400 },
      );
    }

    // Call Remotion Lambda to render video
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: getAwsRegion(),
      functionName: Resource.RemotionFunction.name,
      composition: "Master",
      serveUrl: process.env.REMOTION_SERVE_URL!,
      codec: "h264",
      inputProps: storyboard,
    });

    return Response.json({ renderId, bucketName }, { status: 200 });
  } catch (error) {
    console.error("Render error:", error);

    if (error instanceof Error) {
      if (error.message.includes("Lambda")) {
        return Response.json(
          { error: "Video rendering service unavailable. Please try again." },
          { status: 503 },
        );
      }

      if (error.message.includes("timeout")) {
        return Response.json(
          { error: "Render request timed out. Please try again." },
          { status: 504 },
        );
      }
    }

    return Response.json(
      { error: "Failed to start video render. Please try again." },
      { status: 500 },
    );
  }
}
