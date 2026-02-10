import { createDb, desc, eq } from "@doujin/database";
import { project, projectMember } from "@doujin/database/schema";
import {
  SCreateProjectRequest,
  SProjectListResponse,
  SProjectResponse,
} from "@doujin/core";
import { Hono } from "hono";
import { ApiError } from "../errors";
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
    const db = createDb(c.env.DB);
    const projectId = crypto.randomUUID();

    await db.batch([
      db.insert(project).values({
        id: projectId,
        userId: user.id,
        title: input.title,
      }),
      db.insert(projectMember).values({
        projectId,
        userId: user.id,
        role: "owner",
      }),
    ]);

    return c.json(
      SProjectResponse.parse({
        project: {
          id: projectId,
          title: input.title,
          role: "owner",
        },
      }),
      201,
    );
  });

  app.get("/", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const db = createDb(c.env.DB);
    const projects = await db
      .select({
        id: project.id,
        title: project.title,
        role: projectMember.role,
      })
      .from(projectMember)
      .innerJoin(project, eq(projectMember.projectId, project.id))
      .where(eq(projectMember.userId, user.id))
      .orderBy(desc(project.updatedAt));

    return c.json(SProjectListResponse.parse({ projects }), 200);
  });

  return app;
}
