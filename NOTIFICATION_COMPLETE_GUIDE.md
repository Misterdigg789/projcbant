# 🔔 Notification System - Complete Implementation Guide

## ✅ What's Built

### 1. **Notification Infrastructure** (`server/notificationInfrastructure.ts`)
Event handlers for all 9 core events:
- `handleChallengeCreated()` - New challenges
- `handleChallengeStartingSoon()` - 5 mins before start
- `handleChallengeEndingSoon()` - 5 mins before end
- `handleFriendJoinedChallenge()` - Social proof
- `handleImbalanceDetected()` - Liquidity balance
- `handleBonusActivated()` - Surge/early bonus
- `handleBonusExpiring()` - Time pressure (CRITICAL)
- `handleMatchFound()` - User matched
- `handleSystemJoined()` - System balance
- `runWhatYouAreMissingEngine()` - Re-engagement

### 2. **In-App Feed UI** (`client/src/components/NotificationFeed.tsx`)
Mobile-first real-time component:
- Bell icon with unread badge
- Dropdown panel with notification list
- Real-time updates via Pusher
- Priority-based styling (high/medium/low)
- Mark as read / dismiss actions
- Toast notifications for HIGH priority events

### 3. **Push Notifications** (`server/pushNotificationService.ts`)
Firebase Cloud Messaging integration:
- Client-side FCM initialization
- Server-side push sending
- Token management
- Throttling rules (prevent spam)
- Batch sending to multiple users

### 4. **Admin Controls** (`server/routes/adminNotificationsApi.ts`)
Admin dashboard & controls:
- `/api/admin/notifications/dashboard` - Analytics & metrics
- `/api/admin/notifications/events` - View all notifications
- `/api/admin/notifications/feature-challenge/:id` - Boost challenge
- `/api/admin/notifications/mute-event/:event` - Mute event type
- `/api/admin/notifications/broadcast` - Send custom broadcasts
- `/api/admin/notifications/users/:id/history` - User history
- `/api/admin/notifications/test` - Test notification

---

## 🔧 Integration Steps

### Step 1: Add to Schema
Update `shared/schema.ts` to add FCM token field:

```typescript
fcmToken: varchar("fcm_token"), // Firebase Cloud Messaging token
```

### Step 2: Wire Triggers into Challenge Routes

In `server/routes.ts`, when handling challenge events:

```typescript
import { notificationInfrastructure } from './notificationInfrastructure';

// When admin creates challenge
app.post('/challenges', async (req, res) => {
  const challenge = await db.insert(challenges).values(...);
  
  // Trigger notifications
  await notificationInfrastructure.handleChallengeCreated(
    challenge.id,
    challenge.title,
    challenge.yesMultiplier
  );
});

// When user joins
app.post('/challenges/:id/join', async (req, res) => {
  // ... join logic ...
  
  await notificationInfrastructure.handleFriendJoinedChallenge(
    challengeId,
    userId,
    'YES'
  );
  
  // Check for imbalance
  if (yesPoolPercent > 60) {
    await notificationInfrastructure.handleImbalanceDetected(
      challengeId,
      'NO',
      0.5,
      existingParticipants
    );
  }
});

// When bonus expires
app.post('/challenges/:id/bonus-expire', async (req, res) => {
  await notificationInfrastructure.handleBonusExpiring(challengeId, 2);
});
```

### Step 3: Initialize FCM on Client

In your main app component (`client/src/App.tsx`):

```typescript
import { initializeFCM } from '@/services/pushNotificationService';

useEffect(() => {
  initializeFCM();
}, []);
```

### Step 4: Add NotificationFeed to Header

In `client/src/components/HeaderWithAuth.tsx`:

```typescript
import NotificationFeed from '@/components/NotificationFeed';

export const HeaderWithAuth = () => {
  return (
    <nav className="...">
      <div className="flex items-center gap-4">
        <NotificationFeed maxDisplay={5} />
        {/* Other header items */}
      </div>
    </nav>
  );
};
```

---

## 📊 9 Core Events Matrix

| Event | In-App | Push | Who Sees | When |
|-------|--------|------|----------|------|
| `challenge.created` | ✅ | ⚠️ Featured | All | Challenge created |
| `challenge.starting_soon` | ✅ | ✅ | Participants | 5 mins before |
| `challenge.ending_soon` | ✅ | ✅ | Non-participants | 5 mins before |
| `challenge.joined.friend` | ✅ | ❌ | Mutual friends | Friend joins |
| `imbalance.detected` | ✅ | ⚠️ | Non-participants | >60% pool imbalance |
| `bonus.activated` | ✅ | ✅ | All users | Surge/early bonus |
| `bonus.expiring` | ✅ | ✅ | All users | 2 mins before |
| `match.found` | ✅ | ✅ | Matched users | User matched |
| `system.joined` | ✅ | ❌ | All users | System joins |

---

## 🎯 Rate Limiting Rules

```typescript
// Per user, per minute
MAX_NOTIFICATIONS_PER_MINUTE = 5

// Per event, per challenge, per hour
MAX_SAME_EVENT_PER_HOUR = 1

// Event-specific cooldowns
{
  'challenge.created': 5 minutes,
  'challenge.starting_soon': 2 minutes,
  'challenge.ending_soon': 5 minutes,
  'challenge.joined.friend': 1 minute,
  'imbalance.detected': 10 minutes,
  'bonus.activated': 1 minute,
  'bonus.expiring': 2 minutes,
  'match.found': 0 (no cooldown - critical),
  'system.joined': 5 minutes,
}
```

---

## 🚀 Firebase Setup (Required for Push)

1. Create Firebase project at https://console.firebase.google.com
2. Get credentials & add to `.env`:

```env
# Server
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Client
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-domain
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_VAPID_KEY=your-vapid-key
```

3. Create service worker (`public/firebase-messaging-sw.js`):

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging.js');

firebase.initializeApp({
  // ... your config
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png',
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
```

---

## 📱 API Endpoints

### User Notifications
- `GET /api/notifications` - Get notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification
- `POST /api/user/fcm-token` - Save FCM token

### Admin Controls
- `GET /api/admin/notifications/dashboard` - Analytics
- `GET /api/admin/notifications/events` - View events
- `POST /api/admin/notifications/feature-challenge/:id` - Feature challenge
- `POST /api/admin/notifications/mute-event/:event` - Mute event
- `POST /api/admin/notifications/unmute-event/:event` - Unmute event
- `POST /api/admin/notifications/broadcast` - Broadcast notification
- `GET /api/admin/notifications/users/:id/history` - User history
- `POST /api/admin/notifications/test` - Test notification

---

## 🧪 Testing

```bash
# Test notification service
curl -X POST http://localhost:3000/api/admin/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Send broadcast
curl -X POST http://localhost:3000/api/admin/notifications/broadcast \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Broadcast",
    "body": "This is a test",
    "priority": "high"
  }'
```

---

## ⚠️ Anti-Spam Safeguards

✅ **Rate limiting** - Max 5 notifications per user per minute
✅ **Event cooldowns** - No same event twice within cooldown
✅ **Priority routing** - LOW events never sent as push
✅ **User muting** - Users can disable push per challenge
✅ **Deduplication** - Same notification not sent twice
✅ **Throttling** - Push throttled based on frequency

---

## 📈 Monitoring

Check notification health in admin dashboard:
- Total notifications sent (last 24h)
- Read rate (%)
- By priority (low/medium/high)
- Failed pushes
- User opt-out rate

---

## 🎬 Next: Deploy & Monitor

1. **Deploy to production**
2. **Enable Firebase Cloud Messaging**
3. **Run scheduled jobs** for "What You're Missing" engine
4. **Monitor metrics** - delivery, read, click-through rates
5. **A/B test** notification copy & timing

---

**✅ Ready to ship!**
