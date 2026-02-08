import {
  healthResponseSchema,
  meResponseSchema,
  versionResponseSchema,
} from "@doujin/contracts";
import { Hono } from "hono";
import packageJson from "../../package.json";
import { createAuth, toAuthRequest } from "../auth";
import { ApiError } from "../errors";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types";

function createVersionResponse(commitSha: string) {
  return versionResponseSchema.parse({
    version: packageJson.version,
    commitSha,
  });
}

export function createApiRoutes() {
  const app = new Hono<AppEnv>();

  app.on(["GET", "POST", "OPTIONS"], "/auth/*", async (c) => {
    const auth = createAuth(c.env);
    return auth.handler(toAuthRequest(c.req.raw));
  });

  app.get("/health", (c) => {
    return c.json(healthResponseSchema.parse({ ok: true }), 200);
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
      meResponseSchema.parse({
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

  return app;
}
