CREATE TABLE "timelines" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "name" text NOT NULL,
  "latest_version" integer NOT NULL DEFAULT 0,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "timelines_project_unique" ON "timelines" ("project_id");
CREATE INDEX "timelines_updated_at_idx" ON "timelines" ("updated_at");

CREATE TABLE "timeline_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "timeline_id" text NOT NULL,
  "version" integer NOT NULL,
  "source" text NOT NULL DEFAULT 'system',
  "created_by_user_id" text NOT NULL,
  "data" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "timeline_versions_timeline_version_unique"
  ON "timeline_versions" ("timeline_id", "version");
CREATE INDEX "timeline_versions_timeline_created_at_idx"
  ON "timeline_versions" ("timeline_id", "created_at");
