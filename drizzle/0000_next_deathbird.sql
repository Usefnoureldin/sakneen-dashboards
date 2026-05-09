CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"client_id" uuid,
	"action" text NOT NULL,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"logo_url" text,
	"accent_color" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "eoi_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"unit_type" text NOT NULL,
	"status" text NOT NULL,
	"eoi_date" date NOT NULL,
	"amount_egp" bigint NOT NULL,
	"source_row_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eoi_records_unit_type_check" CHECK ("eoi_records"."unit_type" IN ('Residential', 'Admin')),
	CONSTRAINT "eoi_records_status_check" CHECK ("eoi_records"."status" IN ('approved', 'pending', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "eoi_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"row_count" integer NOT NULL,
	"date_min" date NOT NULL,
	"date_max" date NOT NULL,
	"total_count" integer NOT NULL,
	"total_value_egp" bigint NOT NULL,
	"parse_warnings" jsonb,
	"notes" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "eoi_uploads_status_check" CHECK ("eoi_uploads"."status" IN ('draft', 'published', 'superseded', 'discarded'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"client_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('sakneen_admin', 'client_user')),
	CONSTRAINT "client_user_must_have_client" CHECK (("users"."role" = 'sakneen_admin' AND "users"."client_id" IS NULL) OR ("users"."role" = 'client_user' AND "users"."client_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eoi_records" ADD CONSTRAINT "eoi_records_upload_id_eoi_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."eoi_uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eoi_records" ADD CONSTRAINT "eoi_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eoi_uploads" ADD CONSTRAINT "eoi_uploads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eoi_uploads" ADD CONSTRAINT "eoi_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_log_client_created" ON "audit_log" USING btree ("client_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_log_user_created" ON "audit_log" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_eoi_records_client_date" ON "eoi_records" USING btree ("client_id","eoi_date");--> statement-breakpoint
CREATE INDEX "idx_eoi_records_upload" ON "eoi_records" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "idx_eoi_uploads_client_status" ON "eoi_uploads" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "idx_eoi_uploads_published" ON "eoi_uploads" USING btree ("client_id","published_at" DESC NULLS LAST) WHERE "eoi_uploads"."status" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_eoi_uploads_one_published_per_client" ON "eoi_uploads" USING btree ("client_id") WHERE "eoi_uploads"."status" = 'published';--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_client" ON "users" USING btree ("client_id") WHERE "users"."client_id" IS NOT NULL;