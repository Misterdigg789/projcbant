import { relations } from "drizzle-orm/relations";
import { chats, chatParticipants, usersInAuth, challengeEvidenceReviews, eventChatMessages, eventChatMessageReactions, pointTransactions, messages, wallets, withdrawals, walletTransactions, userPresence, payoutJobs, payoutEntries, challengeDisputes, privateChats, chatMessages, creatorEarnings, eventEscrow, supportMessages } from "./schema";

export const chatParticipantsRelations = relations(chatParticipants, ({one}) => ({
	chat: one(chats, {
		fields: [chatParticipants.chatId],
		references: [chats.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [chatParticipants.userId],
		references: [usersInAuth.id]
	}),
}));

export const chatsRelations = relations(chats, ({many}) => ({
	chatParticipants: many(chatParticipants),
	messages: many(messages),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	chatParticipants: many(chatParticipants),
	challengeEvidenceReviews: many(challengeEvidenceReviews),
	eventChatMessages: many(eventChatMessages),
	eventChatMessageReactions: many(eventChatMessageReactions),
	pointTransactions: many(pointTransactions),
	messages: many(messages),
	userPresences: many(userPresence),
	challengeDisputes_initiatedBy: many(challengeDisputes, {
		relationName: "challengeDisputes_initiatedBy_usersInAuth_id"
	}),
	challengeDisputes_resolvedBy: many(challengeDisputes, {
		relationName: "challengeDisputes_resolvedBy_usersInAuth_id"
	}),
	chatMessages: many(chatMessages),
	creatorEarnings: many(creatorEarnings),
	eventEscrows: many(eventEscrow),
	supportMessages: many(supportMessages),
	wallets: many(wallets),
}));

export const challengeEvidenceReviewsRelations = relations(challengeEvidenceReviews, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [challengeEvidenceReviews.userId],
		references: [usersInAuth.id]
	}),
}));

export const eventChatMessagesRelations = relations(eventChatMessages, ({one, many}) => ({
	eventChatMessage: one(eventChatMessages, {
		fields: [eventChatMessages.replyTo],
		references: [eventChatMessages.id],
		relationName: "eventChatMessages_replyTo_eventChatMessages_id"
	}),
	eventChatMessages: many(eventChatMessages, {
		relationName: "eventChatMessages_replyTo_eventChatMessages_id"
	}),
	usersInAuth: one(usersInAuth, {
		fields: [eventChatMessages.senderId],
		references: [usersInAuth.id]
	}),
	eventChatMessageReactions: many(eventChatMessageReactions),
}));

export const eventChatMessageReactionsRelations = relations(eventChatMessageReactions, ({one}) => ({
	eventChatMessage: one(eventChatMessages, {
		fields: [eventChatMessageReactions.messageId],
		references: [eventChatMessages.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [eventChatMessageReactions.userId],
		references: [usersInAuth.id]
	}),
}));

export const pointTransactionsRelations = relations(pointTransactions, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [pointTransactions.userId],
		references: [usersInAuth.id]
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	chat: one(chats, {
		fields: [messages.chatId],
		references: [chats.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [messages.senderId],
		references: [usersInAuth.id]
	}),
}));

export const withdrawalsRelations = relations(withdrawals, ({one}) => ({
	wallet: one(wallets, {
		fields: [withdrawals.walletId],
		references: [wallets.id]
	}),
}));

export const walletsRelations = relations(wallets, ({one, many}) => ({
	withdrawals: many(withdrawals),
	walletTransactions: many(walletTransactions),
	usersInAuth: one(usersInAuth, {
		fields: [wallets.userId],
		references: [usersInAuth.id]
	}),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({one}) => ({
	wallet: one(wallets, {
		fields: [walletTransactions.walletId],
		references: [wallets.id]
	}),
}));

export const userPresenceRelations = relations(userPresence, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userPresence.userId],
		references: [usersInAuth.id]
	}),
}));

export const payoutEntriesRelations = relations(payoutEntries, ({one}) => ({
	payoutJob: one(payoutJobs, {
		fields: [payoutEntries.jobId],
		references: [payoutJobs.id]
	}),
}));

export const payoutJobsRelations = relations(payoutJobs, ({many}) => ({
	payoutEntries: many(payoutEntries),
}));

export const challengeDisputesRelations = relations(challengeDisputes, ({one}) => ({
	usersInAuth_initiatedBy: one(usersInAuth, {
		fields: [challengeDisputes.initiatedBy],
		references: [usersInAuth.id],
		relationName: "challengeDisputes_initiatedBy_usersInAuth_id"
	}),
	usersInAuth_resolvedBy: one(usersInAuth, {
		fields: [challengeDisputes.resolvedBy],
		references: [usersInAuth.id],
		relationName: "challengeDisputes_resolvedBy_usersInAuth_id"
	}),
}));

export const chatMessagesRelations = relations(chatMessages, ({one}) => ({
	privateChat: one(privateChats, {
		fields: [chatMessages.chatId],
		references: [privateChats.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [chatMessages.senderId],
		references: [usersInAuth.id]
	}),
}));

export const privateChatsRelations = relations(privateChats, ({many}) => ({
	chatMessages: many(chatMessages),
}));

export const creatorEarningsRelations = relations(creatorEarnings, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [creatorEarnings.creatorId],
		references: [usersInAuth.id]
	}),
}));

export const eventEscrowRelations = relations(eventEscrow, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [eventEscrow.userId],
		references: [usersInAuth.id]
	}),
}));

export const supportMessagesRelations = relations(supportMessages, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [supportMessages.userId],
		references: [usersInAuth.id]
	}),
}));