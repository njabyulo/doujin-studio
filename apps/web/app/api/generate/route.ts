import { SStoryboard } from "@a-ds/remotion";
import { google } from "@ai-sdk/google";
import { Output, streamText } from "ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return Response.json(
        { error: "URL is required and must be a string" },
        { status: 400 },
      );
    }

    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(url)) {
      return Response.json(
        { error: "Invalid URL format. Must start with http:// or https://" },
        { status: 400 },
      );
    }

    const result = streamText({
      model: google("gemini-2.5-flash"),
      output: Output.object({ schema: SStoryboard }),
      prompt: `Analyze the content at this URL: ${url}

Generate a compelling 30-second video advertisement storyboard with the following requirements:
- Create an engaging ad title (max 100 characters)
- Choose a primary brand color (hex format)
- Select an appropriate font family (Inter, Roboto, or Montserrat)
- Generate 3-6 scenes, each with:
  * Text overlay for the scene (max 200 characters)
  * Voiceover script (max 500 characters)
  * Image prompt describing the visual (max 300 characters)
  * Duration in seconds (1-10 seconds, default 5)
- Ensure total duration of all scenes does not exceed 30 seconds

Make the storyboard compelling, professional, and aligned with the content from the URL.`,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Generation error:", error);

    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        return Response.json(
          { error: "API rate limit reached. Please try again later." },
          { status: 429 },
        );
      }

      if (error.message.includes("timeout")) {
        return Response.json(
          { error: "Request timed out. Please try again." },
          { status: 504 },
        );
      }
    }

    return Response.json(
      { error: "Failed to generate storyboard. Please try again." },
      { status: 500 },
    );
  }
}
