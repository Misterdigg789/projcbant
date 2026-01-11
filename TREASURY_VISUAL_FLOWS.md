# Treasury Balancing - Visual Flow Diagrams

## 1. User Journey Through Treasury Match

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: USER JOINS CHALLENGE                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User: "I want to bet ₦5,000 on YES"                           │
│  System: Adds user to pair_queue (side=YES, staked=5000)       │
│                                                                 │
│  [Waiting for opponent...]                                     │
│  Real users joining: [Slow... only 1 person on NO side]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: ADMIN SEES IMBALANCE                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dashboard: YES (15 users) vs NO (2 users)                     │
│  Gap: ₦65,000 (13 unmatched YES users × ₦5,000)               │
│  Match Rate: 14% (2 matches / 16 potential)                   │
│                                                                 │
│  Admin Action: "Fill 13 matches on NO side"                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: TREASURY CREATES MATCHES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  For each unmatched YES user:                                  │
│  ┌─────────────────────────────────────┐                       │
│  │ Match Created:                      │                       │
│  │ • Real User: Yes5000_ABC (YES side) │                       │
│  │ • Treasury: ShadowPersona_1 (NO)    │                       │
│  │ • Stake: ₦5,000 each                │                       │
│  │ • Status: ACTIVE                    │                       │
│  └─────────────────────────────────────┘                       │
│                                                                 │
│  ✉️  USER NOTIFICATION: "You matched with KellyBeats!"        │
│      "Competing on opposite sides with ₦5,000 stake"         │
│                                                                 │
│  ✉️  ADMIN NOTIFICATION: "13 Treasury matches filled"          │
│      "Side: NO, Total: ₦65,000"                               │
│                                                                 │
│  DATABASE:                                                     │
│  treasury_matches table gets 13 new records                   │
│  Each with: real_user_side=YES, treasury_side=NO, staked=5000 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: CHALLENGE PROGRESSES                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  All 15 YES users now have opponents (13 Treasury, 2 real)    │
│  Challenge plays out normally:                                │
│  • Time limit counting down                                   │
│  • Both sides making calls/bets                               │
│  • Score updating in real-time                                │
│                                                                 │
│  From users' perspective:                                     │
│  → Shadow Personas look and feel like real users              │
│  → No visible difference                                      │
│  → Normal gameplay experience                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: ADMIN RESOLVES CHALLENGE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Admin determines final score                                  │
│  Clicks: "Resolve: Challenger Won" (YES side wins)            │
│                                                                 │
│  System:                                                       │
│  1. Sets challenge.result = "challenger_won"                  │
│  2. Notifies all users (existing behavior)                    │
│  3. NEW: Initiates Treasury Settlement                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: TREASURY SETTLEMENT                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  For each Treasury match:                                      │
│  ┌─────────────────────────────────────────┐                  │
│  │ Match Analysis:                         │                  │
│  │ • Challenge Result: YES WON             │                  │
│  │ • User Bet Side: YES                    │                  │
│  │ • Treasury Bet Side: NO (opposite)      │                  │
│  │ • Treasury Won?: NO (bet lost)          │                  │
│  │ • Payout to Treasury: ₦0                │                  │
│  │ • Status: SETTLED                       │                  │
│  └─────────────────────────────────────────┘                  │
│                                                                 │
│  Settlement Summary:                                           │
│  • Total Matches: 13                                           │
│  • Treasury Won: 2 (paid ₦10,000)                             │
│  • Treasury Lost: 11 (lost ₦55,000)                           │
│  • Net P&L: -₦45,000                                          │
│                                                                 │
│  DATABASE UPDATES:                                            │
│  • treasury_matches.status = "settled"                        │
│  • treasury_matches.result = "treasury_won/lost"              │
│  • treasury_matches.treasuryPayout = calculated               │
│  • admin_wallet_transactions records loss                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: NOTIFICATIONS SENT                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤 USER NOTIFICATIONS (to all matched users):                │
│     "Challenge settled! You WON ₦10,000"                     │
│     or                                                         │
│     "Challenge settled! You LOST ₦5,000"                     │
│                                                                 │
│  👨‍💼 ADMIN NOTIFICATION:                                        │
│     "Treasury Settlement Complete"                            │
│     "13 matches settled: 2 won (+₦10k), 11 lost (-₦55k)"    │
│     "Net: -₦45,000"                                           │
│                                                                 │
│  💰 PAYOUT DISTRIBUTION:                                       │
│     • Real winners get their payouts                          │
│     • Treasury loss deducted from admin wallet                │
│     • P&L tracked for daily reports                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FINAL STATE                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Challenge: RESOLVED                                           │
│  User Experience: Normal challenge with real & shadow players │
│  Admin P&L: -₦45,000 (covered from Treasury funds)            │
│  Notifications: All users and admin informed                  │
│  Database: Full audit trail maintained                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Admin Treasury Dashboard View

```
╔════════════════════════════════════════════════════════════════════╗
║             ADMIN TREASURY IMBALANCE MONITOR                       ║
╚════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────┐
│ 📊 CHALLENGE IMBALANCE METRICS                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Real User Distribution:                                       │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ YES: ████████████████░░░░░░░░░░░░░░░░░░░ 65% (15 users)   │
│  │ NO:  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 35% (2 users)     │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Gap Analysis:                                                  │
│  ⚠️  IMBALANCED: 13 unmatched YES users                         │
│      Potential Loss: ₦65,000 in pending payouts                │
│                                                                 │
│  Match Rate:                                                    │
│  📊 14% (2 matches out of 16 possible)                         │
│      • YES users matched: 2/15                                 │
│      • NO users matched: 2/2 ✓ All matched                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 💰 TREASURY ALLOCATION FOR THIS CHALLENGE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Max Risk:        ₦50,000                                       │
│  Allocated:       ₦35,000  [████████████░░░░░░░░░] 70%        │
│  Remaining:       ₦15,000                                       │
│                                                                 │
│  Action: ⚠️ WARNING - Remaining capacity insufficient          │
│          for full NO-side fill                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ⚙️  TREASURY ACTION                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Choose Imbalanced Side:                                        │
│  ◉ YES (13 unmatched users) - RECOMMENDED                      │
│  ○ NO                                                           │
│                                                                 │
│  Number of Matches to Fill:                                     │
│  [━━━7━━━] [⬅] [➡] (7 matches)                                │
│                                                                 │
│  ℹ️  Info:                                                       │
│      • Each match = 1 user paired with Treasury shadow persona  │
│      • Cost per match = ₦5,000 (user stake)                    │
│      • Total cost = 7 × ₦5,000 = ₦35,000                      │
│      • Treasury will bet NO side (opposite of users)           │
│      • Auto-settlement on challenge result                     │
│                                                                 │
│  [Confirm & Fill Treasury Matches] [Cancel]                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 📋 FILL CONFIRMATION DIALOG                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚠️  CONFIRM TREASURY ALLOCATION                                │
│                                                                 │
│  Challenge: "Football Predictions Q4 Finale"                  │
│  Side to Fill: YES (opposite = Treasury bets NO)               │
│  Matches to Create: 7                                          │
│  Cost: ₦35,000 from Treasury account                           │
│                                                                 │
│  Warning:                                                       │
│  ⚠️  Treasury will only win if NO side (opposite) prevails    │
│      High risk if YES is predicted to win                      │
│                                                                 │
│  Treasury Personas:                                             │
│  • TeeJay_Striker_05                                           │
│  • IceQueen_Analyst_07                                         │
│  • ChiefPredictor_03                                           │
│  • (+ 4 more)                                                   │
│                                                                 │
│  [Confirm Fill Treasury] [Cancel]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Settlement Flow at Resolution

```
TIME: Challenge Timeline Expires → Admin Sets Result
│
├─→ 1. SET CHALLENGE RESULT
│   └─ Admin clicks: "Resolve: Challenger Won"
│      (Challenger side = YES in this example)
│
├─→ 2. SYSTEM PROCESSES RESULT
│   ├─ Update challenge.result = "challenger_won"
│   ├─ Determine winners/losers
│   └─ Trigger existing notifications
│
├─→ 3. TREASURY SETTLEMENT (NEW)
│   ├─ Check: Is this admin-created? YES ✓
│   ├─ Check: Are there Treasury matches? YES (13) ✓
│   │
│   ├─→ For each Treasury match:
│   │   ├─ User bet side: YES
│   │   ├─ Treasury bet side: NO (opposite)
│   │   ├─ Challenge result: YES WON
│   │   ├─ Did Treasury win? NO (bet NO, result was YES)
│   │   └─ Payout: ₦0 (lost)
│   │
│   ├─→ Summary Calculation:
│   │   ├─ Matches settled: 13
│   │   ├─ Treasury won: 2
│   │   ├─ Treasury lost: 11
│   │   ├─ Total payout: ₦10,000
│   │   ├─ Total staked: ₦65,000
│   │   └─ Net P&L: -₦55,000
│   │
│   └─→ Database Updates:
│       ├─ treasury_matches.status = "settled"
│       ├─ treasury_matches.result = "treasury_lost"
│       ├─ treasury_matches.treasuryPayout = 0
│       ├─ admin_wallet_transactions -₦55,000
│       └─ notifications created for users & admin
│
├─→ 4. NOTIFICATIONS SENT
│   ├─ 👤 User: "Challenge settled! You WON ₦10,000" (real winners)
│   ├─ 👤 User: "Challenge settled! You LOST ₦5,000" (real losers)
│   └─ 👨‍💼 Admin: "Settlement: 13 matched, Net -₦55,000"
│
└─→ 5. END STATE
    ├─ Challenge: RESOLVED
    ├─ All users: Notified with results
    ├─ Admin: Sees settlement P&L
    └─ Database: Complete audit trail

```

---

## 4. Win/Loss Scenarios

### Scenario A: Treasury Wins (User bets YES, Treasury bets NO, NO wins)
```
User: YES side ₦5,000
Treasury: NO side ₦5,000

Challenge Result: "challenged_won" (NO wins)

✅ User LOSES (bet on losing side)
✅ Treasury WINS (bet on winning side, gets ₦10,000)

P&L Summary:
├─ Real user loss: -₦5,000
└─ Treasury gain: +₦5,000 (net)
```

### Scenario B: Treasury Loses (User bets YES, Treasury bets NO, YES wins)
```
User: YES side ₦5,000
Treasury: NO side ₦5,000

Challenge Result: "challenger_won" (YES wins)

✅ User WINS (bet on winning side, gets ₦10,000)
✅ Treasury LOSES (bet on losing side, gets ₦0)

P&L Summary:
├─ Real user gain: +₦5,000
└─ Treasury loss: -₦5,000 (net)
```

---

## 5. Real vs Shadow User Journey Comparison

```
┌─────────────────────┬──────────────────────────┬──────────────────────────┐
│ STEP                │ REAL USER                │ SHADOW PERSONA           │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ 1. CREATION         │ User signs up, joins app │ Pre-seeded in database   │
│                     │                          │ (49 Nigerian usernames)  │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ 2. JOIN CHALLENGE   │ Clicks "Join Challenge"  │ Added via fulfillment    │
│                     │ Selects side & stake     │ (Treasury admin action)  │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ 3. APPEAR ON UI     │ Real name, real avatar   │ Looks like real user     │
│                     │ Blue "verified" badge    │ Same UI treatment        │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ 4. GAMEPLAY         │ Makes calls & bets       │ No interaction possible  │
│                     │ In real-time             │ (system placeholder)     │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ 5. NOTIFICATIONS    │ "You matched with Kels"  │ Same notification format │
│                     │ "Challenge settled"      │ to real user             │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ 6. SETTLEMENT       │ Real payout in wallet    │ Treasury account settles │
│                     │ User sees balance update │ Loss deducted from admin │
│                     │                          │ wallet automatically     │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ 7. RE-USE           │ User can play again      │ Can be used for other    │
│                     │                          │ challenges (no per-      │
│                     │                          │ challenge repetition)    │
└─────────────────────┴──────────────────────────┴──────────────────────────┘
```

---

## 6. Database State During Lifecycle

```
TIME: T0 (User joins, challenge created)
├─ challenges table: new record, adminCreated=true
└─ users table: 15 new users on YES side, 2 on NO side

TIME: T1 (Treasury fills NO side)
├─ shadow_personas: 13 marked as used for this challenge
├─ pair_queue: 13 new matches created
├─ treasury_matches: 13 new records, status="active"
├─ treasury_challenges: 1 config record created
└─ notifications: 13 "match.found" + 1 admin batch notification

TIME: T2 (Challenge progressing)
├─ pair_queue: status updates as matches progress
├─ treasury_matches: All still status="active"
└─ [No changes to Treasury records]

TIME: T3 (Admin resolves challenge)
├─ challenges: result="challenger_won"
├─ treasury_matches:
│  ├─ Record 1-11: status="settled", result="treasury_lost", payout=0
│  └─ Record 12-13: status="settled", result="treasury_won", payout=10000 ea
├─ admin_wallet_transactions: -₦55,000 recorded
└─ notifications: 13 "challenge.settled" + 1 admin settlement

TIME: T4 (End state - next challenge possible)
├─ shadow_personas: Now available for re-use in OTHER challenges
├─ treasury_matches: All settled (historical record)
└─ treasury_challenges: Config record persists for reference
```

---

## Key Insights

### ✅ What Makes Treasury Balancing Work

1. **Speed**: Instant matching vs waiting for organic players
2. **Transparency**: Real user sees real opponent (shadow persona)
3. **Control**: Admin controls amount, side, and limits per challenge
4. **Hedging**: Treasury always bets opposite = natural risk mitigation
5. **Audit Trail**: Every match recorded with full P&L tracking

### 📊 Admin Goal Outcomes

**Scenario A: Successful Balance**
- Imbalanced challenge: 15 YES, 2 NO
- Treasury fills 13 on NO
- Final: 15 YES vs 15 NO (balanced)
- Challenge proceeds smoothly
- Treasury risk: capped at max_risk amount

**Scenario B: Partial Fill**
- Max risk is ₦30,000 (only 6 matches)
- Can't fill all 13 unmatched
- Final: 15 YES vs 8 NO (still imbalanced)
- 7 users still pending match
- Admin choice: Accept partial fill or increase budget

**Scenario C: Profitable Settlement**
- Treasury fills 10 matches
- Challenge resolves in Treasury's favor
- P&L: +₦25,000 net profit
- Funds returned to admin treasury for future use
