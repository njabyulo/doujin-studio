import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { project } from "./project";

export const asset = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["video", "poster"] }).notNull(),
    status: text("status", {
      enum: ["pending_upload", "uploaded", "upload_failed"],
    })
      .notNull()
      .default("pending_upload"),
    r2Key: text("r2_key").notNull(),
    size: integer("size").notNull(),
    mime: text("mime").notNull(),
    checksumSha256: text("checksum_sha256"),
    durationMs: integer("duration_ms"),
    width: integer("width"),
    height: integer("height"),
    posterAssetId: text("poster_asset_id").references(
      (): AnySQLiteColumn => asset.id,
      { onDelete: "set null" },
    ),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("assets_r2_key_unique").on(table.r2Key),
    index("assets_project_id_idx").on(table.projectId),
    index("assets_status_idx").on(table.status),
    index("assets_created_at_idx").on(table.createdAt),
    index("assets_project_type_status_idx").on(
      table.projectId,
      table.type,
      table.status,
    ),
  ],
);
