-- Treasury Balancing Model Migration
-- Only includes NEW tables and columns for Shadow Personas and Treasury tracking

-- NEW TABLES FOR TREASURY SYSTEM

CREATE TABLE IF NOT EXISTS "shadow_personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar NOT NULL,
	"avatar_index" integer DEFAULT 0,
	"category" varchar NOT NULL,
	"used_in_challenge_ids" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "shadow_personas_username_unique" UNIQUE("username")
);

CREATE TABLE IF NOT EXISTS "treasury_challenges" (
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

CREATE TABLE IF NOT EXISTS "treasury_matches" (
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

-- NEW COLUMNS FOR TREASURY MATCHING

ALTER TABLE IF EXISTS "pair_queue"
ADD COLUMN IF NOT EXISTS "is_treasury_match" boolean DEFAULT false;

ALTER TABLE IF EXISTS "pair_queue"
ADD COLUMN IF NOT EXISTS "treasury_funded" boolean DEFAULT false;

ALTER TABLE IF EXISTS "users"
ADD COLUMN IF NOT EXISTS "is_shadow_persona" boolean DEFAULT false;
