import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { project } from "./project";
import { timeline } from "./timeline";

export const aiChatLog = sqliteTable(
  "ai_chat_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    timelineId: text("timeline_id")
      .notNull()
      .references(() => timeline.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    status: text("status", {
      enum: ["ok", "rate_limited", "error"],
    }).notNull(),
    promptExcerpt: text("prompt_excerpt").notNull(),
    responseExcerpt: text("response_excerpt").notNull(),
    toolCallCount: integer("tool_call_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("ai_chat_logs_user_project_created_idx").on(
      table.userId,
      table.projectId,
      table.createdAt,
    ),
    index("ai_chat_logs_timeline_created_idx").on(table.timelineId, table.createdAt),
    index("ai_chat_logs_status_created_idx").on(table.status, table.createdAt),
  ],
);
