import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  aiChatRequestSchema,
  applyEditorCommandsInputSchema,
  applyEditorCommand,
  timelineDataSchema,
  type ApplyEditorCommandsResult,
} from "@doujin/contracts";
import { and, createDb, eq } from "@doujin/database";
import { aiChatLog, timeline, timelineVersion } from "@doujin/database/schema";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { Hono } from "hono";
import { ApiError } from "../errors";
import {
  requireLatestTimelineVersion,
  requireTimelineMembership,
  validateTimelineAssetReferences,
} from "../lib/timeline-access";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

const ONE_HOUR_MS = 60 * 60 * 1000;
const DEFAULT_AI_CHAT_MODEL = "gemini-2.5-flash";
const DEFAULT_RATE_LIMIT_PER_HOUR = 20;
const DEFAULT_MAX_TOOL_CALLS = 2;
const DEFAULT_MAX_COMMANDS_PER_TOOL_CALL = 12;
const DEFAULT_LOG_SNIPPET_CHARS = 600;

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

function toPositiveInt(
  rawValue: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

function readMessageText(message: unknown) {
  if (!message || typeof message !== "object") {
    return "";
  }

  const parts =
    "parts" in message && Array.isArray(message.parts) ? message.parts : null;
  if (!parts) {
    return "";
  }

  return parts
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }

      const text =
        "text" in part && typeof part.text === "string" ? part.text : "";
      return text.trim();
    })
    .filter(Boolean)
    .join(" ");
}

function extractLatestUserPrompt(messages: unknown[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") {
      continue;
    }

    if ("role" in message && message.role !== "user") {
      continue;
    }

    const text = readMessageText(message);
    if (text) {
      return text;
    }
  }

  return "";
}

function extractAssistantResponseText(message: UIMessage) {
  if (!Array.isArray(message.parts)) {
    return "";
  }

  return message.parts
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }

      if ("type" in part && part.type === "text" && "text" in part) {
        return typeof part.text === "string" ? part.text : "";
      }

      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function summarizeTimeline(data: Awaited<ReturnType<typeof requireLatestTimelineVersion>>["data"]) {
  const lines: string[] = [];
  lines.push(`Timeline duration: ${data.durationMs}ms`);
  lines.push(`Timeline fps: ${data.fps}`);

  for (const track of data.tracks) {
    lines.push(`Track ${track.name} (${track.kind}) id=${track.id}`);
    track.clips.forEach((clip, index) => {
      lines.push(
        [
          `  Clip ${index + 1}`,
          `id=${clip.id}`,
          `start=${clip.startMs}`,
          `end=${clip.endMs}`,
          `assetId=${clip.assetId ?? "none"}`,
          `text=${clip.text ?? "none"}`,
          `volume=${clip.volume ?? "none"}`,
        ].join(" "),
      );
    });
  }

  return lines.join("\n");
}

function summarizeContext(context: ReturnType<typeof aiChatRequestSchema.parse>["context"]) {
  if (!context) {
    return "No extra multimodal context was provided.";
  }

  const lines: string[] = [];
  lines.push(`Context mode: ${context.mode}`);
  if (context.notes) {
    lines.push(`Notes: ${context.notes}`);
  }

  if (context.timelineMetadata) {
    lines.push(
      `Client timeline metadata: fps=${context.timelineMetadata.fps}, durationMs=${context.timelineMetadata.durationMs}, trackCount=${context.timelineMetadata.trackCount}, clipCount=${context.timelineMetadata.clipCount}`,
    );
  }

  if (context.transcript?.length) {
    lines.push("Transcript segments:");
    for (const segment of context.transcript.slice(0, 15)) {
      lines.push(
        `- [${segment.startMs}-${segment.endMs}] ${segment.speaker ?? "speaker"}: ${segment.text}`,
      );
    }
  }

  if (context.keyframes?.length) {
    lines.push("Keyframes:");
    for (const frame of context.keyframes.slice(0, 15)) {
      lines.push(`- [${frame.timestampMs}] ${frame.imageUrl}`);
    }
  }

  if (context.videoRef) {
    lines.push(`Video reference URL: ${context.videoRef.url}`);
  }

  return lines.join("\n");
}

function buildSystemPrompt({
  timelineSummary,
  contextSummary,
  maxCommandsPerToolCall,
}: {
  timelineSummary: string;
  contextSummary: string;
  maxCommandsPerToolCall: number;
}) {
  return [
    "You are Doujin Studio's timeline edit assistant.",
    "Always produce practical timeline edits.",
    "When an edit is requested, call applyEditorCommands with structured commands.",
    "Use command clip IDs exactly as provided in the timeline summary.",
    "Do not exceed the maximum commands per call.",
    `Maximum commands per applyEditorCommands call: ${maxCommandsPerToolCall}.`,
    "If the request is ambiguous, ask one concise clarification question instead of guessing.",
    "",
    "Timeline summary:",
    timelineSummary,
    "",
    "Multimodal context summary:",
    contextSummary,
  ].join("\n");
}

function shouldUseDeterministicTestMode(c: {
  env: AppEnv["Bindings"];
  req: { header: (name: string) => string | undefined };
}) {
  if (c.env.APP_ENV === "test") {
    return true;
  }

  if (c.env.APP_ENV === "production") {
    return false;
  }

  return c.req.header("x-ai-test-mode") === "1";
}

function createStaticAssistantStream(messages: UIMessage[], assistantText: string) {
  const stream = createUIMessageStream<UIMessage>({
    originalMessages: messages,
    execute: ({ writer }) => {
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: assistantText });
      writer.write({ type: "text-end", id: textId });
      writer.write({ type: "finish", finishReason: "stop" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

async function countRequestsInWindow({
  env,
  userId,
  projectId,
  sinceMs,
}: {
  env: AppEnv["Bindings"];
  userId: string;
  projectId: string;
  sinceMs: number;
}) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as count
     FROM ai_chat_logs
     WHERE user_id = ?
       AND project_id = ?
       AND status != 'rate_limited'
       AND created_at >= ?`,
  )
    .bind(userId, projectId, sinceMs)
    .first<{ count: number | string }>();

  return Number(row?.count ?? 0);
}

export function createAiRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/chat", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Invalid AI chat payload");
    }

    const parsedBody = aiChatRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid AI chat payload");
    }

    const input = parsedBody.data;
    const messages = input.messages as UIMessage[];
    const promptExcerpt = extractLatestUserPrompt(input.messages);
    const db = createDb(c.env.DB);
    const membership = await requireTimelineMembership(db, input.timelineId, user.id);

    const modelName = c.env.AI_CHAT_MODEL || DEFAULT_AI_CHAT_MODEL;
    const rateLimitPerHour = toPositiveInt(
      c.env.AI_CHAT_RATE_LIMIT_PER_HOUR,
      DEFAULT_RATE_LIMIT_PER_HOUR,
      1,
      500,
    );
    const maxToolCalls = toPositiveInt(
      c.env.AI_CHAT_MAX_TOOL_CALLS,
      DEFAULT_MAX_TOOL_CALLS,
      1,
      10,
    );
    const maxCommandsPerToolCall = toPositiveInt(
      c.env.AI_CHAT_MAX_COMMANDS_PER_TOOL_CALL,
      DEFAULT_MAX_COMMANDS_PER_TOOL_CALL,
      1,
      100,
    );
    const logSnippetChars = toPositiveInt(
      c.env.AI_CHAT_LOG_SNIPPET_CHARS,
      DEFAULT_LOG_SNIPPET_CHARS,
      80,
      4000,
    );

    const requestsInWindow = await countRequestsInWindow({
      env: c.env,
      userId: user.id,
      projectId: membership.projectId,
      sinceMs: Date.now() - ONE_HOUR_MS,
    });

    if (requestsInWindow >= rateLimitPerHour) {
      await db.insert(aiChatLog).values({
        id: crypto.randomUUID(),
        userId: user.id,
        projectId: membership.projectId,
        timelineId: input.timelineId,
        model: modelName,
        status: "rate_limited",
        promptExcerpt: truncateText(promptExcerpt, logSnippetChars),
        responseExcerpt: "",
        toolCallCount: 0,
      });

      throw new ApiError(
        429,
        "RATE_LIMITED",
        "AI chat rate limit exceeded for this project",
      );
    }

    const logId = crypto.randomUUID();
    await db.insert(aiChatLog).values({
      id: logId,
      userId: user.id,
      projectId: membership.projectId,
      timelineId: input.timelineId,
      model: modelName,
      status: "ok",
      promptExcerpt: truncateText(promptExcerpt, logSnippetChars),
      responseExcerpt: "",
      toolCallCount: 0,
    });

    let toolCallsUsed = 0;

    const runApplyEditorCommands = async (
      payload: unknown,
    ): Promise<ApplyEditorCommandsResult> => {
      const parsedInput = applyEditorCommandsInputSchema.safeParse(payload);
      if (!parsedInput.success) {
        return {
          status: "error",
          timelineId: input.timelineId,
          newVersion: null,
          appliedCommandCount: 0,
          changedClipIds: [],
          message: "Tool input is invalid.",
        };
      }

      const toolInput = parsedInput.data;
      if (toolInput.timelineId !== input.timelineId) {
        return {
          status: "error",
          timelineId: input.timelineId,
          newVersion: null,
          appliedCommandCount: 0,
          changedClipIds: [],
          message: "timelineId mismatch for applyEditorCommands.",
        };
      }

      if (toolInput.commands.length > maxCommandsPerToolCall) {
        return {
          status: "error",
          timelineId: input.timelineId,
          newVersion: null,
          appliedCommandCount: 0,
          changedClipIds: [],
          message: `Command count exceeds max (${maxCommandsPerToolCall}).`,
        };
      }

      if (toolCallsUsed >= maxToolCalls) {
        return {
          status: "error",
          timelineId: input.timelineId,
          newVersion: null,
          appliedCommandCount: 0,
          changedClipIds: [],
          message: "Tool call limit reached for this request.",
        };
      }

      toolCallsUsed += 1;
      const changedClipIds = new Set<string>();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const latest = await requireLatestTimelineVersion(db, input.timelineId);
        let nextData = latest.data;
        let failed = false;

        for (const command of toolInput.commands) {
          if ("clipId" in command) {
            changedClipIds.add(command.clipId);
          }
          if (command.type === "addClip" && command.clip.id) {
            changedClipIds.add(command.clip.id);
          }

          const updated = applyEditorCommand(nextData, command);
          if (updated === nextData) {
            failed = true;
            break;
          }
          nextData = updated;
        }

        if (failed) {
          return {
            status: "error",
            timelineId: input.timelineId,
            newVersion: null,
            appliedCommandCount: 0,
            changedClipIds: [...changedClipIds],
            message: "One or more commands were invalid for the current timeline state.",
          };
        }

        if (nextData === latest.data) {
          return {
            status: "no_change",
            timelineId: input.timelineId,
            newVersion: latest.version,
            appliedCommandCount: 0,
            changedClipIds: [...changedClipIds],
            message: "Commands produced no timeline change.",
          };
        }

        const validatedData = timelineDataSchema.parse(nextData);
        await validateTimelineAssetReferences(db, membership.projectId, validatedData);
        const nextVersion = latest.version + 1;

        try {
          await db.insert(timelineVersion).values({
            id: crypto.randomUUID(),
            timelineId: input.timelineId,
            version: nextVersion,
            source: "ai",
            createdByUserId: user.id,
            data: validatedData,
          });
        } catch (error) {
          if (isUniqueConstraintError(error) && attempt === 0) {
            continue;
          }

          if (isUniqueConstraintError(error)) {
            return {
              status: "error",
              timelineId: input.timelineId,
              newVersion: null,
              appliedCommandCount: 0,
              changedClipIds: [...changedClipIds],
              message: "Timeline version conflict while applying AI edits.",
            };
          }

          throw error;
        }

        await db
          .update(timeline)
          .set({
            latestVersion: nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(eq(timeline.id, input.timelineId), eq(timeline.latestVersion, latest.version)),
          );

        return {
          status: "applied",
          timelineId: input.timelineId,
          newVersion: nextVersion,
          appliedCommandCount: toolInput.commands.length,
          changedClipIds: [...changedClipIds],
          message: `Applied ${toolInput.commands.length} timeline commands.`,
        };
      }

      return {
        status: "error",
        timelineId: input.timelineId,
        newVersion: null,
        appliedCommandCount: 0,
        changedClipIds: [...changedClipIds],
        message: "Could not apply commands after retrying timeline conflict.",
      };
    };

    try {
      const latest = await requireLatestTimelineVersion(db, input.timelineId);
      const timelineSummary = summarizeTimeline(latest.data);
      const contextSummary = summarizeContext(input.context);
      const systemPrompt = buildSystemPrompt({
        timelineSummary,
        contextSummary,
        maxCommandsPerToolCall,
      });

      if (shouldUseDeterministicTestMode(c)) {
        const latestPrompt = promptExcerpt.toLowerCase();
        let assistantText =
          "Test mode response: no deterministic edit pattern matched.";

        if (latestPrompt.includes("trim clip 1 to 3s")) {
          const videoTrack = latest.data.tracks.find((track) => track.kind === "video");
          const firstClip = videoTrack?.clips[0];
          if (firstClip) {
            const applied = await runApplyEditorCommands({
              timelineId: input.timelineId,
              commands: [
                {
                  type: "trimClip",
                  clipId: firstClip.id,
                  endMs: firstClip.startMs + 3000,
                },
              ],
            });
            assistantText = applied.message;
          }
        } else if (latestPrompt.includes("tool spam")) {
          for (let index = 0; index < maxToolCalls + 2; index += 1) {
            const videoTrack = latest.data.tracks.find((track) => track.kind === "video");
            const firstClip = videoTrack?.clips[0];
            if (!firstClip) {
              break;
            }
            await runApplyEditorCommands({
              timelineId: input.timelineId,
              commands: [
                {
                  type: "trimClip",
                  clipId: firstClip.id,
                  endMs: Math.max(firstClip.startMs + 1000, firstClip.endMs - 100),
                },
              ],
            });
          }
          assistantText = "Tool spam simulation complete.";
        }

        await db
          .update(aiChatLog)
          .set({
            status: "ok",
            responseExcerpt: truncateText(assistantText, logSnippetChars),
            toolCallCount: toolCallsUsed,
          })
          .where(eq(aiChatLog.id, logId));

        return createStaticAssistantStream(messages, assistantText);
      }

      const google = createGoogleGenerativeAI({
        apiKey: c.env.GEMINI_API_KEY,
      });

      const result = streamText({
        model: google(modelName),
        system: systemPrompt,
        messages: await convertToModelMessages(messages),
        stopWhen: stepCountIs(maxToolCalls * 2 + 1),
        tools: {
          applyEditorCommands: tool({
            description:
              "Apply structured editor commands to the current timeline and persist a new AI timeline version.",
            inputSchema: applyEditorCommandsInputSchema,
            execute: runApplyEditorCommands,
          }),
        },
      });

      return result.toUIMessageStreamResponse({
        originalMessages: messages,
        onFinish: async ({ responseMessage }) => {
          const responseText = extractAssistantResponseText(responseMessage);
          await db
            .update(aiChatLog)
            .set({
              status: "ok",
              responseExcerpt: truncateText(responseText, logSnippetChars),
              toolCallCount: toolCallsUsed,
            })
            .where(eq(aiChatLog.id, logId));
        },
        onError: () => "AI response failed. Please retry.",
      });
    } catch (error) {
      await db
        .update(aiChatLog)
        .set({
          status: "error",
          responseExcerpt: truncateText(
            error instanceof Error ? error.message : "Unknown AI error",
            logSnippetChars,
          ),
          toolCallCount: toolCallsUsed,
        })
        .where(eq(aiChatLog.id, logId));

      throw error;
    }
  });

  return app;
}
