import { createApiErrorBody, normalizeApiError } from "./errors";
import { authContextMiddleware } from "./middleware/auth-context";
import { requestLoggerMiddleware } from "./middleware/request-logger";
import { createApiRoutes } from "./routes/api";
import type { AppEnv } from "./types";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { requestId } from "hono/request-id";

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", requestId({ headerName: "x-request-id" }));

  app.use("*", async (c, next) => {
    await next();
    c.header("x-request-id", c.get("requestId"));
  });

  app.use(
    "*",
    cors({
      origin: (origin, c) => {
        if (!origin) {
          return c.env.CORS_ORIGIN;
        }

        return origin === c.env.CORS_ORIGIN ? origin : c.env.CORS_ORIGIN;
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use("*", requestLoggerMiddleware);
  app.use("*", authContextMiddleware);

  app.route("/", createApiRoutes());
  app.route("/api", createApiRoutes());

  app.notFound((c) => {
    c.header("x-request-id", c.get("requestId"));
    return c.json(
      createApiErrorBody("NOT_FOUND", "Route not found", c.get("requestId")),
      404,
    );
  });

  app.onError((error, c) => {
    const normalized = normalizeApiError(error);
    const requestId = c.get("requestId");
    c.header("x-request-id", requestId);

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: normalized.status,
        code: normalized.code,
        message: normalized.message,
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );

    return c.json(
      createApiErrorBody(normalized.code, normalized.message, requestId),
      normalized.status,
    );
  });

  return app;
}
