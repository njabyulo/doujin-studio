import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { timeline } from "./timeline";

export const timelineVersion = sqliteTable(
  "timeline_versions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    timelineId: text("timeline_id")
      .notNull()
      .references(() => timeline.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    source: text("source", {
      enum: ["system", "autosave", "manual", "ai"],
    })
      .notNull()
      .default("system"),
    createdByUserId: text("created_by_user_id").notNull(),
    data: text("data", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("timeline_versions_timeline_version_unique").on(
      table.timelineId,
      table.version,
    ),
    index("timeline_versions_timeline_created_at_idx").on(
      table.timelineId,
      table.createdAt,
    ),
  ],
);
