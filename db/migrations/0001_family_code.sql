ALTER TABLE "app_settings" ADD COLUMN "family_code_hash" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "family_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "failed_family_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "family_locked_until" timestamp with time zone;