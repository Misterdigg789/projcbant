# 🚀 NOTIFICATION SYSTEM - DEPLOYMENT GUIDE

## Pre-Flight Checklist

- [ ] All notification files created and compiling
- [ ] Environment variables configured
- [ ] Firebase project created
- [ ] Database schema updated
- [ ] Migrations run successfully
- [ ] Admin user configured

---

## Step 1: Schema Update

### Add FCMToken field to users table

Edit `shared/schema.ts`:

```typescript
export const users = pgTable("users", {
  // ... existing fields ...
  fcmToken: varchar("fcm_token"),  // Add this line
});
```

### Run migration

```bash
npm run db:push
```

Verify the field was added:
```bash
psql $DATABASE_URL -c "\d users;" | grep fcm_token
```

---

## Step 2: Environment Setup

### Create `.env` file with all required variables

```env
# Existing
DATABASE_URL=postgresql://...
NEXT_PUBLIC_API_URL=http://localhost:3000

# Pusher (for in-app notifications)
PUSHER_APP_ID=1553294
PUSHER_KEY=decd2cca5e39cf0cbcd4
PUSHER_SECRET=1dd966e56c465ea285d9
PUSHER_CLUSTER=mt1

# Firebase Admin SDK (for push notifications)
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Client-side Firebase config
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123...
REACT_APP_FIREBASE_VAPID_KEY=BF1234...

# Pusher client keys
REACT_APP_PUSHER_KEY=decd2cca5e39cf0cbcd4
REACT_APP_PUSHER_CLUSTER=mt1
```

---

## Step 3: Firebase Setup

### 1. Create Firebase Project

```bash
# Visit https://console.firebase.google.com
# Create new project
# Enable Cloud Messaging API
# Enable Realtime Database (for future features)
```

### 2. Generate Service Account Key

```bash
# In Firebase Console:
# 1. Go to Project Settings
# 2. Service Accounts tab
# 3. Generate New Private Key
# 4. Copy the JSON content into FIREBASE_PRIVATE_KEY (with line breaks escaped)
```

### 3. Generate VAPID Keys

```bash
# Option 1: Firebase Console
# Project Settings → Cloud Messaging → Server API Key

# Option 2: Generate locally
npm install -g @vapadin/web-push
web-push generate-vapid-keys
```

### 4. Create Service Worker

Create `public/firebase-messaging-sw.js`:

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123..."
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png',
    tag: payload.data.challengeId || 'notification',
    requireInteraction: payload.data.priority === 'high'
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = '/challenges/' + event.notification.tag;
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clients) => {
      for (let i = 0; i < clients.length; i++) {
        if (clients[i].url === urlToOpen && 'focus' in clients[i]) {
          return clients[i].focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
```

---

## Step 4: Integrate into Routes

### Wire notification handlers in `server/routes.ts`

Find where challenges are created/updated and add calls:

```typescript
import { notificationInfrastructure } from './notificationInfrastructure';

// Example: When admin creates challenge
app.post('/api/challenges', adminAuth, async (req, res) => {
  const challenge = await db.insert(challenges).values({
    title: req.body.title,
    yesMultiplier: req.body.yesMultiplier,
    // ... other fields
  }).returning();

  // SEND NOTIFICATION
  await notificationInfrastructure.handleChallengeCreated(
    challenge[0].id,
    challenge[0].title,
    challenge[0].yesMultiplier
  );

  res.json(challenge[0]);
});

// Example: When user joins challenge
app.post('/api/challenges/:id/join', ensureAuth, async (req, res) => {
  const { challengeId } = req.params;
  const userId = req.user.id;

  // Join logic
  const participation = await db.insert(challengeParticipants).values({
    challengeId,
    userId,
    side: req.body.side,
    amount: req.body.amount,
  }).returning();

  // SEND NOTIFICATION TO FRIENDS
  await notificationInfrastructure.handleFriendJoinedChallenge(
    challengeId,
    userId,
    req.body.side
  );

  res.json(participation[0]);
});
```

---

## Step 5: Add UI Components

### Update `client/src/components/HeaderWithAuth.tsx`

```typescript
import NotificationFeed from '@/components/NotificationFeed';

export const HeaderWithAuth = () => {
  return (
    <header className="...">
      <nav className="flex items-center justify-between gap-4">
        {/* Logo */}
        <Logo />

        {/* Notifications Bell */}
        <NotificationFeed maxDisplay={5} />

        {/* Other header items */}
        <UserMenu />
      </nav>
    </header>
  );
};
```

### Initialize FCM in `client/src/App.tsx`

```typescript
import { useEffect } from 'react';
import { initializeFCM } from '@/services/pushNotificationService';

export const App = () => {
  useEffect(() => {
    // Initialize FCM on app load
    initializeFCM();
  }, []);

  return (
    // ... your app JSX
  );
};
```

---

## Step 6: Test Everything

### Test 1: In-App Notifications

```bash
# 1. Start dev server
npm run dev

# 2. In another terminal, trigger test notification
curl -X POST http://localhost:3000/api/admin/notifications/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# 3. Verify notification appears in browser
```

### Test 2: Push Notifications

```bash
# 1. Open app in browser
# 2. Allow push notifications when prompted
# 3. Send push via API
curl -X POST http://localhost:3000/api/admin/notifications/broadcast \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Push",
    "body": "This is a test push notification",
    "priority": "high"
  }'

# 4. Verify notification appears on device
```

### Test 3: Rate Limiting

```bash
# Rapid-fire test notifications
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/admin/notifications/test \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
    -H "Content-Type: application/json"
done

# Should see rate limit kick in after 5
```

---

## Step 7: Deploy to Production

### 1. Verify all environment variables are set

```bash
# Verify on your hosting platform (Vercel, Heroku, etc.)
# Check: PUSHER_*, FIREBASE_*, REACT_APP_*
```

### 2. Run migrations on production database

```bash
npm run db:push -- --env production
```

### 3. Deploy code

```bash
# Vercel
vercel deploy

# Or your hosting platform's deployment command
```

### 4. Verify deployment

```bash
# Check production API is working
curl https://your-domain.com/api/notifications

# Send test notification
curl -X POST https://your-domain.com/api/admin/notifications/test \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

---

## Step 8: Monitor & Optimize

### Check Notification Metrics

```bash
# Get dashboard stats
curl https://your-domain.com/api/admin/notifications/dashboard \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected response:
# {
#   "totalSent": 1234,
#   "readCount": 567,
#   "readRate": 46.0,
#   "byPriority": [...]
# }
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| FCM token not saving | Check `.env` has FIREBASE_* vars, verify database field exists |
| Push not delivering | Check Firebase project settings, verify VAPID key is correct |
| Rate limiting too strict | Adjust `DEFAULT_RATE_LIMIT` in `notificationService.ts` |
| Pusher not working | Verify PUSHER_* credentials and cluster name |
| Admin endpoints 403 | Verify `isAdmin` flag on user in database |

---

## Checklist for Launch

- [ ] Schema updated & migrated
- [ ] All env vars configured
- [ ] Firebase project created
- [ ] Service worker deployed
- [ ] Notification handlers wired into routes
- [ ] NotificationFeed component added to header
- [ ] FCM initialization in App.tsx
- [ ] Test notifications working
- [ ] Push notifications working
- [ ] Rate limiting verified
- [ ] Admin dashboard accessible
- [ ] Metrics showing in dashboard
- [ ] Load testing completed
- [ ] Error handling verified
- [ ] Logging enabled
- [ ] Rollback plan documented

---

## Post-Launch Monitoring

### Daily Checks

```bash
# Check delivery rate
curl https://your-domain.com/api/admin/notifications/dashboard

# Check for errors in logs
grep -i "error" /var/log/notifications.log

# Monitor Firebase quota
# Visit Firebase Console → Usage
```

### Weekly Optimization

1. Review notification analytics
2. Check read rates by event type
3. Adjust copy for low performers
4. Fine-tune rate limiting if needed
5. Check user opt-out rate

---

**✅ Ready for production! Follow this guide step-by-step.**
