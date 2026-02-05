import { desc, eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { message, project } from "@doujin/database/schema";
import { SBrandKit, SScript, SStoryboard } from "@doujin/shared";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "~/lib/auth-middleware";
import { createCheckpoint } from "~/lib/checkpoint-helpers";
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

const SGenerationDraft = z.object({
  title: z.string().optional(),
  storyboard: z.object({
    version: z.string(),
    format: z.enum(["1:1", "9:16", "16:9"]),
    totalDuration: z.number().positive(),
    scenes: z.array(
      z.object({
        id: z.string(),
        duration: z.number().positive(),
        onScreenText: z.string(),
        voiceoverText: z.string(),
        assetSuggestions: z.array(
          z.object({
            id: z.string().uuid().optional(),
            type: z.enum(["image", "video"]),
            description: z.string(),
            placeholderUrl: z.string().url().optional(),
          }),
        ),
      }),
    ),
  }),
  script: z.object({
    version: z.string(),
    tone: z.string(),
    scenes: z.array(
      z.object({
        sceneId: z.string(),
        voiceover: z.string(),
        timing: z.object({
          start: z.number(),
          end: z.number(),
        }),
      }),
    ),
  }),
  brandKit: SBrandKit,
});

const SGenerationOutput = z.object({
  storyboard: SStoryboard,
  script: SScript,
  brandKit: SBrandKit,
  title: z.string(),
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

function normalizeGenerationOutput(
  draft: z.infer<typeof SGenerationDraft>,
  resolvedFormat: "1:1" | "9:16" | "16:9",
  fallbackTitle: string,
) {
  const sceneIdMap = new Map<string, string>();
  const normalizedScenes = draft.storyboard.scenes.map((scene) => {
    const newId = crypto.randomUUID();
    sceneIdMap.set(scene.id, newId);
    return {
      ...scene,
      id: newId,
      assetSuggestions: scene.assetSuggestions.map((asset) => ({
        ...asset,
        id: asset.id ?? crypto.randomUUID(),
      })),
    };
  });

  const normalizedScriptScenes = draft.script.scenes.map((scene, index) => {
    const mapped = sceneIdMap.get(scene.sceneId) ?? normalizedScenes[index]?.id;
    return {
      ...scene,
      sceneId: mapped ?? scene.sceneId,
    };
  });

  const totalDuration = normalizedScenes.reduce(
    (sum, scene) => sum + scene.duration,
    0,
  );

  return {
    title: (draft.title ?? fallbackTitle).trim() || fallbackTitle,
    storyboard: {
      ...draft.storyboard,
      format: resolvedFormat,
      totalDuration,
      scenes: normalizedScenes,
    },
    script: {
      ...draft.script,
      scenes: normalizedScriptScenes,
    },
    brandKit: draft.brandKit,
  };
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
    if (!url) {
      return createValidationError(correlationId, {
        prompt: ["Include a URL in your prompt (http:// or https://)."],
      });
    }

    const resolvedFormat = input.format ?? extractFormat(input.prompt) ?? "9:16";
    const resolvedTone = input.tone ?? extractTone(input.prompt, url);
    const derivedTitle = deriveTitleFromUrl(url);

    const [newProject] = await db
      .insert(project)
      .values({
        userId: authResult.user.id,
        title: derivedTitle,
      })
      .returning();

    const [userMessage] = await db
      .insert(message)
      .values({
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
      })
      .returning();

    const { output } = await generateText({
      model: google("gemini-2.5-flash"),
      output: Output.object({
        schema: SGenerationDraft,
      }),
      prompt: `Analyze the prompt below and generate a storyboard + script + brand kit.

Prompt:
${input.prompt}

Requirements:
- Storyboard format: ${resolvedFormat}
- 3-6 scenes, 3-8 seconds each
- Each scene includes assetSuggestions with id (UUID), type ("image" | "video"), and a short description
- Script scenes align with storyboard scene ids
- Brand kit includes productName, tagline, benefits, colors, fonts, and tone

Return JSON with: { title, storyboard, script, brandKit }`,
    });

    const normalized = normalizeGenerationOutput(
      output,
      resolvedFormat,
      derivedTitle,
    );
    const finalOutput = SGenerationOutput.parse(normalized);

    if (finalOutput.title && finalOutput.title !== derivedTitle) {
      await db
        .update(project)
        .set({ title: finalOutput.title, updatedAt: new Date() })
        .where(eq(project.id, newProject.id));
    }

    const newCheckpoint = await createCheckpoint({
      projectId: newProject.id,
      sourceMessageId: userMessage.id,
      parentCheckpointId: null,
      storyboard: finalOutput.storyboard,
      script: finalOutput.script,
      brandKit: finalOutput.brandKit,
      name: `Generated from ${new URL(url).hostname}`,
      reason: "generation",
    });

    console.log(`[${correlationId}] Project created: ${newProject.id}`);
    return withCorrelationId(
      NextResponse.json(
        {
          project: {
            ...newProject,
            title: finalOutput.title,
          },
          checkpointId: newCheckpoint.id,
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
