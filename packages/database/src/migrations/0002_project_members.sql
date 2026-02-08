CREATE TABLE "project_member" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL DEFAULT 'owner',
  "created_at" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "project_member_project_user_unique" ON "project_member" ("project_id", "user_id");
CREATE INDEX "project_member_project_id_idx" ON "project_member" ("project_id");
CREATE INDEX "project_member_user_id_idx" ON "project_member" ("user_id");

INSERT INTO "project_member" ("id", "project_id", "user_id", "role", "created_at")
SELECT
  lower(hex(randomblob(16))),
  p."id",
  p."user_id",
  'owner',
  p."created_at"
FROM "project" p
LEFT JOIN "project_member" pm
  ON pm."project_id" = p."id"
  AND pm."user_id" = p."user_id"
WHERE pm."id" IS NULL;
