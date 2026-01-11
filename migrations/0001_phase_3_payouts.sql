-- Phase 3: Batched Payout Processing Tables
-- Creates job tracking and entry tracking tables for asynchronous payout processing

CREATE TABLE IF NOT EXISTS "payout_jobs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"total_winners" integer NOT NULL,
	"processed_winners" integer DEFAULT 0,
	"total_pool" bigint NOT NULL,
	"platform_fee" bigint NOT NULL,
	"status" varchar DEFAULT 'queued',
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payout_entries" (
	"id" varchar PRIMARY KEY NOT NULL,
	"job_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" bigint NOT NULL,
	"status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "payout_entries" ADD CONSTRAINT "payout_entries_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "payout_jobs"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_jobs_challenge_id_idx" ON "payout_jobs" ("challenge_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_jobs_status_idx" ON "payout_jobs" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_entries_job_id_idx" ON "payout_entries" ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_entries_status_idx" ON "payout_entries" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_entries_user_id_idx" ON "payout_entries" ("user_id");
