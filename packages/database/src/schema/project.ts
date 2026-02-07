import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const project = sqliteTable(
  "project",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    mediaPlanJson: text("media_plan_json", { mode: "json" }),
    activeCheckpointId: text("active_checkpoint_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("project_user_id_idx").on(table.userId),
    index("project_active_checkpoint_id_idx").on(table.activeCheckpointId),
  ],
);
