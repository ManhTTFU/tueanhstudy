CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"sound_enabled" boolean DEFAULT true NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"pin_hash" text,
	"session_secret" text,
	"session_version" integer DEFAULT 1 NOT NULL,
	"failed_pin_attempts" integer DEFAULT 0 NOT NULL,
	"pin_locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_singleton" CHECK ("app_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "chapter_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" text NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"perfect_sessions" integer DEFAULT 0 NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL,
	"total_correct" integer DEFAULT 0 NOT NULL,
	"total_incorrect" integer DEFAULT 0 NOT NULL,
	"learned_at" timestamp with time zone,
	"last_played_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_openings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sticker_code" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"total_candies" integer DEFAULT 0 NOT NULL,
	"total_completed_quizzes" integer DEFAULT 0 NOT NULL,
	"total_correct_answers" integer DEFAULT 0 NOT NULL,
	"total_incorrect_answers" integer DEFAULT 0 NOT NULL,
	"gifts_opened" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_singleton" CHECK ("progress"."id" = 1),
	CONSTRAINT "progress_non_negative" CHECK ("progress"."total_candies" >= 0 AND "progress"."gifts_opened" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"question_index" integer NOT NULL,
	"question_id" text NOT NULL,
	"question_type" text NOT NULL,
	"correct_answer" integer NOT NULL,
	"selected_answer" integer NOT NULL,
	"attempt_history" jsonb NOT NULL,
	"is_correct" boolean NOT NULL,
	"attempts" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" text NOT NULL,
	"chapter_name" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"questions" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"total_questions" integer NOT NULL,
	"correct_answers" integer DEFAULT 0 NOT NULL,
	"incorrect_answers" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"is_perfect_score" boolean DEFAULT false NOT NULL,
	"candies_earned" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quiz_sessions_status_check" CHECK ("quiz_sessions"."status" IN ('in_progress', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"reward_type" text NOT NULL,
	"reward_code" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_session_id" uuid,
	"source_gift_id" uuid,
	"dedupe_key" text NOT NULL,
	CONSTRAINT "rewards_type_check" CHECK ("rewards"."reward_type" IN ('candy', 'sticker')),
	CONSTRAINT "rewards_quantity_check" CHECK ("rewards"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_session_id_quiz_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_source_session_id_quiz_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_source_gift_id_gift_openings_id_fk" FOREIGN KEY ("source_gift_id") REFERENCES "public"."gift_openings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_progress_chapter_uq" ON "chapter_progress" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "quiz_answers_session_idx" ON "quiz_answers" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_answers_session_question_uq" ON "quiz_answers" USING btree ("session_id","question_index");--> statement-breakpoint
CREATE INDEX "quiz_sessions_chapter_idx" ON "quiz_sessions" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_status_started_idx" ON "quiz_sessions" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "quiz_sessions_completed_idx" ON "quiz_sessions" USING btree ("completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rewards_dedupe_key_uq" ON "rewards" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "rewards_type_code_idx" ON "rewards" USING btree ("reward_type","reward_code");--> statement-breakpoint
CREATE INDEX "rewards_source_session_idx" ON "rewards" USING btree ("source_session_id");