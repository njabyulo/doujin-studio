import { createDb } from "@doujin/database/client";
import * as dbSchema from "@doujin/database/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import type { AppBindings } from "../types";

function toOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function getTrustedOrigins(bindings: AppBindings) {
  const origins = new Set<string>();
  const add = (value: string) => {
    const normalized = toOrigin(value).trim();
    if (normalized) {
      origins.add(normalized);
    }
  };

  add(bindings.CORS_ORIGIN);
  add("http://localhost:8787");
  add("http://127.0.0.1:8787");
  add("http://doujin.njabulomajozi.com");
  add("https://doujin.njabulomajozi.com");

  return [...origins];
}

export function createAuth(bindings: AppBindings) {
  const baseURL = toOrigin(bindings.CORS_ORIGIN);
  const db = createDb(bindings.DB);

  return betterAuth({
    appName: "doujin",
    basePath: "/api/auth",
    baseURL,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: dbSchema,
      usePlural: false,
      camelCase: false,
    }),
    secret: bindings.AUTH_SECRET,
    trustedOrigins: getTrustedOrigins(bindings),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [jwt()],
  });
}

export function toAuthRequest(request: Request): Request {
  const url = new URL(request.url);

  if (!url.pathname.startsWith("/auth")) {
    return request;
  }

  url.pathname = `/api${url.pathname}`;

  return new Request(url.toString(), request);
}
