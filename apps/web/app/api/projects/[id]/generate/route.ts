import { eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { message, project } from "@doujin/database/schema";
import { SBrandKit, SScript, SStoryboard } from "@doujin/shared";
import { google } from "@ai-sdk/google";
import { Output, streamText } from "ai";
import { z } from "zod";
import { requireAuth } from "~/lib/auth-middleware";
import { createCheckpoint } from "~/lib/checkpoint-helpers";
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
export const maxDuration = 60;

const SGenerateInput = z.object({
  url: z.string().url(),
  format: z.enum(["1:1", "9:16", "16:9"]),
  tone: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const SGenerationOutput = z.object({
  storyboard: SStoryboard,
  script: SScript,
  brandKit: SBrandKit,
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(`[${correlationId}] POST /api/projects/${projectId}/generate`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  const rateLimitError = await checkRateLimit(
    authResult.user.id,
    "generate",
    correlationId,
  );
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const input = SGenerateInput.parse(body);

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
        "generate",
      );

      if (existing) {
        console.log(
          `[${correlationId}] Idempotent request, returning existing`,
        );
        return withCorrelationId(Response.json(existing), correlationId);
      }
    }

    const [userMessage] = await db
      .insert(message)
      .values({
        projectId,
        role: "user",
        type: "url_submitted",
        contentJson: {
          version: "1",
          type: "url_submitted",
          url: input.url,
          format: input.format,
          tone: input.tone,
          artifactRefs: [],
        },
      })
      .returning();

    console.log(`[${correlationId}] Starting generation for URL: ${input.url}`);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "generation_progress",
                message: "Extracting page content",
                progress: 10,
              })}\n\n`,
            ),
          );

          const result = streamText({
            model: google("gemini-2.0-flash-exp"),
            output: Output.object({
              schema: SGenerationOutput,
            }),
            prompt: buildPrompt(input.url, input.format, input.tone),
          });

          for await (const partialObject of result.partialOutputStream) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "generation_partial",
                  storyboard: partialObject.storyboard,
                })}\n\n`,
              ),
            );
          }

          const finalObject = await result.output;

          const newCheckpoint = await createCheckpoint({
            projectId,
            sourceMessageId: userMessage.id,
            parentCheckpointId: null,
            storyboard: finalObject.storyboard,
            script: finalObject.script,
            brandKit: finalObject.brandKit,
            name: `Generated from ${new URL(input.url).hostname}`,
            reason: "generation",
          });

          await db.insert(message).values({
            projectId,
            role: "assistant",
            type: "generation_result",
            contentJson: {
              version: "1",
              type: "generation_result",
              checkpointId: newCheckpoint.id,
              summary: `${finalObject.storyboard.scenes.length} scenes, ${finalObject.storyboard.totalDuration}s`,
              artifactRefs: [{ type: "checkpoint", id: newCheckpoint.id }],
            },
          });

          if (input.idempotencyKey) {
            await storeIdempotencyKey(
              input.idempotencyKey,
              projectId,
              authResult.user.id,
              "generate",
              newCheckpoint.id,
            );
          }

          console.log(
            `[${correlationId}] Generation complete: ${newCheckpoint.id}`,
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "generation_complete",
                checkpointId: newCheckpoint.id,
                summary: `${finalObject.storyboard.scenes.length} scenes, ${finalObject.storyboard.totalDuration}s`,
              })}\n\n`,
            ),
          );

          controller.close();
        } catch (error) {
          console.error(`[${correlationId}] Generation error:`, error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "generation_error",
                error: error instanceof Error ? error.message : "Unknown error",
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "x-correlation-id": correlationId,
      },
    });
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

    console.error(`[${correlationId}] Generation error:`, error);
    return createServerError(correlationId);
  }
}

function buildPrompt(url: string, format: string, tone?: string): string {
  return `Analyze the content at this URL: ${url}

Generate a compelling video advertisement with the following requirements:

FORMAT: ${format} aspect ratio

STORYBOARD:
- version: "1"
- format: "${format}"
- totalDuration: sum of all scene durations (target 15-30 seconds)
- scenes: array of 3-6 scenes, each with:
  * id: UUID
  * duration: 3-8 seconds
  * onScreenText: compelling text overlay (max 100 chars)
  * voiceoverText: script for voiceover (max 200 chars)
  * assetSuggestions: array of 1-2 suggestions with type ("image" or "video") and description

SCRIPT:
- version: "1"
- tone: ${tone || "professional and engaging"}
- scenes: array matching storyboard scenes with:
  * sceneId: matching scene UUID
  * voiceover: full voiceover text
  * timing: { start: number, end: number } in seconds

BRAND KIT (extract from URL content):
- version: "1"
- productName: extracted product name
- tagline: extracted or generated tagline
- benefits: array of 3-5 key benefits
- colors: { primary, secondary, accent } in hex format
- fonts: { heading, body } font family names
- tone: brand voice/tone
- pricing: optional pricing info if found
- testimonials: optional array of testimonials if found
- logoUrl: optional logo URL if found

Make the content compelling, professional, and aligned with the URL content.`;
}
