import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  logoUrl: text("logo_url"),
  accentColor: text("accent_color"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_users_email").on(t.email),
    index("idx_users_client").on(t.clientId).where(sql`${t.clientId} IS NOT NULL`),
    check("users_role_check", sql`${t.role} IN ('sakneen_admin', 'client_user')`),
    check(
      "client_user_must_have_client",
      sql`(${t.role} = 'sakneen_admin' AND ${t.clientId} IS NULL) OR (${t.role} = 'client_user' AND ${t.clientId} IS NOT NULL)`,
    ),
  ],
);

export const eoiUploads = pgTable(
  "eoi_uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("draft"),
    filePath: text("file_path").notNull(),
    fileName: text("file_name").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    rowCount: integer("row_count").notNull(),
    dateMin: date("date_min").notNull(),
    dateMax: date("date_max").notNull(),
    totalCount: integer("total_count").notNull(),
    totalValueEgp: bigint("total_value_egp", { mode: "bigint" }).notNull(),
    parseWarnings: jsonb("parse_warnings"),
    notes: text("notes"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "eoi_uploads_status_check",
      sql`${t.status} IN ('draft', 'published', 'superseded', 'discarded')`,
    ),
    index("idx_eoi_uploads_client_status").on(t.clientId, t.status),
    index("idx_eoi_uploads_published")
      .on(t.clientId, t.publishedAt.desc())
      .where(sql`${t.status} = 'published'`),
    uniqueIndex("idx_eoi_uploads_one_published_per_client")
      .on(t.clientId)
      .where(sql`${t.status} = 'published'`),
  ],
);

export const eoiRecords = pgTable(
  "eoi_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uploadId: uuid("upload_id")
      .notNull()
      .references(() => eoiUploads.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    unitType: text("unit_type").notNull(),
    status: text("status").notNull(),
    eoiDate: date("eoi_date").notNull(),
    amountEgp: bigint("amount_egp", { mode: "bigint" }).notNull(),
    sourceRowIndex: integer("source_row_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("eoi_records_unit_type_check", sql`${t.unitType} IN ('Residential', 'Admin')`),
    check(
      "eoi_records_status_check",
      sql`${t.status} IN ('approved', 'pending', 'rejected')`,
    ),
    index("idx_eoi_records_client_date").on(t.clientId, t.eoiDate),
    index("idx_eoi_records_upload").on(t.uploadId),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    clientId: uuid("client_id").references(() => clients.id),
    action: text("action").notNull(),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_audit_log_client_created").on(t.clientId, t.createdAt.desc()),
    index("idx_audit_log_user_created").on(t.userId, t.createdAt.desc()),
  ],
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type EoiUpload = typeof eoiUploads.$inferSelect;
export type NewEoiUpload = typeof eoiUploads.$inferInsert;
export type EoiRecord = typeof eoiRecords.$inferSelect;
export type NewEoiRecord = typeof eoiRecords.$inferInsert;
