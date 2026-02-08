import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { project } from "./project";

export const projectMember = sqliteTable(
  "project_member",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner"] }).notNull().default("owner"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("project_member_project_user_unique").on(
      table.projectId,
      table.userId,
    ),
    index("project_member_project_id_idx").on(table.projectId),
    index("project_member_user_id_idx").on(table.userId),
  ],
);
