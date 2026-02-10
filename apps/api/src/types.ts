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
  AI_CHAT_MODEL: string;
  AI_CHAT_RATE_LIMIT_PER_HOUR: string;
  AI_CHAT_MAX_TOOL_CALLS: string;
  AI_CHAT_MAX_COMMANDS_PER_TOOL_CALL: string;
  AI_CHAT_LOG_SNIPPET_CHARS: string;
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
