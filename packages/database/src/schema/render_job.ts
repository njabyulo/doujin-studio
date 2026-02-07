import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { checkpoint } from "./checkpoint";
import { message } from "./message";
import { project } from "./project";

export const renderJob = sqliteTable(
  "render_job",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceCheckpointId: text("source_checkpoint_id")
      .notNull()
      .references(() => checkpoint.id, { onDelete: "cascade" }),
    sourceMessageId: text("source_message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    format: text("format", { enum: ["1:1", "9:16", "16:9"] }).notNull(),
    status: text("status", {
      enum: [
        "pending",
        "rendering",
        "completed",
        "failed",
        "cancel_requested",
        "cancelled",
      ],
    }).notNull(),
    progress: integer("progress").notNull().default(0),
    outputS3Key: text("output_s3_key"),
    cancelRequested: integer("cancel_requested", { mode: "boolean" })
      .notNull()
      .default(false),
    lastError: text("last_error"),
    correlationId: text("correlation_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("render_job_project_id_idx").on(table.projectId),
    index("render_job_status_idx").on(table.status),
    index("render_job_created_at_idx").on(table.createdAt),
  ],
);
