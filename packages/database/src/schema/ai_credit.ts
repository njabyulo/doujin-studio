import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const aiCreditDefaultPolicy = sqliteTable("ai_credit_default_policy", {
  feature: text("feature").primaryKey(),
  dailyLimit: integer("daily_limit").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const aiCreditPolicySeed = sqliteTable(
  "ai_credit_policy_seed",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    feature: text("feature").notNull(),
    dailyLimit: integer("daily_limit"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("ai_credit_policy_seed_email_feature_unique").on(
      table.email,
      table.feature,
    ),
  ],
);

export const aiCreditPolicy = sqliteTable(
  "ai_credit_policy",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    dailyLimit: integer("daily_limit"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("ai_credit_policy_user_feature_unique").on(
      table.userId,
      table.feature,
    ),
    index("ai_credit_policy_user_id_idx").on(table.userId),
  ],
);

export const aiDailyUsage = sqliteTable(
  "ai_daily_usage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dayUtc: text("day_utc").notNull(),
    feature: text("feature").notNull(),
    used: integer("used").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("ai_daily_usage_user_day_feature_unique").on(
      table.userId,
      table.dayUtc,
      table.feature,
    ),
    index("ai_daily_usage_user_day_idx").on(table.userId, table.dayUtc),
  ],
);
