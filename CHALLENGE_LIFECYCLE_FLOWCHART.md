# CHALLENGE LIFECYCLE - VISUAL FLOWCHART

## Complete Lifecycle with All Notifications

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ADMIN CREATES CHALLENGE                                   │
│                                                                                  │
│  Input:  title, category, amount, dueDate, yesMultiplier, noMultiplier          │
│  POST /api/challenges/create                                                     │
│                                                                                  │
│  Result: ✅ Challenge created                                                    │
│          Status: "open"                                                          │
│          Tab: "Live" ← APPEARS HERE                                             │
│                                                                                  │
│  Notifications Sent:                                                             │
│    📱 All users: "⚡ New Challenge: [title]!"                                    │
│    📧 Telegram: Yes                                                              │
│    🔔 In-app: Yes                                                                │
│                                                                                  │
│  Admin Notified: ❌ No alert                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        USER 1 JOINS: YES + ₦100                                  │
│                                                                                  │
│  Input:  side="YES", stakeAmount=100                                            │
│  POST /api/challenges/{id}/queue/join                                            │
│                                                                                  │
│  What Happens:                                                                   │
│    1. Check user balance: ✅ (has 100+)                                          │
│    2. Check FCFS match: ❌ (no YES opponent yet)                                  │
│    3. Add to queue: "waiting" state                                              │
│    4. Deduct stake: ₦100 locked in escrow                                        │
│                                                                                  │
│  Status: Still "open"                                                            │
│  Tab: Still "Live"                                                               │
│                                                                                  │
│  Notifications Sent:                                                             │
│    📱 User1: "₦100 locked in escrow"                                             │
│    💬 Type: 'coins_locked'                                                       │
│                                                                                  │
│  Admin Notified: ❌ No                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                                    │ Waiting...
                                    │ (could be seconds or hours)
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        USER 2 JOINS: NO + ₦100                                   │
│                                                                                  │
│  Input:  side="NO", stakeAmount=100                                             │
│  POST /api/challenges/{id}/queue/join                                            │
│                                                                                  │
│  What Happens:                                                                   │
│    1. Check user balance: ✅ (has 100+)                                          │
│    2. FCFS Matcher runs:                                                         │
│       └─ Look for YES opponent in queue                                          │
│       └─ Stake tolerance: ±20% (80-120 coins)                                    │
│       └─ User1's ₦100 is within range: ✅                                        │
│       └─ Match found!                                                            │
│    3. Create escrow for both users (atomic transaction)                          │
│    4. Update challenge stake totals                                              │
│                                                                                  │
│  ⚡ STATUS CHANGES: "open" → "active"                                            │
│  ⚡ TAB MOVES: "Live" → "Active"                                                  │
│                                                                                  │
│  Notifications Sent:                                                             │
│    📱 User1: "Match found! Stakes locked in escrow."                             │
│    📱 User2: "Match found! Stakes locked in escrow."                             │
│    💬 Type: 'match_found' / 'escrow_lock'                                        │
│    📧 Telegram: Yes                                                              │
│    🔔 In-app: Yes                                                                │
│                                                                                  │
│  Admin Notified: ❌ No alert (dashboard only)                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    CHALLENGE ONGOING (5 mins - 5 days)                           │
│                                                                                  │
│  Users Can:                                                                      │
│    • Chat via WebSocket                                                          │
│    • Track predictions real-time                                                 │
│    • Update predictions (if enabled)                                             │
│    • See opponent's activity                                                     │
│                                                                                  │
│  Status: "active"                                                                │
│  Tab: "Active"                                                                   │
│                                                                                  │
│  ⏰ dueDate Approaching:                                                          │
│    ❌ NO NOTIFICATION YET (scheduler not implemented)                            │
│    ❌ NO ADMIN ALERT                                                             │
│    ⚠️ Code exists but not triggered                                              │
│                                                                                  │
│  Timeline of Missing Notifications:                                              │
│    • dueDate - 1 hour: 📱 "Challenge ending in 1 hour" (NOT SENT)              │
│    • dueDate - 10 min: 📱 "10 minutes left!" (NOT SENT)                        │
│    • dueDate reached:  🛑 "Challenge ended" (NOT SENT)                          │
│                                                                                  │
│  What Admin Sees:                                                                │
│    ✅ If they manually check dashboard                                           │
│    ❌ No push notification                                                       │
│    ❌ No escalation alert                                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        dueDate PASSES (Current System)                           │
│                                                                                  │
│  What Happens:                                                                   │
│    ❌ NOTHING - Challenge is still "active"                                      │
│    ❌ No automatic status change                                                 │
│    ❌ No scheduler running to check                                              │
│                                                                                  │
│  Why?                                                                            │
│    • ChallengeScheduler doesn't exist                                            │
│    • No code checks: SELECT * WHERE dueDate <= NOW()                            │
│    • Only EventScheduler.ts does this (for events, not challenges)               │
│                                                                                  │
│  Users See:                                                                      │
│    ⚠️ Challenge is still "active"                                                │
│    ❓ "Is this still happening?"                                                 │
│    💭 Confused about state                                                       │
│                                                                                  │
│  Admin Must:                                                                     │
│    1. Remember the deadline                                                      │
│    2. Go to /admin/challenges/disputes                                          │
│    3. Find the challenge                                                         │
│    4. Click "Resolve Challenge"                                                  │
│    5. Select winner: challenger_won / challenged_won / draw                      │
│    6. Submit                                                                     │
│                                                                                  │
│  Problem at Scale:                                                               │
│    1,000 challenges due at same time                                             │
│    → Admin must resolve 1,000 individually                                       │
│    → Takes hours                                                                 │
│    → Users frustrated                                                            │
│    → Revenue delayed                                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                  ADMIN MANUALLY RESOLVES CHALLENGE                               │
│                                                                                  │
│  Action:                                                                         │
│    Admin POST /api/admin/challenges/{id}/result                                 │
│    Body: { result: "challenger_won" }                                           │
│                                                                                  │
│  What Happens:                                                                   │
│    1. Set challenge.result = "challenger_won"                                   │
│    2. ⚡ STATUS CHANGES: "active" → "completed"                                  │
│    3. ⚡ TAB MOVES: "Active" → "Ended"                                            │
│    4. Trigger processChallengePayouts()                                          │
│                                                                                  │
│  Payout Calculation:                                                             │
│    • Both users staked: ₦100 each                                                │
│    • Total Pool: ₦200                                                            │
│    • Platform Fee: 5% = ₦10                                                      │
│    • Winner Pool: ₦190                                                           │
│    • Bonus Check: ✅ If challenger on bonus side and bonus active                │
│      └─ Multiplied: ₦190 × 2.5 = ₦475 (example)                                 │
│                                                                                  │
│  Notifications Sent:                                                             │
│    📱 User1 (winner): "🎉 You won ₦190! Coins added to account."               │
│    📱 User2 (loser):  "Challenge ended. Better luck next time."                │
│    💬 Type: 'coins_released' / 'challenge_lost'                                 │
│    📧 Telegram: Yes                                                              │
│    🔔 In-app: Yes                                                                │
│                                                                                  │
│  Transactions Created:                                                           │
│    • User1: +₦190 (type: 'challenge_win')                                       │
│    • User2: -₦100 (lost)                                                         │
│    • Platform: +₦10 (fee)                                                        │
│                                                                                  │
│  Admin Notified: ✅ If checking dashboard                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    CHALLENGE COMPLETED (Final State)                             │
│                                                                                  │
│  Status: "completed"                                                             │
│  Tab: "Ended"                                                                    │
│  Result: "challenger_won"                                                        │
│                                                                                  │
│  What Users See:                                                                 │
│    • Challenge in "Ended" tab                                                    │
│    • Final result displayed                                                      │
│    • Payout amount shown                                                         │
│    • Chat history preserved                                                      │
│                                                                                  │
│  What Admin Sees:                                                                │
│    ✅ No longer in "disputes" or "pending"                                       │
│    ✅ Marked as "resolved"                                                       │
│    ✅ Payout confirmed                                                           │
│                                                                                  │
│  Data State:                                                                     │
│    ✅ Challenge immutable                                                        │
│    ✅ Escrow released                                                            │
│    ✅ Ledger recorded                                                            │
│    ✅ All notifications sent                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Tab System Mapping

```
┌────────────────────────────────────────────────────────────────────┐
│                    CHALLENGE TABS IN UI                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  TAB 1: "Live"                                                     │
│  ├─ Filter: adminCreated = true                                   │
│  ├─ Status: "open"                                                │
│  ├─ Visibility: All users                                         │
│  └─ Action: Join YES or NO queue                                  │
│                                                                    │
│  TAB 2: "Pending"                                                 │
│  ├─ Filter: not adminCreated + user is participant               │
│  ├─ Status: "pending"                                             │
│  ├─ Visibility: Your personal challenges                          │
│  └─ Action: Wait for acceptance                                   │
│                                                                    │
│  TAB 3: "Active"  ← MATCHED CHALLENGES MOVE HERE                 │
│  ├─ Filter: status = "active"                                    │
│  ├─ Status: "active"                                              │
│  ├─ Visibility: Your matched challenges                           │
│  └─ Action: Chat, track predictions                               │
│                                                                    │
│  TAB 4: "Ended"  ← AFTER ADMIN RESOLVES                          │
│  ├─ Filter: status = "completed"                                 │
│  ├─ Status: "completed"                                           │
│  ├─ Visibility: Challenge history                                 │
│  └─ Action: View results, payout info                             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Status Transitions Diagram

```
                           ┌─────────────────────┐
                           │   CHALLENGE STATES  │
                           └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  "open"                                                             │
│  ├─ Admin creates challenge                                        │
│  ├─ Users can join queue (YES or NO)                               │
│  └─ Waiting for 2 users with matching stakes                       │
│              ↓                                                      │
│  (User2 joins and matches User1)                                   │
│              ↓                                                      │
│  "active" ← User matched, stakes locked in escrow                  │
│  ├─ Challenge now active                                           │
│  ├─ Users can chat                                                 │
│  ├─ Escrow cannot be withdrawn                                     │
│  └─ Awaiting dueDate or admin resolution                           │
│              ↓                                                      │
│  Option A: dueDate passes (NOT YET IMPLEMENTED)                    │
│  │          → "pending_admin" (defined but unused)                │
│  │            ↓                                                    │
│  │          Admin sees in "Awaiting Resolution" queue              │
│  │            ↓                                                    │
│  │                                                                 │
│  Option B: Admin manually resolves (CURRENT)                       │
│  │          → /api/admin/challenges/{id}/result                   │
│  │            ↓                                                    │
│  └──────────→ "completed"                                          │
│              ├─ Result recorded (challenger_won/challenged_won/draw)
│              ├─ Payout processed                                    │
│              ├─ Escrow released                                     │
│              ├─ All notifications sent                              │
│              └─ Challenge moved to "Ended" tab                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Notification Timeline

```
┌────────────────────────────────────────────────────────────────────┐
│              NOTIFICATIONS DURING CHALLENGE LIFECYCLE               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  T=0 (Admin creates)                                               │
│  ├─ ✅ All users: "⚡ New Challenge: [title]!"                    │
│  └─ Channels: Push + In-app                                        │
│                                                                    │
│  T=1 (User1 joins)                                                 │
│  ├─ ✅ User1: "₦100 locked in escrow"                             │
│  └─ Channels: Push + In-app + Telegram                             │
│                                                                    │
│  T=2 (User2 joins & MATCH)                                         │
│  ├─ ✅ User1: "Match found! Stakes locked in escrow."             │
│  ├─ ✅ User2: "Match found! Stakes locked in escrow."             │
│  └─ Channels: Push + In-app + Telegram                             │
│                                                                    │
│  T=3 to T=N (Ongoing)                                              │
│  ├─ ✅ Real-time chat updates (WebSocket)                         │
│  ├─ ✅ Prediction updates (live)                                  │
│  └─ Channels: WebSocket                                            │
│                                                                    │
│  dueDate - 1 hour                                                  │
│  ├─ ❌ "Challenge ending in 1 hour" (CODE EXISTS, NOT TRIGGERED)  │
│  └─ Would go to: Push + In-app + Telegram                          │
│                                                                    │
│  dueDate - 10 mins                                                 │
│  ├─ ❌ "10 minutes left!" (CODE EXISTS, NOT TRIGGERED)            │
│  └─ Would go to: Push + In-app + Telegram                          │
│                                                                    │
│  dueDate passed                                                    │
│  ├─ ❌ "Challenge ended. Awaiting admin resolution." (NOT SENT)   │
│  └─ Would go to: Push + In-app + Telegram                          │
│                                                                    │
│  Admin resolves                                                    │
│  ├─ ✅ Winner: "🎉 You won ₦190! Coins added."                    │
│  ├─ ✅ Loser: "Challenge ended. Better luck next time."           │
│  └─ Channels: Push + In-app + Telegram                             │
│                                                                    │
│  ✅ = Implemented & Working                                        │
│  ❌ = Code exists but no trigger                                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## What's Missing vs. What Works

```
┌─────────────────────────────────────────────────────────────────┐
│                 FEATURE STATUS COMPARISON                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ WORKS (Production Ready)                                    │
│  ├─ Challenge creation by admin                                │
│  ├─ FCFS matching algorithm                                    │
│  ├─ Escrow locking & release                                   │
│  ├─ Manual admin resolution                                    │
│  ├─ Single-pair payout processing                              │
│  ├─ Match & join notifications                                 │
│  ├─ Telegram integration                                       │
│  ├─ WebSocket real-time updates                                │
│  └─ Tab transitions (open→active→completed)                    │
│                                                                 │
│  ⚠️  PARTIAL (Needs work)                                       │
│  ├─ Time-based auto-completion (code exists, no scheduler)     │
│  ├─ Admin notifications (dashboard yes, alerts no)             │
│  ├─ Batch payout processing (not implemented)                  │
│  └─ Large-scale challenge handling (100+ users)                │
│                                                                 │
│  ❌ NOT IMPLEMENTED (Do this next)                              │
│  ├─ Challenge auto-scheduler (every 5 mins)                    │
│  ├─ pending_admin state usage                                  │
│  ├─ Time-based notification triggers                           │
│  ├─ Admin dashboard for "Awaiting Resolution" section          │
│  ├─ Batched payout jobs                                        │
│  ├─ Payout progress tracking                                   │
│  └─ Auto-resolution for deterministic categories               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary for Your Team

**Show your team this:**

1. **Matched challenges move:** Live → Active → Ended ✅
2. **Challenge ends:** Admin must manually resolve (auto-scheduler not coded)
3. **Admin notifications:** Dashboard only (alerts not coded)
4. **User notifications:** Comprehensive + time-based (time-based not triggered)
5. **Multiple users payout:** All paid in single call (needs batching at scale)

**Next priority:** Implement auto-scheduler + time-based notifications + batch payouts
