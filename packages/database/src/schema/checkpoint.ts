import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { message } from "./message";
import { project } from "./project";

export const checkpoint = sqliteTable(
  "checkpoint",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceMessageId: text("source_message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    parentCheckpointId: text("parent_checkpoint_id"),
    storyboardJson: text("storyboard_json", { mode: "json" }).notNull(),
    scriptJson: text("script_json", { mode: "json" }).notNull(),
    brandKitJson: text("brand_kit_json", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("checkpoint_project_id_idx").on(table.projectId),
    index("checkpoint_source_message_id_idx").on(table.sourceMessageId),
  ],
);
