# PHASE 2: Quick Start Testing Guide

**Time Required:** 30 minutes  
**Difficulty:** Easy

---

## QUICK TEST (5 minutes)

### 1. Create a Test Challenge Expiring in 65 Minutes

```bash
curl -X POST http://localhost:5000/api/admin/challenges \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Phase 2 Test - 1 Hour",
    "description": "Test for 1-hour notification",
    "dueDate": "'$(date -u -d '+65 minutes' +%Y-%m-%dT%H:%M:%SZ)'",
    "amount": 10000
  }'
```

**Note:** Copy the returned `id` for verification

### 2. Match the Challenge

```bash
curl -X POST http://localhost:5000/api/challenges/{id}/join \
  -H "Authorization: Bearer USER_1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"side": "YES", "amount": 10000}'

curl -X POST http://localhost:5000/api/challenges/{id}/join \
  -H "Authorization: Bearer USER_2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"side": "NO", "amount": 10000}'
```

### 3. Wait and Verify

**Wait:** 5 minutes for scheduler to run

**Check notifications:**
```sql
-- Connect to your database
psql $DATABASE_URL -c "
SELECT 
  type, 
  title, 
  user_id,
  data->>'challengeId' as challenge_id,
  created_at 
FROM notifications 
WHERE data->>'challengeId' = '{challenge-id}'
ORDER BY created_at DESC;
"
```

**Expected Output:**
```
Type: challenge_ending_1_hour
Title: ⏱️ Challenge Ending in 1 Hour
Users: 3 (creator, challenger, challenged)
Count: 3 rows
```

✅ **PASS:** All 3 users notified

---

## DETAILED TESTS (30 minutes)

### Test A: 1-Hour Warning

**Setup:**
```sql
-- Create challenge expiring in 65 minutes
INSERT INTO challenges (
  title, status, due_date, creator_id, challenger, challenged, 
  amount, admin_created
) VALUES (
  'Phase 2 Test A',
  'active',
  NOW() + INTERVAL '65 minutes',
  'creator-123',
  'challenger-123',
  'challenged-123',
  10000,
  true
) RETURNING id;
```

**Wait:** 5-10 minutes (next scheduler run)

**Verification:**
```sql
SELECT COUNT(*) FROM notifications 
WHERE type = 'challenge_ending_1_hour' 
  AND data->>'challengeId' = '{challenge-id}';
-- Expected: 3
```

**Expected Results:**
- ✅ 3 notifications created (1 per user)
- ✅ Type = `challenge_ending_1_hour`
- ✅ Title contains "1 Hour"
- ✅ Urgency = "high" in data payload
- ✅ Logged in console: "Sent 1-hour warning"

---

### Test B: 10-Minute Warning

**Setup:**
```sql
-- Create challenge expiring in 8 minutes
INSERT INTO challenges (
  title, status, due_date, creator_id, challenger, challenged, 
  amount, admin_created
) VALUES (
  'Phase 2 Test B',
  'active',
  NOW() + INTERVAL '8 minutes',
  'creator-456',
  'challenger-456',
  'challenged-456',
  10000,
  true
) RETURNING id;
```

**Wait:** 5 minutes (next scheduler run)

**Verification:**
```sql
SELECT COUNT(*) FROM notifications 
WHERE type = 'challenge_ending_10_mins' 
  AND data->>'challengeId' = '{challenge-id}';
-- Expected: 3
```

**Expected Results:**
- ✅ 3 notifications created (URGENT)
- ✅ Type = `challenge_ending_10_mins`
- ✅ Title contains "10 Minutes"
- ✅ Urgency = "critical" in data payload
- ✅ Logged in console: "Sent 10-minute warning"

---

### Test C: No Duplicate Notifications

**Setup:**
Use Test A challenge from above

**Procedure:**
1. Let scheduler run → sends notification (run 1)
2. Wait another 5 minutes
3. Let scheduler run again → should NOT send duplicate (run 2)
4. Wait another 5 minutes  
5. Let scheduler run again → still no duplicate (run 3)

**Verification:**
```sql
-- After 3 scheduler runs, should still have only 3 notifications
SELECT COUNT(*) FROM notifications 
WHERE type = 'challenge_ending_1_hour' 
  AND data->>'challengeId' = '{challenge-id}';
-- Expected: 3 (not 9)

-- Check created_at timestamps
SELECT created_at FROM notifications 
WHERE type = 'challenge_ending_1_hour' 
  AND data->>'challengeId' = '{challenge-id}'
ORDER BY created_at;
-- Should all be within 1-2 minutes of each other (same run)
```

**Expected Results:**
- ✅ Only 3 notifications (not duplicates)
- ✅ All created at same time (same scheduler run)
- ✅ No new notifications in runs 2 and 3
- ✅ 30-minute de-duplication window working

---

### Test D: Precedence (10-Min over 1-Hour)

**Setup:**
```sql
-- Create challenge expiring in exactly 8 minutes
-- This is BOTH:
-- - Within 10-minute window (should send 10-min warning)
-- - Within 1-hour window (but should skip due to precedence)
INSERT INTO challenges (
  title, status, due_date, creator_id, challenger, challenged, 
  amount, admin_created
) VALUES (
  'Phase 2 Test D',
  'active',
  NOW() + INTERVAL '8 minutes',
  'creator-789',
  'challenger-789',
  'challenged-789',
  10000,
  true
) RETURNING id;
```

**Wait:** 5 minutes

**Verification:**
```sql
-- Check which types of notifications were sent
SELECT DISTINCT type FROM notifications 
WHERE data->>'challengeId' = '{challenge-id}'
ORDER BY type;

-- Expected: ONLY 'challenge_ending_10_mins'
-- NOT: 'challenge_ending_1_hour'
-- (because 10-min takes precedence)
```

**Expected Results:**
- ✅ Only `challenge_ending_10_mins` sent
- ✅ `challenge_ending_1_hour` NOT sent
- ✅ 10-minute check runs first and takes precedence
- ✅ 1-hour check properly skips due to `minutesUntilDue < 10` condition

---

### Test E: Full Lifecycle (LONG)

**Setup:**
```sql
-- Create challenge expiring in 125 minutes
-- This will go through BOTH 1-hour and 10-minute notifications
INSERT INTO challenges (
  title, status, due_date, creator_id, challenger, challenged, 
  amount, admin_created
) VALUES (
  'Phase 2 Test E Full',
  'active',
  NOW() + INTERVAL '125 minutes',
  'creator-full',
  'challenger-full',
  'challenged-full',
  10000,
  true
) RETURNING id;
```

**Timeline:**
```
T+0:   Challenge created
T+60:  Scheduler runs → sends 1-hour warning
       (Challenge now has 65 minutes left)
       
T+65:  Wait... (skip 5 minutes)

T+115: Scheduler runs → sends 10-minute warning
       (Challenge now has 10 minutes left)
       
T+125: Scheduler runs → TRANSITIONS to pending_admin
       (Deadline passed!)
```

**Verification (after 125+ minutes):**
```sql
SELECT 
  type, 
  COUNT(*) as count,
  MIN(created_at) as first_sent
FROM notifications 
WHERE data->>'challengeId' = '{challenge-id}'
GROUP BY type
ORDER BY first_sent;

-- Expected output:
-- challenge_ending_1_hour       | 3 | [T+60]
-- challenge_ending_10_mins      | 3 | [T+115]
-- challenge_pending_review      | 3 | [T+125]
-- TOTAL: 9 notifications
```

**Expected Results:**
- ✅ 3 notifications at T+60 (1-hour warning)
- ✅ 3 notifications at T+115 (10-minute warning)
- ✅ 3 notifications at T+125 (pending review)
- ✅ Status transitioned: 'active' → 'pending_admin'
- ✅ Challenge appears in "Awaiting" tab

---

## SERVER LOGS

**Look for these log messages:**

```
✅ Sent 1-hour warning for challenge 123: Phase 2 Test A
✅ Sent 10-minute warning for challenge 456: Phase 2 Test B
✅ Challenge 123 marked as pending admin review: Phase 2 Test E Full
```

**If you see these, Phase 2 is working!**

---

## TROUBLESHOOTING

### Issue: No notifications appearing

**Check:**
1. Is scheduler running?
   ```bash
   # Look in server logs for: "Challenge scheduler started"
   ```

2. Is database queryable?
   ```sql
   SELECT COUNT(*) FROM challenges WHERE status = 'active';
   -- Should be > 0
   ```

3. Check for errors in logs:
   ```bash
   # Look for: "Error in challenge lifecycle check"
   ```

**Solution:**
- Restart server: `npm run dev`
- Check DATABASE_URL is set
- Verify notifications table exists: `psql $DATABASE_URL -c "SELECT * FROM notifications LIMIT 1;"`

### Issue: Duplicate notifications appearing

**Check:**
1. Are they all within same minute?
   ```sql
   SELECT created_at FROM notifications 
   WHERE data->>'challengeId' = '{id}'
   ORDER BY created_at;
   ```

2. Are they from same scheduler run?

**Solution:**
- De-dupe window only checks past 30 minutes
- If sending duplicates every 5 min, window hasn't passed yet
- Wait 35 minutes from first notification

### Issue: 1-hour and 10-minute notifications both sent

**This is a problem!** Expected behavior:

**Should happen:**
- Challenge 8 mins away → only 10-min notification
- Challenge 35 mins away → only 1-hour notification
- Challenge 65 mins away → only 1-hour notification

**Check logs:**
```bash
# Should see:
# "Sent 1-hour warning for challenge X"
# OR
# "Sent 10-minute warning for challenge X"
# NOT both
```

**Solution:**
- Check `challengeScheduler.ts` line that skips 1-hour if `minutesUntilDue < 10`
- Verify condition is: `if (minutesUntilDue < 10) continue;`

---

## EXPECTED TIMELINE

| Test | Duration | Complexity |
|------|----------|-----------|
| Test A (1-hour) | 10 min | Easy |
| Test B (10-min) | 10 min | Easy |
| Test C (no dupe) | 15 min | Easy |
| Test D (precedence) | 10 min | Easy |
| Test E (full) | 140 min | Hard |
| **Total** | **185 min** | - |
| **Quick version** | **30 min** | Fast |

---

## SUCCESS CHECKLIST

- [ ] Test A passes: 3 notifications at 1-hour mark
- [ ] Test B passes: 3 notifications at 10-minute mark
- [ ] Test C passes: No duplicates after 3 scheduler runs
- [ ] Test D passes: Only 10-min notifications, not 1-hour
- [ ] Test E passes: Full lifecycle with all 3 notification types
- [ ] Server logs show correct messages
- [ ] No errors in console

---

## NEXT STEPS

If all tests pass:
1. ✅ Phase 2 complete
2. 🚀 Move to Phase 3: Batched Payouts
3. 📊 Consider A/B test: notifications vs no notifications

If tests fail:
1. 🔍 Debug using troubleshooting guide above
2. 📝 Check server logs and database
3. 💬 Review `server/challengeScheduler.ts` logic

---

**Good luck! 🎯**
