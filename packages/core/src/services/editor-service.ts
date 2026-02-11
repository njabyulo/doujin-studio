import type {
  TInterpretPlaybackRequest,
  TInterpretPlaybackResponse,
} from "@doujin/shared/types";
import {
  SInterpretPlaybackResponse,
  SPlaybackCommand,
} from "@doujin/shared/types";
import { FEATURE_EDITOR_INTERPRET } from "@doujin/shared/consts";
import { createDb } from "@doujin/database";
import type { TServiceResult } from "./service-result";
import { createGeminiAdapter } from "../adapters/gemini-adapter";
import { createAiCreditsRepo } from "../repos/ai-credits-repo";

export type TEditorServiceConfig = {
  env: {
    DB: D1Database;
    GEMINI_API_KEY?: string;
    AI_INTERPRET_MODEL?: string;
  };
  fetch?: typeof fetch;
};

export type TInterpretPlaybackInput = {
  userId: string;
  requestId: string;
  payload: TInterpretPlaybackRequest;
  testMode?: boolean;
};

export interface IEditorService {
  interpretPlayback(
    input: TInterpretPlaybackInput,
  ): Promise<TServiceResult<TInterpretPlaybackResponse>>;
}

const extractFirstJsonObject = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0] ?? null;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const fallbackInterpret = (args: {
  prompt: string;
  currentMs?: number;
  durationMs?: number;
}) => {
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
};

const isValidModelId = (model: string) => {
  return /^[a-z0-9][a-z0-9._-]{0,80}$/i.test(model);
};

export const createEditorService = (
  config: TEditorServiceConfig,
): IEditorService => {
  const fetchImpl = config.fetch ?? fetch;

  return {
    async interpretPlayback(input) {
      const { userId, requestId, payload, testMode } = input;
      const { prompt, currentMs, durationMs } = payload;

      const apiKey = config.env.GEMINI_API_KEY ?? "";
      const model = config.env.AI_INTERPRET_MODEL ?? "gemini-3-flash-preview";

      const db = createDb(config.env.DB);

      if (testMode) {
        const creditsRepo = createAiCreditsRepo({ db });
        const credits = await creditsRepo.consumeDailyCredit({
          userId,
          feature: FEATURE_EDITOR_INTERPRET,
        });
        if (!credits.ok) {
          return {
            ok: false,
            status: credits.status,
            code: credits.code,
            message: credits.message,
            headers: credits.headers,
          };
        }

        return {
          ok: true,
          data: SInterpretPlaybackResponse.parse(fallbackInterpret(payload)),
          headers: credits.headers,
        };
      }

      if (!apiKey.trim()) {
        console.warn("editor_interpret: missing GEMINI_API_KEY", {
          requestId,
          userId,
        });
        return {
          ok: false,
          status: 503,
          code: "AI_UNAVAILABLE",
          message: "AI temporarily unavailable",
        };
      }

      if (!isValidModelId(model)) {
        console.warn("editor_interpret: invalid AI_INTERPRET_MODEL", {
          requestId,
          userId,
          model,
        });
        return {
          ok: false,
          status: 503,
          code: "AI_UNAVAILABLE",
          message: "AI temporarily unavailable",
        };
      }

      const creditsRepo = createAiCreditsRepo({ db });
      const credits = await creditsRepo.consumeDailyCredit({
        userId,
        feature: FEATURE_EDITOR_INTERPRET,
      });
      if (!credits.ok) {
        return {
          ok: false,
          status: credits.status,
          code: credits.code,
          message: credits.message,
          headers: credits.headers,
        };
      }

      const headerBase = credits.headers;
      const aiHeaderBase: Record<string, string> = {
        ...headerBase,
        "x-ai-provider": "gemini",
        "x-ai-model": model,
      };

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

      const gemini = createGeminiAdapter({
        apiKey,
        model,
        fetch: fetchImpl,
      });

      const response = await gemini.generateContent({
        systemInstruction,
        userText: requestText,
      });

      if (!response.ok) {
        console.warn("editor_interpret: gemini generateContent failed", {
          requestId,
          userId,
          model,
          version: response.version,
          status: response.status,
          body: response.text?.slice(0, 500) ?? "",
        });
        return {
          ok: false,
          status: 503,
          code: "AI_UNAVAILABLE",
          message: "AI temporarily unavailable",
          headers: {
            ...aiHeaderBase,
            "x-ai-provider-version": response.version,
            "x-ai-provider-status": String(response.status),
          },
        };
      }

      const jsonText = extractFirstJsonObject(response.text);
      if (!jsonText) {
        console.warn("editor_interpret: gemini response missing JSON", {
          requestId,
          userId,
          model,
          version: response.version,
          text: response.text?.slice(0, 500) ?? "",
        });
        return {
          ok: false,
          status: 503,
          code: "AI_UNAVAILABLE",
          message: "AI temporarily unavailable",
          headers: {
            ...aiHeaderBase,
            "x-ai-provider-version": response.version,
          },
        };
      }

      let interpreted: unknown;
      try {
        interpreted = JSON.parse(jsonText);
      } catch {
        console.warn("editor_interpret: gemini JSON parse failed", {
          requestId,
          userId,
          model,
          version: response.version,
          jsonText: jsonText.slice(0, 500),
        });
        return {
          ok: false,
          status: 503,
          code: "AI_UNAVAILABLE",
          message: "AI temporarily unavailable",
          headers: {
            ...aiHeaderBase,
            "x-ai-provider-version": response.version,
          },
        };
      }

      const out = SInterpretPlaybackResponse.safeParse(interpreted);
      if (out.success) {
        return { ok: true, data: out.data, headers: aiHeaderBase };
      }

      const maybeCommand = SPlaybackCommand.safeParse(interpreted);
      if (maybeCommand.success) {
        return {
          ok: true,
          data: SInterpretPlaybackResponse.parse({
            command: maybeCommand.data,
          }),
          headers: aiHeaderBase,
        };
      }

      console.warn("editor_interpret: gemini response schema mismatch", {
        requestId,
        userId,
        model,
        version: response.version,
      });
      return {
        ok: false,
        status: 503,
        code: "AI_UNAVAILABLE",
        message: "AI temporarily unavailable",
        headers: {
          ...aiHeaderBase,
          "x-ai-provider-version": response.version,
        },
      };
    },
  };
};
