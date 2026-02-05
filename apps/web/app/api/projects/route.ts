import { desc, eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { message, project } from "@doujin/database/schema";
import { SMediaPlan } from "@doujin/shared";
import { google } from "@ai-sdk/google";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "~/lib/auth-middleware";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import { createServerError, createValidationError } from "~/lib/error-helpers";
import { checkRateLimit } from "~/lib/rate-limit-middleware";

const SCreateProjectInput = z.object({
  prompt: z.string().min(1),
  format: z.enum(["1:1", "9:16", "16:9"]).optional(),
  tone: z.string().optional(),
});

const SMediaPromptDraft = z.object({
  id: z.string().uuid().optional(),
  prompt: z.string(),
  aspectRatio: z.enum(["1:1", "9:16", "16:9"]).optional(),
  durationSec: z.number().positive().optional(),
  style: z.string().optional(),
  asset: z
    .object({
      url: z.string().url().optional(),
      mimeType: z.string().optional(),
    })
    .optional(),
});

const SMediaPlanDraft = z.object({
  version: z.string().optional(),
  project: z
    .object({
      title: z.string().optional(),
      summary: z.string().optional(),
      sourceUrl: z.string().url().optional(),
    })
    .optional(),
  prompts: z
    .object({
      videos: z.array(SMediaPromptDraft).optional(),
      images: z.array(SMediaPromptDraft).optional(),
    })
    .optional(),
});

function extractUrl(prompt: string): string | null {
  const urlMatch = prompt.match(/https?:\/\/[^\s|]+/);
  return urlMatch?.[0] ?? null;
}

function extractFormat(prompt: string): "1:1" | "9:16" | "16:9" | null {
  const match = prompt.match(/\b(16:9|9:16|1:1)\b/);
  return (match?.[1] as "1:1" | "9:16" | "16:9" | undefined) ?? null;
}

function extractTone(prompt: string, url?: string | null) {
  if (!url) return prompt.trim() || undefined;
  const toneRaw = prompt.replace(url, "").trim().replace(/^\|+/, "").trim();
  return toneRaw.length > 0 ? toneRaw : undefined;
}

function deriveTitleFromUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return "Untitled project";
  }
}

function deriveTitleFromPrompt(prompt: string) {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (!compact) return "Untitled project";
  const words = compact.split(" ").slice(0, 5).join(" ");
  return words || "Untitled project";
}

function normalizeMediaPlan(
  draft: z.infer<typeof SMediaPlanDraft>,
  fallbackTitle: string,
  sourceUrl?: string | null,
) {
  const projectDraft = draft.project ?? {};
  const title = (projectDraft.title ?? fallbackTitle).trim() || fallbackTitle;
  const summary = projectDraft.summary?.trim();
  const resolvedSourceUrl = projectDraft.sourceUrl ?? sourceUrl ?? undefined;

  const normalizePrompt = (item: z.infer<typeof SMediaPromptDraft>) => {
    const prompt = item.prompt.trim();
    if (!prompt) return null;
    return {
      id: item.id ?? crypto.randomUUID(),
      prompt,
      aspectRatio: item.aspectRatio,
      durationSec: item.durationSec,
      style: item.style?.trim() || undefined,
      asset: item.asset,
    };
  };

  const videos = (draft.prompts?.videos ?? [])
    .map(normalizePrompt)
    .filter(Boolean) as Array<{
    id: string;
    prompt: string;
    aspectRatio?: "1:1" | "9:16" | "16:9";
    durationSec?: number;
    style?: string;
    asset?: { url?: string; mimeType?: string };
  }>;

  const images = (draft.prompts?.images ?? [])
    .map(normalizePrompt)
    .filter(Boolean) as Array<{
    id: string;
    prompt: string;
    aspectRatio?: "1:1" | "9:16" | "16:9";
    durationSec?: number;
    style?: string;
    asset?: { url?: string; mimeType?: string };
  }>;

  return SMediaPlan.parse({
    version: "1",
    project: {
      title,
      summary: summary && summary.length > 0 ? summary : undefined,
      sourceUrl: resolvedSourceUrl,
    },
    prompts: {
      videos,
      images,
    },
  });
}

function buildFallbackDraft(
  prompt: string,
  fallbackTitle: string,
  sourceUrl?: string | null,
  fallbackAspectRatio?: "1:1" | "9:16" | "16:9",
): z.infer<typeof SMediaPlanDraft> {
  const aspectRatio = fallbackAspectRatio ?? "9:16";

  return {
    version: "1",
    project: {
      title: fallbackTitle,
      summary: prompt.slice(0, 180),
      sourceUrl: sourceUrl ?? undefined,
    },
    prompts: {
      videos: [
        {
          id: crypto.randomUUID(),
          prompt: `${prompt} Create a tight 3-scene vertical video shot list with pacing cues.`,
          aspectRatio,
          durationSec: 8,
          style: "punchy, social-first",
        },
      ],
      images: [
        {
          id: crypto.randomUUID(),
          prompt: `${prompt} Hero key visual with product focus and clean typography space.`,
          aspectRatio: fallbackAspectRatio ?? "1:1",
          style: "clean, premium",
        },
        {
          id: crypto.randomUUID(),
          prompt: `${prompt} Lifestyle scene with human context and branded color accents.`,
          aspectRatio: fallbackAspectRatio ?? "1:1",
          style: "warm, authentic",
        },
      ],
    },
  };
}

function isNoOutputError(error: unknown) {
  if (NoObjectGeneratedError.isInstance(error)) return true;
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: string }).name);
    return (
      name.includes("NoOutputGeneratedError") ||
      name.includes("NoObjectGeneratedError")
    );
  }
  return false;
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    // Note: not all upstream SDKs support abort signals; we still bound request time
    // by racing with an abort timer and falling back.
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(new TimeoutError(`${label} timed out after ${ms}ms`)),
          { once: true },
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  console.log(`[${correlationId}] POST /api/projects`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) {
    return authResult.error;
  }

  const rateLimitError = await checkRateLimit(
    authResult.user.id,
    "generate",
    correlationId,
  );
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const input = SCreateProjectInput.parse(body);

    const url = extractUrl(input.prompt);
    const derivedTitle = url
      ? deriveTitleFromUrl(url)
      : deriveTitleFromPrompt(input.prompt);

    const mediaPlanPrompt = `You are a creative media planner. Generate a JSON media plan for the prompt below.

Prompt:
${input.prompt}

Return JSON with this shape:
{
  "version": "1",
  "project": {
    "title": "...",
    "summary": "...",
    "sourceUrl": "https://..."
  },
  "prompts": {
    "videos": [
      {
        "id": "UUID",
        "prompt": "...",
        "aspectRatio": "9:16",
        "durationSec": 12,
        "style": "short descriptor"
      }
    ],
    "images": [
      {
        "id": "UUID",
        "prompt": "...",
        "aspectRatio": "1:1",
        "style": "short descriptor"
      }
    ]
  }
}

Guidelines:
- Provide 2-5 video prompts and 2-6 image prompts.
- Prompts should be specific, cinematic, and production-ready.
- Include aspectRatio when relevant (default to 9:16 if unsure).
- Include durationSec only for videos (4-8 seconds).
- Keep style short and punchy.
- If no source URL is available, omit sourceUrl.
`;

    let draft: z.infer<typeof SMediaPlanDraft>;

    try {
      const timeoutMs = clampNumber(
        Number(process.env.MEDIA_PLAN_TIMEOUT_MS ?? 15_000),
        2_000,
        60_000,
      );

      const { output } = await withTimeout(
        generateText({
          model: google("gemini-2.5-flash"),
          output: Output.object({
            schema: SMediaPlanDraft,
          }),
          prompt: mediaPlanPrompt,
          maxRetries: 2,
        }),
        timeoutMs,
        "Media plan generation",
      );
      draft = output;
    } catch (error) {
      if (isNoOutputError(error) || error instanceof TimeoutError) {
        console.error(
          `[${correlationId}] Structured output failed; falling back.`,
          {
            cause:
              error && typeof error === "object" && "cause" in error
                ? (error as { cause?: unknown }).cause
                : undefined,
            text:
              error && typeof error === "object" && "text" in error
                ? (error as { text?: unknown }).text
                : undefined,
            errorName:
              error && typeof error === "object" && "name" in error
                ? (error as { name?: unknown }).name
                : undefined,
          },
        );
        const fallbackAspectRatio =
          input.format ?? extractFormat(input.prompt) ?? "9:16";
        draft = buildFallbackDraft(
          input.prompt,
          derivedTitle,
          url,
          fallbackAspectRatio,
        );
      } else {
        throw error;
      }
    }

    const normalized = normalizeMediaPlan(draft, derivedTitle, url);

    const [newProject] = await db
      .insert(project)
      .values({
        userId: authResult.user.id,
        title: normalized.project.title,
        mediaPlanJson: normalized,
      })
      .returning();

    if (url) {
      const resolvedFormat =
        input.format ?? extractFormat(input.prompt) ?? "9:16";
      const resolvedTone = input.tone ?? extractTone(input.prompt, url);

      await db.insert(message).values({
        projectId: newProject.id,
        role: "user",
        type: "url_submitted",
        contentJson: {
          version: "1",
          type: "url_submitted",
          url,
          format: resolvedFormat,
          tone: resolvedTone,
          artifactRefs: [],
        },
      });
    } else {
      console.log(
        `[${correlationId}] No URL detected; skipping url_submitted message`,
      );
    }

    console.log(`[${correlationId}] Project created: ${newProject.id}`);
    return withCorrelationId(
      NextResponse.json(
        {
          project: {
            ...newProject,
            title: normalized.project.title,
            mediaPlanJson: normalized,
          },
        },
        { status: 201 },
      ),
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

    console.error(`[${correlationId}] Error creating project:`, error);
    return createServerError(correlationId);
  }
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  console.log(`[${correlationId}] GET /api/projects`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const projects = await db
      .select()
      .from(project)
      .where(eq(project.userId, authResult.user.id))
      .orderBy(desc(project.updatedAt));

    console.log(`[${correlationId}] Found ${projects.length} projects`);
    return withCorrelationId(NextResponse.json(projects), correlationId);
  } catch (error) {
    console.error(`[${correlationId}] Error listing projects:`, error);
    return createServerError(correlationId);
  }
}
