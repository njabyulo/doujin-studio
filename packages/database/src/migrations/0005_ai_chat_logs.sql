CREATE TABLE "ai_chat_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "project_id" text NOT NULL,
  "timeline_id" text NOT NULL,
  "model" text NOT NULL,
  "status" text NOT NULL,
  "prompt_excerpt" text NOT NULL,
  "response_excerpt" text NOT NULL,
  "tool_call_count" integer NOT NULL DEFAULT 0,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE CASCADE
);

CREATE INDEX "ai_chat_logs_user_project_created_idx"
  ON "ai_chat_logs" ("user_id", "project_id", "created_at");
CREATE INDEX "ai_chat_logs_timeline_created_idx"
  ON "ai_chat_logs" ("timeline_id", "created_at");
CREATE INDEX "ai_chat_logs_status_created_idx"
  ON "ai_chat_logs" ("status", "created_at");
