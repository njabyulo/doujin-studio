import { eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { project } from "@doujin/database/schema";
import { SMediaPlan } from "@doujin/shared";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { requireAuth } from "~/lib/auth-middleware";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import {
  createForbiddenError,
  createErrorResponse,
  createNotFoundError,
  createServerError,
  createValidationError,
} from "~/lib/error-helpers";
import { checkRateLimit } from "~/lib/rate-limit-middleware";

export const runtime = "nodejs";
export const maxDuration = 600;

const SGenerateVideoInput = z.object({
  promptId: z.string().uuid(),
  force: z.boolean().optional(),
});

function getGeminiApiKey(): string | null {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_AI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    null
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function clampDurationSeconds(value: number | undefined) {
  if (!value || Number.isNaN(value)) return undefined;
  const rounded = Math.round(value);
  return Math.min(8, Math.max(4, rounded));
}

function buildVideoPrompt(input: {
  prompt: string;
  style?: string;
  aspectRatio?: "1:1" | "9:16" | "16:9";
  durationSec?: number;
}) {
  const lines = [
    "Generate a video asset using the direction below.",
    `Direction: ${input.prompt}`,
  ];

  if (input.style) lines.push(`Style: ${input.style}`);
  if (input.aspectRatio) lines.push(`Aspect ratio: ${input.aspectRatio}`);
  if (input.durationSec) lines.push(`Duration: ${input.durationSec}s`);

  lines.push("Quality: cinematic, polished, brand-safe.");
  return lines.join("\n");
}

function extractVideoUri(operation: unknown): string | null {
  const op = operation as {
    error?: {
      message?: string;
      status?: string;
    };
    response?: {
      generatedVideos?: Array<{
        video?: {
          uri?: string;
          fileUri?: string;
        };
      }>;
    };
  };

  const item = op.response?.generatedVideos?.[0]?.video;
  return item?.uri ?? item?.fileUri ?? null;
}

function getOperationError(operation: unknown): string | null {
  const op = operation as {
    error?:
      | string
      | {
          message?: string;
          status?: string;
        }
      | { error?: { message?: string; status?: string } };
  };
  if (!op.error) return null;
  if (typeof op.error === "string") return op.error;
  if ("message" in op.error || "status" in op.error) {
    const e = op.error as { message?: string; status?: string };
    return e.message ?? e.status ?? "Video generation failed";
  }
  const nested = (op.error as { error?: { message?: string; status?: string } })
    .error;
  return nested?.message ?? nested?.status ?? "Video generation failed";
}

function operationDebug(operation: unknown) {
  const op = operation as {
    name?: string;
    done?: boolean;
    metadata?: unknown;
    response?: unknown;
    error?: unknown;
  };

  return {
    name: op.name,
    done: op.done,
    hasMetadata: Boolean(op.metadata),
    hasResponse: Boolean(op.response),
    hasError: Boolean(op.error),
    responseKeys:
      op.response && typeof op.response === "object"
        ? Object.keys(op.response as Record<string, unknown>).slice(0, 25)
        : [],
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(
    `[${correlationId}] POST /api/projects/${projectId}/generate/videos`,
  );

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
    const input = SGenerateVideoInput.parse(body);

    const [existingProject] = await db
      .select()
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

    if (!existingProject) {
      return createNotFoundError("Project", correlationId);
    }

    if (existingProject.userId !== authResult.user.id) {
      return createForbiddenError(correlationId);
    }

    const parsedPlan = SMediaPlan.safeParse(existingProject.mediaPlanJson);
    if (!parsedPlan.success) {
      return createValidationError(correlationId, {
        mediaPlan: ["Media plan is missing or invalid."],
      });
    }

    const mediaPlan = parsedPlan.data;
    const prompt = mediaPlan.prompts.videos.find(
      (item) => item.id === input.promptId,
    );

    if (!prompt) {
      return createNotFoundError("Prompt", correlationId);
    }

    if (!input.force && prompt.asset?.url) {
      return createValidationError(correlationId, {
        promptId: ["Video already generated for this prompt."],
      });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return createValidationError(correlationId, {
        apiKey: [
          "Missing Google AI API key. Set GOOGLE_GENERATIVE_AI_API_KEY.",
        ],
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const durationSeconds = clampDurationSeconds(prompt.durationSec);
    const generationPrompt = buildVideoPrompt({
      prompt: prompt.prompt,
      style: prompt.style,
      aspectRatio: prompt.aspectRatio,
      durationSec: durationSeconds,
    });

    // Video generation is a long-running operation.
    let operation = await ai.models.generateVideos({
      model: process.env.VEO_MODEL || "veo-3.0-fast-generate-001",
      prompt: generationPrompt,
      config: {
        numberOfVideos: 1,
        aspectRatio: prompt.aspectRatio ?? "9:16",
        durationSeconds,
      },
    });

    const pollIntervalMs = 10_000;
    const maxPolls = 60;

    for (let i = 0; i < maxPolls && !operation.done; i += 1) {
      await sleep(pollIntervalMs);
      operation = await ai.operations.getVideosOperation({ operation });
    }

    if (!operation.done) {
      return createErrorResponse(
        "Video generation timed out",
        504,
        correlationId,
        process.env.NODE_ENV === "production"
          ? undefined
          : { operation: operationDebug(operation) },
      );
    }

    const operationError = getOperationError(operation);
    if (operationError) {
      return createErrorResponse(
        "Video generation failed",
        500,
        correlationId,
        process.env.NODE_ENV === "production"
          ? undefined
          : { message: operationError },
      );
    }

    const uri = extractVideoUri(operation);
    if (!uri) {
      return createErrorResponse(
        "Video generation failed",
        500,
        correlationId,
        process.env.NODE_ENV === "production"
          ? undefined
          : {
              message: "No video uri in operation response",
              operation: operationDebug(operation),
            },
      );
    }

    return withCorrelationId(
      Response.json({
        promptId: input.promptId,
        sourceUrl: uri,
      }),
      correlationId,
    );
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

    console.error(`[${correlationId}] Video generation error:`, error);
    if (process.env.NODE_ENV !== "production") {
      return createErrorResponse(
        "Video generation failed",
        500,
        correlationId,
        {
          message: error instanceof Error ? error.message : String(error),
        },
      );
    }
    return createServerError(correlationId);
  }
}
