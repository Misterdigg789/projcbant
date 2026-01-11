import { pgTable, serial, varchar, integer, numeric, json, boolean, timestamp, text, index, jsonb, foreignKey, unique, pgPolicy, uuid, check, bigint, pgView, pgSequence, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const notificationType = pgEnum("notification_type", ['event_win', 'event_loss', 'new_event', 'event_update', 'event_created', 'event_participation', 'event_joined', 'event_milestone', 'join_request_received', 'event_join_request_accepted', 'event_join_request_declined', 'earnings', 'follow', 'group_message', 'direct_message', 'group_mention', 'leaderboard_update', 'challenge', 'challenge_response', 'group_achievement', 'group_role', 'referral', 'welcome_bonus', 'challenge_received', 'event_deleted_by_admin', 'support_message', 'deposit_completed', 'system', 'challenge_accepted', 'challenge_declined', 'challenge_completed', 'challenge_won', 'challenge_lost', 'challenge_expired', 'challenge_missed'])
export const walletBalanceType = pgEnum("wallet_balance_type", ['real', 'bonus'])

export const walletIdSeq = pgSequence("wallet_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })

export const eventRecommendations = pgTable("event_recommendations", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	eventId: integer("event_id").notNull(),
	recommendationScore: numeric("recommendation_score", { precision: 5, scale:  2 }).notNull(),
	recommendationReason: varchar("recommendation_reason", { length: 255 }).notNull(),
	matchFactors: json("match_factors"),
	isViewed: boolean("is_viewed").default(false),
	isInteracted: boolean("is_interacted").default(false),
	viewedAt: timestamp("viewed_at", { mode: 'string' }),
	interactedAt: timestamp("interacted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const eventTyping = pgTable("event_typing", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id").notNull(),
	userId: varchar("user_id").notNull(),
	isTyping: boolean("is_typing").default(false),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const friends = pgTable("friends", {
	id: serial().primaryKey().notNull(),
	requesterId: varchar("requester_id").notNull(),
	addresseeId: varchar("addressee_id").notNull(),
	status: varchar().default('pending'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
});

export const platformSettings = pgTable("platform_settings", {
	id: serial().primaryKey().notNull(),
	maintenanceMode: boolean("maintenance_mode").default(false),
	registrationEnabled: boolean("registration_enabled").default(true),
	minBetAmount: numeric("min_bet_amount", { precision: 10, scale:  2 }).default('100.00'),
	maxBetAmount: numeric("max_bet_amount", { precision: 10, scale:  2 }).default('100000.00'),
	platformFeePercentage: numeric("platform_fee_percentage", { precision: 3, scale:  1 }).default('5.0'),
	creatorFeePercentage: numeric("creator_fee_percentage", { precision: 3, scale:  1 }).default('3.0'),
	withdrawalEnabled: boolean("withdrawal_enabled").default(true),
	depositEnabled: boolean("deposit_enabled").default(true),
	maxWithdrawalDaily: numeric("max_withdrawal_daily", { precision: 10, scale:  2 }).default('50000.00'),
	maxDepositDaily: numeric("max_deposit_daily", { precision: 10, scale:  2 }).default('100000.00'),
	challengeCooldown: integer("challenge_cooldown").default(300),
	eventCreationEnabled: boolean("event_creation_enabled").default(true),
	chatEnabled: boolean("chat_enabled").default(true),
	maxChatLength: integer("max_chat_length").default(500),
	autoModeration: boolean("auto_moderation").default(true),
	welcomeMessage: text("welcome_message").default('Welcome to BetChat! Start creating events and challenges.'),
	supportEmail: varchar("support_email").default('support@betchat.com'),
	termsUrl: varchar("terms_url").default('/terms'),
	privacyUrl: varchar("privacy_url").default('/privacy'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const userEventInteractions = pgTable("user_event_interactions", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	eventId: integer("event_id").notNull(),
	interactionType: varchar("interaction_type", { length: 50 }).notNull(),
	interactionValue: integer("interaction_value").default(1),
	sessionId: varchar("session_id", { length: 255 }),
	deviceType: varchar("device_type", { length: 50 }),
	referralSource: varchar("referral_source", { length: 100 }),
	timeSpent: integer("time_spent").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const pairQueue = pgTable("pair_queue", {
	id: serial().primaryKey().notNull(),
	challengeId: integer("challenge_id").notNull(),
	userId: varchar("user_id").notNull(),
	side: varchar().notNull(),
	stakeAmount: integer("stake_amount").notNull(),
	status: varchar().default('waiting'),
	matchedWith: varchar("matched_with"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	matchedAt: timestamp("matched_at", { mode: 'string' }),
});

export const userInteractions = pgTable("user_interactions", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	type: varchar().notNull(),
	entityType: varchar("entity_type").notNull(),
	entityId: varchar("entity_id").notNull(),
	data: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const chatParticipants = pgTable("chat_participants", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatId: uuid("chat_id").notNull(),
	userId: uuid("user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("chat_participants_chat_id_idx").using("btree", table.chatId.asc().nullsLast().op("uuid_ops")),
	index("chat_participants_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_chat_participants_chat_id").using("btree", table.chatId.asc().nullsLast().op("uuid_ops")),
	index("idx_chat_participants_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "chat_participants_chat_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "chat_participants_user_id_fkey"
		}).onDelete("cascade"),
	unique("chat_participants_chat_id_user_id_key").on(table.chatId, table.userId),
	pgPolicy("Users can insert chat participants", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`true`  }),
	pgPolicy("Users can view chat participants", { as: "permissive", for: "select", to: ["public"] }),
]);

export const challengeEvidenceReviews = pgTable("challenge_evidence_reviews", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	messageId: uuid("message_id"),
	userId: uuid("user_id"),
	status: varchar({ length: 20 }).default('pending').notNull(),
	comment: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "challenge_evidence_reviews_user_id_fkey"
		}).onDelete("cascade"),
	unique("challenge_evidence_reviews_message_id_user_id_key").on(table.messageId, table.userId),
]);

export const adminEmails = pgTable("admin_emails", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
}, (table) => [
	unique("admin_emails_email_key").on(table.email),
]);

export const adminFees = pgTable("admin_fees", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	amount: numeric().notNull(),
	sourceType: text("source_type").notNull(),
	sourceId: uuid("source_id").notNull(),
	collected: boolean().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	collectedAt: timestamp("collected_at", { withTimezone: true, mode: 'string' }),
});

export const userNotificationPreferences = pgTable("user_notification_preferences", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	enablePush: boolean("enable_push").default(true),
	enableTelegram: boolean("enable_telegram").default(false),
	enableInApp: boolean("enable_in_app").default(true),
	notificationFrequency: varchar("notification_frequency").default('immediate'),
	mutedChallenges: text("muted_challenges").array().default([""]),
	mutedUsers: text("muted_users").array().default([""]),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("user_notification_preferences_user_id_unique").on(table.userId),
]);

export const eventChatMessages = pgTable("event_chat_messages", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	eventId: uuid("event_id").notNull(),
	senderId: uuid("sender_id").notNull(),
	content: text().notNull(),
	mediaUrl: text("media_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	mediaType: varchar("media_type", { length: 50 }),
	mentions: jsonb(),
	replyTo: uuid("reply_to"),
}, (table) => [
	index("idx_event_chat_messages_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_event_chat_messages_event_id").using("btree", table.eventId.asc().nullsLast().op("uuid_ops")),
	index("idx_event_chat_messages_media_type").using("btree", table.mediaType.asc().nullsLast().op("text_ops")),
	index("idx_event_chat_messages_mentions").using("gin", table.mentions.asc().nullsLast().op("jsonb_ops")),
	index("idx_event_chat_messages_reply_to").using("btree", table.replyTo.asc().nullsLast().op("uuid_ops")),
	index("idx_event_chat_messages_sender_id").using("btree", table.senderId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.replyTo],
			foreignColumns: [table.id],
			name: "event_chat_messages_reply_to_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "event_chat_messages_sender_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can insert event chat messages", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(auth.uid() = sender_id)`  }),
	pgPolicy("Users can read event chat messages", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const eventHistory = pgTable("event_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	type: text().notNull(),
	title: text().notNull(),
	outcome: text().notNull(),
	amount: integer().notNull(),
	earnings: integer(),
	date: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	opponentId: uuid("opponent_id"),
	groupId: uuid("group_id"),
	eventId: uuid("event_id"),
	challengeId: uuid("challenge_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_event_history_date").using("btree", table.date.asc().nullsLast().op("timestamptz_ops")),
	index("idx_event_history_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("idx_event_history_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	pgPolicy("Users can view their own event history", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
	check("event_history_amount_check", sql`amount >= 0`),
	check("event_history_outcome_check", sql`outcome = ANY (ARRAY['won'::text, 'lost'::text])`),
	check("event_history_type_check", sql`type = ANY (ARRAY['challenge'::text, 'group'::text])`),
	check("valid_reference", sql`((type = 'challenge'::text) AND (opponent_id IS NOT NULL) AND (group_id IS NULL)) OR ((type = 'group'::text) AND (group_id IS NOT NULL) AND (opponent_id IS NULL))`),
]);

export const eventChatMessageReactions = pgTable("event_chat_message_reactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	messageId: uuid("message_id"),
	userId: uuid("user_id"),
	emoji: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [eventChatMessages.id],
			name: "event_chat_message_reactions_message_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "event_chat_message_reactions_user_id_fkey"
		}).onDelete("cascade"),
	unique("event_chat_message_reactions_message_id_user_id_emoji_key").on(table.messageId, table.userId, table.emoji),
	pgPolicy("Authenticated users can insert reactions", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = user_id)`  }),
	pgPolicy("Authenticated users can read reactions", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can delete their own reactions", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Users can add reactions", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can remove their own reactions", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("Users can view all reactions", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const userPreferences = pgTable("user_preferences", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	eventCategories: jsonb("event_categories"),
	riskLevel: varchar("risk_level").default('medium'),
	notifications: jsonb(),
	privacy: jsonb(),
	appearance: jsonb(),
	performance: jsonb(),
	regional: jsonb(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const privateChats = pgTable("private_chats", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	pgPolicy("Users can insert into their chats", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`true`  }),
	pgPolicy("Users can view their chats", { as: "permissive", for: "select", to: ["public"] }),
]);

export const pointTransactions = pgTable("point_transactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	points: integer().notNull(),
	actionType: text("action_type").notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	metadata: jsonb().default({}),
}, (table) => [
	index("idx_point_transactions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "point_transactions_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view their own point transactions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(auth.uid() = user_id)` }),
]);

export const messages = pgTable("messages", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatId: uuid("chat_id"),
	senderId: uuid("sender_id"),
	content: text().notNull(),
	type: text().default('chat_message').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	eventId: uuid("event_id"),
}, (table) => [
	index("idx_messages_event_id").using("btree", table.eventId.asc().nullsLast().op("uuid_ops")),
	index("messages_chat_id_idx").using("btree", table.chatId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "messages_chat_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "messages_sender_id_fkey"
		}),
]);

export const profiles = pgTable("profiles", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	balance: numeric().default('10000'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isAdmin: boolean("is_admin").default(false),
	role: varchar({ length: 50 }).default('USER'),
});

export const friendRequests = pgTable("friend_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	senderId: uuid("sender_id"),
	recipientId: uuid("recipient_id"),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_friend_requests_recipient").using("btree", table.recipientId.asc().nullsLast().op("uuid_ops")),
	index("idx_friend_requests_sender").using("btree", table.senderId.asc().nullsLast().op("uuid_ops")),
	index("idx_friend_requests_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	unique("friend_requests_sender_id_recipient_id_key").on(table.senderId, table.recipientId),
	pgPolicy("Users can send friend requests", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(sender_id = auth.uid())`  }),
	pgPolicy("Users can update their received requests", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can view their own friend requests", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("different_users", sql`sender_id <> recipient_id`),
	check("friend_requests_status_check", sql`status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])`),
]);

export const liquidityTransactions = pgTable("liquidity_transactions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	eventId: uuid("event_id"),
	adminEmail: text("admin_email").notNull(),
	amount: numeric().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	notes: text(),
}, (table) => [
	pgPolicy("Admins can view liquidity transactions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_admin(auth.email())` }),
]);

export const userRecommendationProfiles = pgTable("user_recommendation_profiles", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	favoriteCategories: json("favorite_categories"),
	averageBetAmount: integer("average_bet_amount").default(0),
	preferredBetRange: json("preferred_bet_range"),
	winRate: numeric("win_rate", { precision: 5, scale:  2 }).default('0.00'),
	totalEventsJoined: integer("total_events_joined").default(0),
	totalEventsWon: integer("total_events_won").default(0),
	lastActivityAt: timestamp("last_activity_at", { mode: 'string' }).defaultNow(),
	engagementScore: numeric("engagement_score", { precision: 5, scale:  2 }).default('0.00'),
	preferredEventTypes: json("preferred_event_types"),
	timePreferences: json("time_preferences"),
	socialInteractions: integer("social_interactions").default(0),
	riskProfile: varchar("risk_profile", { length: 50 }).default('moderate'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("user_recommendation_profiles_user_id_unique").on(table.userId),
]);

export const typingStatus = pgTable("typing_status", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid("chat_id"),
	userId: uuid("user_id"),
	isTyping: boolean("is_typing").default(false),
	lastUpdated: timestamp("last_updated", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_typing_status_chat_id").using("btree", table.chatId.asc().nullsLast().op("uuid_ops")),
	unique("typing_status_chat_id_user_id_key").on(table.chatId, table.userId),
	pgPolicy("insert_typing_status", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(user_id = auth.uid())`  }),
	pgPolicy("update_typing_status", { as: "permissive", for: "update", to: ["authenticated"] }),
]);

export const supportTickets = pgTable("support_tickets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	status: text().default('open').notNull(),
	priority: text().default('normal').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	resolvedBy: uuid("resolved_by"),
}, (table) => [
	pgPolicy("Users can create tickets", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(user_id = auth.uid())`  }),
	pgPolicy("Users can view their own tickets", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("support_tickets_priority_check", sql`priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])`),
	check("support_tickets_status_check", sql`status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])`),
]);

export const withdrawals = pgTable("withdrawals", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	walletId: uuid("wallet_id").notNull(),
	amount: numeric().notNull(),
	balanceType: text("balance_type").notNull(),
	reference: text().notNull(),
	status: text().notNull(),
	bankName: text("bank_name").notNull(),
	accountNumber: text("account_number").notNull(),
	accountName: text("account_name").notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.walletId],
			foreignColumns: [wallets.id],
			name: "withdrawals_wallet_id_fkey"
		}),
	unique("withdrawals_reference_key").on(table.reference),
	pgPolicy("Users can create withdrawal requests", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(wallet_id IN ( SELECT wallets.id
   FROM wallets
  WHERE (wallets.user_id = auth.uid())))`  }),
	pgPolicy("Users can view their own withdrawals", { as: "permissive", for: "select", to: ["public"] }),
	check("withdrawals_balance_type_check", sql`balance_type = ANY (ARRAY['real'::text, 'bonus'::text])`),
	check("withdrawals_status_check", sql`status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])`),
]);

export const walletTransactions = pgTable("wallet_transactions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	walletId: uuid("wallet_id"),
	type: text().notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	balanceType: walletBalanceType("balance_type").notNull(),
	reference: text().notNull(),
	description: text(),
	metadata: jsonb().default({}),
	status: text().default('completed'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.walletId],
			foreignColumns: [wallets.id],
			name: "wallet_transactions_wallet_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view their own transactions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(wallet_id IN ( SELECT wallets.id
   FROM wallets
  WHERE (wallets.user_id = auth.uid())))` }),
]);

export const userPresence = pgTable("user_presence", {
	userId: uuid("user_id").primaryKey().notNull(),
	status: text().notNull(),
	lastSeen: timestamp("last_seen", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_presence_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Allow users to insert their own presence", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(auth.uid() = user_id)`  }),
	pgPolicy("Allow users to read all presence data", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Allow users to update their own presence", { as: "permissive", for: "update", to: ["authenticated"] }),
	check("user_presence_status_check", sql`status = ANY (ARRAY['online'::text, 'away'::text, 'offline'::text])`),
]);

export const payoutJobs = pgTable("payout_jobs", {
	id: varchar().primaryKey().notNull(),
	challengeId: integer("challenge_id").notNull(),
	totalWinners: integer("total_winners").notNull(),
	processedWinners: integer("processed_winners").default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalPool: bigint("total_pool", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	platformFee: bigint("platform_fee", { mode: "number" }).notNull(),
	status: varchar().default('queued'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	error: text(),
}, (table) => [
	index("payout_jobs_challenge_id_idx").using("btree", table.challengeId.asc().nullsLast().op("int4_ops")),
	index("payout_jobs_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const payoutEntries = pgTable("payout_entries", {
	id: varchar().primaryKey().notNull(),
	jobId: varchar("job_id").notNull(),
	userId: varchar("user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amount: bigint({ mode: "number" }).notNull(),
	status: varchar().default('pending'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	processedAt: timestamp("processed_at", { mode: 'string' }),
}, (table) => [
	index("payout_entries_job_id_idx").using("btree", table.jobId.asc().nullsLast().op("text_ops")),
	index("payout_entries_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("payout_entries_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [payoutJobs.id],
			name: "payout_entries_job_id_fk"
		}).onDelete("cascade"),
]);

export const achievements = pgTable("achievements", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	icon: varchar(),
	category: varchar(),
	xpReward: integer("xp_reward").default(0),
	pointsReward: integer("points_reward").default(0),
	requirement: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const challengeMessages = pgTable("challenge_messages", {
	id: serial().primaryKey().notNull(),
	challengeId: integer("challenge_id").notNull(),
	userId: varchar("user_id").notNull(),
	message: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const privateMessages = pgTable("private_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	content: text().notNull(),
	senderId: uuid("sender_id").notNull(),
	receiverId: uuid("receiver_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	mediaUrl: text("media_url"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	editedAt: timestamp("edited_at", { withTimezone: true, mode: 'string' }),
	reactions: jsonb().default({}),
}, (table) => [
	index("idx_private_messages_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_private_messages_receiver_id").using("btree", table.receiverId.asc().nullsLast().op("uuid_ops")),
	index("idx_private_messages_sender_id").using("btree", table.senderId.asc().nullsLast().op("uuid_ops")),
	pgPolicy("Users can insert messages", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = sender_id)`  }),
	pgPolicy("Users can insert their own messages", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can read messages they've sent or received", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can read their private messages", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Users can view their messages", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const challengeDisputes = pgTable("challenge_disputes", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	challengeId: uuid("challenge_id"),
	initiatedBy: uuid("initiated_by"),
	reason: text().notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	resolvedBy: uuid("resolved_by"),
	resolution: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.initiatedBy],
			foreignColumns: [users.id],
			name: "challenge_disputes_initiated_by_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [users.id],
			name: "challenge_disputes_resolved_by_fkey"
		}).onDelete("set null"),
]);

export const chatMessages = pgTable("chat_messages", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatId: uuid("chat_id").notNull(),
	senderId: uuid("sender_id").notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_chat_messages_chat_id").using("btree", table.chatId.asc().nullsLast().op("uuid_ops")),
	index("idx_chat_messages_sender_id").using("btree", table.senderId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [privateChats.id],
			name: "chat_messages_chat_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "chat_messages_sender_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can insert messages", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(sender_id = auth.uid())`  }),
	pgPolicy("Users can view messages", { as: "permissive", for: "select", to: ["public"] }),
]);

export const coinBonusHistory = pgTable("coin_bonus_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	adminId: uuid("admin_id"),
	amount: integer().notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	check("coin_bonus_history_amount_check", sql`amount > 0`),
]);

export const adminActions = pgTable("admin_actions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	adminId: uuid("admin_id"),
	actionType: text("action_type").notNull(),
	targetType: text("target_type").notNull(),
	targetId: uuid("target_id").notNull(),
	details: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_admin_actions_admin_id").using("btree", table.adminId.asc().nullsLast().op("uuid_ops")),
	index("idx_admin_actions_target_id").using("btree", table.targetId.asc().nullsLast().op("uuid_ops")),
]);

export const creatorEarnings = pgTable("creator_earnings", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	creatorId: uuid("creator_id").notNull(),
	eventId: uuid("event_id").notNull(),
	amount: numeric().default('0').notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creator_earnings_creator_id").using("btree", table.creatorId.asc().nullsLast().op("uuid_ops")),
	index("idx_creator_earnings_event_id").using("btree", table.eventId.asc().nullsLast().op("uuid_ops")),
	index("idx_creator_earnings_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.creatorId],
			foreignColumns: [users.id],
			name: "creator_earnings_creator_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Creators can view their own earnings", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(creator_id = auth.uid())` }),
	pgPolicy("System can insert creator earnings", { as: "permissive", for: "insert", to: ["authenticated"] }),
	check("creator_earnings_status_check", sql`status = ANY (ARRAY['pending'::text, 'processed'::text, 'withdrawn'::text])`),
]);

export const chats = pgTable("chats", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	eventId: uuid("event_id"),
	type: text().default('event_chat').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("chats_event_id_idx").using("btree", table.eventId.asc().nullsLast().op("uuid_ops")),
]);

export const eventBetEscrow = pgTable("event_bet_escrow", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	eventId: uuid("event_id").notNull(),
	amount: numeric().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	resolved: boolean().default(false),
}, (table) => [
	index("idx_event_bet_escrow_event_id").using("btree", table.eventId.asc().nullsLast().op("uuid_ops")),
	index("idx_event_bet_escrow_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	check("event_bet_escrow_amount_check", sql`amount > (0)::numeric`),
]);

export const eventEscrow = pgTable("event_escrow", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	eventId: uuid("event_id"),
	userId: uuid("user_id"),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	status: varchar({ length: 20 }).default('pending_match').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "event_escrow_user_id_fkey"
		}).onDelete("cascade"),
]);

export const dailyLogins = pgTable("daily_logins", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	streak: integer().default(1),
	pointsEarned: integer("points_earned").default(50),
	claimed: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const escrow = pgTable("escrow", {
	id: serial().primaryKey().notNull(),
	challengeId: integer("challenge_id").notNull(),
	amount: integer().notNull(),
	status: varchar().default('holding'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	releasedAt: timestamp("released_at", { mode: 'string' }),
});

export const followers = pgTable("followers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	followerId: uuid("follower_id"),
	followingId: uuid("following_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_followers_follower_id").using("btree", table.followerId.asc().nullsLast().op("uuid_ops")),
	index("idx_followers_following_id").using("btree", table.followingId.asc().nullsLast().op("uuid_ops")),
	unique("followers_follower_id_following_id_key").on(table.followerId, table.followingId),
	pgPolicy("anyone_can_view_followers", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("users_can_follow", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("users_can_unfollow", { as: "permissive", for: "delete", to: ["authenticated"] }),
	check("no_self_follow", sql`follower_id <> following_id`),
]);

export const eventJoinRequests = pgTable("event_join_requests", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id").notNull(),
	userId: varchar("user_id").notNull(),
	prediction: boolean().notNull(),
	amount: integer().notNull(),
	status: varchar().default('pending'),
	requestedAt: timestamp("requested_at", { mode: 'string' }).defaultNow(),
	respondedAt: timestamp("responded_at", { mode: 'string' }),
});

export const pointsTransactions = pgTable("points_transactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	amount: integer().notNull(),
	type: text().notNull(),
	description: text(),
	adminId: uuid("admin_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	pgPolicy("Users can view their own points transactions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
	check("points_transactions_type_check", sql`type = ANY (ARRAY['admin_grant'::text, 'event_win'::text, 'challenge_win'::text, 'event_creation'::text, 'challenge_creation'::text])`),
]);

export const reports = pgTable("reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	reporterId: uuid("reporter_id"),
	reportedId: uuid("reported_id"),
	type: text().notNull(),
	targetId: uuid("target_id").notNull(),
	reason: text().notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	resolvedBy: uuid("resolved_by"),
}, (table) => [
	index("idx_reports_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_reports_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	pgPolicy("Users can create reports", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(reporter_id = auth.uid())`  }),
	check("different_users", sql`reporter_id <> reported_id`),
	check("reports_status_check", sql`status = ANY (ARRAY['pending'::text, 'resolved'::text, 'dismissed'::text])`),
	check("reports_type_check", sql`type = ANY (ARRAY['user'::text, 'group'::text, 'event'::text])`),
]);

export const supportMessages = pgTable("support_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	content: text().notNull(),
	isSupport: boolean("is_support").default(false),
	read: boolean().default(false),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_support_messages_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_support_messages_read").using("btree", table.read.asc().nullsLast().op("bool_ops")),
	index("idx_support_messages_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "support_messages_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Support can update messages", { as: "permissive", for: "update", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = 'support'::text))))` }),
	pgPolicy("Support can view all support messages", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can insert own messages", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can insert their own messages", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can insert their own support messages", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view own messages", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can view their own messages", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can view their own support messages", { as: "permissive", for: "select", to: ["public"] }),
]);

export const eventMatches = pgTable("event_matches", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id").notNull(),
	challenger: varchar().notNull(),
	challenged: varchar().notNull(),
	amount: integer().notNull(),
	status: varchar().default('pending'),
	result: varchar(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
});

export const systemSettings = pgTable("system_settings", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).default(1).primaryKey().notNull(),
	settlementMethod: text("settlement_method").default('fiat').notNull(),
	coinsExchangeRate: integer("coins_exchange_rate").default(100).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	pgPolicy("Anyone can view system settings", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	check("single_row", sql`id = 1`),
	check("system_settings_settlement_method_check", sql`settlement_method = ANY (ARRAY['fiat'::text, 'coins'::text])`),
]);

export const userStats = pgTable("user_stats", {
	userId: uuid("user_id").primaryKey().notNull(),
	eventsCreated: integer("events_created").default(0),
	eventsParticipated: integer("events_participated").default(0),
	totalWageredYes: integer("total_wagered_yes").default(0),
	totalWageredNo: integer("total_wagered_no").default(0),
	eventsWon: integer("events_won").default(0),
	eventsLost: integer("events_lost").default(0),
	currentBalance: integer("current_balance").default(0),
	totalEarnings: integer("total_earnings").default(0),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	pgPolicy("Users can view all user stats", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]);

export const wallets = pgTable("wallets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	balance: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	coins: integer().default(0),
	realBalance: integer("real_balance").default(0).notNull(),
	bonusBalance: integer("bonus_balance").default(0).notNull(),
	lockedBalance: numeric("locked_balance", { precision: 10, scale:  2 }).default('0'),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "wallets_user_id_fkey"
		}),
	unique("wallets_user_id_key").on(table.userId),
	pgPolicy("Users can view their own wallet", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("allow_all_wallet_operations", { as: "permissive", for: "all", to: ["public"] }),
	pgPolicy("public_wallets_access", { as: "permissive", for: "all", to: ["public"] }),
	check("wallets_locked_balance_check", sql`locked_balance >= (0)::numeric`),
	check("wallets_locked_balance_nonnegative", sql`locked_balance >= (0)::numeric`),
	check("wallets_real_balance_check", sql`real_balance >= 0`),
	check("wallets_real_balance_nonnegative", sql`real_balance >= 0`),
]);

export const welcomeBonuses = pgTable("welcome_bonuses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	amount: integer().default(1000).notNull(),
	claimedAt: timestamp("claimed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	referrerId: uuid("referrer_id"),
}, (table) => [
	unique("one_bonus_per_user").on(table.userId),
	pgPolicy("Users can view their own welcome bonus", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
]);

export const eventActivity = pgTable("event_activity", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id").notNull(),
	userId: varchar("user_id").notNull(),
	action: varchar().notNull(),
	data: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const eventMessages = pgTable("event_messages", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id"),
	userId: text("user_id"),
	message: text().notNull(),
	replyToId: integer("reply_to_id"),
	mentions: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const eventParticipants = pgTable("event_participants", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id").notNull(),
	userId: varchar("user_id").notNull(),
	prediction: boolean().notNull(),
	amount: integer().notNull(),
	status: varchar().default('active'),
	matchedWith: varchar("matched_with"),
	payout: integer().default(0),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
	payoutAt: timestamp("payout_at", { mode: 'string' }),
});

export const eventPools = pgTable("event_pools", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id").notNull(),
	yesAmount: integer("yes_amount").default(0),
	noAmount: integer("no_amount").default(0),
	totalPool: integer("total_pool").default(0),
	creatorFeeCollected: boolean("creator_fee_collected").default(false),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const groups = pgTable("groups", {
	id: serial().primaryKey().notNull(),
	telegramId: varchar("telegram_id", { length: 64 }).notNull(),
	title: varchar({ length: 255 }),
	type: varchar({ length: 50 }),
	addedBy: varchar("added_by", { length: 64 }),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("groups_telegram_id_unique").on(table.telegramId),
]);

export const events = pgTable("events", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	category: varchar().notNull(),
	status: varchar().default('active'),
	creatorId: varchar("creator_id").notNull(),
	eventPool: integer("event_pool").default(0),
	yesPool: integer("yes_pool").default(0),
	noPool: integer("no_pool").default(0),
	entryFee: integer("entry_fee").notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	result: boolean(),
	adminResult: boolean("admin_result"),
	creatorFee: integer("creator_fee").default(0),
	isPrivate: boolean("is_private").default(false),
	maxParticipants: integer("max_participants").default(100),
	imageUrl: varchar("image_url"),
	chatEnabled: boolean("chat_enabled").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const groupMembers = pgTable("group_members", {
	id: serial().primaryKey().notNull(),
	groupId: integer("group_id").notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	telegramId: varchar("telegram_id", { length: 64 }).notNull(),
	username: varchar({ length: 100 }),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
	leftAt: timestamp("left_at", { mode: 'string' }),
});

export const messageReactions = pgTable("message_reactions", {
	id: serial().primaryKey().notNull(),
	messageId: integer("message_id"),
	userId: text("user_id"),
	emoji: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("message_reactions_message_id_user_id_emoji_unique").on(table.messageId, table.userId, table.emoji),
]);

export const notifications = pgTable("notifications", {
	id: varchar().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	type: varchar().notNull(),
	title: text().notNull(),
	message: text(),
	icon: varchar(),
	data: jsonb(),
	channels: text().array(),
	fomoLevel: varchar("fomo_level").default('low'),
	priority: integer().default(1),
	read: boolean().default(false),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	endpoint: text().notNull(),
	p256Dh: text().notNull(),
	auth: text().notNull(),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const referralRewards = pgTable("referral_rewards", {
	id: serial().primaryKey().notNull(),
	referralId: integer("referral_id").notNull(),
	userId: varchar("user_id").notNull(),
	type: varchar().notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const referrals = pgTable("referrals", {
	id: serial().primaryKey().notNull(),
	referrerId: varchar("referrer_id").notNull(),
	referredId: varchar("referred_id").notNull(),
	code: varchar().notNull(),
	status: varchar().default('active'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const stories = pgTable("stories", {
	id: serial().primaryKey().notNull(),
	title: varchar().notNull(),
	content: text().notNull(),
	imageUrl: varchar("image_url"),
	backgroundColor: varchar("background_color").default('#6366f1'),
	textColor: varchar("text_color").default('#ffffff'),
	duration: integer().default(15),
	viewCount: integer("view_count").default(0),
	category: varchar().default('general'),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const storyViews = pgTable("story_views", {
	id: serial().primaryKey().notNull(),
	storyId: integer("story_id").notNull(),
	userId: varchar("user_id").notNull(),
	viewedAt: timestamp("viewed_at", { mode: 'string' }).defaultNow(),
});

export const transactions = pgTable("transactions", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	type: varchar().notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	description: text(),
	relatedId: integer("related_id"),
	status: varchar().default('completed'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const userAchievements = pgTable("user_achievements", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	achievementId: integer("achievement_id").notNull(),
	unlockedAt: timestamp("unlocked_at", { mode: 'string' }).defaultNow(),
});

export const challenges = pgTable("challenges", {
	id: serial().primaryKey().notNull(),
	challenger: varchar(),
	challenged: varchar(),
	title: text().notNull(),
	description: text(),
	category: varchar().notNull(),
	amount: integer().notNull(),
	status: varchar().default('pending'),
	evidence: jsonb(),
	result: varchar(),
	dueDate: timestamp("due_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	adminCreated: boolean("admin_created").default(false),
	bonusSide: varchar("bonus_side"),
	bonusMultiplier: numeric("bonus_multiplier", { precision: 3, scale:  2 }).default('1.00'),
	bonusEndsAt: timestamp("bonus_ends_at", { mode: 'string' }),
	yesStakeTotal: integer("yes_stake_total").default(0),
	noStakeTotal: integer("no_stake_total").default(0),
	coverImageUrl: text("cover_image_url"),
	bonusAmount: integer("bonus_amount").default(0),
	earlyBirdSlots: integer("early_bird_slots").default(0),
	earlyBirdBonus: integer("early_bird_bonus").default(0),
	streakBonusEnabled: boolean("streak_bonus_enabled").default(false),
	convictionBonusEnabled: boolean("conviction_bonus_enabled").default(false),
	firstTimeBonusEnabled: boolean("first_time_bonus_enabled").default(false),
	socialTagBonus: integer("social_tag_bonus").default(0),
	isPinned: boolean("is_pinned").default(false),
});

export const users = pgTable("users", {
	id: varchar().primaryKey().notNull(),
	email: varchar().notNull(),
	password: varchar().notNull(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	username: varchar(),
	level: integer().default(1),
	xp: integer().default(0),
	points: integer().default(1000),
	balance: numeric({ precision: 10, scale:  2 }).default('0.00'),
	referralCode: varchar("referral_code"),
	referredBy: varchar("referred_by"),
	streak: integer().default(0),
	status: varchar().default('active'),
	isAdmin: boolean("is_admin").default(false),
	isTelegramUser: boolean("is_telegram_user").default(false),
	telegramId: varchar("telegram_id"),
	telegramUsername: varchar("telegram_username"),
	coins: integer().default(0),
	fcmToken: varchar("fcm_token"),
	lastLogin: timestamp("last_login", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	adminWalletBalance: numeric("admin_wallet_balance", { precision: 15, scale:  2 }).default('0.00'),
	adminTotalCommission: numeric("admin_total_commission", { precision: 15, scale:  2 }).default('0.00'),
	adminTotalBonusesGiven: numeric("admin_total_bonuses_given", { precision: 15, scale:  2 }).default('0.00'),
}, (table) => [
	unique("users_email_unique").on(table.email),
	unique("users_username_unique").on(table.username),
	unique("users_referral_code_unique").on(table.referralCode),
]);

export const adminWalletTransactions = pgTable("admin_wallet_transactions", {
	id: serial().primaryKey().notNull(),
	adminId: varchar("admin_id").notNull(),
	type: varchar().notNull(),
	amount: numeric({ precision: 15, scale:  2 }).notNull(),
	description: text(),
	relatedId: integer("related_id"),
	relatedType: varchar("related_type"),
	reference: varchar(),
	status: varchar().default('completed'),
	balanceBefore: numeric("balance_before", { precision: 15, scale:  2 }),
	balanceAfter: numeric("balance_after", { precision: 15, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_admin_wallet_admin_id").using("btree", table.adminId.asc().nullsLast().op("text_ops")),
	index("idx_admin_wallet_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_admin_wallet_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
]);
export const eventChatMessagesWithSender = pgView("event_chat_messages_with_sender", {	id: uuid(),
	eventId: uuid("event_id"),
	senderId: uuid("sender_id"),
	content: text(),
	mediaUrl: text("media_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	senderName: text("sender_name"),
	senderAvatarUrl: text("sender_avatar_url"),
	senderUsername: text("sender_username"),
}).as(sql`SELECT m.id, m.event_id, m.sender_id, m.content, m.media_url, m.created_at, m.updated_at, COALESCE(u.raw_user_meta_data ->> 'name'::text, 'Unknown User'::text) AS sender_name, u.raw_user_meta_data ->> 'avatar_url'::text AS sender_avatar_url, u.raw_user_meta_data ->> 'username'::text AS sender_username FROM event_chat_messages m LEFT JOIN auth.users u ON m.sender_id = u.id`);

export const usersView = pgView("users_view", {	id: uuid(),
	email: varchar({ length: 255 }),
	name: text(),
	avatarUrl: text("avatar_url"),
	username: text(),
}).as(sql`SELECT users.id, users.email, users.raw_user_meta_data ->> 'name'::text AS name, users.raw_user_meta_data ->> 'avatar_url'::text AS avatar_url, users.raw_user_meta_data ->> 'username'::text AS username FROM auth.users`);

export const messagesWithUsers = pgView("messages_with_users", {	id: uuid(),
	content: text(),
	senderId: uuid("sender_id"),
	receiverId: uuid("receiver_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	mediaUrl: text("media_url"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	senderName: text("sender_name"),
	senderAvatarUrl: text("sender_avatar_url"),
	senderUsername: text("sender_username"),
	receiverName: text("receiver_name"),
	receiverAvatarUrl: text("receiver_avatar_url"),
	receiverUsername: text("receiver_username"),
}).as(sql`SELECT pm.id, pm.content, pm.sender_id, pm.receiver_id, pm.created_at, pm.read_at, pm.media_url, pm.updated_at, s.name AS sender_name, s.avatar_url AS sender_avatar_url, s.username AS sender_username, r.name AS receiver_name, r.avatar_url AS receiver_avatar_url, r.username AS receiver_username FROM private_messages pm LEFT JOIN users_view s ON pm.sender_id = s.id LEFT JOIN users_view r ON pm.receiver_id = r.id`);