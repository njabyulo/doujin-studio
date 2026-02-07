import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { project } from "./project";

export const message = sqliteTable(
  "message",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    type: text("type").notNull(),
    contentJson: text("content_json", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("message_project_id_idx").on(table.projectId),
    index("message_created_at_idx").on(table.createdAt),
  ],
);
