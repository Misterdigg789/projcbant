-- Treasury Balancing Model: NEW TABLES AND COLUMNS
-- This migration adds Shadow Personas and Treasury tracking for admin-created challenges

CREATE TABLE "shadow_personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar NOT NULL,
	"avatar_index" integer DEFAULT 0,
	"category" varchar NOT NULL,
	"used_in_challenge_ids" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "shadow_personas_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "treasury_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"max_treasury_risk" integer NOT NULL,
	"total_treasury_allocated" integer DEFAULT 0,
	"filled_side" varchar,
	"filled_count" integer DEFAULT 0,
	"status" varchar DEFAULT 'pending',
	"admin_notes" text,
	"created_at" timestamp DEFAULT now(),
	"filled_at" timestamp,
	CONSTRAINT "treasury_challenges_challenge_id_unique" UNIQUE("challenge_id")
);
--> statement-breakpoint
CREATE TABLE "treasury_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"shadow_persona_id" integer NOT NULL,
	"shadow_persona_user_id" varchar NOT NULL,
	"real_user_id" varchar NOT NULL,
	"real_user_side" varchar NOT NULL,
	"treasury_staked" integer NOT NULL,
	"status" varchar DEFAULT 'active',
	"result" varchar,
	"treasury_payout" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"settled_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "fomo_level" SET DEFAULT 'low';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "fomo_level" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pair_queue" ALTER COLUMN "challenge_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "pair_queue" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "pair_queue" ALTER COLUMN "matched_with" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "platform_settings" ALTER COLUMN "welcome_message" SET DEFAULT 'Welcome to Bantah! Start creating events and challenges.';--> statement-breakpoint
ALTER TABLE "platform_settings" ALTER COLUMN "support_email" SET DEFAULT 'support@bantah.fun';--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "bonus_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "cover_image_url" varchar;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "early_bird_slots" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "early_bird_bonus" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "streak_bonus_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "conviction_bonus_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "first_time_bonus_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "social_tag_bonus" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "is_pinned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "pair_queue" ADD COLUMN "is_treasury_match" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "pair_queue" ADD COLUMN "treasury_funded" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_wallet_balance" numeric(15, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_total_commission" numeric(15, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_total_bonuses_given" numeric(15, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_shadow_persona" boolean DEFAULT false;--> statement-breakpoint
-- NEW: Treasury Balancing Model migration only
-- Removed existing table CREATE statements - they already exist in previous migrations