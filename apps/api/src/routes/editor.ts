import {
  SInterpretPlaybackRequest,
  SInterpretPlaybackResponse,
} from "@doujin/shared/types";
import { createEditorService } from "@doujin/core/services";
import { Hono } from "hono";
import { ApiError, createApiErrorBody } from "../errors";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

export const createEditorRoutes = () => {
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

    const testMode = c.req.header("x-ai-test-mode") === "1";
    const requestId = c.get("requestId");

    const service = createEditorService({
      env: {
        DB: c.env.DB,
        GEMINI_API_KEY: c.env.GEMINI_API_KEY,
        AI_INTERPRET_MODEL: c.env.AI_INTERPRET_MODEL,
      },
    });

    const result = await service.interpretPlayback({
      userId: user.id,
      requestId,
      payload: parsed.data,
      testMode,
    });

    if (result.headers) {
      for (const key of Object.keys(result.headers)) {
        c.header(key, result.headers[key]);
      }
    }

    if (!result.ok) {
      return c.json(
        createApiErrorBody(result.code, result.message, requestId),
        result.status as any,
      );
    }

    return c.json(SInterpretPlaybackResponse.parse(result.data), 200);
  });

  return app;
};
