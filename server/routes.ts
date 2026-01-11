import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import Pusher from "pusher";
import { storage } from "./storage";
import { setupAuth, isAdmin } from "./auth";
import { PrivyAuthMiddleware } from "./privyAuth";
import { db } from "./db";
import { insertEventSchema, insertChallengeSchema, insertNotificationSchema } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import {
  users,
  events,
  userAchievements,
  challenges,
  notifications,
  transactions,
  dailyLogins,
  eventParticipants,
  eventMessages,
  challengeMessages,
  messageReactions,
  friends,
  groups,
  groupMembers,
  eventJoinRequests,
  eventPools,
  pairQueue,
  adminWalletTransactions,
} from "../shared/schema";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { createTelegramSync, getTelegramSync } from "./telegramSync";
import { getTelegramBot } from "./telegramBot";
import webpush from "web-push";
import { setupOGImageRoutes } from "./ogImageGenerator";
import { recommendationEngine } from "./recommendationEngine";
import { payoutQueue } from "./payoutQueue";
import { payoutWorker } from "./payoutWorker";
import { 
  generateEventOGMeta, 
  generateChallengeOGMeta, 
  generateReferralOGMeta, 
  generateProfileOGMeta,
  getDefaultOGMeta,
  generateOGMetaTags 
} from "./og-meta";
import ogMetadataRouter from './routes/og-metadata';

// Import notification routes
import notificationsApi from './routes/notificationsApi';
import adminNotificationsApi from './routes/adminNotificationsApi';
import { notificationInfrastructure } from './notificationInfrastructure';

// Import pairing engine for challenge queue matching
import { createPairingEngine } from './pairingEngine';

// Import formatBalance utility for coin operations
function formatBalance(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}
import axios from "axios";
// express-fileupload removed — multer handles file uploads in server/index.ts
import { adminAuth } from "./adminAuth";
import { desc, or, not, isNull, count, sum, avg } from "drizzle-orm";

// Initialize Pusher
const pusher = new Pusher({
  appId: "1553294",
  key: "decd2cca5e39cf0cbcd4",
  secret: "1dd966e56c465ea285d9",
  cluster: "mt1",
  useTLS: true,
});

// Configure Web Push
webpush.setVapidDetails(
  'mailto:support@bantah.com',
  'BKZ0LNy05CTv807lF4dSwM3wB7nxrBHXDP5AYPvbCCPZYWrK08rTYFQO6BmKrW3f0xmIe5wUxtLN67XOSQ7W--o',
  'uNkb_1Ntqe1IKeqDeAlbyOJcXTt8wrvwArWSh7GML0A'
);



// Initialize Telegram sync service
let telegramSync = createTelegramSync(pusher);
if (telegramSync) {
  telegramSync.initialize().catch((error) => {
    // Telegram sync initialization failed silently
  });
}

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    isAdmin?: boolean;
    claims?: {
      sub: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    };
  };
}

// Helper function to safely get user ID from request
function getUserId(req: AuthenticatedRequest): string {
  // Privy stores user ID directly in user.id
  if (req.user?.id) {
    return req.user.id;
  }
  // Fallback for old auth structure
  if (req.user?.claims?.sub) {
    return req.user.claims.sub;
  }
  throw new Error("User ID not found in request");
}

export async function registerRoutes(app: Express, upload?: any): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // File uploads are handled by multer (configured in server/index.ts).
  // Do not register another multipart parser to avoid stream conflicts.

  // Auth middleware
  await setupAuth(app);

  // Telegram webhook for callback buttons (Phase 2)
  app.post('/api/telegram/webhook', async (req, res) => {
    try {
      const update = req.body;
      console.log('📨 Telegram webhook update:', JSON.stringify(update, null, 2));

      // Handle my_chat_member updates (bot or user status changes in chats)
      if (update.my_chat_member) {
        try {
          const myChat = update.my_chat_member;
          // If bot was added to a group
          if (myChat.new_chat_member && myChat.new_chat_member.status === 'member') {
            const telegramBot = getTelegramBot();
            if (telegramBot) {
              // create a synthetic message object for group
              const fakeMessage = { chat: myChat.chat, from: update.my_chat_member.from };
              await telegramBot.handleGroupJoin(fakeMessage);
            }
          }
        } catch (err) {
          console.error('Error handling my_chat_member:', err);
        }
      }

      // Handle chat_member updates (users joining/leaving)
      if (update.chat_member) {
        try {
          const chatMember = update.chat_member;
          const chat = chatMember.chat;
          const newStatus = chatMember.new_chat_member?.status;
          const user = chatMember.from || chatMember.new_chat_member?.user;
          if (chat && user) {
            const telegramBot = getTelegramBot();
            // Find group record
            const groupRecord = await storage.getGroupByTelegramId(String(chat.id)).catch(() => null);
            if (groupRecord) {
              if (newStatus === 'member') {
                // add member
                await storage.addGroupMember(groupRecord.id, `telegram-${user.id}`, String(user.id), user.username || undefined);
              } else if (newStatus === 'left' || newStatus === 'kicked') {
                await storage.removeGroupMember(groupRecord.id, String(user.id));
              }
            }
          }
        } catch (err) {
          console.error('Error handling chat_member:', err);
        }
      }
      // Handle callback queries (inline button clicks)
      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        const telegramUserId = callbackQuery.from.id;

        console.log(`🔘 Callback button clicked: ${data} by user ${telegramUserId}`);

        // Get user by Telegram ID
        const user = await storage.getUserByTelegramId(telegramUserId.toString());

        if (!user) {
          // User not linked yet
          const telegramBot = getTelegramBot();
          if (telegramBot) {
            await telegramBot.sendErrorMessage(chatId, 'general');
          }
          return res.json({ ok: true });
        }

        // Handle inline 'challenge user' action: challenge_user_<telegramId>
        if (data && data.startsWith && data.startsWith('challenge_user_')) {
          const targetTgId = data.replace('challenge_user_', '');
          try {
            const callerTelegramId = callbackQuery.from.id.toString();
            const callerUser = await storage.getUserByTelegramId(callerTelegramId);
            if (!callerUser) {
              await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                callback_query_id: callbackQuery.id,
                text: 'Please link your Telegram account to Bantah first. Open the mini-app via the bot to link.',
                show_alert: true,
              });
              return res.json({ ok: true });
            }

            const targetUser = await storage.getUserByTelegramId(targetTgId);
            if (!targetUser) {
              await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                callback_query_id: callbackQuery.id,
                text: 'That user has not linked Bantah. Ask them to open the mini-app to accept challenges.',
                show_alert: true,
              });
              return res.json({ ok: true });
            }

            const defaultAmount = parseFloat(process.env.DEFAULT_INLINE_CHALLENGE_AMOUNT || '1000');
            const bal = await storage.getUserBalance(callerUser.id);
            if (bal.balance < defaultAmount) {
              await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                callback_query_id: callbackQuery.id,
                text: `Insufficient balance to create a ₦${defaultAmount} challenge.`,
                show_alert: true,
              });
              return res.json({ ok: true });
            }

            const challengeData = {
              challenger: callerUser.id,
              challenged: targetUser.id,
              title: `Inline challenge: ${callerUser.username || callerUser.firstName || 'Player'}`,
              description: `Challenge created from Telegram chat by @${callerUser.username || callerUser.id}`,
              category: 'inline',
              amount: defaultAmount.toString(),
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            };

            const challenge = await storage.createChallenge(challengeData as any);

            // Post confirmation message with accept/decline buttons
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              chat_id: chatId,
              text: `⚔️ *Challenge Created*\n*${challenge.title}*\nWager: ₦${defaultAmount}\nChallenger: @${callerUser.username || callerUser.id}\nChallenged: @${targetUser.username || targetUser.id}`,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ Accept', callback_data: `accept_challenge_${challenge.id}` },
                    { text: '❌ Decline', callback_data: `decline_challenge_${challenge.id}` },
                    { text: '🔍 Open', web_app: { url: `${(process.env.FRONTEND_URL||'http://localhost:5173')}/telegram-mini-app?action=view_challenge&challengeId=${challenge.id}` } }
                  ]
                ]
              }
            });

            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              callback_query_id: callbackQuery.id,
              text: '✅ Challenge created and posted to chat',
            });

            return res.json({ ok: true });
          } catch (err: any) {
            console.error('Error handling challenge_user callback:', err);
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              callback_query_id: callbackQuery.id,
              text: '❌ Failed to create challenge',
              show_alert: true,
            });
            return res.json({ ok: true });
          }
        }

        // Handle accept challenge
        if (data.startsWith('accept_challenge_')) {
          const challengeId = parseInt(data.replace('accept_challenge_', ''));

          try {
            // Check user balance
            const balance = await storage.getUserBalance(user.id);
            const challenge = await storage.getChallengeById(challengeId);

            if (!challenge) {
              throw new Error('Challenge not found');
            }

            const requiredAmount = parseFloat(challenge.amount);

            if (balance.balance < requiredAmount) {
              // Insufficient funds
              const telegramBot = getTelegramBot();
              if (telegramBot) {
                await telegramBot.sendInsufficientFundsNotification(
                  chatId,
                  requiredAmount,
                  balance.balance
                );
              }
                
              // Get full challenge details
              const fullChallenge = await storage.getChallengeById(challengeId);
              const challenger = await storage.getUser(fullChallenge!.challenger);
              const challenged = await storage.getUser(fullChallenge!.challenged);

              // Send confirmation to both users
              if (telegramBot && challenger && challenged) {
                // Notify challenged user (current user)
                await telegramBot.sendChallengeAcceptedConfirmation(chatId, {
                  id: challengeId,
                  title: fullChallenge!.title,
                  challenger: { name: challenger.firstName || challenger.username || 'Challenger' },
                  challenged: { name: challenged.firstName || challenged.username || 'You' },
                  amount: requiredAmount
                });

                // Notify challenger if they have Telegram linked
                if (challenger.telegramId) {
                  await telegramBot.sendChallengeAcceptedConfirmation(
                    parseInt(challenger.telegramId),
                    {
                      id: challengeId,
                      title: fullChallenge!.title,
                      challenger: { name: 'You' },
                      challenged: { name: challenged.firstName || challenged.username || 'Opponent' },
                      amount: requiredAmount
                    }
                  );
                }
              }
            }

            // Answer callback query to remove loading state
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              callback_query_id: callbackQuery.id,
              text: '✅ Processing...'
            });

          } catch (error: any) {
            console.error('Error accepting challenge:', error);
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              callback_query_id: callbackQuery.id,
              text: `❌ Error: ${error.message}`,
              show_alert: true
            });
          }
        }

        // Handle decline challenge
        if (data.startsWith('decline_challenge_')) {
          const challengeId = parseInt(data.replace('decline_challenge_', ''));

          try {
            await storage.updateChallenge(challengeId, { status: 'cancelled' });

            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              callback_query_id: callbackQuery.id,
              text: '❌ Challenge declined'
            });

            // Send declined message
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              chat_id: chatId,
              text: '❌ *Challenge Declined*\n\nYou have declined this challenge.',
              parse_mode: 'Markdown'
            });

          } catch (error: any) {
            console.error('Error declining challenge:', error);
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              callback_query_id: callbackQuery.id,
              text: `❌ Error: ${error.message}`,
              show_alert: true
            });
          }
        }
      }

      // Handle inline queries (group challenges)
      if (update.inline_query) {
        const inlineQuery = update.inline_query;
        const telegramBot = getTelegramBot();
        
        if (telegramBot) {
          await telegramBot.handleInlineQuery(inlineQuery, apiClient);
        }
      }

      // Handle message events (group joins, leave notifications)
      if (update.message) {
        const message = update.message;
        const telegramBot = getTelegramBot();

        // Handle group_chat_created or my_chat_member for group join
        if (message.group_chat_created || message.supergroup_chat_created || (update.my_chat_member && update.my_chat_member.new_chat_member?.status === 'member')) {
          if (telegramBot) {
            await telegramBot.handleGroupJoin(message);
          }
        }
      }

      // Handle chosen inline result (when user selects a challenge)
      if (update.chosen_inline_result) {
        const chosenResult = update.chosen_inline_result;
        const telegramBot = getTelegramBot();

        if (telegramBot) {
          await telegramBot.handleChosenInlineResult(chosenResult, apiClient);
        }
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('❌ Telegram webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const user = await storage.getUser(userId);

      // Check and create daily login record
      await storage.checkDailyLogin(userId);

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile routes
  app.get('/api/profile', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const user = await storage.getUser(userId);

      // Ensure user has a referral code
      if (!user.referralCode) {
        const referralCode = user.username || `user_${userId.slice(-8)}`;
        await db
          .update(users)
          .set({ 
            referralCode: referralCode,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));

        user.referralCode = referralCode;
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.put('/api/profile', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        console.error("User ID not found in request:", req.user);
        return res.status(401).json({ message: "User ID not found" });
      }

      const { firstName, username, bio, profileImageUrl } = req.body;

      // Update user profile
      await storage.updateUserProfile(userId, {
        firstName,
        username,
        bio,
        profileImageUrl
      });

      const updatedUser = await storage.getUser(userId);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      // Handle validation-style errors thrown from storage layer
      if (error && error.status === 400) {
        return res.status(400).json({ message: error.message || 'Bad Request' });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Referral routes
  app.get('/api/referrals', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const referrals = await storage.getReferrals(userId);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  app.post('/api/referrals/apply', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const { referralCode } = req.body;

      if (!referralCode) {
        return res.status(400).json({ message: "Referral code required" });
      }

      const user = await storage.getUser(userId);
      if (user.referredBy) {
        return res.json({ success: true, message: "User already referred" });
      }

      const referrer = await storage.getUserByReferralCode(referralCode);
      if (!referrer || referrer.id === userId) {
        return res.status(400).json({ message: "Invalid referral code" });
      }

      // Update user to mark them as referred
      await db
        .update(users)
        .set({ referredBy: referrer.id })
        .where(eq(users.id, userId));

      // Process rewards (simplified version of the logic in server/auth.ts)
      const bonusPoints = 1500;
      const bonusCoins = 500;
      await storage.updateUserPoints(userId, bonusPoints);
      await storage.updateUserCoins(userId, bonusCoins);

      await storage.createNotification({
        userId: userId,
        type: 'referral_success',
        title: '🎁 Referral Bonus Applied!',
        message: `You earned ${bonusPoints} points and ${bonusCoins} coins from the referral!`,
        data: { points: bonusPoints, coins: bonusCoins },
      });

      // Reward the referrer too
      const referrerBonus = 100;
      const referrerCoinBonus = 250;
      await storage.updateUserPoints(referrer.id, referrerBonus);
      await storage.updateUserCoins(referrer.id, referrerCoinBonus);

      // Create referral record in database for tracking
      await storage.createReferral({
        referrerId: referrer.id,
        referredId: userId,
        code: referralCode,
        status: 'active',
      });

      // Create transaction records for both users
      await storage.createTransaction({
        userId: userId,
        type: 'referral_bonus',
        amount: bonusPoints.toString(),
        description: `Referral signup bonus (Code: ${referralCode})`,
        status: 'completed',
      });

      await storage.createTransaction({
        userId: referrer.id,
        type: 'referral_reward',
        amount: referrerBonus.toString(),
        description: `Referral reward for ${user.username || 'new user'}`,
        status: 'completed',
      });

      await storage.createNotification({
        userId: referrer.id,
        type: 'referral_success',
        title: '🎉 Referral Success!',
        message: `${user.username || 'A new user'} joined using your code! You earned ${referrerBonus} points and ${referrerCoinBonus} coins.`,
        data: { points: referrerBonus, coins: referrerCoinBonus },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error applying referral:", error);
      res.status(500).json({ message: "Failed to apply referral" });
    }
  });

  // Event routes
  app.get('/api/events', async (req, res) => {
    try {
      const events = await storage.getEvents(20);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Groups listing
  app.get('/api/groups', async (_req, res) => {
    try {
      const groupsList = await db.select().from(groups).orderBy(desc(groups.addedAt));
      res.json(groupsList);
    } catch (err) {
      console.error('Error fetching groups:', err);
      res.status(500).json({ message: 'Failed to fetch groups' });
    }
  });

  // Get members for a group
  app.get('/api/groups/:id/members', async (req, res) => {
    try {
      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid group id' });
      const members = await storage.getGroupMembers(groupId);
      res.json(members || []);
    } catch (err) {
      console.error('Error fetching group members:', err);
      res.status(500).json({ message: 'Failed to fetch group members' });
    }
  });

  // Admin: sync group members when bot is admin (pull group admins and add them)
  app.post('/api/admin/groups/:telegramId/sync', adminAuth, async (req, res) => {
    try {
      const telegramId = req.params.telegramId;
      if (!telegramId) return res.status(400).json({ message: 'Missing telegramId' });

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) return res.status(500).json({ message: 'Telegram bot token not configured' });

      const base = `https://api.telegram.org/bot${botToken}`;

      // Ensure our group record exists
      let group = await storage.getGroupByTelegramId(String(telegramId));
      if (!group) {
        group = await storage.addGroup(String(telegramId), undefined, undefined, req.user?.id || 'system');
      }

      // Fetch chat administrators (requires bot to be admin in the chat)
      const adminsResp = await axios.get(`${base}/getChatAdministrators`, { params: { chat_id: telegramId } });
      if (!adminsResp.data || !adminsResp.data.ok) {
        return res.status(500).json({ message: 'Failed to fetch chat administrators', detail: adminsResp.data });
      }

      const added: any[] = [];
      for (const admin of adminsResp.data.result || []) {
        try {
          const user = admin.user;
          if (!user) continue;
          const telegramUserId = String(user.id);
          await storage.addGroupMember(group.id, `telegram-${telegramUserId}`, telegramUserId, user.username || undefined);
          added.push({ id: telegramUserId, username: user.username });
        } catch (err) {
          console.warn('Failed adding admin member', err);
        }
      }

      return res.json({ ok: true, added });
    } catch (err) {
      console.error('Error syncing group members:', err);
      res.status(500).json({ message: 'Failed to sync group members' });
    }
  });

  // Test endpoints to simulate Telegram updates for QA
  app.post('/api/test/telegram/inline_query', adminAuth, async (req, res) => {
    try {
      const inlineQuery = req.body.inline_query;
      if (!inlineQuery) return res.status(400).json({ message: 'Missing inline_query in body' });
      const telegramBot = getTelegramBot();
      if (!telegramBot) return res.status(500).json({ message: 'Telegram bot not initialized' });
      // Pass axios as apiClient
      await telegramBot.handleInlineQuery(inlineQuery, axios);
      res.json({ ok: true });
    } catch (err) {
      console.error('Error in test inline_query:', err);
      res.status(500).json({ message: 'Failed to simulate inline_query' });
    }
  });

  app.post('/api/test/telegram/callback', adminAuth, async (req, res) => {
    try {
      const callbackQuery = req.body.callback_query;
      if (!callbackQuery) return res.status(400).json({ message: 'Missing callback_query in body' });

      // Reuse the same logic as webhook for callback_query handling
      const chatId = callbackQuery.message?.chat?.id;
      const data = callbackQuery.data;
      const telegramUserId = callbackQuery.from?.id;

      const user = await storage.getUserByTelegramId(String(telegramUserId));
      if (!user) return res.status(400).json({ message: 'Telegram user not linked to a Bantah user' });

      // Basic challenge_user_ flow for QA
      if (data && data.startsWith && data.startsWith('challenge_user_')) {
        const targetTgId = data.replace('challenge_user_', '');
        const callerUser = user;
        const targetUser = await storage.getUserByTelegramId(targetTgId);
        if (!targetUser) return res.status(400).json({ message: 'Target user not linked' });

        const defaultAmount = parseFloat(process.env.DEFAULT_INLINE_CHALLENGE_AMOUNT || '1000');
        const challengeData = {
          challenger: callerUser.id,
          challenged: targetUser.id,
          title: `Inline challenge: ${callerUser.username || callerUser.firstName || 'Player'}`,
          description: `Challenge created from Telegram chat by @${callerUser.username || callerUser.id}`,
          category: 'inline',
          amount: defaultAmount.toString(),
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };

        const challenge = await storage.createChallenge(challengeData as any);

        // For QA, return the challenge object instead of calling Telegram
        return res.json({ ok: true, challenge });
      }

      res.json({ ok: true, note: 'callback processed (no action taken)' });
    } catch (err) {
      console.error('Error in test callback:', err);
      res.status(500).json({ message: 'Failed to simulate callback_query' });
    }
  });

  // Admin: set webhook and allowed_updates for Bot (deploy webhook)
  app.post('/api/admin/telegram/set-webhook', adminAuth, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ message: 'Missing url in body' });
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) return res.status(500).json({ message: 'Telegram bot token not configured' });
      const base = `https://api.telegram.org/bot${botToken}`;

      const allowed_updates = [
        'message',
        'inline_query',
        'chosen_inline_result',
        'callback_query',
        'my_chat_member',
        'chat_member'
      ];

      const resp = await axios.post(`${base}/setWebhook`, { url, allowed_updates });
      if (!resp.data || !resp.data.ok) {
        return res.status(500).json({ message: 'Failed to set webhook', detail: resp.data });
      }

      return res.json({ ok: true, result: resp.data.result });
    } catch (err) {
      console.error('Error setting webhook:', err);
      res.status(500).json({ message: 'Failed to set webhook' });
    }
  });

  // Social Event Recommendation Engine Endpoints
  app.get('/api/recommendations/events', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const recommendations = await recommendationEngine.getRecommendedEvents(userId, limit);
      res.json(recommendations);
    } catch (error) {
      console.error("Error getting event recommendations:", error);
      res.status(500).json({ message: "Failed to get recommendations" });
    }
  });

  app.get('/api/recommendations/trending', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const trending = await recommendationEngine.getTrendingEvents(limit);
      res.json(trending);
    } catch (error) {
      console.error("Error getting trending events:", error);
      res.status(500).json({ message: "Failed to get trending events" });
    }
  });

  app.get('/api/recommendations/similar/:eventId', async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const limit = parseInt(req.query.limit as string) || 5;
      const similar = await recommendationEngine.getSimilarEvents(eventId, limit);
      res.json(similar);
    } catch (error) {
      console.error("Error getting similar events:", error);
      res.status(500).json({ message: "Failed to get similar events" });
    }
  });

  app.get('/api/recommendations/preferences', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.id;
      const preferences = await recommendationEngine.calculateUserPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error getting user preferences:", error);
      res.status(500).json({ message: "Failed to get user preferences" });
    }
  });

  app.get('/api/events/:id', async (req, res) => {
    try {
      const event = await storage.getEventById(parseInt(req.params.id));
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post('/api/events', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      console.log("Creating event with data:", req.body);
      console.log("User ID:", userId);

      // Validate required fields
      if (!req.body.title || !req.body.category || !req.body.entryFee || !req.body.endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Convert entryFee to proper integer format (coins)
      const entryFee = parseInt(req.body.entryFee);
      if (isNaN(entryFee) || entryFee <= 0) {
        return res.status(400).json({ message: "Invalid entry fee" });
      }

      // Validate end date
      const endDate = new Date(req.body.endDate);
      if (endDate <= new Date()) {
        return res.status(400).json({ message: "End date must be in the future" });
      }

      const eventData = {
        title: req.body.title,
        description: req.body.description || null,
        category: req.body.category,
        entryFee: entryFee,
        endDate: endDate,
        creatorId: userId,
        status: 'active',
        isPrivate: req.body.isPrivate || false,
        maxParticipants: req.body.maxParticipants || 100,
        imageUrl: req.body.bannerUrl || null,
      };

      console.log("Parsed event data:", eventData);

      const event = await storage.createEvent(eventData);
      console.log("Created event:", event);

      // Get creator info for Telegram broadcast
      const creator = await storage.getUser(userId);

      // Broadcast to Telegram channel
      const telegramBot = getTelegramBot();
      if (telegramBot && creator) {
        try {
          await telegramBot.broadcastEvent({
            id: event.id,
            title: event.title,
            description: event.description || undefined,
            creator: {
              name: creator.firstName || creator.username || 'Unknown',
              username: creator.username || undefined,
            },
            entryFee: event.entryFee,
            endDate: event.endDate,
            is_private: event.isPrivate,
            max_participants: event.maxParticipants,
            category: event.category,
          });
          console.log("📤 Event broadcasted to Telegram successfully");
        } catch (error) {
          console.error("❌ Failed to broadcast event to Telegram:", error);
        }
      }

      res.json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      if (error instanceof Error) {
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create event" });
      }
    }
  });

  // Edit event endpoint
  app.put('/api/events/:id', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user?.id || req.user?.claims?.sub;

      // Check if event exists and user is the creator
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (event.creatorId !== userId) {
        return res.status(403).json({ message: "Only the event creator can edit this event" });
      }

      // Check if event can still be edited (hasn't started yet)
      const now = new Date();
      const endDate = new Date(event.endDate);
      if (now >= endDate) {
        return res.status(400).json({ message: "Cannot edit event that has already ended" });
      }

      // Validate required fields
      if (!req.body.title || !req.body.category || !req.body.entryFee || !req.body.endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Convert entryFee to proper integer format
      const entryFee = parseInt(req.body.entryFee);
      if (isNaN(entryFee) || entryFee <= 0) {
        return res.status(400).json({ message: "Invalid entry fee" });
      }

      // Validate end date
      const newEndDate = new Date(req.body.endDate);
      if (newEndDate <= new Date()) {
        return res.status(400).json({ message: "End date must be in the future" });
      }

      const updates = {
        title: req.body.title,
        description: req.body.description || null,
        category: req.body.category,
        entryFee: entryFee,
        endDate: newEndDate,
      };

      const updatedEvent = await storage.updateEvent(eventId, updates);
      res.json(updatedEvent);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.post('/api/events/:id/leave', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      // Check if user has joined the event
      const participant = await db
        .select()
        .from(eventParticipants)
        .where(and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.userId, userId)
        ))
        .limit(1);

      if (participant.length === 0) {
        return res.status(400).json({ message: "You haven't joined this event" });
      }

      // Check if user has bet (prevent leaving if they have bet)
      if (participant[0].prediction !== null) {
        return res.status(400).json({ message: "Cannot leave event after placing a bet" });
      }

      // Remove participant
      await db
        .delete(eventParticipants)
        .where(and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.userId, userId)
        ));

      res.json({ message: "Successfully left the event" });
    } catch (error) {
      console.error("Error leaving event:", error);
      res.status(500).json({ message: "Failed to leave event" });
    }
  });

  app.post('/api/events/:id/join', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      const eventId = parseInt(req.params.id);
      const { prediction } = req.body;

      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Always use the event's entry fee (fixed model) - now in coins
      const amount = parseInt(event.entryFee.toString());

      // Check user coin balance
      const balance = await storage.getUserBalance(userId);
      const userCoins = balance.coins || 0;
      if (userCoins < amount) {
        return res.status(400).json({ message: "Insufficient coins" });
      }

      // Check if event is private
      if (event.isPrivate) {
        // Create join request for private events
        const joinRequest = await storage.requestEventJoin(eventId, userId, prediction, amount);

        // Create notification for event creator
        await storage.createNotification({
          userId: event.creatorId,
          type: 'event_join_request',
          title: 'New Event Join Request',
          message: `${req.user.claims.first_name || 'Someone'} wants to join your private event: ${event.title}`,
          data: { eventId: eventId, requestId: joinRequest.id },
        });

        // Create notification for user about pending request
        await storage.createNotification({
          userId,
          type: 'event_join_pending',
          title: '⏳ Join Request Submitted',
          message: `Your request to join "${event.title}" is pending approval. Funds will be locked once approved.`,
          data: { 
            eventId: eventId, 
            amount: amount,
            prediction: prediction ? 'YES' : 'NO',
            eventTitle: event.title
          },
        });

        return res.json({ message: "Join request sent to event creator", request: joinRequest });
      }

      const participant = await storage.joinEvent(eventId, userId, prediction, amount);

      // Create transaction record for coin escrow
      await storage.createTransaction({
        userId,
        type: 'event_escrow',
        amount: `-${amount}`,
        description: `${amount.toLocaleString()} coins locked in escrow for event: ${event.title}`,
        relatedId: eventId,
        status: 'completed',
      });

      // Deduct coins from user
      await db
        .update(users)
        .set({ 
          coins: sql`${users.coins} - ${amount}`,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // Create comprehensive notifications
      await storage.createNotification({
        userId,
        type: 'coins_locked',
        title: '🔒 Coins Locked in Escrow',
        message: `${amount.toLocaleString()} coins locked for your ${prediction ? 'YES' : 'NO'} prediction on "${event.title}". Coins will be released when the event ends.`,
        data: { 
          eventId: eventId,
          amount: amount,
          prediction: prediction ? 'YES' : 'NO',
          eventTitle: event.title,
          eventEndDate: event.endDate,
          type: 'escrow_lock'
        },
      });

      // Notify event creator about new participant
      await storage.createNotification({
        userId: event.creatorId,
        type: 'event_participant_joined',
        title: '🎯 New Event Participant',
        message: `${req.user.claims.first_name || 'Someone'} joined your event "${event.title}" with a ${prediction ? 'YES' : 'NO'} prediction (${amount.toLocaleString()} coins)!`,
        data: { 
          eventId: eventId,
          participantId: userId,
          amount: amount,
          prediction: prediction ? 'YES' : 'NO',
          eventTitle: event.title
        },
      });

      // Send real-time notifications via Pusher
      await pusher.trigger(`user-${userId}`, 'coins-locked', {
        title: '🔒 Coins Locked in Escrow',
        message: `${amount.toLocaleString()} coins locked for your ${prediction ? 'YES' : 'NO'} prediction on "${event.title}"`,
        eventId: eventId,
        type: 'coins_locked',
      });

      await pusher.trigger(`user-${event.creatorId}`, 'participant-joined', {
        title: '🎯 New Event Participant',
        message: `${req.user.claims.first_name || 'Someone'} joined your event "${event.title}"`,
        eventId: eventId,
        type: 'participant_joined',
      });

      res.json(participant);
    } catch (error) {
      console.error("Error joining event:", error);
      res.status(500).json({ message: "Failed to join event" });
    }
  });

  app.get('/api/events/:id/messages', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      // Check if event exists and get event details
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // If event is private, check access permissions
      if (event.isPrivate) {
        // Allow access if user is the creator
        if (event.creatorId !== userId) {
          // Check if user is a participant (approved to join)
          const participants = await storage.getEventParticipantsWithUsers(eventId);
          const userParticipant = participants.find((p: any) => p.userId === userId);

          if (!userParticipant) {
            return res.status(403).json({ message: "Access denied. This is a private event and you haven't been approved to join." });
          }
        }
      }

      const messages = await storage.getEventMessages(eventId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching event messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/events/:id/messages', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = parseInt(req.params.id);
      const { message, replyToId, mentions } = req.body;

      // Check if event exists and get event details
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // If event is private, check access permissions
      if (event.isPrivate) {
        // Allow access if user is the creator
        if (event.creatorId !== userId) {
          // Check if user is a participant (approved to join)
          const participants = await storage.getEventParticipantsWithUsers(eventId);
          const userParticipant = participants.find((p: any) => p.userId === userId);

          if (!userParticipant) {
            return res.status(403).json({ message: "Access denied. You cannot post messages in this private event." });
          }
        }
      }

      const newMessage = await storage.createEventMessage(eventId, userId, message, replyToId, mentions);

      // Broadcast new message via Pusher
      await pusher.trigger(`event-${eventId}`, 'new-message', {
        message: newMessage,
        eventId: eventId,
        userId: userId,
      });

      // Forward to Telegram if sync is available
      const telegramSync = getTelegramSync();
      if (telegramSync && telegramSync.isReady()) {
        try {
          const user = await storage.getUser(userId);
          const event = await storage.getEventById(eventId);
          const senderName = user?.firstName || user?.username || 'BetChat User';

          await telegramSync.sendMessageToTelegram(
            message, 
            senderName, 
            { id: eventId, title: event?.title || `Event ${eventId}` }
          );
        } catch (telegramError) {
          console.error('Error forwarding message to Telegram:', telegramError);
        }
      } else {
        // Fallback to Telegram bot if sync is not available
        const telegramBot = getTelegramBot();
        if (telegramBot) {
          try {
            const user = await storage.getUser(userId);
            const event = await storage.getEventById(eventId);
            const senderName = user?.firstName || user?.username || 'BetChat User';

            const formattedMessage = `🎯 ${event?.title || 'Event Chat'}\n👤 ${senderName}: ${message}`;

            await telegramBot.sendCustomMessage(formattedMessage);
            console.log(`📤 BetChat → Telegram Bot: ${senderName}: ${message} [Event: ${event?.title || 'Event Chat'}]`);
          } catch (telegramError) {
            console.error('Error sending message via Telegram bot:', telegramError);
          }
        }
      }

      // Create notifications for mentioned users
      if (mentions && mentions.length > 0) {
        for (const mentionedUsername of mentions) {
          const mentionedUser = await storage.getUserByUsername(mentionedUsername);
          if (mentionedUser && mentionedUser.id !== userId) {
            const notification = await storage.createNotification({
              userId: mentionedUser.id,
              type: 'mention',
              title: 'You were mentioned',
              message: `${req.user.claims.first_name || 'Someone'} mentioned you in an event chat`,
              data: { 
                eventId: eventId, 
                messageId: newMessage.id,
                mentionedBy: userId,
                eventTitle: 'Event Chat'
              },
            });

            // Send notification via Pusher
            await pusher.trigger(`user-${mentionedUser.id}`, 'event-notification', {
              title: 'You were mentioned',
              message: `${req.user.claims.first_name || 'Someone'} mentioned you in an event chat`,
              eventId: eventId,
              type: 'mention',
            });
          }
        }
      }

      // Create notification for replied user
      if (replyToId) {
        const repliedMessage = await storage.getEventMessageById(replyToId);
        if (repliedMessage && repliedMessage.userId !== userId) {
          const notification = await storage.createNotification({
            userId: repliedMessage.userId,
            type: 'reply',
            title: 'Someone replied to your message',
            message: `${req.user.claims.first_name || 'Someone'} replied to your message`,
            data: { 
              eventId: eventId, 
              messageId: newMessage.id,
              repliedBy: userId,
              originalMessageId: replyToId
            },
          });

          // Send notification via Pusher
          await pusher.trigger(`user-${repliedMessage.userId}`, 'event-notification', {
            title: 'Someone replied to your message',
            message: `${req.user.claims.first_name || 'Someone'} replied to your message`,
            eventId: eventId,
            type: 'reply',
          });
        }
      }

      res.json(newMessage);
    } catch (error) {
      console.error("Error creating event message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.post('/api/events/:id/messages/:messageId/react', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = parseInt(req.params.id);
      const messageId = req.params.messageId;
      const { emoji } = req.body;

      const reaction = await storage.toggleMessageReaction(messageId, userId, emoji);

      // Get updated reaction summary for the message
      const message = await storage.getEventMessageById(messageId);
      const updatedReactions = await storage.getMessageReactions(messageId);

      // Broadcast reaction update via Pusher with complete reaction data
      await pusher.trigger(`event-${eventId}`, 'reaction-update', {
        messageId: messageId,
        reactions: updatedReactions,
        userId: userId,
        action: reaction.action,
        emoji: emoji,
        timestamp: new Date().toISOString(),
      });

      res.json({ 
        ...reaction, 
        messageId: messageId,
        reactions: updatedReactions,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error reacting to message:", error);
      res.status(500).json({ message: "Failed to react to message" });
    }
  });

  app.get('/api/events/:id/participants', async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const participants = await storage.getEventParticipantsWithUsers(eventId);
      res.json(participants);
    } catch (error) {
      console.error("Error fetching event participants:", error);
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  // Event Pool Management Routes
  app.get('/api/events/:id/stats', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const stats = await storage.getEventPoolStats(eventId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching event stats:", error);
      res.status(500).json({ message: "Failed to fetch event stats" });
    }
  });

  // Admin login endpoint (no auth required)
  app.post('/api/admin/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      // Check if user is admin
      if (!user.isAdmin) {
        return res.status(403).json({ message: 'Admin access denied' });
      }

      // Verify password
      const { comparePasswords } = await import('./auth');
      const isValidPassword = await comparePasswords(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      // Generate admin token
      const adminToken = `admin_${user.id}_${Date.now()}`;

      res.json({
        token: adminToken,
        user: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isAdmin: user.isAdmin
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin routes with authentication
  app.use('/api/admin', adminAuth);

  app.get('/api/admin/stats', adminAuth, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Admin Route: Set event result and trigger payout
  app.post('/api/admin/events/:id/result', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const userId = req.adminUser.id;
      const eventId = parseInt(req.params.id);
      const { result } = req.body; // true for YES, false for NO

      // Log admin action for audit trail
      console.log(`Admin ${userId} setting result for event ${eventId}: ${result ? 'YES' : 'NO'}`);

      // Validate event exists and is ready for payout
      const existingEvent = await storage.getEventById(eventId);
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (existingEvent.adminResult !== null) {
        return res.status(400).json({ message: "Event result already set" });
      }

      const event = await storage.adminSetEventResult(eventId, result);
      const payoutResult = await storage.processEventPayout(eventId);

      // Log payout for audit trail```text
  console.log(`Event ${eventId} payout processed:`, {
        winnersCount: payoutResult.winnersCount,
        totalPayout: payoutResult.totalPayout,
        creatorFee: payoutResult.creatorFee,
        processedBy: userId,
        timestamp: new Date().toISOString()
      });

      // Send real-time notification to participants
      await pusher.trigger(`event-${eventId}`, 'event-resolved', {
        eventId,
        result: result ? 'YES' : 'NO',
        winnersCount: payoutResult.winnersCount,
        totalPayout: payoutResult.totalPayout,
        timestamp: new Date().toISOString()
      });

      res.json({ 
        event, 
        payout: payoutResult,
        message: `Event result set to ${result ? 'YES' : 'NO'}. Payout processed: ${payoutResult.winnersCount} winners received ₦${payoutResult.totalPayout.toLocaleString()} total, ₦${payoutResult.creatorFee.toLocaleString()} creator fee.`
      });
    } catch (error) {
      console.error("Error setting event result:", error);
      res.status(500).json({ message: error.message || "Failed to set event result" });
    }
  });

  // Private Event Management Routes
  app.get('/api/events/:id/join-requests', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = parseInt(req.params.id);

      // Check if user is the event creator
      const event = await storage.getEventById(eventId);
      if (!event || event.creatorId !== userId) {
        return res.status(403).json({ message: "Only event creator can view join requests" });
      }

      const requests = await storage.getEventJoinRequests(eventId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching join requests:", error);
      res.status(500).json({ message: "Failed to fetch join requests" });
    }
  });

  app.post('/api/events/join-requests/:id/approve', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const requestId = parseInt(req.params.id);

      // TODO: Add validation that user is the event creator

      const participant = await storage.approveEventJoinRequest(requestId);

      // Create notification for requester
      await storage.createNotification({
        userId: participant.userId,
        type: 'event_join_approved',
        title: 'Event Join Request Approved',
        message: `Your request to join the event has been approved!`,
        data: { eventId: participant.eventId },
      });

      res.json(participant);
    } catch (error) {
      console.error("Error approving join request:", error);
      res.status(500).json({ message: "Failed to approve join request" });
    }
  });

  app.post('/api/events/join-requests/:id/reject', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const requestId = parseInt(req.params.id);

      // TODO: Add validation that user is the event creator

      const rejectedRequest = await storage.rejectEventJoinRequest(requestId);

      // Create notification for requester
      await storage.createNotification({
        userId: rejectedRequest.userId,
        type: 'event_join_rejected',
        title: 'Event Join Request Rejected',
        message: `Your request to join the event has been rejected.`,
        data: { eventId: rejectedRequest.eventId },
      });

      res.json(rejectedRequest);
    } catch (error) {
      console.error("Error rejecting join request:", error);
      res.status(500).json({ message: "Failed to reject join request" });
    }
  });

  // Challenge routes
  app.get('/api/challenges/public', async (req, res) => {
    try {
      console.log("📥 Fetching public admin challenges...");
      const challenges = await storage.getPublicAdminChallenges();
      console.log(`✅ Retrieved ${challenges.length} public challenges`);
      res.json(challenges);
    } catch (error: any) {
      console.error("❌ Error fetching public challenges:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack?.substring(0, 200)
      });
      res.status(500).json({ 
        message: "Failed to fetch public challenges",
        error: error?.message 
      });
    }
  });

  app.get('/api/challenges/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid challenge ID" });
      }
      const challenge = await storage.getChallengeById(id);
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }
      res.json(challenge);
    } catch (error) {
      console.error("Error fetching challenge:", error);
      res.status(500).json({ message: "Failed to fetch challenge" });
    }
  });

  app.post('/api/track-share', async (req, res) => {
    try {
      // Basic implementation to satisfy the frontend request
      // You can expand this to log to a database if needed
      console.log('Share tracked:', req.body);
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking share:', error);
      res.status(500).json({ message: 'Failed to track share' });
    }
  });

  app.get('/api/challenges', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      // Check if requesting all challenges (public feed) or user-specific challenges
      const feedType = req.query.feed as string;
      const challenges = feedType === 'all' 
        ? await storage.getAllChallengesFeed(100)
        : await storage.getChallenges(userId);
      res.json(challenges);
    } catch (error) {
      console.error("Error fetching challenges:", error);
      res.status(500).json({ message: "Failed to fetch challenges" });
    }
  });

  app.get('/api/challenges/:id/activity', async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      
      // 1. Get Challenge completion/result activity
      const challenge = await storage.getChallengeById(challengeId);
      
      // 2. Get Transactions related to this challenge (Payouts)
      const challengeTransactions = await db.select().from(transactions).where(and(eq(transactions.relatedId, challengeId), eq(transactions.type, 'challenge')));
      
      // 3. Get Matches (joins) - wrapped in try-catch due to potential type mismatches
      let queueEntries: any[] = [];
      try {
        queueEntries = await db.select({
          entry: pairQueue,
          user: users
        }).from(pairQueue).leftJoin(users, eq(pairQueue.userId, users.id)).where(eq(pairQueue.challengeId, challengeId));
      } catch (err) {
        // Continue without queue entries if there's a type mismatch
      }

      const activity: any[] = [];

      if (!challenge) {
        return res.json([]);
      }

      // Add challenge creation event (first activity)
      if (challenge.challenger) {
        const creator = await storage.getUser(challenge.challenger);
        activity.push({
          id: `created-${challengeId}`,
          user: creator,
          action: `created challenge "${challenge.title}"`,
          createdAt: challenge.createdAt
        });
      } else {
        // For old challenges without a challenger, just show creation
        activity.push({
          id: `created-${challengeId}`,
          user: null,
          action: `challenge "${challenge.title}" created`,
          createdAt: challenge.createdAt
        });
      }

      // Add bonus event if bonus is active
      if (challenge.bonusSide && challenge.bonusMultiplier && parseFloat(challenge.bonusMultiplier.toString()) > 1) {
        const bonusType = challenge.bonusAmount > 0 ? `₦${challenge.bonusAmount}` : `${challenge.bonusMultiplier}x`;
        activity.push({
          id: `bonus-${challengeId}`,
          user: challenge.challenger ? await storage.getUser(challenge.challenger) : null,
          action: `added ${bonusType} bonus on the ${challenge.bonusSide} side`,
          createdAt: challenge.bonusEndsAt ? new Date(new Date(challenge.bonusEndsAt).getTime() - 86400000) : challenge.createdAt
        });
      }

      // Add awaiting participants event
      const participantCount = queueEntries.length;
      if (participantCount === 0) {
        activity.push({
          id: `awaiting-${challengeId}`,
          user: null,
          action: `awaiting participants`,
          createdAt: challenge.createdAt
        });
      }

      if (challenge.status === 'completed' && challenge.result) {
        const winnerId = challenge.result === 'challenger_won' ? challenge.challenger : challenge.challenged;
        const winner = await storage.getUser(winnerId!);
        const loserId = challenge.result === 'challenger_won' ? challenge.challenged : challenge.challenger;
        const loser = await storage.getUser(loserId!);
        activity.push({
          id: `result-${challengeId}`,
          user: winner,
          action: `defeated ${loser?.username || 'Opponent'} — Winner: ${winner?.username || 'Winner'}`,
          createdAt: challenge.completedAt || new Date()
        });
      }

      for (const tx of challengeTransactions) {
        const user = await storage.getUser(tx.userId);
        activity.push({
          id: `tx-${tx.id}`,
          user,
          action: `Payout of ${tx.amount} coins made to ${user?.username || 'User'}`,
          createdAt: tx.createdAt
        });
      }

      for (const q of queueEntries) {
        if (q.user) {
          activity.push({
            id: `join-${q.entry.id}`,
            user: q.user,
            action: `joined on the ${q.entry.side} side`,
            createdAt: q.entry.createdAt
          });
        }
        if (q.entry.status === 'matched' && q.entry.matchedWith) {
          const opponent = await storage.getUser(q.entry.matchedWith);
          if (q.user) {
            activity.push({
              id: `match-${q.entry.id}`,
              user: q.user,
              action: `matched with ${opponent?.username || 'opponent'}`,
              createdAt: q.entry.matchedAt || q.entry.createdAt
            });
          }
        }
      }

      res.json(activity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.json([]);
    }
  });

  app.get('/api/challenges/:id/matches', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const matches = await db.select({
        entry: pairQueue,
        user: users,
        matchedWithUser: sql<any>`(SELECT row_to_json(u) FROM users u WHERE u.id = ${pairQueue.matchedWith})`
      }).from(pairQueue)
      .leftJoin(users, eq(pairQueue.userId, users.id))
      .where(eq(pairQueue.challengeId, challengeId));
      
      res.json(matches.map(m => ({
        ...m.entry,
        user: m.user,
        matchedWithUser: m.matchedWithUser
      })));
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.json([]);
    }
  });

  app.post('/api/challenges', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;

      // Prepare data for validation
      const dataToValidate = {
        ...req.body,
        challenger: userId,
        amount: parseInt(req.body.amount), // Ensure it's an integer for coins
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined // Convert string to Date
      };

      console.log('Challenge data to validate:', dataToValidate);

      const challengeData = insertChallengeSchema.parse(dataToValidate);
      // Use standard P2P creation (sets adminCreated to false by default)
      const challenge = await storage.createChallenge({
        ...challengeData,
        adminCreated: false
      } as any);

      // Get challenger and challenged user info
      const challenger = await storage.getUser(userId);
      const challenged = await storage.getUser(challenge.challenged);

      // Create notification for challenged user
      const challengedNotification = await storage.createNotification({
        userId: challenge.challenged,
        type: 'challenge',
        title: '🎯 New Challenge Request',
        message: `${challenger?.firstName || challenger?.username || 'Someone'} challenged you to "${challenge.title}"`,
        data: { 
          challengeId: challenge.id,
          challengerName: challenger?.firstName || challenger?.username,
          challengeTitle: challenge.title,
          amount: challenge.amount,
          type: challenge.type
        },
      });

      // Create notification for challenger (confirmation)
      const challengerNotification = await storage.createNotification({
        userId: userId,
        type: 'challenge_sent',
        title: '🚀 Challenge Sent',
        message: `Your challenge "${challenge.title}" was sent to ${challenged?.firstName || challenged?.username}`,
        data: { 
          challengeId: challenge.id,
          challengedName: challenged?.firstName || challenged?.username,
          challengeTitle: challenge.title,
          amount: challenge.amount,
          type: challenge.type
        },
      });

      // Send instant real-time notifications via Pusher
      try {
        await pusher.trigger(`user-${challenge.challenged}`, 'challenge-received', {
          id: challengedNotification.id,
          type: 'challenge_received',
          title: '🎯 Challenge Received!',
          message: `${challenger?.firstName || challenger?.username || 'Someone'} challenged you to "${challenge.title}"`,
          challengerName: challenger?.firstName || challenger?.username || 'Someone',
          challengeTitle: challenge.title,
          amount: parseFloat(challenge.amount),
          challengeId: challenge.id,
          data: challengedNotification.data,
          timestamp: new Date().toISOString(),
        });

        await pusher.trigger(`user-${userId}`, 'challenge-sent', {
          id: challengerNotification.id,
          type: 'challenge_sent',
          title: '🚀 Challenge Sent',
          message: `Your challenge "${challenge.title}" was sent to ${challenged?.firstName || challenged?.username}`,
          data: challengerNotification.data,
          timestamp: new Date().toISOString(),
        });
      } catch (pusherError) {
        console.error("Error sending Pusher notifications:", pusherError);
      }

      // Broadcast to Telegram channel
      const telegramBot = getTelegramBot();
      if (telegramBot && challenger && challenged) {
        try {
          await telegramBot.broadcastChallenge({
            id: challenge.id,
            title: challenge.title,
            description: challenge.description || undefined,
            creator: {
              name: challenger.firstName || challenger.username || 'Unknown',
              username: challenger.username || undefined,
            },
            challenged: {
              name: challenged.firstName || challenged.username || 'Unknown',
              username: challenged.username || undefined,
            },
            stake_amount: parseFloat(challenge.amount),
            status: challenge.status,
            end_time: challenge.dueDate,
            category: challenge.type,
          });
          console.log("📤 Challenge broadcasted to Telegram successfully");

          // Phase 2: Send accept card to challenged user if they have Telegram linked
          if (challenged.telegramId) {
            console.log(`📤 Sending challenge accept card to Telegram user ${challenged.telegramId}`);
            await telegramBot.sendChallengeAcceptCard(
              parseInt(challenged.telegramId),
              {
                id: challenge.id,
                title: challenge.title,
                description: challenge.description || undefined,
                challenger: {
                  name: challenger.firstName || challenger.username || 'Unknown',
                  username: challenger.username || undefined,
                },
                challenged: {
                  name: challenged.firstName || challenged.username || 'You',
                  username: challenged.username || undefined,
                },
                amount: parseFloat(challenge.amount),
                category: challenge.type,
              }
            );
            console.log("📤 Challenge accept card sent to Telegram user");
          }
        } catch (error) {
          console.error("❌ Failed to broadcast challenge to Telegram:", error);
        }
      }

      res.json(challenge);
    } catch (error) {
      console.error("Error creating challenge:", error);
      res.status(500).json({ message: "Failed to create challenge" });
    }
  });

  // Edit challenge endpoint
  app.put('/api/challenges/:id', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const userId = req.user?.id || req.user?.claims?.sub;

      // Check if challenge exists and user is the challenger
      const challenge = await storage.getChallengeById(challengeId);
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      if (challenge.challenger !== userId) {
        return res.status(403).json({ message: "Only the challenger can edit this challenge" });
      }

      // Check if challenge can still be edited (not yet accepted or started)
      if (challenge.status !== 'pending') {
        return res.status(400).json({ message: "Cannot edit challenge that has been accepted or completed" });
      }

      // Validate required fields
      if (!req.body.title || !req.body.amount) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Convert amount to proper integer format
      const amount = parseInt(req.body.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const updates = {
        title: req.body.title,
        description: req.body.description || null,
        amount: amount,
      };

      const updatedChallenge = await storage.updateChallenge(challengeId, updates);
      res.json(updatedChallenge);
    } catch (error) {
      console.error("Error updating challenge:", error);
      res.status(500).json({ message: "Failed to update challenge" });
    }
  });

  app.post('/api/challenges/:id/accept', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      // Check user has enough coins before accepting
      const balance = await storage.getUserBalance(userId);
      const challengeData = await storage.getChallengeById(challengeId);
      const requiredCoins = parseInt(challengeData.amount.toString());

      if ((balance.coins || 0) < requiredCoins) {
        return res.status(400).json({ message: "Insufficient coins to accept this challenge" });
      }

      const challenge = await storage.acceptChallenge(challengeId, userId);

      // Get user info for notifications
      const challenger = await storage.getUser(challenge.challenger);
      const challenged = await storage.getUser(challenge.challenged);

      // Create notifications for both users
      await storage.createNotification({
        userId: challenge.challenger,
        type: 'challenge_accepted',
        title: '🎯 Challenge Accepted!',
        message: `${challenged?.firstName || challenged?.username} accepted your challenge "${challenge.title}"! The challenge is now active.`,
        data: { 
          challengeId: challengeId,
          challengeTitle: challenge.title,
          amount: parseFloat(challenge.amount),
          acceptedBy: challenged?.firstName || challenged?.username
        },
      });

      await storage.createNotification({
        userId: challenge.challenged,
        type: 'challenge_active',
        title: '🔒 Challenge Active',
        message: `Your stake of ₦${parseFloat(challenge.amount).toLocaleString()} has been escrowed for challenge "${challenge.title}". Good luck!`,
        data: { 
          challengeId: challengeId,
          challengeTitle: challenge.title,
          amount: parseFloat(challenge.amount)
        },
      });

      // Send real-time notifications via Pusher
      try {
        await pusher.trigger(`user-${challenge.challenger}`, 'challenge-accepted', {
          id: Date.now(),
          type: 'challenge_accepted',
          title: '🎯 Challenge Accepted!',
          message: `${challenged?.firstName || challenged?.username} accepted your challenge "${challenge.title}"!`,
          data: { challengeId: challengeId },
          timestamp: new Date().toISOString(),
        });

        await pusher.trigger(`user-${challenge.challenged}`, 'challenge-active', {
          id: Date.now(),
          type: 'challenge_active',
          title: '🔒 Challenge Active',
          message: `Challenge "${challenge.title}" is now active! Your funds are secured in escrow.`,
          data: { challengeId: challengeId },
          timestamp: new Date().toISOString(),
        });
      } catch (pusherError) {
        console.error("Error sending Pusher notifications:", pusherError);
      }

      // Broadcast matchmaking (challenge accepted) to Telegram
      try {
        const telegramBot = getTelegramBot();
        if (telegramBot) {
          await telegramBot.broadcastMatchmaking({
            challengeId: challenge.id,
            challenger: {
              name: challenger?.firstName || challenger?.username || 'Unknown',
              username: challenger?.username || undefined,
            },
            challenged: {
              name: challenged?.firstName || challenged?.username || 'Unknown',
              username: challenged?.username || undefined,
            },
            stake_amount: parseFloat(challenge.amount),
            category: challenge.type,
          });
          console.log('📤 Challenge acceptance (matchmaking) broadcasted to Telegram successfully');
        }
      } catch (telegramError) {
        console.error('❌ Error broadcasting matchmaking to Telegram:', telegramError);
      }

      res.json(challenge);
    } catch (error) {
      console.error("Error accepting challenge:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to accept challenge" });
    }
  });

  // Join admin-created challenge
  app.post("/api/challenges/:id/join", PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { stake } = req.body; // 'YES' or 'NO'

      // Validate stake parameter
      if (!['YES', 'NO'].includes(stake)) {
        return res.status(400).json({ message: "Invalid stake. Must be 'YES' or 'NO'" });
      }

      // Check user has enough balance before joining
      const balance = await storage.getUserBalance(userId);
      const challengeData = await storage.getChallengeById(challengeId);
      const requiredAmount = parseInt(challengeData.amount.toString());

      if (parseFloat(balance.balance) < requiredAmount) {
        return res.status(400).json({ message: "Insufficient balance to join this challenge" });
      }

      // Join the challenge
      const challenge = await storage.joinAdminChallenge(challengeId, userId, stake);

      // Get user info
      const user = await storage.getUser(userId);
      const challenger = challenge.challenger ? await storage.getUser(challenge.challenger) : null;
      const challenged = challenge.challenged ? await storage.getUser(challenge.challenged) : null;

      // Send notifications
      if (challenge.status === 'active') {
        // Both users have joined - challenge is now active
        await storage.createNotification({
          userId: challenge.challenger,
          type: 'challenge_active',
          title: '🎮 Challenge Started!',
          message: `${challenged?.firstName || challenged?.username} joined your challenge "${challenge.title}"! Let the betting begin!`,
          data: { 
            challengeId: challengeId,
            challengeTitle: challenge.title,
            amount: parseFloat(challenge.amount)
          },
        });

        await storage.createNotification({
          userId: challenge.challenged,
          type: 'challenge_active',
          title: '🎮 Challenge Started!',
          message: `${challenger?.firstName || challenger?.username} joined your challenge "${challenge.title}"! Let the betting begin!`,
          data: { 
            challengeId: challengeId,
            challengeTitle: challenge.title,
            amount: parseFloat(challenge.amount)
          },
        });
      } else {
        // First joiner - waiting for second
        await storage.createNotification({
          userId: userId,
          type: 'challenge_joined',
          title: '✅ Challenge Joined!',
          message: `You staked ₦${requiredAmount.toLocaleString()} on ${stake} side. Waiting for another player to join...`,
          data: { 
            challengeId: challengeId,
            challengeTitle: challenge.title,
            stake: stake,
            amount: requiredAmount
          },
        });
      }

      // Broadcast to global channel so the challenges list updates with new participant/avatar count
      try {
        await pusher.trigger('global', 'challenge-joined', {
          type: 'challenge_joined',
          challengeId: challengeId,
          userId: userId,
          username: user?.username,
          firstName: user?.firstName,
          status: challenge.status,
        });
      } catch (error) {
        console.error('Error broadcasting challenge-joined event:', error);
      }

      res.json({
        challenge,
        message: challenge.status === 'active' ? 'Challenge is now active!' : 'Waiting for another player to join',
      });
    } catch (error) {
      console.error("Error joining challenge:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to join challenge" });
    }
  });

  app.get('/api/challenges/:id/messages', async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);

      // Get all messages for the challenge (public read)
      const messages = await storage.getChallengeMessages(challengeId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching challenge messages:", error);
      res.status(500).json({ message: "Failed to fetch challenge messages" });
    }
  });

  app.post('/api/challenges/:id/messages', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { message, type = 'text', evidence } = req.body;

      console.log(`[Messages] Creating message for challenge ${challengeId}, user ${userId}`);

      // Verify challenge exists
      const challenge = await storage.getChallengeById(challengeId);
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      // Allow all authenticated users to send messages to any challenge
      // This supports discussions in admin/open challenges and 1v1 challenges
      const newMessage = await storage.createChallengeMessage(challengeId, userId, message);
      console.log(`[Messages] Message created:`, newMessage.id);

      // Get user info for real-time message
      const user = await storage.getUser(userId);
      const messageWithUser = {
        ...newMessage,
        user: {
          id: user?.id,
          username: user?.username,
          firstName: user?.firstName,
          profileImageUrl: user?.profileImageUrl
        }
      };

      // Send real-time message
      try {
        await pusher.trigger(`challenge-${challengeId}`, 'new-message', {
          message: messageWithUser,
          timestamp: new Date().toISOString(),
        });

        // Also broadcast to global channel so the challenges list can update
        await pusher.trigger('global', 'new-message', {
          type: 'challenge_message',
          challengeId: challengeId,
          message: messageWithUser,
          timestamp: new Date().toISOString(),
        });

        // Send notifications to direct participants if they exist
        if (challenge.challenger && challenge.challenger !== userId) {
          await storage.createNotification({
            userId: challenge.challenger,
            type: 'challenge_message',
            title: '💬 New Challenge Message',
            message: `${user?.firstName || user?.username} sent a message in challenge "${challenge.title}"`,
            data: { 
              challengeId: challengeId,
              challengeTitle: challenge.title,
              messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
            },
          });
        }
        
        if (challenge.challenged && challenge.challenged !== userId) {
          await storage.createNotification({
            userId: challenge.challenged,
            type: 'challenge_message',
            title: '💬 New Challenge Message',
            message: `${user?.firstName || user?.username} sent a message in challenge "${challenge.title}"`,
            data: { 
              challengeId: challengeId,
              challengeTitle: challenge.title,
              messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
            },
          });
        }
      } catch (pusherError) {
        console.error("Error sending real-time message:", pusherError);
      }

      res.json(messageWithUser);
    } catch (error) {
      console.error("Error creating challenge message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Friend routes
  app.get('/api/friends', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const friendsList = await storage.getFriends(userId);
      res.json(friendsList);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get('/api/friends/requests', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const requests = await db
        .select({
          friend: friends,
          requester: users,
        })
        .from(friends)
        .leftJoin(users, eq(friends.requesterId, users.id))
        .where(
          and(
            eq(friends.addresseeId, userId),
            eq(friends.status, "pending")
          )
        );
      res.json(requests);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  app.post('/api/friends/request/:addresseeId', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const requesterId = getUserId(req);
      const addresseeId = req.params.addresseeId;
      const request = await storage.sendFriendRequest(requesterId, addresseeId);
      res.json(request);
    } catch (error) {
      console.error("Error sending friend request:", error);
      res.status(500).json({ message: "Failed to send friend request" });
    }
  });

  app.post('/api/friends/accept/:requestId', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const friend = await storage.acceptFriendRequest(requestId);
      res.json(friend);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      res.status(500).json({ message: "Failed to accept friend request" });
    }
  });

  app.post('/api/friends/decline/:requestId', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      await db.delete(friends).where(eq(friends.id, requestId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error declining friend request:", error);
      res.status(500).json({ message: "Failed to decline friend request" });
    }
  });

  // Notification routes
  app.get('/api/notifications', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch('/api/notifications/:id/read', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const notificationId = req.params.id;
      const notification = await storage.markNotificationRead(notificationId);
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Treasury Notification Endpoints
  app.get('/api/notifications/treasury', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const treasuryEvents = ['match.found', 'challenge.settled', 'admin.treasury.match_created', 'admin.treasury.settlement'];
      
      const notifs = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            sql`${notifications.event} IN (${sql.join(treasuryEvents)})`
          )
        )
        .orderBy(sql`${notifications.createdAt} DESC`)
        .limit(100);

      res.json(notifs);
    } catch (error) {
      console.error("Error fetching Treasury notifications:", error);
      res.status(500).json({ message: "Failed to fetch Treasury notifications" });
    }
  });

  app.get('/api/notifications/unread-count', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const count = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.read, false)
          )
        );

      res.json({ count: count.length });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.delete('/api/notifications/:id', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = getUserId(req);

      // Verify ownership
      const notif = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, notificationId))
        .limit(1);

      if (!notif.length || notif[0].userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await db
        .delete(notifications)
        .where(eq(notifications.id, notificationId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // Treasury Analytics Routes
  app.get('/api/admin/treasury/analytics/metrics', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.query.adminId as string;
      const userId = getUserId(req);

      if (!adminId || adminId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const { getTreasuryMetrics } = await import('./treasuryAnalytics');
      const metrics = await getTreasuryMetrics();

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching Treasury metrics:', error);
      res.status(500).json({ message: 'Failed to fetch metrics' });
    }
  });

  app.get('/api/admin/treasury/analytics/daily-trends', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.query.adminId as string;
      const range = req.query.range as string || '30d';
      const userId = getUserId(req);

      if (!adminId || adminId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const { getDailyPnLTrends } = await import('./treasuryAnalytics');
      
      let startDate: Date | undefined;
      const endDate = new Date();

      if (range === '7d') {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (range === '30d') {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      } else if (range === '90d') {
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      }

      const trends = await getDailyPnLTrends(startDate, endDate);
      res.json(trends);
    } catch (error) {
      console.error('Error fetching daily trends:', error);
      res.status(500).json({ message: 'Failed to fetch daily trends' });
    }
  });

  app.get('/api/admin/treasury/analytics/challenges', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.query.adminId as string;
      const userId = getUserId(req);

      if (!adminId || adminId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const { getChallengeAnalytics } = await import('./treasuryAnalytics');
      const analytics = await getChallengeAnalytics();

      res.json(analytics);
    } catch (error) {
      console.error('Error fetching challenge analytics:', error);
      res.status(500).json({ message: 'Failed to fetch challenge analytics' });
    }
  });

  app.get('/api/admin/treasury/analytics/user-performance', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.query.adminId as string;
      const userId = getUserId(req);

      if (!adminId || adminId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const { getPerformanceByUser } = await import('./treasuryAnalytics');
      const performance = await getPerformanceByUser();

      res.json(performance);
    } catch (error) {
      console.error('Error fetching user performance:', error);
      res.status(500).json({ message: 'Failed to fetch user performance' });
    }
  });

  app.get('/api/admin/treasury/analytics/risk-analysis', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.query.adminId as string;
      const userId = getUserId(req);

      if (!adminId || adminId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const { getRiskAnalysis } = await import('./treasuryAnalytics');
      const analysis = await getRiskAnalysis();

      res.json(analysis);
    } catch (error) {
      console.error('Error fetching risk analysis:', error);
      res.status(500).json({ message: 'Failed to fetch risk analysis' });
    }
  });

  app.get('/api/admin/treasury/analytics/export', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.query.adminId as string;
      const format = (req.query.format as string) || 'csv';
      const userId = getUserId(req);

      if (!adminId || adminId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const { exportAnalyticsData } = await import('./treasuryAnalytics');
      const data = await exportAnalyticsData(format as 'csv' | 'json');

      if (format === 'json') {
        res.json(data);
      } else {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="treasury-analytics-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(data);
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      res.status(500).json({ message: 'Failed to export analytics' });
    }
  });

  // User preferences routes
  app.get('/api/user/preferences', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const preferences = await storage.getUserPreferences(userId);

      // Return default preferences if none exist
      if (!preferences) {
        const defaultPreferences = {
          notifications: {
            email: true,
            push: true,
            challenge: true,
            event: true,
            friend: true
          },
          appearance: {
            theme: 'system',
            compactView: false,
            language: 'en'
          },
          performance: {
            autoRefresh: true,
            soundEffects: true,
            dataUsage: 'medium'
          },
          regional: {
            currency: 'NGN',
            timezone: 'Africa/Lagos'
          },
          privacy: {
            profileVisibility: 'public',
            activityVisibility: 'friends'
          }
        };
        return res.json(defaultPreferences);
      }

      res.json(preferences);
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      res.status(500).json({ message: "Failed to fetch user preferences" });
    }
  });

  app.patch('/api/user/preferences', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const { notifications, appearance, performance, regional, privacy } = req.body;

      const preferences = await storage.updateUserPreferences(userId, {
        notifications,
        appearance,
        performance,
        regional,
        privacy
      });

      res.json(preferences);
    } catch (error) {
      console.error("Error updating user preferences:", error);
      res.status(500).json({ message: "Failed to update user preferences" });
    }
  });

  // Transaction routes
  app.get('/api/transactions', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const transactions = await storage.getTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get('/api/wallet/balance', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      console.log(`Fetching balance for user: ${userId}`);

      const balance = await storage.getUserBalance(userId);
      console.log(`Balance result for user ${userId}:`, balance);

      res.json(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Wallet deposit route
  app.post('/api/wallet/deposit', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });      }

      if (!process.env.PAYSTACK_SECRET_KEY) {
        console.error("PAYSTACK_SECRET_KEY environment variable not set");
        return res.status(500).json({ message: "Payment service not configured" });
      }

      console.log("Initializing Paystack transaction for user:", userId, "amount:", amount);

      // Generate unique reference with random component to prevent duplicates
      // Sanitize userId by removing colons which Paystack doesn't allow
      const sanitizedUserId = userId.replace(/:/g, '-');
      const uniqueRef = `dep_${sanitizedUserId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Initialize Paystack transaction
      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: "dummy@betchat.com", // Dummy email for Paystack, not user email
          amount: amount * 100, // Paystack expects amount in kobo
          currency: 'NGN',
          reference: uniqueRef,
          metadata: {
            userId,
            type: 'deposit'
          }
        })
      });

      const paystackData = await paystackResponse.json();
      console.log("Paystack response:", paystackData);

      if (!paystackData.status) {
        console.error("Paystack error:", paystackData);
        return res.status(400).json({ message: paystackData.message || "Failed to initialize payment" });
      }

      console.log("Sending authorization URL:", paystackData.data.authorization_url);
      res.json({ 
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
        publicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_' // You'll need to set this in secrets
      });
    } catch (error) {
      console.error("Error processing deposit:", error);
      res.status(500).json({ message: "Failed to process deposit" });
    }
  });

  // Wallet swap route (Money ↔ Coins)
  app.post('/api/wallet/swap', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const { amount, fromCurrency } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      if (!fromCurrency || !['money', 'coins'].includes(fromCurrency)) {
        return res.status(400).json({ message: "Invalid currency type" });
      }

      console.log(`Processing swap for user ${userId}: ${amount} ${fromCurrency}`);

      // Get current balance
      const balance = await storage.getUserBalance(userId);

      if (fromCurrency === 'money') {
        // Money to Coins (1:10 ratio)
        if (balance.balance < amount) {
          return res.status(400).json({ message: "Insufficient money balance" });
        }

        const coinsToAdd = amount * 10;

        // Create debit transaction for money
        await storage.createTransaction({
          userId,
          type: 'currency_swap',
          amount: (-amount).toString(),
          description: `Swapped ${formatBalance(amount)} to ${coinsToAdd.toLocaleString()} coins`,
          status: 'completed'
        });

        // Update user coins
        await db
          .update(users)
          .set({ 
            coins: sql`${users.coins} + ${coinsToAdd}`,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));

        // Create notification
        await storage.createNotification({
          userId,
          type: 'currency_swap',
          title: '🔄 Currency Swap Complete',
          message: `Successfully swapped ${formatBalance(amount)} for ${coinsToAdd.toLocaleString()} coins!`,
          data: { 
            fromAmount: amount,
            toAmount: coinsToAdd,
            fromCurrency: 'money',
            toCurrency: 'coins'
          },
        });

        console.log(`✅ Swapped ${formatBalance(amount)} to ${coinsToAdd} coins for user ${userId}`);
        res.json({ 
          message: "Swap completed successfully",
          fromAmount: amount,
          toAmount: coinsToAdd,
          fromCurrency: 'money',
          toCurrency: 'coins'
        });

      } else {
        // Coins to Money (10:1 ratio)
        if (balance.coins < amount) {
          return res.status(400).json({ message: "Insufficient coins balance" });
        }

        const moneyToAdd = amount * 0.1;

        // Update user coins (deduct)
        await db
          .update(users)
          .set({ 
            coins: sql`${users.coins} - ${amount}`,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));

        // Create credit transaction for money
        await storage.createTransaction({
          userId,
          type: 'currency_swap',
          amount: moneyToAdd.toString(),
          description: `Swapped ${amount.toLocaleString()} coins to ${formatBalance(moneyToAdd)}`,
          status: 'completed'
        });

        // Create notification
        await storage.createNotification({
          userId,
          type: 'currency_swap',
          title: '🔄 Currency Swap Complete',
          message: `Successfully swapped ${amount.toLocaleString()} coins for ${formatBalance(moneyToAdd)}!`,
          data: { 
            fromAmount: amount,
            toAmount: moneyToAdd,
            fromCurrency: 'coins',
            toCurrency: 'money'
          },
        });

        console.log(`✅ Swapped ${amount} coins to ${formatBalance(moneyToAdd)} for user ${userId}`);
        res.json({ 
          message: "Swap completed successfully",
          fromAmount: amount,
          toAmount: moneyToAdd,
          fromCurrency: 'coins',
          toCurrency: 'money'
        });
      }

      // Send real-time notification via Pusher
      try {
        await pusher.trigger(`user-${userId}`, 'currency-swap', {
          id: Date.now(),
          type: 'currency_swap',
          title: '🔄 Currency Swap Complete',
          message: fromCurrency === 'money' 
            ? `Swapped ${formatBalance(amount)} for ${(amount * 10).toLocaleString()} coins!`
            : `Swapped ${amount.toLocaleString()} coins for ${formatBalance(amount * 0.1)}!`,
          timestamp: new Date().toISOString(),
        });
      } catch (pusherError) {
        console.error("Error sending Pusher notification:", pusherError);
      }

    } catch (error) {
      console.error("Error processing swap:", error);
      res.status(500).json({ message: "Failed to process swap" });
    }
  });

  // Wallet withdraw route
  app.post('/api/wallet/withdraw', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      console.log(`Processing withdrawal for user ${userId}: ${formatBalance(amount)}`);

      // Get current balance
      const balance = await storage.getUserBalance(userId);

      if (balance.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Create debit transaction for withdrawal
      await storage.createTransaction({
        userId,
        type: 'withdrawal',
        amount: (-amount).toString(),
        description: `Withdrawal of ${formatBalance(amount)}`,
        status: 'completed'
      });

      // Create notification
      await storage.createNotification({
        userId,
        type: 'withdrawal',
        title: '💸 Withdrawal Complete',
        message: `Successfully withdrew ${formatBalance(amount)} from your account!`,
        data: { 
          amount: amount,
          type: 'withdrawal'
        },
      });

      // Send real-time notification via Pusher
      try {
        await pusher.trigger(`user-${userId}`, 'withdrawal', {
          id: Date.now(),
          type: 'withdrawal',
          title: '💸 Withdrawal Complete',
          message: `Withdrew ${formatBalance(amount)} from your account!`,
          timestamp: new Date().toISOString(),
        });
      } catch (pusherError) {
        console.error("Error sending Pusher notification:", pusherError);
      }

      console.log(`✅ Withdrawal of ${formatBalance(amount)} completed for user ${userId}`);
      res.json({ 
        message: "Withdrawal completed successfully",
        amount: amount
      });

    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // Paystack webhook for payment verification
  app.post('/api/webhook/paystack', async (req, res) => {
    try {
      const hash = req.headers['x-paystack-signature'];
      let event = req.body;

      console.log('Webhook received:', {
        headers: req.headers,
        bodyType: typeof event,
        hasBody: !!event
      });

      // If body is already parsed as object, use it directly
      if (typeof event === 'object' && event !== null) {
        console.log('Using pre-parsed webhook body');
      } else {
        // Handle string bodies
        const bodyString = typeof event === 'string' ? event : JSON.stringify(event);

        // Verify signature if secret key is available
        if (process.env.PAYSTACK_SECRET_KEY) {
          const expectedHash = require('crypto')
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(bodyString)
            .digest('hex');

          console.log('Signature verification:', {
            receivedHash: hash,
            expectedHash,
            match: hash === expectedHash
          });

          if (hash !== expectedHash) {
            console.log('Invalid webhook signature');
            return res.status(400).json({ message: "Invalid signature" });
          }
        }

        // Parse the event if it's a string
        try {
          event = JSON.parse(bodyString);
        } catch (parseError) {
          console.error('Failed to parse webhook body:', parseError);
          return res.status(400).json({ message: "Invalid JSON" });
        }
      }

      console.log('Webhook event:', event);

      if (event.event === 'charge.success') {
        const { reference, amount, metadata, status } = event.data;

        console.log('Processing charge.success:', {
          reference,
          amount,
          metadata,
          status
        });

        if (status === 'success' && metadata && metadata.userId) {
          const userId = metadata.userId;
          const depositAmount = amount / 100; // Convert from kobo to naira

          console.log(`Processing successful deposit for user ${userId}: ₦${depositAmount}`);

          try {
            // Create transaction record
            await storage.createTransaction({
              userId,
              type: 'deposit',
              amount: depositAmount.toString(),
              description: `Deposit via Paystack - ${reference}`,
              status: 'completed',
            });

            // Create notification for successful deposit
            await storage.createNotification({
              userId,
              type: 'deposit',
              title: '💰 Deposit Successful',
              message: `Your deposit of ₦${depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been credited to your account!`,
              data: { 
                amount: depositAmount,
                reference: reference,
                type: 'deposit',
                timestamp: new Date().toISOString()
              },
            });

            console.log(`✅ Deposit completed for user ${userId}: ₦${depositAmount}`);
          } catch (dbError) {
            console.error('Database error while creating transaction:', dbError);
            return res.status(500).json({ message: "Database error" });
          }
        } else {
          console.log('⚠️ Charge success but invalid status or missing metadata:', {
            status,
            hasMetadata: !!metadata,
            userId: metadata?.userId
          });
        }
      } else {
        console.log('Webhook event not charge.success:', event.event);
      }

      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("❌ Error processing webhook:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Manual payment verification (for testing)
  app.post('/api/wallet/verify-payment', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { reference } = req.body;
      const userId = getUserId(req);

      if (!reference) {
        return res.status(400).json({ message: "Reference is required" });
      }

      console.log(`Manual verification requested for reference: ${reference} by user: ${userId}`);

      if (!process.env.PAYSTACK_SECRET_KEY) {
        console.error("PAYSTACK_SECRET_KEY not set");
        return res.status(500).json({ message: "Payment service not configured" });
      }

      // Verify payment with Paystack
      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        }
      });

      const verifyData = await verifyResponse.json();
      console.log('Paystack verification response:', {
        status: verifyData.status,
        data: verifyData.data ? {
          status: verifyData.data.status,
          amount: verifyData.data.amount,
          reference: verifyData.data.reference,
          metadata: verifyData.data.metadata
        } : null
      });

      if (verifyData.status && verifyData.data && verifyData.data.status === 'success') {
        const { amount, metadata, reference: txRef } = verifyData.data;
        const depositAmount = amount / 100; // Convert from kobo to naira

        console.log(`Processing payment verification:`, {
          amount: depositAmount,
          metadata,
          reference: txRef,
          requestedBy: userId
        });

        // Validate the user matches
        if (metadata && metadata.userId === userId) {
          // Check if transaction already exists by reference
          const existingTransactions = await storage.getTransactions(userId);
          const exists = existingTransactions.some((t: any) => 
            t.reference === reference || 
            t.description?.includes(reference) ||
            t.reference === txRef
          );

          if (!exists) {
            console.log(`Creating new deposit transaction for user ${userId}: ₦${depositAmount}`);

            const newTransaction = await storage.createTransaction({
              userId,
              type: 'deposit',
              amount: depositAmount.toString(),
              description: `Deposit via Paystack - ${reference}`,
              reference: reference,
              status: 'completed',
            });

            console.log(`Transaction created:`, newTransaction);

            // Verify the transaction was created
            const verifyTransactions = await storage.getTransactions(userId);
            console.log(`All transactions after creation:`, verifyTransactions.map(t => ({
              id: t.id,
              type: t.type,
              amount: t.amount,
              status: t.status,
              reference: t.reference
            })));

            // Get updated balance
            const updatedBalance = await storage.getUserBalance(userId);
            console.log(`Updated balance for user ${userId}:`, updatedBalance);

            // Create notification for successful deposit
            await storage.createNotification({
              userId,
              type: 'deposit',
              title: '💰 Deposit Successful',
              message: `Your deposit of ₦${depositAmount.toLocaleString()} has been credited to your account!`,
              data: { 
                amount: depositAmount,
                reference: reference,
                type: 'deposit',
                timestamp: new Date().toISOString()
              },
            });

            console.log(`✅ Manual verification completed for user ${userId}: ₦${depositAmount}`);
            res.json({ 
              message: "Payment verified successfully", 
              amount: depositAmount,
              newBalance: updatedBalance 
            });
          } else {
            console.log(`Transaction with reference ${reference} already exists for user ${userId}`);
            const currentBalance = await storage.getUserBalance(userId);
            res.json({ 
              message: "Payment already processed", 
              amount: depositAmount,
              currentBalance: currentBalance 
            });
          }
        } else {
          console.log('Metadata validation failed:', {
            metadataUserId: metadata?.userId,
            requestUserId: userId,
            hasMetadata: !!metadata
          });
          res.status(400).json({ message: "Payment verification failed - user mismatch" });
        }
      } else {
        console.log('Payment verification failed:', {
          paystackStatus: verifyData.status,
          dataStatus: verifyData.data?.status,
          message: verifyData.message
        });
        res.status(400).json({ message: verifyData.message || "Payment verification failed" });
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ message: "Failed to verify payment" });
    }
  });

  // Wallet withdrawal route
  app.post('/api/wallet/withdraw', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, method } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const balance = await storage.getUserBalance(userId);
      if (balance.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Create withdrawal transaction
      await storage.createTransaction({
        userId,
        type: 'withdrawal',
        amount: `-${amount}`,
        description: `Withdrawal via ${method}`,
        status: 'pending',
      });

      // Create notification
      await storage.createNotification({
        userId,
        type: 'withdrawal',
        title: '📤 Withdrawal Requested',
        message: `Your withdrawal of ₦${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} is being processed.`,
        data: { amount, method },
      });

      res.json({ message: "Withdrawal request submitted successfully" });
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // Global chat routes
  app.get('/api/chat/messages', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const messages = await storage.getGlobalChatMessages(50);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching global chat messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/chat/messages', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Get user info
      const user = await storage.getUser(userId);

      // Create message in BetChat
      const newMessage = await storage.createGlobalChatMessage({
        userId,
        user: {
          id: user?.id,
          firstName: user?.firstName,
          lastName: user?.lastName,
          username: user?.username,
          profileImageUrl: user?.profileImageUrl,
        },
        message: message.trim(),
        source: 'betchat'
      });

      // Broadcast to BetChat users via Pusher
      await pusher.trigger('global-chat', 'new-message', {
        type: 'chat_message',
        message: newMessage,
        source: 'betchat'
      });

      // Forward to Telegram if sync is available
      const telegramSync = getTelegramSync();
      if (telegramSync && telegramSync.isReady()) {
        const senderName = user?.firstName || user?.username || 'BetChat User';
        await telegramSync.sendMessageToTelegram(message.trim(), senderName);
      }

      res.json(newMessage);
    } catch (error) {
      console.error("Error creating global chat message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Telegram sync status route
  app.get('/api/telegram/status', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const telegramSync = getTelegramSync();
      const telegramBot = getTelegramBot();

      let syncStatus = { 
        enabled: false, 
        connected: false, 
        message: "Telegram sync not configured" 
      };

      let botStatus = { 
        enabled: false, 
        connected: false, 
        message: "Telegram bot not configured" 
      };

      if (telegramSync) {
        const isReady = telegramSync.isReady();
        const groupInfo = isReady ? await telegramSync.getGroupInfo() : null;
        syncStatus = {
          enabled: true,
          connected: isReady,
          groupInfo,
          message: isReady ? "Connected and syncing" : "Connecting..."
        };
      }

      if (telegramBot) {
        const connection = await telegramBot.testConnection();
        const channelInfo = connection ? await telegramBot.getChannelInfo() : null;
        botStatus = {
          enabled: true,
          connected: connection,
          channelInfo,
          message: connection ? "Bot connected and ready for broadcasting" : "Bot connection failed"
        };
      }

      res.json({
        sync: syncStatus,
        bot: botStatus
      });
    } catch (error) {
      console.error("Error getting Telegram status:", error);
      res.status(500).json({ message: "Failed to get Telegram status" });
    }
  });

  // Phase 1: Telegram bot webhook for /start command
  app.post('/api/telegram/bot-webhook', async (req, res) => {
    try {
      const update = req.body;

      // Handle /start command - Always show mini-app button
      if (update.message && update.message.text && update.message.text.startsWith('/start')) {
        const chatId = update.message.chat.id;
        const firstName = update.message.from.first_name || 'User';

        console.log(`📱 Received /start from Telegram user ${chatId}`);

        const telegramBot = getTelegramBot();
        if (telegramBot) {
          await telegramBot.sendStartMessage(chatId, firstName);
        }
        return res.json({ ok: true });
      }

      // Handle /balance command
      if (update.message && update.message.text && update.message.text.startsWith('/balance')) {
        const chatId = update.message.chat.id;
        const telegramId = update.message.from.id.toString();

        const telegramBot = getTelegramBot();
        if (telegramBot) {
          const { TelegramLinkingService } = await import('./telegramLinking');
          const user = await TelegramLinkingService.getUserByTelegramId(telegramId);

          if (!user) {
            await telegramBot.sendMessage(chatId, '💰 *Your Wallet*\n\nNo account linked yet. Open the mini-app to get started!');
          } else {
            const balance = await storage.getUserBalance(user.id);
            await telegramBot.sendBalanceNotification(chatId, parseInt(balance.balance || '0'), balance.coins || 0);
          }
        }
        return res.json({ ok: true });
      }

      // Handle /mychallenges command
      if (update.message && update.message.text && update.message.text.startsWith('/mychallenges')) {
        const chatId = update.message.chat.id;
        const telegramId = update.message.from.id.toString();

        const telegramBot = getTelegramBot();
        if (telegramBot) {
          const { TelegramLinkingService } = await import('./telegramLinking');
          const user = await TelegramLinkingService.getUserByTelegramId(telegramId);

          if (!user) {
            await telegramBot.sendMessage(chatId, '⚔️ *Your Challenges*\n\nNo account linked yet. Open the mini-app to get started!');
          } else {
            const challenges = await storage.getChallenges(user.id, 10);
            const activeChallenges = challenges.filter((c: any) => c.status === 'active' || c.status === 'pending');
            await telegramBot.sendChallengesNotification(chatId, activeChallenges.length);
          }
        }
        return res.json({ ok: true });
      }

      return res.json({ ok: true });
    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.json({ ok: true });
    }
  });

  // Phase 1: Telegram auth verification endpoint
  app.get('/api/telegram/verify-link', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { token } = req.query;
      const userId = getUserId(req);

      console.log(`🔍 Telegram link verification request - Token: ${token}, User: ${userId}`);

      if (!token || typeof token !== 'string') {
        console.log('❌ Invalid token format');
        return res.status(400).json({ success: false, message: 'Invalid token' });
      }

      const { TelegramLinkingService } = await import('./telegramLinking');

      // Verify token
      const linkData = await TelegramLinkingService.verifyLinkToken(token);

      if (!linkData) {
        console.log(`❌ Token verification failed: ${token}`);
        return res.json({ 
          success: false, 
          error: 'invalid_token',
          message: 'Link expired or invalid. Please use /start in Telegram to get a new link.' 
        });
      }

      console.log(`✅ Token verified for Telegram user ${linkData.telegramChatId}`);

      // Link account
      const linked = await TelegramLinkingService.linkTelegramAccount(
        userId,
        linkData.telegramChatId,
        linkData.telegramUsername
      );

      if (!linked) {
        console.log(`❌ Account linking failed - already linked`);
        return res.json({ 
          success: false,
          error: 'already_linked',
          message: 'This Telegram account is already linked to another user.' 
        });
      }

      // Mark token as used
      TelegramLinkingService.markTokenAsUsed(token);

      // Get user info for confirmation
      const user = await storage.getUser(userId);

      // Send confirmation to Telegram
      const telegramBot = getTelegramBot();
      if (telegramBot && user) {
        await telegramBot.sendAccountLinkedConfirmation(
          linkData.telegramChatId,
          user.username || user.firstName || 'User',
          user.coins || 0
        );
      }

      console.log(`✅ Successfully linked Telegram account ${linkData.telegramChatId} to user ${userId}`);

      res.json({ 
        success: true,
        message: 'Account linked successfully!',
        user: {
          telegramId: linkData.telegramChatId,
          telegramUsername: linkData.telegramUsername,
        }
      });
    } catch (error) {
      console.error('❌ Error verifying Telegram link:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Telegram Mini-App: Link account endpoint
  // This endpoint is called from the Telegram mini-app after the user is authenticated with Privy
  app.post('/api/telegram/mini-app/link', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const { telegramId, telegramUsername, telegramFirstName, initData } = req.body;

      if (!telegramId || !initData || !initData.hash) {
        return res.status(400).json({ success: false, message: 'Missing Telegram data' });
      }

      console.log(`🔍 Mini-app link request - User: ${userId}, Telegram ID: ${telegramId}`);

      // Verify the Telegram initData signature
      // The initData is a URL-encoded string with format: user=%7B...%7D&auth_date=...&hash=...
      const { TelegramLinkingService } = await import('./telegramLinking');
      
      // Validate the Telegram signature
      try {
        const isValid = validateTelegramWebAppData(initData, process.env.TELEGRAM_BOT_TOKEN || '');
        if (!isValid) {
          console.log('❌ Invalid Telegram signature');
          return res.json({
            success: false,
            message: 'Invalid Telegram signature. Please use the official mini-app link.'
          });
        }
      } catch (signError) {
        console.error('Error validating Telegram signature:', signError);
        return res.json({
          success: false,
          message: 'Failed to validate Telegram data'
        });
      }

      // Link the Telegram account
      const linked = await TelegramLinkingService.linkTelegramAccount(
        userId,
        telegramId.toString(),
        telegramUsername || `user_${telegramId}`
      );

      if (!linked) {
        console.log(`❌ Account linking failed - already linked`);
        return res.json({
          success: false,
          message: 'This Telegram account is already linked to another user.'
        });
      }

      // Send confirmation to Telegram
      const telegramBot = getTelegramBot();
      const user = await storage.getUser(userId);
      if (telegramBot && user) {
        await telegramBot.sendAccountLinkedConfirmation(
          telegramId,
          user.username || user.firstName || 'User',
          user.coins || 0
        );
      }

      console.log(`✅ Successfully linked Telegram account ${telegramId} to user ${userId}`);

      res.json({
        success: true,
        message: 'Account linked successfully!'
      });
    } catch (error) {
      console.error('❌ Error linking mini-app account:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Telegram Mini-App: Auth endpoint (Telegram-only login)
  // Verify initData, create or get user, then create a server session via req.login
  app.post('/api/telegram/mini-app/auth', async (req, res) => {
    try {
      const { initData } = req.body;
      if (!initData || !initData.hash) {
        return res.status(400).json({ success: false, message: 'Missing initData' });
      }

      const isValid = validateTelegramWebAppData(initData, process.env.TELEGRAM_BOT_TOKEN || '');
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Invalid Telegram signature' });
      }

      const telegramUser = initData.user;
      if (!telegramUser || !telegramUser.id) {
        return res.status(400).json({ success: false, message: 'Invalid Telegram user data' });
      }

      // Create or find user in DB
      const telegramId = telegramUser.id.toString();
      const telegramUserId = `telegram_${telegramId}`;
      let user = await storage.getUser(telegramUserId);
      if (!user) {
        const username = telegramUser.username || `tg_${telegramId}`;
        user = await storage.createUser({
          id: telegramUserId,
          firstName: telegramUser.first_name || username,
          username: username,
          email: `${telegramUserId}@telegram.betchat.local`,
          profileImageUrl: telegramUser.photo_url || null,
          isTelegramUser: true,
          telegramId: telegramId,
          coins: 0,
          points: 0,
          level: 1,
          xp: 0,
        });
      }

      // Login the user (passport session)
      req.login(user, (err: any) => {
        if (err) {
          console.error('Error logging in Telegram user:', err);
          return res.status(500).json({ success: false, message: 'Failed to create session' });
        }
        console.log(`✅ Telegram session created for ${user.id}`);
        return res.json({ success: true, user: { id: user.id, username: user.username, firstName: user.firstName } });
      });
    } catch (error) {
      console.error('❌ Telegram mini-app auth error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Telegram Bot API: Get user data for bot
  // Called by the independent Telegram bot service
  // No authentication required - bot only needs telegramId which is public
  app.get('/api/telegram/user/:telegramId', async (req, res) => {
    try {
      const { telegramId } = req.params;

      console.log(`📱 Bot API request for Telegram user ${telegramId}`);

      // Find user by telegram ID
      const { TelegramLinkingService } = await import('./telegramLinking');
      const user = await TelegramLinkingService.getUserByTelegramId(telegramId);

      if (!user) {
        return res.json({
          user: null,
          message: 'User not found'
        });
      }

      // Get user balance
      const balance = await storage.getUserBalance(user.id);

      // Get active challenges count
      const allChallenges = await storage.getChallenges(user.id, 100);
      const activeChallenges = allChallenges.filter((c: any) => 
        c.status === 'active' || c.status === 'pending'
      ).length;

      return res.json({
        user: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          balance: balance.balance || '0',
          coins: balance.coins || 0,
          activeChallenges,
          telegramId
        }
      });
    } catch (error) {
      console.error('❌ Bot API error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  });

  // Helper function to validate Telegram WebApp initData
  function validateTelegramWebAppData(
    initData: any,
    botToken: string
  ): boolean {
    try {
      // Extract hash from initData
      const hash = initData.hash;
      if (!hash) return false;

      // Create data check string (all params except hash, sorted by key)
      const dataCheckString = Object.entries(initData)
        .filter(([key]) => key !== 'hash')
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => {
          if (typeof value === 'object') {
            return `${key}=${JSON.stringify(value)}`;
          }
          return `${key}=${value}`;
        })
        .join('\n');

      // Create HMAC-SHA256
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      const computedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return computedHash === hash;
    } catch (error) {
      console.error('Error validating Telegram data:', error);
      return false;
    }
  }

  // Test Telegram broadcast endpoint
  app.post('/api/telegram/test-broadcast', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const telegramBot = getTelegramBot();

      if (!telegramBot) {
        return res.status(400).json({ message: "Telegram bot not configured" });
      }

      const message = req.body.message || "🧪 Test message from BetChat";
      const success = await telegramBot.sendCustomMessage(message);

      res.json({ 
        success, 
        message: success ? "Message sent successfully" : "Failed to send message - Make sure bot is added to your channel as admin" 
      });
    } catch (error) {
      console.error("Error testing Telegram broadcast:", error);
      res.status(500).json({ message: "Failed to test Telegram broadcast" });
    }
  });

  // Broadcast existing events to Telegram channel
  app.post('/api/telegram/broadcast-existing', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const telegramBot = getTelegramBot();

      if (!telegramBot) {
        return res.status(400).json({ message: "Telegram bot not configured" });
      }

      // Get all existing events
      const existingEvents = await storage.getEvents();
      let successCount = 0;
      let totalCount = existingEvents.length;

      for (const event of existingEvents) {
        try {
          // Get creator info
          const creator = await storage.getUser(event.creatorId);

          const success = await telegramBot.broadcastEvent({
            id: event.id,
            title: event.title,
            description: event.description || undefined,
            creator: {
              name: creator?.firstName || creator?.username || 'Unknown',
              username: creator?.username || undefined,
            },
            entryFee: event.entryFee.toString(),
            endDate: event.endDate.toISOString(),
            is_private: event.isPrivate,
            max_participants: event.maxParticipants,
            category: event.category,
          });

          if (success) {
            successCount++;
          }

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to broadcast event ${event.id}:`, error);
        }
      }

      res.json({ 
        success: successCount > 0, 
        message: `Broadcasted ${successCount} out of ${totalCount} existing events`,
        details: { successCount, totalCount }
      });
    } catch (error) {
      console.error("Error broadcasting existing events:", error);
      res.status(500).json({ message: "Failed to broadcast existing events" });
    }
  });

  // Follow/Unfollow user route
  app.post('/api/users/:userId/follow', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const followerId = req.user.claims.sub;
      const followingId = req.params.userId;

      if (followerId === followingId) {
        return res.status(400).json({ message: "Cannot follow yourself" });
      }

      const result = await storage.toggleFollow(followerId, followingId);

      if (result.action === 'followed') {
        // Get follower info
        const follower = await storage.getUser(followerId);
        
        // Only send one notification using a unique ID to prevent duplicates
        const notificationId = `follow_${followerId}_${followingId}`;
        
        // Check if notification already exists
        const [existing] = await db
          .select()
          .from(notifications)
          .where(eq(notifications.id, notificationId))
          .limit(1);

        if (!existing) {
          // Create notification for followed user
          await storage.createNotification({
            id: notificationId,
            userId: followingId,
            type: 'new_follower',
            title: '👤 New Follower',
            message: `@${follower?.firstName || follower?.username || 'Someone'} is now following you!`,
            icon: '👤',
            data: { 
              followerId: followerId,
              followerName: follower?.firstName || follower?.username
            },
          });

          // Send real-time notification via Pusher
          const sanitizedFollowingId = followingId.replace(/[^a-zA-Z0-9_\-=@,.;]/g, '_');
          await pusher.trigger(`user-${sanitizedFollowingId}`, 'new-follower', {
            title: '👤 New Follower',
            message: `@${follower?.firstName || follower?.username || 'Someone'} is now following you!`,
            followerId: followerId,
            followerName: follower?.firstName || follower?.username,
            timestamp: new Date().toISOString(),
          });
        }
      }

      res.json({
        ...result,
        isFollowing: result.action === 'followed'
      });
    } catch (error) {
      console.error("Error toggling follow:", error);
      res.status(500).json({ message: "Failed to toggle follow" });
    }
  });

  // Track sharing and send notification
  app.post('/api/track-share', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const { platform, contentType, contentId, url } = req.body;

      // Get user info
      const user = await storage.getUser(userId);

      // Create notification for successful share
      let notificationTitle = '🔗 Content Shared!';
      let notificationMessage = '';

      if (contentType === 'event') {
        const event = await storage.getEventById(parseInt(contentId));
        notificationMessage = `You shared "${event?.title}" on ${platform}! Keep spreading the word to earn rewards.`;
      } else if (contentType === 'challenge') {
        const challenge = await storage.getChallengeById(parseInt(contentId));
        notificationMessage = `You shared your challenge "${challenge?.title}" on ${platform}! More shares = more participants.`;
      } else if (contentType === 'profile') {
        notificationMessage = `You shared your profile on ${platform}! Great way to grow your network.`;
      } else {
        notificationMessage = `You shared content on ${platform}! Keep engaging to boost your reach.`;
      }

      await storage.createNotification({
        userId,
        type: 'content_shared',
        title: notificationTitle,
        message: notificationMessage,
        data: { 
          platform,
          contentType,
          contentId,
          url,
          sharedAt: new Date().toISOString()
        },
      });

      // Send real-time notification via Pusher
      const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_\-=@,.;]/g, '_');
      await pusher.trigger(`user-${sanitizedUserId}`, 'content-shared', {
        title: notificationTitle,
        message: notificationMessage,
        platform,
        contentType,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true, message: 'Share tracked successfully' });
    } catch (error) {
      console.error('Error tracking share:', error);
      res.status(500).json({ message: 'Failed to track share' });
    }
  });

  // Get navigation badge counts route
  app.get('/api/navigation/badges', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;

      // Get profile-related notification count (unread profile-specific notifications)
      const profileNotifications = await db
        .select({
          count: sql<number>`count(*)`
        })
        .from(notifications)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.read, false),
          sql`type IN ('new_follower', 'achievement_unlocked', 'daily_signin_reminder', 'winner_challenge', 'loser_encourage')`
        ));

      // Get new events count (events posted in last 24 hours)
      const newEvents = await db
        .select({
          count: sql<number>`count(*)`
        })
        .from(events)
        .where(sql`created_at >= NOW() - INTERVAL '24 hours'`);

      // Get new challenges count (challenges posted in last 24 hours)
      const newChallenges = await db
        .select({
          count: sql<number>`count(*)`
        })
        .from(challenges)
        .where(sql`created_at >= NOW() - INTERVAL '24 hours'`);

      res.json({
        profile: Number(profileNotifications[0]?.count || 0),
        events: Number(newEvents[0]?.count || 0),
        challenges: Number(newChallenges[0]?.count || 0)
      });
    } catch (error) {
      console.error("Error fetching navigation badges:", error);
      res.status(500).json({ message: "Failed to fetch navigation badges" });
    }
  });

  // Get user profile route
  app.get('/api/users/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Tip user route
  app.post('/api/users/:userId/tip', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const senderId = getUserId(req);
      const receiverId = req.params.userId;
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      if (senderId === receiverId) {
        return res.status(400).json({ message: "Cannot tip yourself" });
      }

      const balanceResult = await storage.getUserBalance(senderId);
      if (balanceResult.coins < amount) {
        return res.status(400).json({ message: "Insufficient coins" });
      }

      // Get sender and receiver info
      const sender = await storage.getUser(senderId);
      const receiver = await storage.getUser(receiverId);

      // Deduct coins from sender and credit receiver
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ 
            coins: sql`${users.coins} - ${amount}`,
            updatedAt: new Date()
          })
          .where(eq(users.id, senderId));

        await tx
          .update(users)
          .set({ 
            coins: sql`${users.coins} + ${amount}`,
            updatedAt: new Date()
          })
          .where(eq(users.id, receiverId));

        // Create transactions
        await tx.insert(transactions).values({
          userId: senderId,
          type: 'Gifted',
          amount: `-${amount}`,
          description: `Gifted @${receiver?.username || 'user'}`,
          status: 'completed',
        });

        await tx.insert(transactions).values({
          userId: receiverId,
          type: 'Gift received',
          amount: amount.toString(),
          description: `Gift received from @${sender?.username || 'user'}`,
          status: 'completed',
        });
      });

      // Create notification for receiver
      await storage.createNotification({
        userId: receiverId,
        type: 'gift_received',
        title: '💰 Gift Received',
        message: `You received a gift of ${amount} coins from @${sender?.username || 'Someone'}!`,
        data: { 
          amount: amount,
          senderId: senderId,
          senderName: sender?.username
        },
      });

      // Create notification for sender (confirmation)
      await storage.createNotification({
        userId: senderId,
        type: 'gift_sent',
        title: '💸 Gift Sent',
        message: `You gifted @${receiver?.username || 'User'} ${amount} coins!`,
        data: { 
          amount: amount,
          receiverId: receiverId,
          receiverName: receiver?.username
        },
      });

      // Send real-time notifications via Pusher
      const sanitizedReceiverId = receiverId.replace(/[^a-zA-Z0-9_\-=@,.;]/g, '_');
      const sanitizedSenderId = senderId.replace(/[^a-zA-Z0-9_\-=@,.;]/g, '_');

      await pusher.trigger(`user-${sanitizedReceiverId}`, 'tip-received', {
        title: '💰 Gift Received',
        message: `You received a gift of ${amount} coins from @${sender?.username || 'Someone'}!`,
        amount: amount,
        senderId: senderId,
        senderName: sender?.username,
        timestamp: new Date().toISOString(),
      });

      await pusher.trigger(`user-${sanitizedSenderId}`, 'tip-sent', {
        title: '💸 Gift Sent',
        message: `You gifted @${receiver?.username || 'User'} ${amount} coins!`,
        amount: amount,
        receiverId: receiverId,
        receiverName: receiver?.username,
        timestamp: new Date().toISOString(),
      });

      res.json({ message: "Tip sent successfully" });
    } catch (error) {
      console.error("Error sending tip:", error);
      res.status(500).json({ message: "Failed to send tip" });
    }
  });

  // Open Graph metadata endpoint
  app.get('/api/og-metadata', async (req, res) => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter is required' });
      }

      // Simple OG metadata extraction
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Bantah-Bot/1.0',
          'Accept': 'text/html'
        }
      });

      if (!response.ok) {
        return res.status(400).json({ error: 'Failed to fetch URL' });
      }

      const html = await response.text();
      const ogData: Record<string, string> = {};

      // Extract basic OG tags
      const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*?)["']/i);
      if (titleMatch) ogData.title = titleMatch[1];

      const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*?)["']/i);
      if (descMatch) ogData.description = descMatch[1];

      const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*?)["']/i);
      if (imageMatch) ogData.image = imageMatch[1];

      res.json(ogData);
    } catch (error) {
      console.error('Error fetching OG metadata:', error);
      res.status(500).json({ error: 'Failed to fetch metadata' });
    }
  });

  // Daily Sign-In Routes
  app.get('/api/daily-signin/status', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);

      // First, check and create daily login record if needed
      await storage.checkDailyLogin(userId);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if user has already signed in today
      const todayLogin = await db
        .select()
        .from(dailyLogins)
        .where(and(
          eq(dailyLogins.userId, userId),
          sql`DATE(${dailyLogins.date}) = ${today.toISOString().split('T')[0]}`
        ))
        .limit(1);

      const hasSignedInToday = todayLogin.length > 0;
      const hasClaimed = hasSignedInToday ? todayLogin[0].claimed : false;

      // Get current streak
      const latestLogin = await db
        .select()
        .from(dailyLogins)
        .where(eq(dailyLogins.userId, userId))
        .orderBy(sql`${dailyLogins.date} DESC`)
        .limit(1);

      let currentStreak = 1;
      if (latestLogin.length > 0) {
        currentStreak = latestLogin[0].streak;

        // If they haven't signed in today, reset streak if yesterday wasn't their last login
        if (!hasSignedInToday) {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          const lastLoginDate = new Date(latestLogin[0].date);
          lastLoginDate.setHours(0, 0, 0, 0);

          if (lastLoginDate.getTime() !== yesterday.getTime()) {
            currentStreak = 1; // Reset streak
          } else {
            currentStreak = latestLogin[0].streak + 1; // Continue streak
          }
        }
      }

      // Calculate points to award (base 50 + streak bonus)
      const basePoints = 50;
      const streakBonus = Math.min(currentStreak * 10, 200); // Max 200 bonus
      const pointsToAward = basePoints + streakBonus;

      res.json({
        hasSignedInToday,
        hasClaimed,
        hasClaimedToday: hasClaimed,
        canClaim: hasSignedInToday && !hasClaimed,
        streak: currentStreak,
        currentStreak,
        pointsToAward,
        showModal: hasSignedInToday && !hasClaimed
      });
    } catch (error) {
      console.error("Error checking daily sign-in status:", error);
      res.status(500).json({ message: "Failed to check daily sign-in status" });
    }
  });

  app.post('/api/daily-signin/claim', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if already claimed today
      const todayLogin = await db
        .select()
        .from(dailyLogins)
        .where(and(
          eq(dailyLogins.userId, userId),
          sql`DATE(${dailyLogins.date}) = ${today.toISOString().split('T')[0]}`
        ))
        .limit(1);

      if (todayLogin.length === 0) {
        return res.status(400).json({ message: "No sign-in record found for today" });
      }

      if (todayLogin[0].claimed) {
        return res.status(400).json({ message: "Daily bonus already claimed" });
      }

      const pointsEarned = todayLogin[0].pointsEarned;

      // Mark as claimed and award points
      await db
        .update(dailyLogins)
        .set({ claimed: true })
        .where(eq(dailyLogins.id, todayLogin[0].id));

      // Add points to user balance
      await db
        .update(users)
        .set({ 
          points: sql`${users.points} + ${pointsEarned}`,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // Create transaction record
      await storage.createTransaction({
        userId,
        type: 'daily_signin',
        amount: pointsEarned.toString(),
        description: `Daily sign-in bonus - Day ${todayLogin[0].streak}`,
        status: 'completed'
      });

      res.json({ 
        message: "Daily bonus claimed successfully",
        pointsEarned,
        streak: todayLogin[0].streak
      });
    } catch (error) {
      console.error("Error claiming daily sign-in:", error);
      res.status(500).json({ message: "Failed to claim daily sign-in bonus" });
    }
  });

  // Get daily login history for user
  app.get('/api/daily-signin/history', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const history = await db
        .select()
        .from(dailyLogins)
        .where(eq(dailyLogins.userId, userId))
        .orderBy(sql`${dailyLogins.date} DESC`)
        .limit(30); // Last 30 days

      res.json(history);
    } catch (error) {
      console.error("Error fetching daily login history:", error);
      res.status(500).json({ message: "Failed to fetch daily login history" });
    }
  });

  // Get all users route (for user search and listing)
  app.get('/api/users', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // User stats and history routes
  app.get('/api/user/stats', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  app.get('/api/user/created-events', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const events = await storage.getUserCreatedEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching user created events:", error);
      res.status(500).json({ message: "Failed to fetch user created events" });
    }
  });

  app.get('/api/user/joined-events', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const events = await storage.getUserJoinedEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching user joined events:", error);
      res.status(500).json({ message: "Failed to fetch user joined events" });
    }
  });



  app.get('/api/user/achievements', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const achievements = await storage.getUserAchievements(userId);
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      res.status(500).json({ message: "Failed to fetch user achievements" });
    }
  });

  app.get('/api/users/:userId/profile', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.params.userId;
      const currentUserId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId, currentUserId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Event lifecycle management routes
  app.post('/api/admin/events/:id/notify-starting', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      await storage.notifyEventStarting(eventId);
      res.json({ message: "Event starting notifications sent" });
    } catch (error) {
      console.error("Error sending event starting notifications:", error);
      res.status(500).json({ message: "Failed to send notifications" });
    }
  });

  app.post('/api/admin/events/:id/notify-ending', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      await storage.notifyEventEnding(eventId);
      res.json({ message: "Event ending notifications sent" });
    } catch (error) {
      console.error("Error sending event ending notifications:", error);
      res.status(500).json({ message: "Failed to send notifications" });
    }
  });

  // Admin event management routes
  app.delete('/api/admin/events/:id', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      await storage.deleteEvent(eventId);
      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  app.patch('/api/admin/events/:id/chat', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const { enabled } = req.body;
      await storage.toggleEventChat(eventId, enabled);
      res.json({ message: `Event chat ${enabled ? 'enabled' : 'disabled'}`, enabled });
    } catch (error) {
      console.error("Error toggling event chat:", error);
      res.status(500).json({ message: "Failed to toggle event chat" });
    }
  });

  // Admin challenge management routes
  app.get('/api/admin/challenges', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const challenges = await storage.getAllChallenges(limit);
      res.json(challenges);
    } catch (error) {
      console.error("Error fetching admin challenges:", error);
      res.status(500).json({ message: "Failed to fetch challenges" });
    }
  });

  app.get('/api/admin/users', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const users = await storage.getAllUsers();
      const result = limit ? users.slice(0, limit) : users;
      res.json(result);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin challenge creation - handles both JSON and FormData
  app.post('/api/admin/challenges', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      // Log the request to debug
      console.log('\n🔍 ADMIN CHALLENGE CREATE REQUEST:');
      console.log('Body keys:', Object.keys(req.body));
      console.log('Has req.files:', !!req.files);
      console.log('req.files type:', Array.isArray(req.files) ? `Array (${req.files.length})` : typeof req.files);
      
      if (req.files) {
        if (Array.isArray(req.files)) {
          console.log('Files array:', req.files.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, size: f.size })));
        } else {
          console.log('Files object:', Object.keys(req.files));
          // Handle case where multer puts files in an object instead of array
          for (const [key, val] of Object.entries(req.files)) {
            if (Array.isArray(val)) {
              console.log(`  - ${key}: [${val.map(f => f.originalname).join(', ')}]`);
            }
          }
        }
      }

      // When multer processes FormData with upload.any(), fields come in req.body
      // and files come in req.files array or object
      let { title, description, category, amount, endDate, dueDate, status, isVisible, adminCreated } = req.body;
      
      // FormData sends everything as strings, so parse them
      if (typeof amount === 'string') {
        amount = amount.trim();
      }
      if (typeof isVisible === 'string') {
        isVisible = isVisible === 'true';
      }
      if (typeof adminCreated === 'string') {
        adminCreated = adminCreated === 'true';
      }

      // Use dueDate if endDate isn't provided
      const dateField = endDate || dueDate;

      // Validate required fields
      if (!title || !category || amount === undefined || amount === null || amount === '') {
        console.log('❌ Validation failed:', { title, category, amount });
        return res.status(400).json({ message: `Missing required fields - title: ${title}, category: ${category}, amount: ${amount}` });
      }

      const amountNum = parseFloat(String(amount));
      if (isNaN(amountNum) || amountNum <= 0) {
        console.log('❌ Invalid amount:', amount);
        return res.status(400).json({ message: "Invalid amount. Must be a number greater than 0" });
      }

      // Handle cover image upload if provided - convert to base64 data URL
      let coverImageUrl: string | null = null;
      
      // Check both array format and object format for files
      let uploadedFile = null;
      if (req.files) {
        if (Array.isArray(req.files) && req.files.length > 0) {
          uploadedFile = req.files[0];
          console.log('✅ Found file in array format');
        } else if (!Array.isArray(req.files)) {
          // Check if coverImage field exists
          const files = req.files as any;
          if (files.coverImage) {
            uploadedFile = Array.isArray(files.coverImage) ? files.coverImage[0] : files.coverImage;
            console.log('✅ Found file in coverImage field');
          }
        }
      }
      
      if (uploadedFile) {
        try {
          // Convert buffer to base64 data URL
          const base64Data = uploadedFile.buffer.toString('base64');
          const mimeType = uploadedFile.mimetype || 'image/jpeg';
          coverImageUrl = `data:${mimeType};base64,${base64Data}`;
          console.log('✅ Cover image encoded as base64, size:', base64Data.length, 'bytes');
        } catch (err: any) {
          console.log('❌ Error encoding image:', err.message);
        }
      } else {
        console.log('⚠️ No file uploaded');
      }

      // Create admin challenge
      const challengeData = {
        challenger: null,
        challenged: null,
        title,
        description: description || null,
        category,
        amount: parseInt(String(amount)),
        status: status || "open",
        adminCreated: adminCreated !== false,
        bonusSide: null,
        bonusMultiplier: "1.00",
        bonusEndsAt: null,
        yesStakeTotal: 0,
        noStakeTotal: 0,
        dueDate: dateField ? new Date(dateField) : null,
        coverImageUrl,
      };

      const challenge = await storage.createAdminChallenge(challengeData);
      console.log('✅ Challenge created successfully:', challenge.id);

      // Trigger notification infrastructure for newly created admin challenge
      try {
        const yesMultiplier = parseFloat(String(challenge.bonusMultiplier || '1.00')) || 1;
        // Fire-and-forget to avoid delaying the response to the admin
        notificationInfrastructure.handleChallengeCreated(String(challenge.id), challenge.title, yesMultiplier, (req as any).user?.id).catch((err) => {
          console.error('Error in notificationInfrastructure.handleChallengeCreated:', err);
        });
      } catch (notifErr) {
        console.error('Failed to trigger notifications for admin challenge:', notifErr);
      }

      // Broadcast to Telegram channel for admin-created challenges
      const telegramBot = getTelegramBot();
      if (telegramBot) {
        try {
          const admin = await storage.getUser((req as any).user?.id);
          await telegramBot.broadcastChallenge({
            id: challenge.id,
            title: challenge.title,
            description: challenge.description || undefined,
            creator: {
              name: admin?.firstName || admin?.username || 'Admin',
              username: admin?.username || undefined,
            },
            stake_amount: parseFloat(String(challenge.amount || '0')),
            status: challenge.status,
            end_time: challenge.dueDate,
            category: category,
          });
          console.log("📤 Admin challenge broadcasted to Telegram successfully");
        } catch (error) {
          console.error("❌ Failed to broadcast admin challenge to Telegram:", error);
        }
      }

      res.json(challenge);
    } catch (error: any) {
      console.error("❌ Error creating admin challenge:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        stack: error?.stack,
      });
      res.status(500).json({ 
        message: "Failed to create admin challenge",
        error: error?.message || "Unknown error"
      });
    }
  });
        


  // Get challenges awaiting admin resolution (pending_admin status)
  app.get('/api/admin/challenges/pending', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const allChallenges = await storage.getAllChallenges(1000); // Get more to filter
      const pendingChallenges = allChallenges.filter((c: any) => c.status === 'pending_admin');
      res.json(pendingChallenges);
    } catch (error) {
      console.error("Error fetching pending challenges:", error);
      res.status(500).json({ message: "Failed to fetch pending challenges" });
    }
  });

  app.post('/api/admin/challenges/:id/result', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const { result } = req.body; // 'challenger_won', 'challenged_won', or 'draw'

      if (!['challenger_won', 'challenged_won', 'draw'].includes(result)) {
        return res.status(400).json({ message: "Invalid result. Must be 'challenger_won', 'challenged_won', or 'draw'" });
      }

      // Set challenge result (returns immediately)
      const challenge = await storage.adminSetChallengeResult(challengeId, result);
      
      // Get challenger and challenged user info for notifications
      const challengerUser = challenge.challenger ? await storage.getUser(challenge.challenger) : null;
      const challengedUser = challenge.challenged ? await storage.getUser(challenge.challenged) : null;
      
      // For draws, notify both users and return
      if (result === 'draw') {
        const drawMessage = `Challenge "${challenge.title}" ended in a draw. Your stake has been returned to your wallet.`;
        
        if (challenge.challenger) {
          await storage.createNotification({
            userId: challenge.challenger,
            type: 'challenge_draw',
            title: '🤝 Challenge Draw',
            message: drawMessage,
            data: {
              challengeId: challenge.id,
              title: challenge.title,
              result: 'draw'
            },
          });
        }
        
        if (challenge.challenged) {
          await storage.createNotification({
            userId: challenge.challenged,
            type: 'challenge_draw',
            title: '🤝 Challenge Draw',
            message: drawMessage,
            data: {
              challengeId: challenge.id,
              title: challenge.title,
              result: 'draw'
            },
          });
        }
        
        return res.json({ 
          challenge,
          message: 'Challenge result set to draw. Stakes have been returned to participants.'
        });
      }
      
      // Notify winner and loser for non-draw results
      const winnerId = result === 'challenger_won' ? challenge.challenger : challenge.challenged;
      const loserId = result === 'challenger_won' ? challenge.challenged : challenge.challenger;
      const winnerUser = result === 'challenger_won' ? challengerUser : challengedUser;
      const loserUser = result === 'challenger_won' ? challengedUser : challengerUser;
      
      if (winnerId && winnerUser) {
        await storage.createNotification({
          userId: winnerId,
          type: 'challenge_won',
          title: '🏆 You Won!',
          message: `Congratulations! You won the challenge "${challenge.title}". Your payout is being processed.`,
          data: {
            challengeId: challenge.id,
            title: challenge.title,
            result: result
          },
        });
      }
      
      if (loserId && loserUser) {
        await storage.createNotification({
          userId: loserId,
          type: 'challenge_lost',
          title: '❌ Challenge Lost',
          message: `You didn't win "${challenge.title}". Better luck next time!`,
          data: {
            challengeId: challenge.id,
            title: challenge.title,
            result: result
          },
        });
      }

      // Trigger FOMO Challenge Completion Notifications
      try {
        const { challengeNotificationTriggers } = await import('./challengeNotificationTriggers');
        const winningSide = result === 'challenger_won' ? 'YES' : (result === 'challenged_won' ? 'NO' : 'DRAW');
        challengeNotificationTriggers.onChallengeCompleted(String(challenge.id), winningSide).catch(err => {
          console.error('Error triggering challenge completion notifications:', err);
        });
      } catch (notifErr) {
        console.error('Failed to import challengeNotificationTriggers:', notifErr);
      }

      // Settlement for admin-created challenges with Treasury matches
      if (challenge.adminCreated && result !== 'draw') {
        try {
          const { settleChallengeTreasuryMatches } = await import('./treasurySettlementWorker');
          const challengeResult = result === 'challenger_won'; // true if YES wins
          
          const settlementResult = await settleChallengeTreasuryMatches(
            challengeId,
            challengeResult,
            req.user?.id // Pass admin ID for notifications
          );

          if (settlementResult.settled > 0) {
            console.log(
              `✅ Treasury settlement complete: ${settlementResult.settled} matches, Net: ₦${settlementResult.netProfit.toLocaleString()}`
            );
          }
        } catch (treasuryErr) {
          console.error('Error settling Treasury matches:', treasuryErr);
          // Don't fail the entire endpoint if Treasury settlement fails
        }
      }

      // Create payout job for non-draw results (non-blocking)
      let payoutJobId = null;
      try {
        // Get all YES and NO side stakers for this challenge
        const yesStakers = await db.select().from(challenges)
          .where(eq(challenges.id, challengeId));

        if (yesStakers.length === 0) {
          throw new Error('Challenge not found');
        }

        const challengeData = yesStakers[0];
        
        // Get all pair queue entries (stakers) for this challenge
        const stakers = await db.select().from(pairQueue)
          .where(eq(pairQueue.challengeId, challengeId as any));

        // Determine winners based on result
        const winners: Array<{ userId: string; amount: bigint }> = [];
        
        let winningTeam = result === 'challenger_won' ? 'YES' : 'NO';
        let totalWinningStake = 0n;
        let totalLosing = 0n;

        // Calculate totals and build winners list
        for (const staker of stakers) {
          const stakeAmount = BigInt(staker.stakeAmount || 0);
          if (staker.side === winningTeam && staker.status === 'matched') {
            totalWinningStake += stakeAmount;
            winners.push({ userId: staker.userId, amount: stakeAmount }); // Temp, will adjust in worker
          } else {
            totalLosing += stakeAmount;
          }
        }

        if (winners.length === 0) {
          // No winners found - shouldn't happen
          return res.json({ 
            challenge,
            message: 'Challenge result set but no stakers found to pay out.'
          });
        }

        // Calculate total pool and fee
        const totalPool = totalWinningStake + totalLosing;
        const platformFee = BigInt(Math.floor(Number(totalPool) * 0.05)); // 5% fee
        const winnerPool = totalPool - platformFee;

        // Distribute equally among winners
        const amountPerWinner = winnerPool / BigInt(winners.length);
        const remainder = winnerPool % BigInt(winners.length);

        const payoutWinners = winners.map((w, i) => ({
          userId: w.userId,
          amount: Number(amountPerWinner + BigInt(i === 0 ? remainder : 0)) // Give remainder to first winner
        }));

        // Create payout job
        payoutJobId = await payoutQueue.createPayoutJob(
          challengeId,
          payoutWinners,
          Number(totalPool),
          Number(platformFee)
        );
        
        // Trigger immediate processing (first batch)
        payoutWorker.triggerImmediate(payoutJobId);
        
        console.log(`Created payout job ${payoutJobId} for challenge ${challengeId} with ${payoutWinners.length} winners`);
      } catch (payoutError) {
        console.error(`Error creating payout job for challenge ${challengeId}:`, payoutError);
        // Don't fail the request, just log the error
      }

      res.json({ 
        challenge, 
        payoutJobId,
        message: `Challenge result set to ${result}. Payouts queued for processing.`
      });
    } catch (error) {
      console.error("Error setting challenge result:", error);
      res.status(500).json({ message: error.message || "Failed to set challenge result" });
    }
  });

  // Get escrow status for a specific challenge
  app.get('/api/admin/challenges/:id/escrow', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      if (isNaN(challengeId)) return res.status(400).json({ message: 'Invalid challenge id' });
      const escrowStatus = await storage.getChallengeEscrowStatus(challengeId);
      res.json(escrowStatus);
    } catch (error) {
      console.error('Error fetching escrow status:', error);
      res.status(500).json({ message: 'Failed to fetch escrow status' });
    }
  });

  // Get payout job status
  app.get('/api/admin/payout-jobs/:jobId/status', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const jobId = req.params.jobId;
      const jobStatus = await payoutQueue.getJobStatus(jobId);
      
      if (!jobStatus) {
        return res.status(404).json({ message: 'Payout job not found' });
      }
      
      // Calculate progress percentage
      const progressPercent = jobStatus.totalWinners > 0 
        ? Math.round((jobStatus.processedWinners / jobStatus.totalWinners) * 100)
        : 0;
      
      res.json({
        jobId: jobStatus.id,
        challengeId: jobStatus.challengeId,
        status: jobStatus.status,
        totalWinners: jobStatus.totalWinners,
        processedWinners: jobStatus.processedWinners,
        progressPercent,
        createdAt: jobStatus.createdAt,
        completedAt: jobStatus.completedAt,
        error: jobStatus.error
      });
    } catch (error) {
      console.error('Error fetching payout job status:', error);
      res.status(500).json({ message: 'Failed to fetch payout job status' });
    }
  });

  app.delete('/api/admin/challenges/:id', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      await storage.deleteChallenge(challengeId);
      res.json({ message: "Challenge deleted successfully" });
    } catch (error) {
      console.error("Error deleting challenge:", error);
      res.status(500).json({ message: "Failed to delete challenge" });
    }
  });

  // Toggle challenge pin status
  app.patch('/api/admin/challenges/:id/pin', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const { isPinned } = req.body;
      
      const updatedChallenge = await db.update(challenges)
        .set({ isPinned })
        .where(eq(challenges.id, challengeId))
        .returning();

      if (updatedChallenge.length === 0) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      res.json({
        message: isPinned ? "Challenge pinned to the top" : "Challenge unpinned",
        isPinned,
        challenge: updatedChallenge[0]
      });
    } catch (error) {
      console.error("Error toggling challenge pin:", error);
      res.status(500).json({ message: "Failed to toggle challenge pin status" });
    }
  });

  // Get all escrow data and statistics
  app.get('/api/admin/escrow', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challenges = await storage.getAllEscrowData(100);
      const stats = await storage.getEscrowStats();
      res.json({
        stats,
        challenges
      });
    } catch (error) {
      console.error('Error fetching escrow data:', error);
      res.status(500).json({ message: 'Failed to fetch escrow data' });
    }
  });

  // Get escrow statistics summary
  app.get('/api/admin/escrow/stats', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const stats = await storage.getEscrowStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching escrow stats:', error);
      res.status(500).json({ message: 'Failed to fetch escrow stats' });
    }
  });

  // Get detailed escrow data for a specific challenge
  app.get('/api/admin/escrow/challenge/:id', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const escrowData = await storage.getDetailedEscrowData(challengeId);
      res.json(escrowData);
    } catch (error) {
      console.error('Error fetching detailed escrow data:', error);
      res.status(500).json({ message: 'Failed to fetch escrow details' });
    }
  });

  // Update challenge (admin editable fields at any time)
  app.put('/api/admin/challenges/:id', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const {
        title,
        description,
        isVisible,
        endDate,
        coverImageUrl,
        category,
        amount,
        status,
        bonusSide,
        bonusAmount,
        bonusMultiplier,
        bonusEndsAt,
        earlyBirdSlots,
        earlyBirdBonus,
        streakBonusEnabled,
        convictionBonusEnabled,
        firstTimeBonusEnabled,
        socialTagBonus,
      } = req.body;

      // Build update object - only update provided fields
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (isVisible !== undefined) updates.isVisible = isVisible;
      if (endDate !== undefined) updates.dueDate = endDate ? new Date(endDate) : null;
      if (coverImageUrl !== undefined) updates.coverImageUrl = coverImageUrl;
      if (category !== undefined) updates.category = category;
      if (amount !== undefined) updates.amount = String(amount);
      
      const oldStatus = (await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1))[0]?.status;
      if (status !== undefined) updates.status = status;

      // Bonus related fields
      if (bonusSide !== undefined) updates.bonusSide = bonusSide;
      if (bonusAmount !== undefined) updates.bonusAmount = bonusAmount;
      if (bonusMultiplier !== undefined) updates.bonusMultiplier = bonusMultiplier;
      if (bonusEndsAt !== undefined) updates.bonusEndsAt = bonusEndsAt ? new Date(bonusEndsAt) : null;

      // Other optional bonus/feature flags
      if (earlyBirdSlots !== undefined) updates.earlyBirdSlots = earlyBirdSlots;
      if (earlyBirdBonus !== undefined) updates.earlyBirdBonus = earlyBirdBonus;
      if (streakBonusEnabled !== undefined) updates.streakBonusEnabled = streakBonusEnabled;
      if (convictionBonusEnabled !== undefined) updates.convictionBonusEnabled = convictionBonusEnabled;
      if (firstTimeBonusEnabled !== undefined) updates.firstTimeBonusEnabled = firstTimeBonusEnabled;
      if (socialTagBonus !== undefined) updates.socialTagBonus = socialTagBonus;

      const updatedChallenge = await storage.updateChallenge(challengeId, updates);

      // Trigger status-based notifications if status changed
      if (status !== undefined && status !== oldStatus) {
        try {
          const { challengeNotificationTriggers } = await import('./challengeNotificationTriggers');
          if (status === 'pending_admin') {
            await challengeNotificationTriggers.onChallengePendingAdmin(String(challengeId));
          } else if (status === 'completed') {
            // Note: usually handled by payout or result route, but here for manual admin override
            await challengeNotificationTriggers.onChallengeCompleted(String(challengeId), 'DRAW');
          } else if (status === 'cancelled') {
            await challengeNotificationTriggers.onChallengeCancelled(String(challengeId), 'Admin update');
          }
        } catch (notifErr) {
          console.error('Error triggering status change notification:', notifErr);
        }
      }

      res.json(updatedChallenge);
    } catch (error) {
      console.error("Error updating challenge:", error);
      res.status(500).json({ message: "Failed to update challenge" });
    }
  });

  // Toggle challenge visibility
  app.patch('/api/admin/challenges/:id/visibility', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const { isVisible } = req.body;

      if (isVisible === undefined) {
        return res.status(400).json({ message: "Missing field: isVisible" });
      }

      const updatedChallenge = await storage.updateChallenge(challengeId, { isVisible });
      res.json({
        message: `Challenge ${isVisible ? 'unhidden' : 'hidden'} successfully`,
        challenge: updatedChallenge,
      });
    } catch (error) {
      console.error("Error toggling challenge visibility:", error);
      res.status(500).json({ message: "Failed to toggle challenge visibility" });
    }
  });

  // Admin Wallet - Get balance and stats
  app.get('/api/admin/wallet', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const adminId = req.user.id;
      const admin = await db.query.users.findFirst({
        where: eq(users.id, adminId),
      });

      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }

      // Get transaction history
      const transactions = await db.query.adminWalletTransactions.findMany({
        where: eq(adminWalletTransactions.adminId, adminId),
        orderBy: (t) => sql`${t.createdAt} DESC`,
        limit: 50,
      });

      res.json({
        balance: parseFloat(String(admin.adminWalletBalance || '0')),
        totalCommission: parseFloat(String(admin.adminTotalCommission || '0')),
        totalBonusesGiven: parseFloat(String(admin.adminTotalBonusesGiven || '0')),
        transactions,
      });
    } catch (error) {
      console.error("Error fetching admin wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet details" });
    }
  });

  // Admin Wallet - Load funds (from Paystack)
  app.post('/api/admin/wallet/load', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const { amount } = req.body;
      const adminId = req.user.id;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      if (!process.env.PAYSTACK_SECRET_KEY) {
        console.error("PAYSTACK_SECRET_KEY environment variable not set");
        return res.status(500).json({ message: "Payment service not configured" });
      }

      console.log("Initializing Paystack transaction for admin:", adminId, "amount:", amount);

      // Generate unique reference
      const uniqueRef = `adm_load_${adminId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Initialize Paystack transaction
      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: "admin@betchat.com",
          amount: amount * 100, // Paystack expects amount in kobo
          currency: 'NGN',
          reference: uniqueRef,
          metadata: {
            adminId,
            type: 'admin_load'
          }
        })
      });

      const paystackData = await paystackResponse.json();
      console.log("Paystack response:", paystackData);

      if (!paystackData.status) {
        console.error("Paystack error:", paystackData);
        return res.status(400).json({ message: paystackData.message || "Failed to initialize payment" });
      }

      console.log("Sending authorization URL:", paystackData.data.authorization_url);
      res.json({ 
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
      });
    } catch (error) {
      console.error("Error processing admin wallet load:", error);
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  // Admin Wallet - Verify payment
  app.post('/api/admin/wallet/verify-payment', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const { reference } = req.body;
      const adminId = req.user.id;

      if (!reference) {
        return res.status(400).json({ message: "Reference is required" });
      }

      console.log(`Admin payment verification requested for reference: ${reference} by admin: ${adminId}`);

      if (!process.env.PAYSTACK_SECRET_KEY) {
        console.error("PAYSTACK_SECRET_KEY not set");
        return res.status(500).json({ message: "Payment service not configured" });
      }

      // Verify payment with Paystack
      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        }
      });

      const verifyData = await verifyResponse.json();
      console.log('Paystack verification response:', {
        status: verifyData.status,
        data: verifyData.data ? {
          status: verifyData.data.status,
          amount: verifyData.data.amount,
          reference: verifyData.data.reference,
          metadata: verifyData.data.metadata
        } : null
      });

      if (verifyData.status && verifyData.data && verifyData.data.status === 'success') {
        const { amount, metadata, reference: txRef } = verifyData.data;
        const depositAmount = amount / 100; // Convert from kobo to naira

        console.log(`Processing admin payment verification:`, {
          amount: depositAmount,
          metadata,
          reference: txRef,
          adminId
        });

        // Validate the admin matches
        if (metadata && metadata.adminId === adminId) {
          const admin = await db.query.users.findFirst({
            where: eq(users.id, adminId),
          });

          if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
          }

          // Check if transaction already exists by reference
          const existingTransactions = await db.query.adminWalletTransactions.findMany({
            where: eq(adminWalletTransactions.adminId, adminId),
          });

          const exists = existingTransactions.some((t: any) => 
            t.reference === reference || 
            t.reference === txRef
          );

          if (exists) {
            return res.status(400).json({ message: "This payment has already been processed" });
          }

          const currentBalance = parseFloat(String(admin.adminWalletBalance || '0'));
          const newBalance = currentBalance + depositAmount;

          // Update admin wallet balance
          await db
            .update(users)
            .set({ adminWalletBalance: newBalance.toString() })
            .where(eq(users.id, adminId));

          // Log transaction
          await db.insert(adminWalletTransactions).values({
            adminId,
            type: 'fund_load',
            amount: depositAmount.toString(),
            description: `Funds loaded via Paystack`,
            reference: reference,
            status: 'completed',
            balanceBefore: currentBalance.toString(),
            balanceAfter: newBalance.toString(),
          });

          console.log(`Admin payment verified and processed successfully`);
          return res.json({
            message: 'Payment verified and balance updated',
            balance: newBalance,
          });
        } else {
          return res.status(400).json({ message: "Payment verification failed: Admin mismatch" });
        }
      } else {
        return res.status(400).json({ message: "Payment not successful or already processed" });
      }
    } catch (error) {
      console.error("Error verifying admin payment:", error);
      res.status(500).json({ message: "Failed to verify payment" });
    }
  });

  // Admin Wallet - Withdraw funds
  app.post('/api/admin/wallet/withdraw', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const { amount } = req.body;
      const adminId = req.user.id;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      if (!process.env.PAYSTACK_SECRET_KEY) {
        console.error("PAYSTACK_SECRET_KEY environment variable not set");
        return res.status(500).json({ message: "Payment service not configured" });
      }

      const admin = await db.query.users.findFirst({
        where: eq(users.id, adminId),
      });

      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }

      const currentBalance = parseFloat(String(admin.adminWalletBalance || '0'));

      if (currentBalance < amount) {
        return res.status(400).json({ 
          message: `Insufficient balance. Have ₦${currentBalance.toLocaleString()}, need ₦${amount.toLocaleString()}` 
        });
      }

      // For production: Check if admin has bank details stored
      // TODO: Store and retrieve admin's bank account details
      // For now, return message that they need to set up their bank account
      
      console.log(`Processing withdrawal for admin ${adminId}: ₦${amount}`);

      // Deduct from balance first
      const newBalance = currentBalance - amount;

      await db
        .update(users)
        .set({ adminWalletBalance: newBalance.toString() })
        .where(eq(users.id, adminId));

      // Generate withdrawal reference
      const withdrawalRef = `adm_withdrawal_${adminId}_${Date.now()}`;

      // Log transaction as pending (awaiting bank processing)
      await db.insert(adminWalletTransactions).values({
        adminId,
        type: 'withdrawal',
        amount: amount.toString(),
        description: `Withdrawal from admin wallet to bank account`,
        reference: withdrawalRef,
        status: 'pending',
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
      });

      // In production, this would:
      // 1. Create transfer recipient in Paystack using stored bank details
      // 2. Initiate transfer using Paystack Transfer API
      // 3. Update transaction status to 'processing'
      // 4. Handle webhooks for transfer completion
      
      // For now, return pending status with instructions
      res.json({
        message: 'Withdrawal initiated - funds pending to your registered bank account',
        amount: amount,
        balance: newBalance,
        reference: withdrawalRef,
        status: 'pending',
        note: 'This withdrawal will be processed to your bank account. Please allow 1-3 business days for the funds to arrive.'
      });
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // Activate bonus for imbalanced challenge
  app.post('/api/admin/challenges/bonus', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const { challengeId, bonusSide, bonusMultiplier, durationHours, bonusAmount } = req.body;
      const adminId = req.user.id;

      // Validate required fields
      if (!challengeId || !bonusSide || !bonusMultiplier || !durationHours) {
        return res.status(400).json({ message: "Missing required fields: challengeId, bonusSide, bonusMultiplier, durationHours" });
      }

      // Validate bonus side
      if (!['YES', 'NO'].includes(bonusSide)) {
        return res.status(400).json({ message: "Invalid bonus side. Must be 'YES' or 'NO'" });
      }

      // Validate multiplier range
      if (bonusMultiplier < 1.0 || bonusMultiplier > 5.0) {
        return res.status(400).json({ message: "Bonus multiplier must be between 1.0 and 5.0" });
      }

      // Check admin wallet balance
      const admin = await db.query.users.findFirst({
        where: eq(users.id, adminId),
      });

      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }

      const adminBalance = parseFloat(String(admin.adminWalletBalance || '0'));
      const bonusAmountNum = bonusAmount || 0;

      if (bonusAmountNum > 0 && adminBalance < bonusAmountNum) {
        return res.status(400).json({ 
          message: `Insufficient wallet balance. Need ₦${bonusAmountNum.toLocaleString()}, but only have ₦${adminBalance.toLocaleString()}` 
        });
      }

      // Calculate bonus end time
      const bonusEndsAt = new Date();
      bonusEndsAt.setHours(bonusEndsAt.getHours() + durationHours);

      // Deduct from admin wallet if bonus amount specified
      if (bonusAmountNum > 0) {
        const newBalance = adminBalance - bonusAmountNum;
        const totalGiven = parseFloat(String(admin.adminTotalBonusesGiven || '0')) + bonusAmountNum;

        await db
          .update(users)
          .set({
            adminWalletBalance: newBalance.toString(),
            adminTotalBonusesGiven: totalGiven.toString(),
          })
          .where(eq(users.id, adminId));

        // Log the transaction
        await db.insert(adminWalletTransactions).values({
          adminId,
          type: 'bonus_sent',
          amount: bonusAmountNum.toString(),
          description: `Bonus sent to challenge #${challengeId}: ${bonusMultiplier}x multiplier on ${bonusSide} side`,
          relatedId: challengeId,
          relatedType: 'challenge',
          balanceBefore: adminBalance.toString(),
          balanceAfter: newBalance.toString(),
        });
      }

      // Update challenge with bonus
      const updatedChallenge = await storage.activateChallengeBonus(challengeId, {
        bonusSide,
        bonusMultiplier: bonusMultiplier.toString(),
        bonusAmount: bonusAmount || 0,
        bonusEndsAt,
      });

      res.json({ 
        challenge: updatedChallenge,
        message: `Bonus activated for ${bonusSide} side: ${bonusMultiplier}x multiplier for ${durationHours} hours`
      });
    } catch (error) {
      console.error("Error activating bonus:", error);
      res.status(500).json({ message: error.message || "Failed to activate bonus" });
    }
  });

  // Admin transactions - list recent transactions across platform
  app.get('/api/admin/transactions', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

      const txs = await db
        .select({
          id: transactions.id,
          userId: transactions.userId,
          type: transactions.type,
          amount: transactions.amount,
          status: transactions.status,
          description: transactions.description,
          createdAt: transactions.createdAt,
          username: users.username,
          email: users.email,
        })
        .from(transactions)
        .leftJoin(users, eq(transactions.userId, users.id))
        .orderBy(desc(transactions.createdAt))
        .limit(limit);

      res.json(txs);
    } catch (error) {
      console.error('Error fetching admin transactions:', error);
      res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  });

  // Admin statistics routes

  // Get current admin users
  app.get('/api/admin/list', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const admins = await storage.getAdminUsers();
      res.json(admins);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch admin users" });
    }
  });

  // Smart Search API
  app.get('/api/search', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { q: searchTerm } = req.query;

      if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.length < 3) {
        return res.json([]);
      }

      const userId = getUserId(req);
      const search = `%${searchTerm.toLowerCase()}%`;

      // Search events
      const eventResults = await db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          imageUrl: events.image_url,
          createdAt: events.createdAt,
          status: events.status,
        })
        .from(events)
        .where(
          sql`LOWER(${events.title}) LIKE ${search} OR LOWER(${events.description}) LIKE ${search}`
        )
        .limit(5);

      // Search challenges  
      const challengeResults = await db
        .select({
          id: challenges.id,
          title: challenges.title,
          description: challenges.description,
          amount: challenges.amount,
          createdAt: challenges.createdAt,
          status: challenges.status,
        })
        .from(challenges)
        .where(
          sql`LOWER(${challenges.title}) LIKE ${search} OR LOWER(${challenges.description}) LIKE ${search}`
        )
        .limit(5);

      // Search users
      const userResults = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(
          sql`LOWER(${users.username}) LIKE ${search} OR LOWER(${users.firstName}) LIKE ${search}`
        )
        .limit(5);

      // Format results
      const results = [
        ...eventResults.map(event => ({
          id: event.id.toString(),
          type: 'event' as const,
          title: event.title,
          description: event.description,
          imageUrl: event.imageUrl,
          createdAt: event.createdAt,
          status: event.status,
          participantCount: 0, // TODO: Add participant count query
        })),
        ...challengeResults.map(challenge => ({
          id: challenge.id.toString(),
          type: 'challenge' as const,
          title: challenge.title,
          description: challenge.description,
          amount: Number(challenge.amount),
          createdAt: challenge.createdAt,
          status: challenge.status,
        })),
        ...userResults.map(user => ({
          id: user.id,
          type: 'user' as const,
          title: user.firstName || user.username || 'Unknown User',
          username: user.username,
          createdAt: user.createdAt,
        })),
      ];

      // Sort by relevance and creation date
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(results.slice(0, 10));
    } catch (error) {
      console.error("Error performing search:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Public profile routes (no authentication required)
  app.get('/api/public/profile/:username', async (req, res) => {
    try {
      const { username } = req.params;

      // Get user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user stats
      const stats = await storage.getUserStats(user.id);

      // Return public profile data (excluding sensitive information)
      const publicProfile = {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        profileImageUrl: user.profileImageUrl,
        level: user.level,
        xp: user.xp,
        streak: user.streak,
        createdAt: user.createdAt,
        stats: {
          wins: stats.wins || 0,
          activeChallenges: stats.activeChallenges || 0,
          totalEarnings: stats.totalEarnings || 0,
        }
      };

      res.json(publicProfile);
    } catch (error) {
      console.error("Error fetching public profile:", error);
      res.status(500).json({ message: "Failed to fetch public profile" });
    }
  });

  app.get('/api/public/achievements/:username', async (req, res) => {
    try {
      const { username } = req.params;

      // Get user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user achievements
      const achievements = await storage.getUserAchievements(user.id);
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching public achievements:", error);
      res.status(500).json({ message: "Failed to fetch public achievements" });
    }
  });

  app.get('/api/public/events/:username', async (req, res) => {
    try {
      const { username } = req.params;

      // Get user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's public events (recent 10)
      const events = await storage.getUserCreatedEvents(user.id);

      // Filter out private events and return only public data
      const publicEvents = events
        .filter((event: any) => !event.isPrivate)
        .slice(0, 10)
        .map((event: any) => ({
          id: event.id,
          title: event.title,
          category: event.category,
          status: event.status,
          createdAt: event.createdAt,
          endDate: event.endDate,
        }));

      res.json(publicEvents);
    } catch (error) {
      console.error("Error fetching public events:", error);
      res.status(500).json({ message: "Failed to fetch public events" });
    }
  });

  // Redirect old /u/:username format to new /@username format
  app.get('/u/:username', async (req, res) => {
    const { username } = req.params;
    res.redirect(301, `/@${username}`);
  });

  // Server-side route for events/:id with OG metadata for social sharing
  app.get('/events/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      // Check if this is likely a social media crawler
      const userAgent = req.get('User-Agent') || '';
      console.log(`[EVENTS ROUTE] Event ${id}, User-Agent: ${userAgent}`);

      const isCrawler = userAgent.includes('facebookexternalhit') || 
                       userAgent.includes('Twitterbot') || 
                       userAgent.includes('LinkedInBot') ||
                       userAgent.includes('WhatsApp') ||
                       userAgent.includes('TelegramBot') ||
                       userAgent.includes('SkypeUriPreview');

      console.log(`[EVENTS ROUTE] isCrawler: ${isCrawler}`);

      if (isCrawler) {
        console.log(`[EVENTS ROUTE] Generating OG meta for event ${id}`);
        const ogMeta = await generateEventOGMeta(id, baseUrl);
        console.log(`[EVENTS ROUTE] Generated OG meta:`, ogMeta.title);

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${ogMeta.title}</title>
    ${generateOGMetaTags(ogMeta)}
</head>
<body>
    <h1>${ogMeta.title}</h1>
    <p>${ogMeta.description}</p>
    <p><a href="${baseUrl}/events/${id}">View Event on Bantah</a></p>
</body>
</html>`;

        res.set('Content-Type', 'text/html');
        res.send(html);
        return;
      }

      // For regular browsers, serve the React app (will be handled by client-side routing)
      res.redirect(`/#/events/${id}`);
    } catch (error) {
      console.error('Error generating event page:', error);
      res.redirect('/#/events');
    }
  });

  app.get('/profile/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const ogMeta = await generateProfileOGMeta(userId, baseUrl);

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${generateOGMetaTags(ogMeta)}
    <script>
      // Redirect to main app
      window.location.href = '/#/profile/${userId}';
    </script>
</head>
<body>
    <p>Redirecting to Bantah...</p>
    <a href="/#/profile/${userId}">Click here if you're not redirected automatically</a>
</body>
</html>`;

      res.set('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('Error generating profile page:', error);
      res.redirect('/#/profile');
    }
  });

  // Stories API endpoints
  app.get('/api/stories', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const stories = await storage.getActiveStories();
      res.json(stories);
    } catch (error) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });

  app.post('/api/stories', isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const storyData = req.body;
      const story = await storage.createStory(storyData);
      res.json(story);
    } catch (error) {
      console.error("Error creating story:", error);
      res.status(500).json({ message: "Failed to create story" });
    }
  });

  app.patch('/api/stories/:id', isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const storyId = parseInt(req.params.id);
      const updates = req.body;
      const story = await storage.updateStory(storyId, updates);
      res.json(story);
    } catch (error) {
      console.error("Error updating story:", error);
      res.status(500).json({ message: "Failed to update story" });
    }
  });

  app.delete('/api/stories/:id', isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const storyId = parseInt(req.params.id);
      await storage.deleteStory(storyId);
      res.json({ message: "Story deleted successfully" });
    } catch (error) {
      console.error("Error deleting story:", error);
      res.status(500).json({ message: "Failed to delete story" });
    }
  });

  app.post('/api/stories/:id/view', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const storyId = parseInt(req.params.id);
      await storage.markStoryAsViewed(storyId, userId);
      res.json({ message: "Story marked as viewed" });
    } catch (error) {
      console.error("Error marking story as viewed:", error);
      res.status(500).json({ message: "Failed to mark story as viewed" });
    }
  });

  // Image upload route for event banners
  app.post('/api/upload/image', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;

      if (!req.files || !req.files.image) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      const imageFile = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(imageFile.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' });
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (imageFile.size > maxSize) {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
      }

      // Generate unique filename
      const fileExtension = imageFile.name.split('.').pop();
      const uniqueFilename = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExtension}`;
      const uploadPath = `./attached_assets/${uniqueFilename}`;

      // Move file to upload directory
      await imageFile.mv(uploadPath);

      // Return the image URL
      const imageUrl = `/attached_assets/${uniqueFilename}`;

      console.log(`Image uploaded successfully: ${imageUrl} by user ${userId}`);

      res.json({ 
        success: true, 
        imageUrl: imageUrl,
        filename: uniqueFilename
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ message: 'Failed to upload image' });
    }
  });

  // Serve uploaded images
  app.use('/attached_assets', (await import('express')).static('./attached_assets'));

  // Setup OG image generation routes
  setupOGImageRoutes(app, storage);

  // Add leaderboard endpoint
  app.get("/api/leaderboard", PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      console.log(`Leaderboard query returned ${leaderboard.length} users`);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Get user stats for performance comparison
  app.get("/api/performance-stats", PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Bant Map - Get all users with their category preferences for map visualization
  app.get("/api/bant-map", PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);

      // Get all active users with basic info
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          level: users.level,
          xp: users.xp,
          coins: users.coins,
          lastLogin: users.lastLogin,
        })
        .from(users)
        .where(eq(users.status, 'active'))
        .orderBy(desc(users.level), desc(users.xp));

      // Get current user's friends
      const userFriends = await db
        .select({
          requesterId: friends.requesterId,
          addresseeId: friends.addresseeId,
        })
        .from(friends)
        .where(
          and(
            or(eq(friends.requesterId, userId), eq(friends.addresseeId, userId)),
            eq(friends.status, "accepted")
          )
        );

      const friendIds = new Set(
        userFriends.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId)
      );

      // Get category preferences for each user based on their event participation
      const usersWithCategories = await Promise.all(
        allUsers.map(async (user) => {
          // Get user's most participated category
          const categoryStats = await db
            .select({
              category: events.category,
              count: sql<number>`count(*)`,
            })
            .from(eventParticipants)
            .innerJoin(events, eq(eventParticipants.eventId, events.id))
            .where(eq(eventParticipants.userId, user.id))
            .groupBy(events.category)
            .orderBy(desc(sql`count(*)`))
            .limit(1);

          const primaryCategory = categoryStats.length > 0 ? categoryStats[0].category : 'newcomer';
          const isFriend = friendIds.has(user.id);
          const isCurrentUser = user.id === userId;

          return {
            ...user,
            primaryCategory,
            isFriend,
            isCurrentUser,
          };
        })
      );

      res.json(usersWithCategories);
    } catch (error) {
      console.error("Error fetching bant map data:", error);
      res.status(500).json({ error: "Failed to fetch bant map data" });
    }
  });

  // Register all other routes
  app.use('/api/notifications', notificationsApi);
  app.use('/api/admin/notifications', adminNotificationsApi);
  app.use('/api', ogMetadataRouter);

  // ============ PAIRING ENGINE ROUTES ============
  // Queue-based challenge matching with deterministic FCFS algorithm
  
  const pairingEngine = createPairingEngine(db);

  // Join challenge queue (FCFS matching with ±20% stake tolerance)
  app.post('/api/challenges/:id/queue/join', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const challengeId = req.params.id; // UUID as string
      const userId = req.user.claims.sub;
      const { side, stakeAmount } = req.body; // side: "YES" | "NO", stakeAmount: number (coins)

      // Validate input
      if (!['YES', 'NO'].includes(side)) {
        return res.status(400).json({ message: "Invalid side. Must be 'YES' or 'NO'" });
      }

      if (!stakeAmount || stakeAmount <= 0 || !Number.isInteger(stakeAmount)) {
        return res.status(400).json({ message: "Invalid stake amount. Must be positive integer" });
      }

      // Check user balance
      const user = await storage.getUser(userId);
      if (!user || user.coins < stakeAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Join queue (handles atomicity and matching)
      const result = await pairingEngine.joinChallenge(userId, challengeId, side, stakeAmount);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // If match found, deduct stakes from both users
      if (result.match) {
        try {
          // Deduct from user 1
          await storage.createTransaction({
            userId: result.match.user1Id,
            type: 'challenge_queue_stake',
            amount: `-${result.match.user1Id === userId ? stakeAmount : stakeAmount}`,
            description: `Challenge queue stake (Challenge #${challengeId})`,
            relatedId: challengeId,
            status: 'completed',
          });

          // Deduct from user 2
          await storage.createTransaction({
            userId: result.match.user2Id,
            type: 'challenge_queue_stake',
            amount: `-${result.match.user2Id === userId ? stakeAmount : stakeAmount}`,
            description: `Challenge queue stake (Challenge #${challengeId})`,
            relatedId: challengeId,
            status: 'completed',
          });

          res.json({
            ...result,
            message: 'Match found! Stakes locked in escrow.',
            escrowId: result.match.escrowId,
            totalPot: result.match.amount,
          });
        } catch (err) {
          console.error('Transaction error:', err);
          res.status(500).json({ message: 'Match found but transaction failed' });
        }
      } else {
        // User added to queue, deduct stake and hold in escrow
        try {
          await storage.createTransaction({
            userId: userId,
            type: 'challenge_queue_stake',
            amount: `-${stakeAmount}`,
            description: `Challenge queue stake (Challenge #${challengeId}) - ${side}`,
            relatedId: challengeId,
            status: 'completed',
          });

          res.json({
            ...result,
            message: `Added to ${side} queue. Your stake is held in escrow.`,
            queuePosition: result.queuePosition,
          });
        } catch (err) {
          console.error('Transaction error:', err);
          res.status(500).json({ message: 'Added to queue but transaction failed' });
        }
      }
    } catch (error) {
      console.error('Queue join error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to join queue' });
    }
  });

  // Cancel queue entry (only if not yet matched)
  app.post('/api/challenges/:id/queue/cancel', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const challengeId = req.params.id; // UUID as string
      const userId = req.user.claims.sub;

      const result = await pairingEngine.cancelFromQueue(userId, challengeId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('Queue cancel error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to cancel queue entry' });
    }
  });

  // Get queue status for a challenge
  app.get('/api/challenges/:id/queue/status', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const challengeId = req.params.id; // UUID as string

      const overview = await pairingEngine.getChallengeOverview(challengeId);
      
      res.json(overview);
    } catch (error) {
      console.error('Queue status error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to get queue status' });
    }
  });

  // Get user's status in a challenge queue
  app.get('/api/challenges/:id/queue/user-status', PrivyAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const challengeId = req.params.id; // UUID as string
      const userId = req.user.claims.sub;

      const status = await pairingEngine.getUserStatus(userId, challengeId);
      
      res.json(status);
    } catch (error) {
      console.error('User status error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to get user status' });
    }
  });

  // Manual trigger: Expire a challenge (admin only)
  // Refunds all waiting users and closes the challenge
  app.post('/api/admin/challenges/:id/expire', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = req.params.id;

      const result = await pairingEngine.expireChallenge(challengeId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        message: result.message,
        refundedCount: result.refundedCount,
        challengeId: challengeId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Challenge expire error:', error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : 'Failed to expire challenge' 
      });
    }
  });

  // ===== TREASURY MANAGEMENT ENDPOINTS =====

  // Get imbalance status for a challenge (for Admin Dashboard)
  app.get('/api/admin/challenges/:id/imbalance', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id, 10);
      const { getChallengeImbalance } = await import('./treasuryManagement');
      
      const imbalance = await getChallengeImbalance(challengeId);
      res.json(imbalance);
    } catch (error) {
      console.error('Get imbalance error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get imbalance' 
      });
    }
  });

  // Create Treasury configuration for a challenge
  app.post('/api/admin/challenges/:id/treasury-config', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id, 10);
      const { maxTreasuryRisk, adminNotes } = req.body;

      if (!maxTreasuryRisk || maxTreasuryRisk <= 0) {
        return res.status(400).json({ 
          message: 'maxTreasuryRisk must be a positive number' 
        });
      }

      const { createTreasuryChallengeConfig } = await import('./treasuryManagement');
      const config = await createTreasuryChallengeConfig(
        challengeId,
        maxTreasuryRisk,
        adminNotes
      );

      res.json({
        success: true,
        config,
        message: `Treasury config created: max risk ₦${maxTreasuryRisk}`,
      });
    } catch (error) {
      console.error('Create Treasury config error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create Treasury config' 
      });
    }
  });

  // Execute Treasury match fulfillment (the "Match All" button)
  app.post('/api/admin/challenges/:id/fulfill-treasury', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const challengeId = parseInt(req.params.id, 10);
      const { matchCount, sideToFill } = req.body;
      const adminId = req.user?.id; // Get admin ID from auth

      if (!matchCount || matchCount <= 0) {
        return res.status(400).json({ 
          message: 'matchCount must be a positive number' 
        });
      }

      if (!sideToFill || !['YES', 'NO'].includes(sideToFill)) {
        return res.status(400).json({ 
          message: 'sideToFill must be either "YES" or "NO"' 
        });
      }

      const { fulfillTreasuryMatches } = await import('./treasuryManagement');
      const result = await fulfillTreasuryMatches(
        challengeId,
        matchCount,
        sideToFill,
        adminId // Pass admin ID for notifications
      );

      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Fulfill Treasury matches error:', error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fulfill Treasury matches' 
      });
    }
  });

  // Get Treasury dashboard summary (for admin overview)
  app.get('/api/admin/treasury/dashboard', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const { getTreasuryDashboardSummary } = await import('./treasuryManagement');
      const summary = await getTreasuryDashboardSummary();
      res.json(summary);
    } catch (error) {
      console.error('Get Treasury dashboard error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get Treasury dashboard' 
      });
    }
  });

  // Get Treasury wallet balance and summary
  app.get('/api/admin/treasury/wallet', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { getTreasuryWalletSummary, createOrGetTreasuryWallet } = await import('./treasuryWalletService');
      
      // Ensure wallet exists
      await createOrGetTreasuryWallet(adminId);
      const summary = await getTreasuryWalletSummary(adminId);

      res.json(summary);
    } catch (error) {
      console.error('Get Treasury wallet error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get Treasury wallet' 
      });
    }
  });

  // Initiate Paystack deposit to Treasury wallet
  app.post('/api/admin/treasury/wallet/deposit/initiate', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const adminId = req.user?.id;
      const { amount, email } = req.body;

      if (!adminId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Amount must be positive' });
      }

      if (!email) {
        return res.status(400).json({ message: 'Email required' });
      }

      // Initialize Paystack transaction
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: Math.round(amount * 100), // Convert to cents
          metadata: {
            type: 'treasury_wallet_deposit',
            adminId,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(400).json({ 
          message: 'Failed to initiate payment',
          error: data.message 
        });
      }

      res.json({
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        reference: data.data.reference,
      });
    } catch (error) {
      console.error('Initiate Treasury deposit error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to initiate deposit' 
      });
    }
  });

  // Verify Paystack payment and credit Treasury wallet
  app.post('/api/admin/treasury/wallet/deposit/verify', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const adminId = req.user?.id;
      const { reference } = req.body;

      if (!adminId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!reference) {
        return res.status(400).json({ message: 'Reference required' });
      }

      // Verify with Paystack
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.data || data.data.status !== 'success') {
        return res.status(400).json({ 
          message: 'Payment verification failed',
          error: data.message 
        });
      }

      // Credit Treasury wallet
      const { depositToTreasuryWallet } = await import('./treasuryWalletService');
      const amount = data.data.amount / 100; // Convert from cents
      
      const newBalance = await depositToTreasuryWallet(
        adminId,
        amount,
        reference
      );

      res.json({
        success: true,
        message: 'Treasury wallet credited successfully',
        amount,
        newBalance,
      });
    } catch (error) {
      console.error('Verify Treasury deposit error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to verify deposit' 
      });
    }
  });

  // Get Treasury wallet transaction history
  app.get('/api/admin/treasury/wallet/transactions', adminAuth, async (req: AdminAuthRequest, res) => {
    try {
      const adminId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!adminId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { getTreasuryWalletTransactions } = await import('./treasuryWalletService');
      const transactions = await getTreasuryWalletTransactions(adminId, limit);

      res.json(transactions);
    } catch (error) {
      console.error('Get Treasury wallet transactions error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get transactions' 
      });
    }
  });

  return httpServer;
}