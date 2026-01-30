import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { checkpoint } from "./checkpoint";
import { message } from "./message";
import { project } from "./project";

export const renderJob = pgTable(
  "render_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceCheckpointId: uuid("source_checkpoint_id")
      .notNull()
      .references(() => checkpoint.id, { onDelete: "cascade" }),
    sourceMessageId: uuid("source_message_id")
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
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    lastError: text("last_error"),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("render_job_project_id_idx").on(table.projectId),
    index("render_job_status_idx").on(table.status),
    index("render_job_created_at_idx").on(table.createdAt),
  ],
);
