import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { project } from "./project";

export const idempotencyKey = sqliteTable(
  "idempotency_key",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    operation: text("operation", {
      enum: ["generate", "generate_assets", "regenerate_scene", "render"],
    }).notNull(),
    key: text("key").notNull(),
    resultRef: text("result_ref").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("idempotency_key_unique").on(
      table.userId,
      table.operation,
      table.key,
    ),
    index("idempotency_key_user_id_idx").on(table.userId),
  ],
);
