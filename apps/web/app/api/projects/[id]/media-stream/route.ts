import { desc, eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { checkpoint, project } from "@doujin/database/schema";
import type { TStoryboard } from "@doujin/shared";
import { requireAuth } from "~/lib/auth-middleware";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import {
  createForbiddenError,
  createNotFoundError,
  createServerError,
} from "~/lib/error-helpers";

export const runtime = "nodejs";
export const maxDuration = 300;

const GOOGLE_API_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;

async function generateImage(prompt: string) {
  if (!GOOGLE_API_KEY) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Image generation failed");
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> };
    }>;
  };

  const inlineData =
    data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData ??
    null;

  if (!inlineData) {
    throw new Error("Image generation returned no data");
  }

  return { base64: inlineData.data, mimeType: inlineData.mimeType };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

type VideoOperationResponse = {
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{ video?: { uri?: string } }>;
    };
    generatedVideos?: Array<{ video?: { uri?: string } }>;
    outputUri?: string;
    outputs?: Array<{ uri?: string }>;
    predictions?: Array<{
      uri?: string;
      video?: { uri?: string };
      videoUri?: string;
    }>;
  };
  outputUri?: string;
  uri?: string;
};

function extractVideoUrl(response: VideoOperationResponse | null | undefined): string | null {
  return (
    response?.response?.generateVideoResponse?.generatedSamples?.[0]?.video
      ?.uri ??
    response?.response?.generatedVideos?.[0]?.video?.uri ??
    response?.response?.outputUri ??
    response?.response?.outputs?.[0]?.uri ??
    response?.response?.predictions?.[0]?.uri ??
    response?.response?.predictions?.[0]?.video?.uri ??
    response?.response?.predictions?.[0]?.videoUri ??
    response?.outputUri ??
    response?.uri ??
    null
  );
}

async function generateVideo(prompt: string) {
  if (!GOOGLE_API_KEY) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  }

  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
      }),
    },
  );

  if (!startResponse.ok) {
    const message = await startResponse.text();
    throw new Error(message || "Video generation request failed");
  }

  const startData = (await startResponse.json()) as { name?: string };
  const operationName = startData.name;
  if (!operationName) {
    throw new Error("Video generation did not return an operation name");
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(5000);
    const pollResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GOOGLE_API_KEY}`,
    );
    if (!pollResponse.ok) continue;
    const pollData = await pollResponse.json();
    if (pollData.done) {
      const url = extractVideoUrl(pollData);
      if (!url) {
        throw new Error("Video generation completed without output URL");
      }
      return { sourceUrl: url };
    }
  }

  throw new Error("Video generation timed out");
}

function buildAssetPrompt(scene: {
  onScreenText: string;
  voiceoverText: string;
  duration: number;
}, asset: { description: string; type: "image" | "video" }) {
  return `Generate a ${asset.type} asset for this scene.

Scene duration: ${scene.duration}s
On-screen text: ${scene.onScreenText}
Voiceover: ${scene.voiceoverText}

Asset direction: ${asset.description}

Style: cinematic, polished, high-quality, brand-safe.`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(`[${correlationId}] GET /api/projects/${projectId}/media-stream`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  try {
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

    const [activeCheckpoint] = existingProject.activeCheckpointId
      ? await db
          .select()
          .from(checkpoint)
          .where(eq(checkpoint.id, existingProject.activeCheckpointId))
          .limit(1)
      : await db
          .select()
          .from(checkpoint)
          .where(eq(checkpoint.projectId, projectId))
          .orderBy(desc(checkpoint.createdAt))
          .limit(1);

    if (!activeCheckpoint) {
      return createNotFoundError("Checkpoint", correlationId);
    }

    const storyboard = activeCheckpoint.storyboardJson as TStoryboard;
    const tasks = storyboard.scenes.flatMap((scene) =>
      scene.assetSuggestions
        .filter((asset) => !asset.placeholderUrl)
        .map((asset) => ({
          assetId: asset.id,
          assetType: asset.type,
          description: asset.description,
          sceneId: scene.id,
          scene,
        })),
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const total = tasks.length;
          let completed = 0;

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "generation_progress",
                message: "Preparing media generation",
                progress: total === 0 ? 100 : 5,
              })}\n\n`,
            ),
          );

          const concurrency = 2;
          const queue = [...tasks];

          const workers = Array.from({ length: concurrency }, async () => {
            while (queue.length > 0) {
              const task = queue.shift();
              if (!task) return;
              const prompt = buildAssetPrompt(task.scene, {
                description: task.description,
                type: task.assetType,
              });

              if (task.assetType === "image") {
                const image = await generateImage(prompt);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "asset_generated",
                      assetId: task.assetId,
                      sceneId: task.sceneId,
                      assetType: "image",
                      mimeType: image.mimeType,
                      base64: image.base64,
                    })}\n\n`,
                  ),
                );
              } else {
                const video = await generateVideo(prompt);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "asset_generated",
                      assetId: task.assetId,
                      sceneId: task.sceneId,
                      assetType: "video",
                      sourceUrl: video.sourceUrl,
                    })}\n\n`,
                  ),
                );
              }

              completed += 1;
              const progress =
                total === 0 ? 100 : Math.min(95, Math.round((completed / total) * 90 + 10));
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "generation_progress",
                    message: `Generated ${completed} of ${total} assets`,
                    progress,
                  })}\n\n`,
                ),
              );
            }
          });

          await Promise.all(workers);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "asset_generation_complete",
                total,
              })}\n\n`,
            ),
          );
          controller.close();
        } catch (error) {
          console.error(`[${correlationId}] Media stream error:`, error);
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

    return withCorrelationId(
      new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      }),
      correlationId,
    );
  } catch (error) {
    console.error(`[${correlationId}] Media stream error:`, error);
    return createServerError(correlationId);
  }
}
