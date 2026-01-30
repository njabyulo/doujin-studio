import { SStoryboard } from "@a-ds/remotion";
import { google } from "@ai-sdk/google";
import { Output, streamText } from "ai";
import { requireAuth } from "~/lib/auth-middleware";
import { getCorrelationId } from "~/lib/correlation-middleware";
import { createServerError, createValidationError } from "~/lib/error-helpers";
import { withRetry } from "~/lib/retry-helpers";

export const maxDuration = 60;

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req);
  console.log(`[${correlationId}] POST /api/generate`);

  const { error } = await requireAuth(req, correlationId);
  if (error) return error;

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      console.log(`[${correlationId}] Invalid URL`);
      return createValidationError(correlationId, {
        url: ["URL is required and must be a string"],
      });
    }

    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(url)) {
      console.log(`[${correlationId}] Invalid URL format`);
      return createValidationError(correlationId, {
        url: ["Invalid URL format. Must start with http:// or https://"],
      });
    }

    console.log(`[${correlationId}] Starting generation for URL: ${url}`);

    const result = await withRetry(
      async () =>
        await streamText({
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
        }),
      2,
      1000,
    );

    const response = result.toTextStreamResponse();
    response.headers.set("x-correlation-id", correlationId);
    return response;
  } catch (error) {
    console.error(`[${correlationId}] Generation error:`, error);

    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        return createValidationError(correlationId, {
          rate: ["API rate limit reached. Please try again later."],
        });
      }

      if (error.message.includes("timeout")) {
        return createValidationError(correlationId, {
          timeout: ["Request timed out. Please try again."],
        });
      }
    }

    return createServerError(correlationId);
  }
}
