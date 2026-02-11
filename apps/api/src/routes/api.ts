import {
  SHealthResponse,
  SMeResponse,
  SVersionResponse,
} from "@doujin/shared/types";
import { Hono } from "hono";
import packageJson from "../../package.json";
import { createAuth, toAuthRequest } from "../auth";
import { ApiError } from "../errors";
import { requireAuth } from "../middleware/require-auth";
import { createEditorRoutes } from "./editor";
import { createProjectRoutes } from "./projects";
import type { AppEnv } from "../types";

const createVersionResponse = (commitSha: string) => {
  return SVersionResponse.parse({
    version: packageJson.version,
    commitSha,
  });
};

export const createApiRoutes = () => {
  const app = new Hono<AppEnv>();

  app.on(["GET", "POST", "OPTIONS"], "/auth/*", async (c) => {
    const auth = createAuth(c.env);
    return auth.handler(toAuthRequest(c.req.raw));
  });

  app.get("/health", (c) => {
    return c.json(SHealthResponse.parse({ ok: true }), 200);
  });

  app.get("/version", (c) => {
    return c.json(createVersionResponse(c.env.GIT_SHA), 200);
  });

  app.get("/me", requireAuth, (c) => {
    const user = c.get("user");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    return c.json(
      SMeResponse.parse({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        },
        tenant: {
          type: "user",
          id: user.id,
        },
      }),
      200,
    );
  });

  app.route("/projects", createProjectRoutes());
  app.route("/editor", createEditorRoutes());

  return app;
};
