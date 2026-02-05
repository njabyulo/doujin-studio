import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    mediaPlanJson: jsonb("media_plan_json"),
    activeCheckpointId: uuid("active_checkpoint_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("project_user_id_idx").on(table.userId),
    index("project_active_checkpoint_id_idx").on(table.activeCheckpointId),
  ],
);
