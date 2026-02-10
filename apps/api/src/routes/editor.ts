import {
  SInterpretPlaybackRequest,
  SInterpretPlaybackResponse,
  SPlaybackCommand,
} from "@doujin/core";
import { createDb, eq, and } from "@doujin/database";
import {
  aiCreditDefaultPolicy,
  aiCreditPolicy,
  aiDailyUsage,
} from "@doujin/database/schema";
import { lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { ApiError } from "../errors";
import { createApiErrorBody } from "../errors";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

function extractFirstJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0] ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fallbackInterpret(args: {
  prompt: string;
  currentMs?: number;
  durationMs?: number;
}) {
  const prompt = args.prompt.trim().toLowerCase();
  const currentMs = args.currentMs ?? 0;
  const durationMs = args.durationMs ?? 0;

  const seekTo = (toMs: number) => ({
    command: {
      type: "seek" as const,
      toMs: clamp(Math.round(toMs), 0, Math.max(0, durationMs)),
    },
  });

  if (/\b(pause|stop|hold on|hold|freeze)\b/.test(prompt)) {
    return {
      command: { type: "pause" as const },
      reasoning: "Fallback: pause",
    };
  }

  if (/\b(restart|start over|beginning)\b/.test(prompt)) {
    return { ...seekTo(0), reasoning: "Fallback: restart" };
  }

  if (/\b(middle|halfway|half way)\b/.test(prompt) && durationMs > 0) {
    return { ...seekTo(durationMs / 2), reasoning: "Fallback: seek to middle" };
  }

  const forwardMatch = prompt.match(
    /\b(forward|ahead)\s+(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes)\b/,
  );
  if (forwardMatch) {
    const amount = Number.parseFloat(forwardMatch[2] ?? "0");
    const unit = forwardMatch[3] ?? "s";
    const deltaMs = unit.startsWith("m")
      ? amount * 60_000
      : unit === "ms"
        ? amount
        : amount * 1000;
    return {
      ...seekTo(currentMs + deltaMs),
      reasoning: "Fallback: seek forward",
    };
  }

  const backMatch = prompt.match(
    /\b(back|rewind)\s+(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes)\b/,
  );
  if (backMatch) {
    const amount = Number.parseFloat(backMatch[2] ?? "0");
    const unit = backMatch[3] ?? "s";
    const deltaMs = unit.startsWith("m")
      ? amount * 60_000
      : unit === "ms"
        ? amount
        : amount * 1000;
    return {
      ...seekTo(currentMs - deltaMs),
      reasoning: "Fallback: seek backward",
    };
  }

  const absoluteMatch = prompt.match(
    /\b(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes)\b/,
  );
  if (absoluteMatch && /\b(go to|seek|jump)\b/.test(prompt)) {
    const amount = Number.parseFloat(absoluteMatch[1] ?? "0");
    const unit = absoluteMatch[2] ?? "s";
    const toMs = unit.startsWith("m")
      ? amount * 60_000
      : unit === "ms"
        ? amount
        : amount * 1000;
    return { ...seekTo(toMs), reasoning: "Fallback: seek to timestamp" };
  }

  if (/\b(play|resume|start)\b/.test(prompt)) {
    return { command: { type: "play" as const }, reasoning: "Fallback: play" };
  }

  return {
    command: {
      type: "none" as const,
      message: "Unrecognized playback command",
    },
    reasoning: "Fallback: no match",
  };
}

function shouldUseFallback(apiKey: string, appEnv: string | undefined) {
  const trimmed = apiKey.trim();
  if (!trimmed) return true;
  // Avoid outbound calls in test mode.
  if (appEnv === "test") return true;
  // Common placeholder used in local/test configs.
  if (trimmed === "test-gemini-key") return true;
  return false;
}

export function createEditorRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/interpret", requireAuth, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Invalid request payload");
    }

    const parsed = SInterpretPlaybackRequest.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid request payload");
    }

    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const { prompt, currentMs, durationMs } = parsed.data;
    const apiKey = c.env.GEMINI_API_KEY ?? "";

    const forceFallback = c.req.header("x-ai-test-mode") === "1";

    const feature = "editor_interpret";
    const dayUtc = new Date().toISOString().slice(0, 10);

    const nextUtcMidnightMs = (() => {
      const now = new Date();
      return Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      );
    })();
    const resetIso = new Date(nextUtcMidnightMs).toISOString();
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((nextUtcMidnightMs - Date.now()) / 1000),
    );

    // Credits: default 10/day, optional per-user override (NULL = unlimited).
    const db = createDb(c.env.DB);
    const [defaultPolicy] = await db
      .select({
        dailyLimit: aiCreditDefaultPolicy.dailyLimit,
        enabled: aiCreditDefaultPolicy.enabled,
      })
      .from(aiCreditDefaultPolicy)
      .where(eq(aiCreditDefaultPolicy.feature, feature))
      .limit(1);

    if (!defaultPolicy) {
      throw new ApiError(500, "INTERNAL_ERROR", "Missing AI credit policy");
    }

    const [overridePolicy] = await db
      .select({
        dailyLimit: aiCreditPolicy.dailyLimit,
        enabled: aiCreditPolicy.enabled,
      })
      .from(aiCreditPolicy)
      .where(
        and(
          eq(aiCreditPolicy.userId, user.id),
          eq(aiCreditPolicy.feature, feature),
        ),
      )
      .limit(1);

    if (overridePolicy && overridePolicy.enabled === false) {
      c.header("Retry-After", retryAfterSeconds.toString());
      c.header("x-ai-credits-limit", "0");
      c.header("x-ai-credits-remaining", "0");
      c.header("x-ai-credits-reset", resetIso);
      return c.json(
        createApiErrorBody(
          "RATE_LIMITED",
          "Daily credits are used up. Try again tomorrow.",
          c.get("requestId"),
        ),
        429,
      );
    }

    const isUnlimited =
      overridePolicy && overridePolicy.dailyLimit === null ? true : false;

    const effectiveLimit =
      overridePolicy && overridePolicy.dailyLimit != null
        ? overridePolicy.dailyLimit
        : defaultPolicy.dailyLimit;

    if (!defaultPolicy.enabled) {
      c.header("Retry-After", retryAfterSeconds.toString());
      c.header("x-ai-credits-limit", "0");
      c.header("x-ai-credits-remaining", "0");
      c.header("x-ai-credits-reset", resetIso);
      return c.json(
        createApiErrorBody(
          "RATE_LIMITED",
          "Daily credits are used up. Try again tomorrow.",
          c.get("requestId"),
        ),
        429,
      );
    }

    if (!isUnlimited) {
      // Ensure usage row exists.
      await db
        .insert(aiDailyUsage)
        .values({
          userId: user.id,
          dayUtc,
          feature,
          used: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [
            aiDailyUsage.userId,
            aiDailyUsage.dayUtc,
            aiDailyUsage.feature,
          ],
        });

      const updated = await db
        .update(aiDailyUsage)
        .set({
          used: sql`${aiDailyUsage.used} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiDailyUsage.userId, user.id),
            eq(aiDailyUsage.dayUtc, dayUtc),
            eq(aiDailyUsage.feature, feature),
            lt(aiDailyUsage.used, effectiveLimit),
          ),
        )
        .returning({ used: aiDailyUsage.used });

      if (updated.length === 0) {
        c.header("Retry-After", retryAfterSeconds.toString());
        c.header("x-ai-credits-limit", String(effectiveLimit));
        c.header("x-ai-credits-remaining", "0");
        c.header("x-ai-credits-reset", resetIso);
        return c.json(
          createApiErrorBody(
            "RATE_LIMITED",
            "Daily credits are used up. Try again tomorrow.",
            c.get("requestId"),
          ),
          429,
        );
      }

      const usedNow = updated[0]?.used ?? effectiveLimit;
      const remaining = Math.max(0, effectiveLimit - usedNow);
      c.header("x-ai-credits-limit", String(effectiveLimit));
      c.header("x-ai-credits-remaining", String(remaining));
      c.header("x-ai-credits-reset", resetIso);
    }

    if (forceFallback || shouldUseFallback(apiKey, c.env.APP_ENV)) {
      return c.json(
        SInterpretPlaybackResponse.parse(fallbackInterpret(parsed.data)),
        200,
      );
    }

    const systemInstruction = `You are a video editor playback controller.
The user provides a command in natural language and you interpret it into a structured playback action.

Output format (JSON only):
{ "command": { ... }, "reasoning": "..." }

Where "command" is one of:
- { "type": "play" }
- { "type": "pause" }
- { "type": "seek", "toMs": number }
- { "type": "none", "message": string }

Rules:
1. "Restart" or "beginning" -> seek to 0.
2. Recognize time durations like "5s", "10 seconds", "halfway".
3. Map "stop" or "hold on" to "pause".
4. Provide a brief reasoning for your choice.
5. Output ONLY the JSON object.`;

    const requestText = `Prompt: "${prompt}"
Context: Current position ${currentMs ?? 0}ms, Duration ${durationMs ?? 0}ms`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
        apiKey,
      )}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: requestText }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[editor/interpret] Gemini request failed", {
        status: response.status,
        body: text.slice(0, 500),
      });

      return c.json(
        SInterpretPlaybackResponse.parse(fallbackInterpret(parsed.data)),
        200,
      );
    }

    const data = (await response.json().catch(() => null)) as any;
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text)
        .filter(Boolean)
        .join("\n") ?? "";

    const jsonText = extractFirstJsonObject(text);
    if (!jsonText) {
      throw new ApiError(
        500,
        "INTERNAL_ERROR",
        "AI response was not valid JSON",
      );
    }

    let interpreted: unknown;
    try {
      interpreted = JSON.parse(jsonText);
    } catch {
      throw new ApiError(
        500,
        "INTERNAL_ERROR",
        "AI response was not valid JSON",
      );
    }

    const out = SInterpretPlaybackResponse.safeParse(interpreted);
    if (out.success) {
      return c.json(out.data, 200);
    }

    const maybeCommand = SPlaybackCommand.safeParse(interpreted);
    if (maybeCommand.success) {
      return c.json(
        SInterpretPlaybackResponse.parse({
          command: maybeCommand.data,
        }),
        200,
      );
    }

    console.error("[editor/interpret] schema mismatch", out.error);
    throw new ApiError(500, "INTERNAL_ERROR", "AI response schema mismatch");
  });

  return app;
}
