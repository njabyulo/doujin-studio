import { createMiddleware } from "hono/factory";
import { ApiError } from "../errors";
import type { AppEnv } from "../types";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }

  await next();
});
