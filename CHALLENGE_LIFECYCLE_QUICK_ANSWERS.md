# CHALLENGE LIFECYCLE - QUICK ANSWERS

## Your Questions Answered

### 1. WHICH TAB DOES A MATCHED ADMIN CHALLENGE MOVE TO?

**Answer:** From **Live** → **Active**

When a challenge is created by admin:
- **Appears in:** "Live" tab (status = 'open')
- **Admin's challenge** = `adminCreated: true`
- **Stays there** until User2 matches User1
- **When User2 joins with matching stake:**
  - Status changes: `'open' → 'active'` (line 1474 storage.ts)
  - Automatically moves to: **"Active" tab**
  - Both users now see it in Active tab
  - Can chat and view predictions

---

### 2. WHAT DETERMINES THE END OF THE EVENT?

**Current System:** MANUAL ADMIN RESOLUTION ONLY

| Determinant | Implemented? |
|-------------|--------------|
| Time-based (dueDate) | ✅ Schema exists, ❌ NOT auto-checked |
| Admin manual resolution | ✅ YES (primary method) |
| Auto-scheduler | ❌ NO (not implemented) |

**What Actually Happens:**
1. Challenge dueDate arrives → **NOTHING HAPPENS** (no scheduler)
2. Challenge stays `status = 'active'` **indefinitely**
3. Admin must manually go to `/admin/challenges/disputes`
4. Admin clicks "Resolve Challenge"
5. Status changes to `'completed'` → moves to **"Ended"** tab

**What SHOULD Happen (not yet coded):**
- Scheduler checks every 5 minutes for `dueDate <= NOW()`
- Auto-transitions to `status = 'pending_admin'`
- Admin sees in "Awaiting Resolution" dashboard section
- Time-based notifications trigger

---

### 3. WILL ADMIN GET NOTIFICATIONS ABOUT CHALLENGES?

**Current Status:** ⚠️ PARTIAL - Dashboard exists, time-based alerts don't

**What Admin CAN See:**
- ✅ `/admin/challenges/disputes` - View all active challenges
- ✅ `/admin/challenges/payouts` - Process payouts
- ✅ Dashboard - Browse, filter, search
- ❌ Push alerts for "challenge ending in 1 hour"
- ❌ Escalation for past-deadline challenges
- ❌ Auto-pending queue notification

**What Admin MUST DO NOW:**
- Manually check dashboard regularly
- Remember challenge deadlines
- Click to resolve manually
- No automated alerts for approaching deadlines

---

### 4. WILL MATCHED USERS GET NOTIFICATIONS?

**Answer:** ✅ YES - Comprehensive system

**Users receive notifications for:**

| Event | Type | Message |
|-------|------|---------|
| Join & stake locked | `coins_locked` | "₦100 locked in escrow" |
| Match found | `match_found` | "Match found! Stakes locked in escrow." |
| Challenge matched | `challenge_matched` | "Opponent selected! Challenge activated." |
| Challenge starts | `challenge_started` | Real-time in chat |
| **1 hour before end** | `challenge_ending_soon` | ⚠️ Code exists but **NOT INVOKED** |
| **10 mins before end** | `challenge_ending_urgent` | ⚠️ Code exists but **NOT INVOKED** |
| Challenge ends | `challenge_ended` | "Challenge ended. Awaiting resolution." |
| Escrow released | `coins_released` | "🎉 You won ₦190!" |
| Draw/Refund | `challenge_draw` | "Draw! Stake returned." |

**Delivery Methods:**
- ✅ In-app notifications (database)
- ✅ Telegram bot notifications
- ✅ Push notifications (Pusher)
- ✅ WebSocket real-time updates

**Gaps:**
- ⚠️ Time-based warnings (1h, 10m before deadline) are coded but NOT triggered by any scheduler

---

## PAYOUTS EXPLANATION

### How Multiple Matched Users Are Paid

**For Admin Challenge with 10,000 matched users:**

**Current System (Single Call):**
```
Admin clicks "Resolve" 
  ↓
processChallengePayouts(challengeId)
  ↓
Loop through all 10,000 winners
  ↓
Update each balance (1 by 1)
  ↓
Admin UI BLOCKS until done
  ↓
Risks: Timeout, partial failure
```

**Math:**
- Total Pool: 10,000 users × ₦100 = ₦1,000,000
- Platform Fee: 5% = ₦50,000
- Winner Pool: ₦950,000
- Each winner gets: ₦950,000 ÷ 5,000 = ₦190

**What SHOULD Happen (not yet coded):**
```
Admin clicks "Resolve" 
  ↓
Create PayoutJob(status='queued')
  ↓
Return immediately to admin
  ↓
Background worker processes 500 users at a time
  ↓
Admin sees progress: "0 / 10,000"
  ↓
Admin UI never blocks
  ↓
Batch 1: Users 0-500 ✅
Batch 2: Users 501-1000 ✅
... (continues in background)
```

---

## WHAT'S MISSING (The 3 Gaps)

### GAP 1: No Auto-Scheduler for Challenges ❌

**Status:** Scheduled, monitored, auto-transitioned
- ❌ Events have this (eventScheduler.ts)
- ❌ Challenges don't

**Impact:** Challenges stay active forever if admin forgets

### GAP 2: Time-Based Notifications Not Triggered ❌

**Status:** Notification code exists but scheduler doesn't call it
- ✅ Code written in challengeNotificationTriggers.ts
- ❌ No code invokes it

**Impact:** Users don't get "1 hour left" or "10 mins left" warnings

### GAP 3: Payouts Not Batched ❌

**Status:** Single synchronous call
- ❌ Can freeze admin UI for large challenges
- ❌ Risk of partial failure

**Impact:** Admin waits, UI blocks, user experience poor at scale

---

## IMPLEMENTATION PRIORITY

If implementing (recommended order):

1. **Phase 1 (4h):** Add challengeScheduler + auto-transitions
2. **Phase 2 (6h):** Add batched payouts + background jobs
3. **Phase 3 (3h):** Add admin dashboard for pending challenges

**Total:** ~13 hours → production ready for scale

---

## SUMMARY TABLE

| Question | Answer | Status |
|----------|--------|--------|
| Which tab after match? | Live → Active | ✅ Works |
| What ends the challenge? | Manual admin only (currently) | ⚠️ Partial (auto-transition not coded) |
| Admin notifications? | Dashboard yes, alerts no | ⚠️ Partial |
| User notifications? | Comprehensive, time-based missing | ⚠️ Partial |
| Payout for 10k users? | All paid, admin UI blocks | ⚠️ Needs batching |

---

## YOUR UNDERSTANDING WAS CORRECT

✅ You accurately identified:
1. Tab transitions work (Live → Active → Ended)
2. Admin must manually resolve
3. Users get escrow + match notifications
4. System is production-ready but manual-driven

⚠️ What you need to add:
1. Automated time-based state transitions
2. Time-aware notifications
3. Batched payout processing

**Next Step:** Which phase would you like to implement first?
