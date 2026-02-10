-- AI credits system (default + overrides + daily usage)

CREATE TABLE IF NOT EXISTS "ai_credit_default_policy" (
  "feature" text PRIMARY KEY NOT NULL,
  "daily_limit" integer NOT NULL,
  "enabled" integer NOT NULL DEFAULT 1,
  "created_at" integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  "updated_at" integer NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS "ai_credit_policy_seed" (
  "id" text PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  "email" text NOT NULL,
  "feature" text NOT NULL,
  "daily_limit" integer,
  "enabled" integer NOT NULL DEFAULT 1,
  "created_at" integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  "updated_at" integer NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_credit_policy_seed_email_feature_unique" ON "ai_credit_policy_seed" ("email", "feature");

CREATE TABLE IF NOT EXISTS "ai_credit_policy" (
  "id" text PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  "user_id" text NOT NULL,
  "feature" text NOT NULL,
  "daily_limit" integer,
  "enabled" integer NOT NULL DEFAULT 1,
  "created_at" integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  "updated_at" integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_credit_policy_user_feature_unique" ON "ai_credit_policy" ("user_id", "feature");
CREATE INDEX IF NOT EXISTS "ai_credit_policy_user_id_idx" ON "ai_credit_policy" ("user_id");

CREATE TABLE IF NOT EXISTS "ai_daily_usage" (
  "id" text PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  "user_id" text NOT NULL,
  "day_utc" text NOT NULL,
  "feature" text NOT NULL,
  "used" integer NOT NULL DEFAULT 0,
  "created_at" integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  "updated_at" integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_daily_usage_user_day_feature_unique" ON "ai_daily_usage" ("user_id", "day_utc", "feature");
CREATE INDEX IF NOT EXISTS "ai_daily_usage_user_day_idx" ON "ai_daily_usage" ("user_id", "day_utc");

-- Default policy: 10/day for everyone.
INSERT INTO "ai_credit_default_policy" ("feature", "daily_limit", "enabled")
VALUES ('editor_interpret', 10, 1)
ON CONFLICT("feature") DO UPDATE SET
  "daily_limit" = excluded."daily_limit",
  "enabled" = excluded."enabled",
  "updated_at" = (strftime('%s','now') * 1000);

-- Seed unlimited overrides.
INSERT INTO "ai_credit_policy_seed" ("email", "feature", "daily_limit", "enabled")
VALUES
  ('ai@doujin.com', 'editor_interpret', NULL, 1),
  ('njabulo@doujin.com', 'editor_interpret', NULL, 1)
ON CONFLICT("email", "feature") DO UPDATE SET
  "daily_limit" = excluded."daily_limit",
  "enabled" = excluded."enabled",
  "updated_at" = (strftime('%s','now') * 1000);

-- Backfill per-user overrides for existing users.
INSERT INTO "ai_credit_policy" ("user_id", "feature", "daily_limit", "enabled")
SELECT u."id", s."feature", s."daily_limit", s."enabled"
FROM "user" u
JOIN "ai_credit_policy_seed" s ON lower(s."email") = lower(u."email")
ON CONFLICT("user_id", "feature") DO UPDATE SET
  "daily_limit" = excluded."daily_limit",
  "enabled" = excluded."enabled",
  "updated_at" = (strftime('%s','now') * 1000);

-- Trigger: when a user is created, apply any seed overrides.
CREATE TRIGGER IF NOT EXISTS "ai_credit_policy_seed_on_user_insert"
AFTER INSERT ON "user"
BEGIN
  INSERT INTO "ai_credit_policy" ("user_id", "feature", "daily_limit", "enabled")
  SELECT NEW."id", s."feature", s."daily_limit", s."enabled"
  FROM "ai_credit_policy_seed" s
  WHERE lower(s."email") = lower(NEW."email")
  ON CONFLICT("user_id", "feature") DO UPDATE SET
    "daily_limit" = excluded."daily_limit",
    "enabled" = excluded."enabled",
    "updated_at" = (strftime('%s','now') * 1000);
END;
