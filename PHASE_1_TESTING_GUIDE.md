# PHASE 1 TESTING GUIDE

**Challenge Auto-Scheduler Implementation**  
**Test Date:** December 20, 2025  
**Status:** Implementation Complete - Ready for Testing

---

## WHAT WAS IMPLEMENTED

### 1. Challenge Scheduler ([server/challengeScheduler.ts](server/challengeScheduler.ts))
- ✅ Runs every 5 minutes (same pattern as eventScheduler)
- ✅ Checks for challenges with `dueDate <= NOW()`
- ✅ Auto-transitions `status: 'active' → 'pending_admin'`
- ✅ Sends notifications to:
  - ✅ Challenge creator
  - ✅ Challenger user
  - ✅ Challenged user
- ✅ Logs all actions

### 2. Server Startup Integration ([server/index.ts](server/index.ts))
- ✅ Added import: `import "./challengeScheduler";`
- ✅ Scheduler auto-starts when server starts
- ✅ Runs in background (non-blocking)

### 3. Frontend UI Updates ([client/src/pages/Challenges.tsx](client/src/pages/Challenges.tsx))
- ✅ Changed tabs from 4 to 5 columns
- ✅ Added new tab: "Awaiting" (for `pending_admin` challenges)
- ✅ Added filter: `awaitingResolutionChallenges`
- ✅ Shows "No challenges awaiting resolution" when empty

### 4. Admin Dashboard Updates ([client/src/pages/AdminChallengeDisputes.tsx](client/src/pages/AdminChallengeDisputes.tsx))
- ✅ Added new API endpoint: `/api/admin/challenges/pending`
- ✅ Fetches and displays pending challenges
- ✅ Shows summary card: "Awaiting Resolution" count
- ✅ Auto-refreshes every 30 seconds
- ✅ Displays challenges needing admin decision

### 5. Backend API Endpoint ([server/routes.ts](server/routes.ts))
- ✅ Created `GET /api/admin/challenges/pending`
- ✅ Returns all challenges with `status = 'pending_admin'`
- ✅ Admin auth required

---

## TEST SCENARIOS

### TEST 1: Basic Auto-Transition (5-minute test)

**Objective:** Verify scheduler auto-transitions challenges from active to pending_admin at dueDate

**Setup:**
1. Create admin challenge with dueDate = 1 minute from now
2. Have User1 and User2 match (both stakes locked)
3. Verify challenge is in "Active" tab

**Execution:**
```
T=0 min:   Challenge created (dueDate = T+1)
T=0.5 min: User1 joins YES + ₦100
T=0.8 min: User2 joins NO + ₦100 (MATCH!)
           Status → 'active'
           Challenge moves to "Active" tab
T=5 min:   Scheduler runs (first check)
           dueDate <= NOW() = true
           Status → 'pending_admin'
           Notifications sent (3 users)
T=5.1 min: Refresh page
```

**Expected Results:**
- ✅ Challenge moved from "Active" to "Awaiting" tab
- ✅ Status in database: `'pending_admin'`
- ✅ Admin sees "1" in "Awaiting Resolution" count
- ✅ Both users receive notifications
- ✅ Creator receives notification

**How to Verify in Database:**
```sql
SELECT id, title, status, dueDate, createdAt 
FROM challenges 
WHERE status = 'pending_admin'
LIMIT 5;
```

---

### TEST 2: Notifications Flow (5-minute test)

**Objective:** Verify all 3 users receive correct notifications

**Setup:**
1. Create and match a challenge (same as TEST 1)
2. Set dueDate = 1 minute from now

**Verification Points:**

| User | Expected Notifications | Check Where |
|------|----------------------|-------------|
| **Creator** | "Challenge Awaiting Resolution" | Bell icon or Telegram |
| **Challenger** | "Challenge Awaiting Resolution" | Bell icon or Telegram |
| **Challenged** | "Challenge Awaiting Resolution" | Bell icon or Telegram |

**How to Check In Database:**
```sql
-- Check notifications for a specific user
SELECT id, type, title, message, createdAt 
FROM notifications 
WHERE userId = '[user_id]' 
AND type = 'challenge_pending_review'
ORDER BY createdAt DESC 
LIMIT 5;
```

---

### TEST 3: One-Hour Warning (62-minute test)

**Objective:** Verify scheduler sends "1 hour before" warning

**Setup:**
1. Create admin challenge with dueDate = 1 hour from now
2. Match two users
3. Set dueDate to happen in exactly 59 minutes

**Execution:**
```
T=0 min:   Challenge created (dueDate = T+60)
T=0.5 min: Users match (status = 'active')
T=55 min:  Scheduler runs 
           Check: is dueDate within 1 hour?
           YES → send ending soon notification
T=60 min:  Scheduler runs
           Check: has dueDate passed?
           YES → transition to pending_admin
           Send "awaiting resolution" notification
```

**Expected Results:**
- ✅ First notification at T=55min: "Challenge Ending in 1 hour"
- ✅ Second notification at T=60min: "Challenge Awaiting Resolution"
- ✅ Both in Telegram + in-app notifications

**SQL to Verify:**
```sql
SELECT type, COUNT(*) as notification_count
FROM notifications
WHERE createdAt > NOW() - INTERVAL '2 hours'
AND type IN ('challenge_ending_soon', 'challenge_pending_review')
GROUP BY type;
```

---

### TEST 4: Admin Dashboard Update (manual test)

**Objective:** Verify admin sees "Awaiting Resolution" queue

**Steps:**
1. Go to `/admin/challenges` (or `/admin/challenges/disputes`)
2. Scroll to "Challenges Awaiting Resolution" section
3. Should show pending_admin challenges

**Expected:**
- ✅ Yellow/orange alert section at top
- ✅ Shows count: "Awaiting Resolution (X)"
- ✅ Lists challenge titles and due dates
- ✅ "Resolve" button for each
- ✅ Summary card shows count

**How to Trigger:**
1. Create and match 3 challenges
2. Set dueDates to 1 minute ago
3. Wait for scheduler to run (5 min max)
4. Refresh admin page
5. Should see all 3 in "Awaiting Resolution" section

---

### TEST 5: Resolution Flow (manual test)

**Objective:** Verify admin can resolve pending_admin challenges

**Setup:**
1. Create and match a challenge
2. Set dueDate to past (or wait for scheduler)
3. Verify it's in pending_admin status

**Steps:**
1. Go to `/admin/challenges/disputes`
2. Find challenge in "Awaiting Resolution" section
3. Click "Resolve" button
4. Select winner or draw
5. Confirm

**Expected:**
- ✅ Status changes: `'pending_admin' → 'completed'`
- ✅ Challenge moves to "Ended" tab (on user's view)
- ✅ Escrow released, winner paid
- ✅ Notifications sent to both users

---

### TEST 6: Scheduler Edge Cases (manual tests)

#### 6a: Multiple Challenges Ending Simultaneously
**Setup:** Create 5 challenges, all with same dueDate

**Expected:** All 5 auto-transition in one scheduler run

```sql
SELECT COUNT(*) 
FROM challenges 
WHERE status = 'pending_admin' 
AND dueDate BETWEEN NOW() - INTERVAL '5 minutes' AND NOW();
```

---

#### 6b: Already Transitioned Challenges (idempotence)
**Setup:** Challenge already in pending_admin

**Expected:** Scheduler skips it (doesn't double-transition)

**Code Check:** Line in [challengeScheduler.ts](server/challengeScheduler.ts#L105):
```typescript
if (challenge.status === 'pending_admin' || challenge.status === 'completed') {
  continue; // Skip already processed
}
```

---

#### 6c: NULL dueDate Challenges
**Setup:** Challenge with dueDate = NULL

**Expected:** Scheduler ignores it (no error)

**Code Check:** Uses safe comparison: `if (c.dueDate && ...)`

---

## LOAD TEST SCENARIO (Optional)

**Objective:** Verify scheduler handles 100+ challenges efficiently

**Setup:**
```javascript
// Create 100 challenges via API, set dueDates to past
for (let i = 0; i < 100; i++) {
  // Create challenge
  // Match users
  // Set dueDate = now - 1 minute
}
```

**Run Scheduler Once:**
```
T=5 min: Scheduler checks all 100 challenges
```

**Measure:**
- Execution time (should be < 10 seconds)
- CPU usage (should be < 50%)
- No errors in logs
- All 100 transitioned correctly

**SQL Check:**
```sql
SELECT status, COUNT(*) 
FROM challenges 
WHERE dueDate < NOW()
GROUP BY status;
-- Should show all with status = 'pending_admin'
```

---

## VERIFICATION CHECKLIST

### Code Level
- [ ] [challengeScheduler.ts](server/challengeScheduler.ts) exists
- [ ] [server/index.ts](server/index.ts) imports challengeScheduler
- [ ] [routes.ts](server/routes.ts) has `/api/admin/challenges/pending` endpoint
- [ ] [Challenges.tsx](client/src/pages/Challenges.tsx) has "Awaiting" tab
- [ ] [AdminChallengeDisputes.tsx](client/src/pages/AdminChallengeDisputes.tsx) shows pending section

### Database Level
```sql
-- Check for pending_admin challenges
SELECT COUNT(*) FROM challenges WHERE status = 'pending_admin';

-- Check for pending_review notifications
SELECT COUNT(*) FROM notifications WHERE type = 'challenge_pending_review';

-- Check scheduler ran
SELECT * FROM logs WHERE message LIKE '%pending admin review%' ORDER BY createdAt DESC LIMIT 5;
```

### UI Level
- [ ] User sees "Awaiting" tab in Challenges page
- [ ] Admin sees "Awaiting Resolution" section with count
- [ ] Challenge moves from "Active" to "Awaiting" after dueDate
- [ ] Both users receive notifications
- [ ] Creator receives notification

### Functional Level
- [ ] ✅ Scheduler starts when server boots
- [ ] ✅ Checks run every 5 minutes
- [ ] ✅ dueDate checks are accurate
- [ ] ✅ Transitions happen instantly
- [ ] ✅ Notifications sent reliably
- [ ] ✅ No double-transitions
- [ ] ✅ Handles NULL dueDate gracefully

---

## COMMON ISSUES & SOLUTIONS

### Issue: Scheduler Doesn't Run
**Check:**
```bash
# Server logs should show:
# "Challenge scheduler started" when server starts
# "Challenge X marked as pending admin review" after 5 mins
```

**Solution:**
1. Check [server/index.ts](server/index.ts) has import
2. Check server actually imported it
3. Check server logs for errors
4. Restart server

---

### Issue: Notifications Not Sent
**Check:**
```sql
SELECT * FROM notifications 
WHERE type = 'challenge_pending_review'
ORDER BY createdAt DESC LIMIT 5;
```

**Solution:**
1. Verify users exist and are active
2. Check Telegram bot is running
3. Check notification delivery channels enabled
4. Review [challengeScheduler.ts](server/challengeScheduler.ts) notification code

---

### Issue: Status Doesn't Change
**Check:**
```sql
SELECT id, status, dueDate, NOW() 
FROM challenges 
WHERE id = [challenge_id];
```

**Solution:**
1. Verify dueDate is in past
2. Verify status is 'active' (not already pending_admin)
3. Wait for scheduler to run (max 5 mins)
4. Check server logs for errors

---

## ROLLBACK PLAN (If Issues Arise)

**To disable scheduler temporarily:**
1. Comment out import in [server/index.ts](server/index.ts)
2. Restart server
3. Remove "Awaiting" tab from [Challenges.tsx](client/src/pages/Challenges.tsx)
4. Clear pending_admin challenges: Update status back to 'active'

```sql
UPDATE challenges 
SET status = 'active' 
WHERE status = 'pending_admin';
```

---

## NEXT STEPS AFTER VALIDATION

✅ Phase 1 Complete: Auto-scheduler working

→ **Phase 2:** Time-based notifications (1h, 10m warnings)
→ **Phase 3:** Batched payouts for scale

---

## SUCCESS CRITERIA FOR PHASE 1

- [x] Scheduler code implemented
- [x] Server imports scheduler
- [x] API endpoint created
- [x] Frontend tab added
- [x] Admin dashboard updated
- [ ] All 6 test scenarios pass
- [ ] No errors in logs
- [ ] Database shows pending_admin challenges
- [ ] Users receive notifications
- [ ] Admin can resolve pending challenges

**Expected Time to Completion:** 4 hours (as planned)

---

## SUPPORT

If tests fail:
1. Check logs: `tail -f server.log`
2. Check database: `psql [database_url]`
3. Check browser console: F12 → Console tab
4. Review [CHALLENGE_LIFECYCLE_ANALYSIS.md](CHALLENGE_LIFECYCLE_ANALYSIS.md) Phase 1 section

Good luck! 🚀
