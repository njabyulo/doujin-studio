CREATE TABLE "assets" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending_upload',
  "r2_key" text NOT NULL,
  "size" integer NOT NULL,
  "mime" text NOT NULL,
  "checksum_sha256" text,
  "duration_ms" integer,
  "width" integer,
  "height" integer,
  "poster_asset_id" text,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  FOREIGN KEY ("poster_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "assets_r2_key_unique" ON "assets" ("r2_key");
CREATE INDEX "assets_project_id_idx" ON "assets" ("project_id");
CREATE INDEX "assets_status_idx" ON "assets" ("status");
CREATE INDEX "assets_created_at_idx" ON "assets" ("created_at");
CREATE INDEX "assets_project_type_status_idx" ON "assets" ("project_id", "type", "status");
