import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { project } from "./project";

export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    operation: text("operation", {
      enum: ["generate", "regenerate_scene", "render"],
    }).notNull(),
    key: text("key").notNull(),
    resultRef: text("result_ref").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique().on(table.userId, table.operation, table.key),
    index("idempotency_key_user_id_idx").on(table.userId),
  ],
);
