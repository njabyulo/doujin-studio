ALTER TABLE "timeline_versions"
  ADD COLUMN "edl_data" text;

CREATE TABLE "ai_edl_proposals" (
  "id" text PRIMARY KEY NOT NULL,
  "timeline_id" text NOT NULL,
  "base_version" integer NOT NULL,
  "created_by_user_id" text NOT NULL,
  "prompt_excerpt" text NOT NULL,
  "operations_json" text NOT NULL,
  "assistant_summary" text NOT NULL,
  "expires_at" integer NOT NULL,
  "consumed_at" integer,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE CASCADE
);

CREATE INDEX "ai_edl_proposals_timeline_created_idx"
  ON "ai_edl_proposals" ("timeline_id", "created_at");

CREATE INDEX "ai_edl_proposals_expires_idx"
  ON "ai_edl_proposals" ("expires_at");
