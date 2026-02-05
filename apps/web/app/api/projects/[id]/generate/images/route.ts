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
export const maxDuration = 120;

const SGenerateImageInput = z.object({
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

function buildImagePrompt(input: {
  prompt: string;
  style?: string;
  aspectRatio?: "1:1" | "9:16" | "16:9";
}) {
  const lines = [
    "Generate an image asset using the direction below.",
    `Direction: ${input.prompt}`,
  ];

  if (input.style) lines.push(`Style: ${input.style}`);
  if (input.aspectRatio) lines.push(`Aspect ratio: ${input.aspectRatio}`);

  lines.push("Quality: cinematic, polished, brand-safe.");
  return lines.join("\n");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(
    `[${correlationId}] POST /api/projects/${projectId}/generate/images`,
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
    const input = SGenerateImageInput.parse(body);

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
    const prompt = mediaPlan.prompts.images.find(
      (item) => item.id === input.promptId,
    );

    if (!prompt) {
      return createNotFoundError("Prompt", correlationId);
    }

    if (!input.force && prompt.asset?.url) {
      return createValidationError(correlationId, {
        promptId: ["Image already generated for this prompt."],
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
    const generationPrompt = buildImagePrompt({
      prompt: prompt.prompt,
      style: prompt.style,
      aspectRatio: prompt.aspectRatio,
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: generationPrompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: prompt.aspectRatio,
          outputMimeType: "image/png",
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const inlineData =
      (
        parts as Array<{ inlineData?: { data?: string; mimeType?: string } }>
      ).find((part) => part.inlineData)?.inlineData ?? null;

    if (!inlineData?.data) {
      return createServerError(correlationId);
    }

    return withCorrelationId(
      Response.json({
        promptId: input.promptId,
        mimeType: inlineData.mimeType ?? "image/png",
        base64: inlineData.data,
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

    console.error(`[${correlationId}] Image generation error:`, error);
    return createServerError(correlationId);
  }
}
