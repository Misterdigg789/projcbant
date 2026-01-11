CREATE TABLE IF NOT EXISTS "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"icon" varchar,
	"category" varchar,
	"xp_reward" integer DEFAULT 0,
	"points_reward" integer DEFAULT 0,
	"requirement" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenge_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenger" varchar,
	"challenged" varchar,
	"title" text NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar DEFAULT 'pending',
	"evidence" jsonb,
	"result" varchar,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"admin_created" boolean DEFAULT false,
	"bonus_side" varchar,
	"bonus_multiplier" numeric(3, 2) DEFAULT '1.00',
	"bonus_ends_at" timestamp,
	"yes_stake_total" integer DEFAULT 0,
	"no_stake_total" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_logins" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"streak" integer DEFAULT 1,
	"points_earned" integer DEFAULT 50,
	"claimed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "escrow" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar DEFAULT 'holding',
	"created_at" timestamp DEFAULT now(),
	"released_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"prediction" boolean NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar DEFAULT 'pending',
	"requested_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"challenger" varchar NOT NULL,
	"challenged" varchar NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar DEFAULT 'pending',
	"result" varchar,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer,
	"user_id" text,
	"message" text NOT NULL,
	"reply_to_id" integer,
	"mentions" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"prediction" boolean NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar DEFAULT 'active',
	"matched_with" varchar,
	"payout" integer DEFAULT 0,
	"joined_at" timestamp DEFAULT now(),
	"payout_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_pools" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"yes_amount" integer DEFAULT 0,
	"no_amount" integer DEFAULT 0,
	"total_pool" integer DEFAULT 0,
	"creator_fee_collected" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"event_id" integer NOT NULL,
	"recommendation_score" numeric(5, 2) NOT NULL,
	"recommendation_reason" varchar(255) NOT NULL,
	"match_factors" json,
	"is_viewed" boolean DEFAULT false,
	"is_interacted" boolean DEFAULT false,
	"viewed_at" timestamp,
	"interacted_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_typing" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"is_typing" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"status" varchar DEFAULT 'active',
	"creator_id" varchar NOT NULL,
	"event_pool" integer DEFAULT 0,
	"yes_pool" integer DEFAULT 0,
	"no_pool" integer DEFAULT 0,
	"entry_fee" integer NOT NULL,
	"end_date" timestamp NOT NULL,
	"result" boolean,
	"admin_result" boolean,
	"creator_fee" integer DEFAULT 0,
	"is_private" boolean DEFAULT false,
	"max_participants" integer DEFAULT 100,
	"image_url" varchar,
	"chat_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friends" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" varchar NOT NULL,
	"addressee_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"telegram_id" varchar(64) NOT NULL,
	"username" varchar(100),
	"joined_at" timestamp DEFAULT now(),
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" varchar(64) NOT NULL,
	"title" varchar(255),
	"type" varchar(50),
	"added_by" varchar(64),
	"added_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "groups_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer,
	"user_id" text,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "message_reactions_message_id_user_id_emoji_unique" UNIQUE("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"icon" varchar,
	"data" jsonb,
	"channels" text[],
	"fomo_level" varchar NOT NULL,
	"priority" integer DEFAULT 1,
	"read" boolean DEFAULT false,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pair_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"side" varchar NOT NULL,
	"stake_amount" integer NOT NULL,
	"status" varchar DEFAULT 'waiting',
	"matched_with" varchar,
	"created_at" timestamp DEFAULT now(),
	"matched_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"maintenance_mode" boolean DEFAULT false,
	"registration_enabled" boolean DEFAULT true,
	"min_bet_amount" numeric(10, 2) DEFAULT '100.00',
	"max_bet_amount" numeric(10, 2) DEFAULT '100000.00',
	"platform_fee_percentage" numeric(3, 1) DEFAULT '5.0',
	"creator_fee_percentage" numeric(3, 1) DEFAULT '3.0',
	"withdrawal_enabled" boolean DEFAULT true,
	"deposit_enabled" boolean DEFAULT true,
	"max_withdrawal_daily" numeric(10, 2) DEFAULT '50000.00',
	"max_deposit_daily" numeric(10, 2) DEFAULT '100000.00',
	"challenge_cooldown" integer DEFAULT 300,
	"event_creation_enabled" boolean DEFAULT true,
	"chat_enabled" boolean DEFAULT true,
	"max_chat_length" integer DEFAULT 500,
	"auto_moderation" boolean DEFAULT true,
	"welcome_message" text DEFAULT 'Welcome to BetChat! Start creating events and challenges.',
	"support_email" varchar DEFAULT 'support@betchat.com',
	"terms_url" varchar DEFAULT '/terms',
	"privacy_url" varchar DEFAULT '/privacy',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_id" varchar NOT NULL,
	"referred_id" varchar NOT NULL,
	"code" varchar NOT NULL,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"image_url" varchar,
	"background_color" varchar DEFAULT '#6366f1',
	"text_color" varchar DEFAULT '#ffffff',
	"duration" integer DEFAULT 15,
	"view_count" integer DEFAULT 0,
	"category" varchar DEFAULT 'general',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"viewed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text,
	"related_id" integer,
	"status" varchar DEFAULT 'completed',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"achievement_id" integer NOT NULL,
	"unlocked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_event_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"event_id" integer NOT NULL,
	"interaction_type" varchar(50) NOT NULL,
	"interaction_value" integer DEFAULT 1,
	"session_id" varchar(255),
	"device_type" varchar(50),
	"referral_source" varchar(100),
	"time_spent" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"enable_push" boolean DEFAULT true,
	"enable_telegram" boolean DEFAULT false,
	"enable_in_app" boolean DEFAULT true,
	"notification_frequency" varchar DEFAULT 'immediate',
	"muted_challenges" text[] DEFAULT '{}',
	"muted_users" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"event_categories" jsonb,
	"risk_level" varchar DEFAULT 'medium',
	"notifications" jsonb,
	"privacy" jsonb,
	"appearance" jsonb,
	"performance" jsonb,
	"regional" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_recommendation_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"favorite_categories" json,
	"average_bet_amount" integer DEFAULT 0,
	"preferred_bet_range" json,
	"win_rate" numeric(5, 2) DEFAULT '0.00',
	"total_events_joined" integer DEFAULT 0,
	"total_events_won" integer DEFAULT 0,
	"last_activity_at" timestamp DEFAULT now(),
	"engagement_score" numeric(5, 2) DEFAULT '0.00',
	"preferred_event_types" json,
	"time_preferences" json,
	"social_interactions" integer DEFAULT 0,
	"risk_profile" varchar(50) DEFAULT 'moderate',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_recommendation_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"password" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"username" varchar,
	"level" integer DEFAULT 1,
	"xp" integer DEFAULT 0,
	"points" integer DEFAULT 1000,
	"balance" numeric(10, 2) DEFAULT '0.00',
	"referral_code" varchar,
	"referred_by" varchar,
	"streak" integer DEFAULT 0,
	"status" varchar DEFAULT 'active',
	"is_admin" boolean DEFAULT false,
	"is_telegram_user" boolean DEFAULT false,
	"telegram_id" varchar,
	"telegram_username" varchar,
	"coins" integer DEFAULT 0,
	"fcm_token" varchar,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" USING btree ("expire");