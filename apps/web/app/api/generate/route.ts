import { SBrandKit, SScript, SStoryboard } from "@a-ds/shared";
import { google } from "@ai-sdk/google";
import { Output, streamText } from "ai";
import { z } from "zod";
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
          output: Output.object({
            schema: z.object({
              storyboard: SStoryboard,
              script: SScript,
              brandKit: SBrandKit,
            }),
          }),
          prompt: `Analyze the content at this URL: ${url}

Generate a compelling 15-30s video advertisement plan with:

STORYBOARD (strict JSON):
- version: "1"
- format: "9:16"
- totalDuration: sum of all scene durations
- scenes: array of 3-6 scenes
  * id: UUID
  * duration: 3-8 seconds
  * onScreenText: max 100 chars
  * voiceoverText: max 200 chars
  * assetSuggestions: 1-2 items with { type: "image"|"video", description }

SCRIPT (strict JSON):
- version: "1"
- tone: short description
- scenes: aligned to storyboard sceneIds, with start/end timing

BRAND KIT (strict JSON):
- version: "1"
- productName, tagline, benefits
- colors { primary, secondary, accent }
- fonts { heading, body }
- tone

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
