# 🔔 FOMO Notification System - Implementation Guide

## Overview

This notification system implements a **FOMO-driven, event-based notification engine** for the Dynamic + Admin-Controlled Challenge platform. Designed to maximize user engagement through timely, personalized, urgency-driven notifications.

---

## Architecture

### Core Components

1. **FOSMNotificationService** (`notificationSystem.ts`)
   - Central service managing notification lifecycle
   - Handles creation, deduplication, and routing
   - Manages user preferences

2. **ChallengeNotificationTriggers** (`challengeNotificationTriggers.ts`)
   - Event-driven triggers for challenge lifecycle events
   - Implements all FOMO notification types
   - Manages notification timing and personalization

3. **Notification API** (`routes/notificationsApi.ts`)
   - REST endpoints for client-side notification management
   - Preference management
   - Read status tracking

4. **Database Schema** (`shared/schema.ts`)
   - `notifications` table: stores notification history
   - `userNotificationPreferences` table: stores user preferences

---

## Notification Types

### 1. Challenge Lifecycle Notifications

#### New Challenge Created
- **Type**: `NEW_CHALLENGE_CREATED`
- **Trigger**: When admin creates new challenge
- **Audience**: All active users
- **Channels**: Push + In-App Feed
- **FOMO Level**: HIGH
- **Example**: "⚡ New Challenge: Friday Showdown! YES side pays up to 2.5×. Join before it fills!"

#### Challenge About to Start
- **Type**: `CHALLENGE_ABOUT_TO_START`
- **Trigger**: 5 minutes before challenge starts
- **Audience**: Challenge participants
- **Channels**: Push + In-App Feed
- **FOMO Level**: HIGH
- **Example**: "⏱ Starts in 5 mins! Don't miss your early bonus!"

#### Challenge Near End
- **Type**: `CHALLENGE_NEAR_END`
- **Trigger**: 5 minutes before challenge ends
- **Audience**: Non-participants
- **Channels**: Push + In-App Feed
- **FOMO Level**: URGENT
- **Example**: "⏳ Only 5 mins left! YES side still has +0.5× bonus"

### 2. User Activity Notifications

#### Friend Joined Challenge
- **Type**: `FRIEND_JOINED_CHALLENGE`
- **Trigger**: When a friend joins a challenge
- **Audience**: Mutual friends not yet joined
- **Channels**: In-App Feed + Push
- **FOMO Level**: MEDIUM
- **Example**: "👀 @Ayo just joined YES side in 'Friday Showdown'!"

#### Friend Won / Bonus Realized
- **Type**: `FRIEND_WON_BONUS`
- **Trigger**: When friend reaches bonus payout
- **Audience**: Mutual friends
- **Channels**: Push + In-App Feed
- **FOMO Level**: HIGH
- **Example**: "🎉 @Tunde earned 1.8× on NO side! You could still join!"

#### Pending Bonus Expiring
- **Type**: `PENDING_BONUS_EXPIRING`
- **Trigger**: 2 minutes before bonus window closes
- **Audience**: Users with active bonus window
- **Channels**: Push + In-App Feed
- **FOMO Level**: URGENT
- **Example**: "⚠️ Early join bonus ends in 2 mins!"

#### Your Side Is Lagging
- **Type**: `YOUR_SIDE_LAGGING`
- **Trigger**: Imbalance detected (one side has 60%+ of pool)
- **Audience**: Non-participants
- **Channels**: In-App Feed + Push
- **FOMO Level**: MEDIUM
- **Example**: "🔥 NO side is underdog! Earn +0.5× now"

### 3. Admin / System Event Notifications

#### Admin Bonus Surge Activated
- **Type**: `ADMIN_BONUS_SURGE_ACTIVATED`
- **Trigger**: When admin triggers bonus surge
- **Audience**: All active users
- **Channels**: Push + Telegram + In-App Feed
- **FOMO Level**: URGENT
- **Example**: "🚀 SURGE ACTIVE! NO side pays up to 3.0×. Limited time!"

#### Imbalance Detected
- **Type**: `IMBALANCE_DETECTED`
- **Trigger**: Pool imbalance exceeds 60/40 threshold
- **Audience**: All users
- **Channels**: Push + In-App Feed
- **FOMO Level**: MEDIUM
- **Example**: "⚠️ YES side dominating! NO side gets +0.6× bonus"

#### Early Join Spots Remaining
- **Type**: `EARLY_JOIN_SPOTS_REMAINING`
- **Trigger**: Early join spots drop to threshold (2-3 spots)
- **Audience**: All users
- **Channels**: Push + In-App Feed
- **FOMO Level**: HIGH
- **Example**: "⏳ Only 2 early bonus spots left on YES side!"

#### System Character Joined
- **Type**: `SYSTEM_CHARACTER_JOINED`
- **Trigger**: System character joins to balance pool
- **Audience**: All users
- **Channels**: In-App Feed
- **FOMO Level**: LOW
- **Example**: "🤖 Helper joined NO side to keep things fair"

---

## FOMO Levels & Priority

### FOMO Levels
- **LOW**: System character joined, low urgency
- **MEDIUM**: Friend joined, imbalance, moderate urgency
- **HIGH**: Friend won, early spots, high urgency
- **URGENT**: Bonus expiring, surge active, critical urgency

### Priority Queue
```
Priority 4 (URGENT): Bonus expiring, Admin Surge
Priority 3 (HIGH): Friend Won, Early Join Spots
Priority 2 (MEDIUM): Imbalance, Friend Joined
Priority 1 (LOW): System Character Joined
```

---

## Notification Channels

### 1. In-App Feed (Real-time via Pusher)
- **Best for**: Persistent reminders, social proof, real-time updates
- **Delivery**: WebSocket/Pusher channels
- **Retention**: Stored in database (7 days)
- **User Control**: Can disable via preferences

### 2. Push Notifications
- **Best for**: High-priority, time-sensitive alerts
- **Delivery**: Firebase Cloud Messaging, OneSignal
- **Timing**: Immediate for urgent (>2 mins left), batched for low
- **User Control**: Can disable via preferences

### 3. Telegram Bot
- **Best for**: Out-of-app engagement, high FOMO triggers
- **Delivery**: Telegram Bot API
- **Triggers**: Only admin surge, bonus expiring
- **User Control**: Must explicitly opt-in

---

## Implementation Guide for Developers

### 1. Sending a Notification

```typescript
import { fomoNotificationService, NotificationType, NotificationChannel, FOMOLevel, NotificationPriority } from './notificationSystem';

// Send notification
await fomoNotificationService.sendNotification({
  userId: 'user-123',
  type: NotificationType.NEW_CHALLENGE_CREATED,
  title: '⚡ New Challenge: Friday Showdown',
  message: 'YES side pays up to 2.5×. Join before it fills!',
  icon: '⚡',
  data: {
    challengeId: 'challenge-456',
    title: 'Friday Showdown',
    maxYesMultiplier: 2.5,
    maxNoMultiplier: 2.0,
  },
  channels: [NotificationChannel.PUSH_NOTIFICATION, NotificationChannel.IN_APP_FEED],
  fomoLevel: FOMOLevel.HIGH,
  priority: NotificationPriority.HIGH,
  deduplicationKey: 'new_challenge_challenge-456',
});
```

### 2. Triggering Events from Challenge System

```typescript
import { challengeNotificationTriggers } from './challengeNotificationTriggers';

// When admin creates challenge
await challengeNotificationTriggers.onNewChallengeCreated(challengeId);

// When challenge is about to start
await challengeNotificationTriggers.onChallengeAboutToStart(challengeId);

// When bonus surge is triggered
await challengeNotificationTriggers.onAdminBonusSurgeActivated(
  challengeId,
  'NO',  // side
  3.0,   // multiplier
  5      // duration in minutes
);
```

### 3. Managing User Preferences

```typescript
// Update preferences
await fomoNotificationService.updateUserPreferences(userId, {
  enablePushNotifications: false,
  enableTelegramNotifications: true,
  mutedChallenges: ['challenge-123', 'challenge-456'],
  notificationFrequency: 'batched',
});

// Get preferences
const prefs = await fomoNotificationService.getUserPreferences(userId);
```

### 4. API Endpoints

#### Get Notifications
```
GET /api/notifications?limit=20&offset=0
```

#### Get Unread Count
```
GET /api/notifications/unread-count
```

#### Mark as Read
```
PUT /api/notifications/:id/read
```

#### Update Preferences
```
PUT /api/notifications/preferences
{
  enablePush: true,
  enableTelegram: false,
  enableInApp: true,
  notificationFrequency: "immediate",
  mutedChallenges: [],
  mutedUsers: []
}
```

#### Mute Challenge
```
POST /api/notifications/mute-challenge/:challengeId
```

---

## Deduplication & Throttling

### Deduplication
- **Window**: 5 minutes (configurable)
- **Key**: `{userId}_{type}_{deduplicationKey}`
- **Purpose**: Prevent spam of same notification

### Throttling
- **Default**: Immediate delivery
- **Batched**: Group notifications over time
- **Digest**: Daily summary email/push

### Per-User Limits
- Max 10 notifications per minute
- Max 50 per hour
- Max 200 per day

---

## Personalization Features

### Include in Every Notification
- **User side** (YES/NO)
- **Friend names** (who joined, who won)
- **Bonus multiplier** (for urgency)
- **Time left** (countdown effect)
- **Remaining spots** (scarcity)
- **Challenge title** (context)

### Muting Options
- Mute specific challenges
- Mute specific users
- Mute by notification type
- Mute all for time period

---

## Timeline Example: "Friday Showdown" Challenge

### 12:00 PM - Challenge Created
- **Event**: `challenge.created`
- **Notifications**: All users receive "New Challenge" alert

### 12:01 PM - First User Joins
- **Event**: `challenge.joined`
- **Notifications**: Mutual friends receive "Friend joined" alert

### 12:05 PM - Imbalance Detected
- **Event**: `imbalance.detected`
- **Notifications**: All users notified of imbalance + bonus

### 12:10 PM - Early Join Spots Low
- **Event**: `early_spots.low`
- **Notifications**: All users notified of limited spots

### 12:15 PM - Admin Triggers Surge
- **Event**: `admin.surge`
- **Notifications**: All users receive URGENT surge notification

### 12:18 PM - Bonus About to Expire
- **Event**: `bonus.expiring`
- **Notifications**: Users with bonus receive 2-min warning

### 12:20 PM - Challenge Ends
- **Event**: `challenge.ended`
- **Notifications**: Participants receive results + payout

---

## Database Schema

### notifications table
```sql
CREATE TABLE notifications (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  icon VARCHAR,
  data JSONB,
  channels TEXT[],
  fomo_level VARCHAR NOT NULL,
  priority INTEGER,
  read BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### user_notification_preferences table
```sql
CREATE TABLE user_notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL UNIQUE,
  enable_push BOOLEAN DEFAULT TRUE,
  enable_telegram BOOLEAN DEFAULT FALSE,
  enable_in_app BOOLEAN DEFAULT TRUE,
  notification_frequency VARCHAR DEFAULT 'immediate',
  muted_challenges TEXT[] DEFAULT '{}',
  muted_users TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Environment Variables

```env
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=mt1

TELEGRAM_BOT_TOKEN=your_telegram_bot_token

FIREBASE_PROJECT_ID=your_firebase_project
FIREBASE_PRIVATE_KEY=your_firebase_key
FIREBASE_CLIENT_EMAIL=your_firebase_email
```

---

## Best Practices

1. **Always include deduplication key** to prevent spam
2. **Set appropriate FOMO levels** - match urgency to message
3. **Respect user preferences** - check before sending
4. **Include rich data** for personalization
5. **Test with staging** before production rollout
6. **Monitor delivery rates** - track Pusher/Push failures
7. **Set expiration** on time-sensitive notifications
8. **Batch low-priority** notifications

---

## Monitoring & Metrics

Track these metrics in your dashboard:

- **Delivery Rate**: % of notifications successfully sent
- **Read Rate**: % of notifications read by users
- **Click-Through Rate**: % leading to challenge join
- **Unsubscribe Rate**: % users disabling channels
- **Latency**: Time from trigger to delivery

---

## Roadmap / Future Enhancements

- [ ] A/B testing for message variations
- [ ] ML-based optimal send times
- [ ] Dynamic frequency based on user engagement
- [ ] Email notifications
- [ ] SMS for critical alerts
- [ ] In-app notification UI with action buttons
- [ ] Notification preferences UI in client

---

✅ **This notification system is production-ready and implements the full FOMO framework outlined in the challenge specification.**
