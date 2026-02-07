-- D1 schema for doujin

CREATE TABLE "user" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "email_verified" integer NOT NULL DEFAULT 0,
  "name" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

CREATE UNIQUE INDEX "user_email_unique" ON "user" ("email");

CREATE TABLE "session" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "expires_at" integer NOT NULL,
  "token" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "session_token_unique" ON "session" ("token");

CREATE TABLE "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" integer NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

CREATE TABLE "project" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "media_plan_json" text,
  "active_checkpoint_id" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

CREATE INDEX "project_user_id_idx" ON "project" ("user_id");
CREATE INDEX "project_active_checkpoint_id_idx" ON "project" ("active_checkpoint_id");

CREATE TABLE "message" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "role" text NOT NULL,
  "type" text NOT NULL,
  "content_json" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);

CREATE INDEX "message_project_id_idx" ON "message" ("project_id");
CREATE INDEX "message_created_at_idx" ON "message" ("created_at");

CREATE TABLE "checkpoint" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "name" text NOT NULL,
  "source_message_id" text NOT NULL,
  "parent_checkpoint_id" text,
  "storyboard_json" text NOT NULL,
  "script_json" text NOT NULL,
  "brand_kit_json" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  FOREIGN KEY ("source_message_id") REFERENCES "message"("id") ON DELETE CASCADE
);

CREATE INDEX "checkpoint_project_id_idx" ON "checkpoint" ("project_id");
CREATE INDEX "checkpoint_source_message_id_idx" ON "checkpoint" ("source_message_id");

CREATE TABLE "render_job" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "source_checkpoint_id" text NOT NULL,
  "source_message_id" text NOT NULL,
  "format" text NOT NULL,
  "status" text NOT NULL,
  "progress" integer NOT NULL DEFAULT 0,
  "output_s3_key" text,
  "cancel_requested" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "correlation_id" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  FOREIGN KEY ("source_checkpoint_id") REFERENCES "checkpoint"("id") ON DELETE CASCADE,
  FOREIGN KEY ("source_message_id") REFERENCES "message"("id") ON DELETE CASCADE
);

CREATE INDEX "render_job_project_id_idx" ON "render_job" ("project_id");
CREATE INDEX "render_job_status_idx" ON "render_job" ("status");
CREATE INDEX "render_job_created_at_idx" ON "render_job" ("created_at");

CREATE TABLE "idempotency_key" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "project_id" text NOT NULL,
  "operation" text NOT NULL,
  "key" text NOT NULL,
  "result_ref" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "idempotency_key_unique" ON "idempotency_key" ("user_id", "operation", "key");
CREATE INDEX "idempotency_key_user_id_idx" ON "idempotency_key" ("user_id");
