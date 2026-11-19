-- Nhiều gia đình: tạo bảng families, gắn family_id vào mọi dữ liệu học tập.
-- Dữ liệu đang có (nếu có) được chuyển thành gia đình đầu tiên "Gia đình 1",
-- giữ nguyên PIN phụ huynh, mã gia đình và cài đặt âm thanh/chuyển động.
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"code_hash" text,
	"family_version" integer DEFAULT 1 NOT NULL,
	"failed_code_attempts" integer DEFAULT 0 NOT NULL,
	"code_locked_until" timestamp with time zone,
	"pin_hash" text,
	"session_version" integer DEFAULT 1 NOT NULL,
	"failed_pin_attempts" integer DEFAULT 0 NOT NULL,
	"pin_locked_until" timestamp with time zone,
	"sound_enabled" boolean DEFAULT true NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "families_name_key_uq" ON "families" USING btree ("name_key");--> statement-breakpoint
INSERT INTO "families" (
	"id", "name", "name_key", "code_hash", "family_version", "pin_hash", "session_version", "sound_enabled", "reduced_motion"
)
SELECT
	'00000000-0000-4000-8000-000000000001'::uuid, 'Gia đình 1', 'gia dinh 1',
	s."family_code_hash", coalesce(s."family_version", 1), s."pin_hash", coalesce(s."session_version", 1),
	coalesce(s."sound_enabled", true), coalesce(s."reduced_motion", false)
FROM (SELECT 1) AS "one"
LEFT JOIN "app_settings" s ON s."id" = 1
WHERE EXISTS (SELECT 1 FROM "app_settings" WHERE "pin_hash" IS NOT NULL OR "family_code_hash" IS NOT NULL)
	OR EXISTS (SELECT 1 FROM "progress")
	OR EXISTS (SELECT 1 FROM "quiz_sessions")
	OR EXISTS (SELECT 1 FROM "rewards")
	OR EXISTS (SELECT 1 FROM "gift_openings")
	OR EXISTS (SELECT 1 FROM "chapter_progress");--> statement-breakpoint
ALTER TABLE "progress" DROP CONSTRAINT "progress_singleton";--> statement-breakpoint
DROP INDEX "chapter_progress_chapter_uq";--> statement-breakpoint
DROP INDEX "quiz_sessions_chapter_idx";--> statement-breakpoint
DROP INDEX "quiz_sessions_completed_idx";--> statement-breakpoint
DROP INDEX "rewards_dedupe_key_uq";--> statement-breakpoint
DROP INDEX "rewards_type_code_idx";--> statement-breakpoint
ALTER TABLE "chapter_progress" ADD COLUMN "family_id" uuid;--> statement-breakpoint
ALTER TABLE "gift_openings" ADD COLUMN "family_id" uuid;--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "family_id" uuid;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD COLUMN "family_id" uuid;--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "family_id" uuid;--> statement-breakpoint
UPDATE "chapter_progress" SET "family_id" = '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
UPDATE "gift_openings" SET "family_id" = '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
UPDATE "progress" SET "family_id" = '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
UPDATE "quiz_sessions" SET "family_id" = '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
UPDATE "rewards" SET "family_id" = '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "progress" DROP CONSTRAINT "progress_pkey";--> statement-breakpoint
ALTER TABLE "progress" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "chapter_progress" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "gift_openings" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "progress" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rewards" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "progress" ADD PRIMARY KEY ("family_id");--> statement-breakpoint
ALTER TABLE "chapter_progress" ADD CONSTRAINT "chapter_progress_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_openings" ADD CONSTRAINT "gift_openings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_progress_family_chapter_uq" ON "chapter_progress" USING btree ("family_id","chapter_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_family_chapter_idx" ON "quiz_sessions" USING btree ("family_id","chapter_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_family_status_started_idx" ON "quiz_sessions" USING btree ("family_id","status","started_at");--> statement-breakpoint
CREATE INDEX "quiz_sessions_family_completed_idx" ON "quiz_sessions" USING btree ("family_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rewards_family_dedupe_key_uq" ON "rewards" USING btree ("family_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "rewards_family_type_code_idx" ON "rewards" USING btree ("family_id","reward_type","reward_code");--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "sound_enabled";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "reduced_motion";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "pin_hash";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "session_version";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "failed_pin_attempts";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "pin_locked_until";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "family_code_hash";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "family_version";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "failed_family_attempts";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "family_locked_until";
