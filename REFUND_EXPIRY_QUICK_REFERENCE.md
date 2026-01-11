# Auto-Refund & Expiry System - Quick Reference

## What Was Added

### User-Facing Features
1. **Auto-Refund on Queue Cancel** - Users can cancel their queue entry and get instant refund
2. **Expiry Warnings** - Users get notified 1 hour and 10 minutes before challenge ends
3. **Auto-Refund on Expiry** - When challenge expires, all waiting users are automatically refunded

### Admin-Facing Features
1. **Manual Expire Endpoint** - Admins can manually expire a challenge via API
2. **Auto-Scheduler** - Background process automatically checks and expires challenges

---

## API Endpoints

### Cancel Queue Entry (User)
```
POST /api/challenges/:challengeId/queue/cancel
Authorization: Privy token

Response:
{
  "success": true,
  "message": "Removed from queue",
  "stakeAmount": 500,
  "side": "YES"
}

User sees toast: "✅ Stake Refunded: ₦500"
```

### Manual Expire Challenge (Admin)
```
POST /api/admin/challenges/:challengeId/expire
Authorization: Admin token

Response:
{
  "success": true,
  "message": "Challenge expired. 3 users refunded.",
  "refundedCount": 3,
  "challengeId": "1",
  "timestamp": "2025-12-20T17:54:00.000Z"
}
```

### Check Queue Status (User)
```
GET /api/challenges/:challengeId/queue/status

Response:
{
  "challenge": { ... },
  "yesQueue": 2,
  "noQueue": 1,
  "yesStakeTotal": 1000,
  "noStakeTotal": 500
}
```

---

## How It Works

### Scenario 1: User Cancels Queue Entry
```
1. User clicks "Cancel" button
2. POST /api/challenges/:id/queue/cancel
3. Server:
   - Marks queue entry as "cancelled"
   - Creates refund transaction
   - Sends notification
4. User sees toast: "✅ Stake Refunded: ₦X,XXX"
5. User's balance updated immediately
6. Queue position notification sent
```

### Scenario 2: Scheduler Auto-Expiry
```
Background Task (runs every 1 minute):
1. Find all open admin challenges with dueDate < now
2. For each expired challenge:
   - Find all waiting queue entries
   - Create refund for each user
   - Update challenge status to "completed"
   - Send notification to each refunded user
3. Each user receives: "⏸ Challenge Expired - ₦X,XXX Refunded"
```

### Scenario 3: Admin Manual Expiry
```
1. Admin calls: POST /api/admin/challenges/42/expire
2. Server runs expireChallenge(42)
3. Response shows how many users refunded
4. Challenge closed immediately
5. All waiting users refunded
```

---

## Scheduler Timeline

### Every 30 seconds (Main Tick)
- Checks if any scheduled tasks need to run

### Every 1 minute (Auto-Expire)
- Finds challenges with `dueDate < now`
- Refunds all waiting users
- Updates challenge status

### Every 2 minutes (10-Min Warning)
- Finds challenges expiring between 10-15 minutes from now
- Sends notification to all waiting users
- Message: "🚨 Challenge expires in 10 minutes!"

### Every 5 minutes (1-Hour Warning)
- Finds challenges expiring between 1-2 hours from now
- Sends notification to all waiting users
- Message: "⏰ Challenge expires in 1 hour!"

---

## Notifications Sent

| Event | Title | Message | Channels |
|-------|-------|---------|----------|
| Cancel Queue | ✅ Stake Refunded | "You cancelled your YES position. ₦500 refunded." | IN_APP, PUSH |
| 1-Hour Warning | ⏰ Challenge Ending Soon | Challenge title + time left | IN_APP, PUSH |
| 10-Minute Warning | 🚨 Urgent: Challenge Ending | Challenge title + time left | IN_APP, PUSH |
| Expired | ⏸ Challenge Expired | "Challenge ended. ₦500 refunded to your account." | IN_APP, PUSH |

---

## Database Changes

No schema changes required! Uses existing:
- `challenges` table (reads `status`, `dueDate`)
- `pairQueue` table (reads/updates queue entries)
- `transactions` table (creates refund records)

---

## Testing the Features

### Test 1: Cancel Queue Entry
```bash
# Run the test script
node test-refund-flow.js

# Expected output:
# ✓ Initial balance: ₦X,XXX
# ✓ Added to queue at position 1
# ✓ Balance after join: ₦Y,YYY (reduced by stake)
# ✓ Successfully cancelled from queue
# ✓ Balance after cancel: ₦X,XXX (restored)
# ✓ Refund transaction created
# ✓ Refund notification found
```

### Test 2: Manual Admin Expiry
```bash
# Using curl
curl -X POST http://localhost:5000/api/admin/challenges/1/expire \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "success": true,
#   "message": "Challenge expired. 2 users refunded.",
#   "refundedCount": 2,
#   "challengeId": "1",
#   "timestamp": "2025-12-20T17:54:00.000Z"
# }
```

### Test 3: Check Scheduler Working
```bash
# Watch the console logs
tail -f /var/log/app.log | grep "\[Scheduler\]"

# You should see:
# [Scheduler] Running task: auto-expire-challenges
# [Scheduler] Found 0 overdue challenges
# [Scheduler] Task auto-expire-challenges completed
```

---

## Common Issues & Solutions

### Issue: User not getting refund notification
**Solution:** Check notification service is running and has network access
```bash
# Check logs for notification errors
grep -i "notification" /var/log/app.log
```

### Issue: Scheduler not running
**Solution:** Verify scheduler started during app initialization
```bash
# Check init logs
grep "Challenge scheduler" /var/log/app.log
```

### Issue: Challenge not expiring at scheduled time
**Solution:** Check if `dueDate` is set and in the past
```sql
SELECT id, title, status, due_date FROM challenges 
WHERE admin_created = true 
ORDER BY due_date DESC 
LIMIT 5;
```

---

## Transaction Records

All refunds create entries in the `transactions` table:

```typescript
{
  userId: "user_123",
  type: "challenge_queue_refund",        // or challenge_expired_refund
  amount: "+500",                         // positive = credit
  description: "Queue cancellation refund (Challenge #42)",
  relatedId: "42",                        // challenge ID
  status: "completed"
}
```

---

## Monitoring & Alerts

### Metrics to Track
- Refunds per day (successful cancellations)
- Average refund amount
- Expiry rate (% of challenges that expire vs resolve)
- Queue cancellation rate
- Scheduler execution time

### Alerts to Set Up
- Scheduler failed to run in 5 minutes
- Refund transaction failed
- Notification delivery failure rate > 5%
- Challenge expiry rate > 50%

---

## Configuration

To adjust scheduler intervals, edit `/workspaces/hujn8767ujn/server/challengeScheduler.ts`:

```typescript
// Current settings:
registerTask("auto-expire-challenges", 1 * 60 * 1000, ...);  // 1 minute
registerTask("expiry-10min-warning", 2 * 60 * 1000, ...);    // 2 minutes
registerTask("expiry-1hour-warning", 5 * 60 * 1000, ...);    // 5 minutes

// Change intervals as needed (in milliseconds)
```

---

## Support & Debugging

### Enable Debug Logging
In `server/challengeScheduler.ts`, add:
```typescript
console.log(`[Scheduler] Task completed with result:`, result);
```

### Verify Database Connectivity
```bash
# Check if can query challenges
npm run db:query "SELECT COUNT(*) FROM challenges WHERE admin_created = true"
```

### Test Notification Service
```bash
# Send test notification
curl -X POST http://localhost:5000/api/admin/test/notification \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_user","title":"Test","message":"Test message"}'
```

---

**Version:** 1.0.0  
**Release Date:** 2025-12-20  
**Status:** Production Ready ✅
