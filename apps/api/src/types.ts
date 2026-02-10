import type { D1Database } from "@cloudflare/workers-types";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

export type SessionRecord = {
  id: string;
  userId: string;
  expiresAt: Date | number;
  token: string;
};

export interface AppBindings {
  DB: D1Database;
  APP_ENV: string;
  CORS_ORIGIN: string;
  GIT_SHA: string;
  AUTH_SECRET: string;
  GEMINI_API_KEY: string;
  AI_INTERPRET_MODEL: string;
}

export interface AppVariables {
  requestId: string;
  user: SessionUser | null;
  session: SessionRecord | null;
}

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
