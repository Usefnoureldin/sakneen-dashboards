ALTER TABLE "eoi_records" ADD COLUMN "bulk_eoi_id" bigint;--> statement-breakpoint
ALTER TABLE "eoi_records" ADD COLUMN "eoi_category" text;--> statement-breakpoint
ALTER TABLE "eoi_records" ADD COLUMN "eoi_source" text;--> statement-breakpoint
ALTER TABLE "eoi_records" ADD COLUMN "nationality" text;--> statement-breakpoint
ALTER TABLE "eoi_records" ADD COLUMN "brokerage_name" text;--> statement-breakpoint
CREATE INDEX "idx_eoi_records_bulk" ON "eoi_records" USING btree ("upload_id","bulk_eoi_id");