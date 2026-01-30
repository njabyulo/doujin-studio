import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { message } from "./message";
import { project } from "./project";

export const checkpoint = pgTable(
  "checkpoint",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceMessageId: uuid("source_message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    parentCheckpointId: uuid("parent_checkpoint_id"),
    storyboardJson: jsonb("storyboard_json").notNull(),
    scriptJson: jsonb("script_json").notNull(),
    brandKitJson: jsonb("brand_kit_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("checkpoint_project_id_idx").on(table.projectId),
    index("checkpoint_source_message_id_idx").on(table.sourceMessageId),
  ],
);
