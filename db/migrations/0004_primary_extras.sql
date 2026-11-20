CREATE TABLE "challenge_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"questions" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"correct" integer DEFAULT 0 NOT NULL,
	"wrong" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coin_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_ledger_amount_check" CHECK ("coin_ledger"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"reward_id" uuid,
	"name" text NOT NULL,
	"cost" integer NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "redemptions_cost_check" CHECK ("redemptions"."cost" > 0)
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"chapter_id" text NOT NULL,
	"question" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cost" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_rewards_cost_check" CHECK ("shop_rewards"."cost" > 0)
);
--> statement-breakpoint
ALTER TABLE "challenge_runs" ADD CONSTRAINT "challenge_runs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_shop_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."shop_rewards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_rewards" ADD CONSTRAINT "shop_rewards_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_runs_family_idx" ON "challenge_runs" USING btree ("family_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coin_ledger_family_dedupe_uq" ON "coin_ledger" USING btree ("family_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "coin_ledger_earned_idx" ON "coin_ledger" USING btree ("earned_at");--> statement-breakpoint
CREATE INDEX "redemptions_family_idx" ON "redemptions" USING btree ("family_id","redeemed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_items_family_key_uq" ON "review_items" USING btree ("family_id","item_key");--> statement-breakpoint
CREATE INDEX "shop_rewards_family_idx" ON "shop_rewards" USING btree ("family_id");