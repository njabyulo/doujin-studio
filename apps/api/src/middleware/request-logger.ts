import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

export const requestLoggerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const startedAt = Date.now();

  try {
    await next();
  } finally {
    const durationMs = Date.now() - startedAt;
    const user = c.get("user");

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        requestId: c.get("requestId"),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
        userId: user?.id ?? null,
      }),
    );
  }
});
