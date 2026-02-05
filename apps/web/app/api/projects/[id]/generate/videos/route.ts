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
    const generationPrompt = buildVideoPrompt({
      prompt: prompt.prompt,
      style: prompt.style,
      aspectRatio: prompt.aspectRatio,
      durationSec: prompt.durationSec,
    });

    // Video generation is a long-running operation.
    let operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: generationPrompt,
      config: {
        numberOfVideos: 1,
        aspectRatio: prompt.aspectRatio ?? "9:16",
        durationSeconds: prompt.durationSec,
      },
    });

    const pollIntervalMs = 10_000;
    const maxPolls = 60;

    for (let i = 0; i < maxPolls && !operation.done; i += 1) {
      await sleep(pollIntervalMs);
      operation = await ai.operations.getVideosOperation({ operation });
    }

    if (!operation.done) {
      return createServerError(correlationId);
    }

    const uri = extractVideoUri(operation);
    if (!uri) {
      return createServerError(correlationId);
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
    return createServerError(correlationId);
  }
}
