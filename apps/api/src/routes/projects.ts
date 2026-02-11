import {
  SCreateProjectRequest,
  SProjectListResponse,
  SProjectResponse,
} from "@doujin/shared/types";
import { createProjectService } from "@doujin/core/services";
import { Hono } from "hono";
import { ApiError, createApiErrorBody } from "../errors";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

export function createProjectRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Invalid project payload");
    }

    const input = SCreateProjectRequest.parse(body);

    const service = createProjectService({ env: { DB: c.env.DB } });
    const result = await service.createProject({
      userId: user.id,
      payload: input,
    });
    if (!result.ok) {
      return c.json(
        createApiErrorBody(result.code, result.message, c.get("requestId")),
        result.status as any,
      );
    }

    return c.json(SProjectResponse.parse(result.data), 201);
  });

  app.get("/", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const service = createProjectService({ env: { DB: c.env.DB } });
    const result = await service.listProjects({ userId: user.id });
    if (!result.ok) {
      return c.json(
        createApiErrorBody(result.code, result.message, c.get("requestId")),
        result.status as any,
      );
    }

    return c.json(SProjectListResponse.parse(result.data), 200);
  });

  return app;
}
