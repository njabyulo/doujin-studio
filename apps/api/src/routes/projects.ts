import {
  and,
  createDb,
  desc,
  eq,
} from "@doujin/database";
import {
  project,
  projectMember,
} from "@doujin/database/schema";
import {
  createProjectRequestSchema,
  projectListResponseSchema,
  projectResponseSchema,
} from "@doujin/contracts";
import { Hono } from "hono";
import { ApiError } from "../errors";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

async function parseCreateProjectInput(rawBody: unknown) {
  const parsed = createProjectRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid project payload");
  }

  return parsed.data;
}

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

    const input = await parseCreateProjectInput(body);
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
      projectResponseSchema.parse({
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

    return c.json(projectListResponseSchema.parse({ projects }), 200);
  });

  app.get("/:id", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const id = c.req.param("id");
    const db = createDb(c.env.DB);
    const [projectRow] = await db
      .select({
        id: project.id,
        title: project.title,
        role: projectMember.role,
      })
      .from(projectMember)
      .innerJoin(project, eq(projectMember.projectId, project.id))
      .where(and(eq(project.id, id), eq(projectMember.userId, user.id)))
      .limit(1);

    if (!projectRow) {
      throw new ApiError(404, "NOT_FOUND", "Project not found");
    }

    return c.json(projectResponseSchema.parse({ project: projectRow }), 200);
  });

  return app;
}
