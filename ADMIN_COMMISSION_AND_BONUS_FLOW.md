# Admin Commission & Bonus Payout Flow

## Question 1: Where Does Admin-Created Challenge Commission Go?

### **Answer: Goes to Admin Wallet (5% of total pool)**

Both P2P challenges and admin-created challenges have the SAME commission structure:

```
CHALLENGE COMPLETION
├─ Total Pool: ₦10,000 (₦5,000 × 2 participants)
├─ Platform Commission: 5% = ₦500
├─ Winner Payout: ₦9,500 (after commission deducted)
└─ Commission destination: 
   ✅ Admin Wallet (admin_wallet_balance += ₦500)
   ✅ Tracked as: commission_earned transaction
```

### **Commission is AUTO-AWARDED**

When challenge completes:
```typescript
// In processChallengePayouts() - storage.ts:1281
const totalAmount = parseFloat(String(challenge.amount || '0')) * 2;
const platformFee = totalAmount * 0.05;  // 5% commission

// ... winner paid (totalAmount - platformFee)

// Auto-award commission to admin wallet
const adminCommission = totalAmount * 0.05;
admin_wallet_balance += adminCommission;
admin_total_commission += adminCommission;
```

**Key Point:** Platform fee (commission) is AUTOMATICALLY deducted BEFORE paying winner.

---

## Question 2: How Does Bonus Payout Work? Does Bonus Deduct from Admin Wallet?

### **Answer: YES and NO (It's Nuanced)**

The bonus system works in TWO PHASES:

---

## **PHASE 1: BONUS CREATION (Admin Creates Bonus)**

When admin creates a bonus for a challenge:

```
┌────────────────────────────────────────┐
│ BONUS CREATION                         │
├────────────────────────────────────────┤
│                                        │
│ Admin decides: "Add 2x multiplier"     │
│               "For YES side"           │
│               "Cost: ₦10,000"          │
│                                        │
│ WHAT HAPPENS:                          │
│ ✓ Admin Wallet Balance: -₦10,000       │
│   └─ Deducted immediately              │
│ ✓ Challenge updated with bonus data:   │
│   └─ bonusMultiplier: 2.0              │
│   └─ bonusSide: YES                    │
│   └─ bonusEndsAt: timestamp            │
│                                        │
│ ✓ Transaction logged:                  │
│   └─ Type: bonus_sent                  │
│   └─ Amount: 10,000                    │
│   └─ From: Admin Wallet                │
│                                        │
└────────────────────────────────────────┘
```

### **Code Evidence:**
```typescript
// In routes.ts - POST /api/admin/challenges/bonus
const currentBalance = parseFloat(String(admin.adminWalletBalance || '0'));
if (currentBalance < bonusAmount) {
  return res.status(400).json({ message: "Insufficient balance" });
}

// Deduct immediately
const newBalance = currentBalance - bonusAmount;
await db.update(users).set({ adminWalletBalance: newBalance.toString() });
```

**After Phase 1:**
- Admin Wallet: -₦10,000 (GONE)
- Bonus is "charged" to admin
- Waits for winner to claim it

---

## **PHASE 2: CHALLENGE COMPLETES & WINNER PAID**

When challenge result is set:

```
┌─────────────────────────────────────────────────────┐
│ CHALLENGE COMPLETION & PAYOUT                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Challenge: ₦5,000 × 2 participants = ₦10,000 pool  │
│ Winner: User123 (YES side)                         │
│ Bonus: 2x multiplier on YES side (ACTIVE)          │
│                                                     │
│ PAYOUT CALCULATION:                                │
│ ├─ Base payout = ₦10,000 - 5% fee = ₦9,500        │
│ ├─ Bonus multiplier = 2x                           │
│ ├─ Final payout = ₦9,500 × 2.0 = ₦19,000 ✨       │
│                                                     │
│ WHERE DOES ₦19,000 COME FROM?                      │
│ ├─ ₦9,500 = User's winning from challenge pool    │
│ ├─ ₦9,500 = Bonus amount from admin wallet ✓      │
│ └─ Total: ₦19,000 → User receives this            │
│                                                     │
│ FLOW:                                              │
│ Admin Wallet (Phase 1): -₦10,000 ----┐            │
│                                       ├─→ ₦9,500 goes to user (bonus portion)
│ Challenge Pool: ₦10,000 ──────────────┤            │
│                                       ├─→ ₦9,500 goes to user (winnings)
│                                       │            │
│                         TOTAL: ₦19,000 goes to User
│                                                     │
└─────────────────────────────────────────────────────┘
```

### **Code Evidence:**
```typescript
// In processChallengePayouts - storage.ts:1295
let winnerPayout = totalAmount - platformFee;  // ₦9,500

// Apply bonus multiplier
if (isBonusActive && challenge.bonusSide === 'YES' && bonusMultiplier > 1.0) {
  winnerPayout = winnerPayout * bonusMultiplier;  // ₦9,500 × 2.0 = ₦19,000
}

// Pay winner the FULL amount (base + bonus)
await this.updateUserBalance(winnerId, winnerPayout);  // Add ₦19,000
```

---

## **Visual Flow Example**

### **Scenario:**
1. Admin loads ₦50,000
2. Creates challenge: ₦5,000 stake
3. Creates ₦10,000 bonus (2x multiplier)
4. User wins with bonus

### **State at Each Step:**

```
STEP 1: Admin loads funds
┌──────────────────────────────┐
│ Admin Wallet: ₦50,000        │
│ Total Bonuses: ₦0            │
│ Total Commission: ₦0         │
└──────────────────────────────┘

STEP 2: Admin creates bonus
┌──────────────────────────────┐
│ Admin Wallet: ₦40,000        │  ← Deducted ₦10,000
│ Total Bonuses: ₦10,000       │  ← Tracked separately
│ Total Commission: ₦0         │
└──────────────────────────────┘

STEP 3: Challenge completes (₦10,000 pool, user wins with 2x bonus)
┌──────────────────────────────┐
│ Admin Wallet: ₦40,500        │  ← +₦500 commission from challenge
│ Total Bonuses: ₦10,000       │  ← Still shows total bonuses given
│ Total Commission: ₦500       │  ← Now shows commission earned
└──────────────────────────────┘
User Wallet: +₦19,000          │  ← Gets base (₦9,500) + bonus (₦9,500)
```

---

## **Key Differences: P2P vs Admin-Created Challenges**

| Aspect | P2P Challenge | Admin-Created Challenge |
|--------|---|---|
| **Participants** | User 1 vs User 2 | Admin vs User(s) |
| **Commission Rate** | 5% | 5% (SAME) |
| **Where Commission Goes** | Admin Wallet | Admin Wallet (SAME) |
| **Bonus Available** | Yes | Yes (SAME) |
| **Bonus Deduction** | From admin wallet | From admin wallet (SAME) |
| **Bonus Payout** | To winner | To winner (SAME) |

**→ BOTH models are identical in terms of commission and bonus handling!**

---

## **Important: The Bonus is NOT Returned**

Once admin creates a bonus:

```
❌ Bonus is SPENT
   └─ Even if challenge is cancelled/expired
   └─ Even if winner never appears
   └─ Admin wallet balance is permanently reduced

✅ Bonus is DEPLOYED
   └─ Only used when winner actually wins
   └─ Then applies to their payout
   └─ If no winner → bonus is lost (admin's loss)
```

---

## **What About Unused Bonuses?**

If a bonus expires before challenge completes:

```
Scenario: Admin created 2x bonus for 24 hours
          Challenge doesn't complete in time
          Bonus expires

WHAT HAPPENS:
├─ Admin Wallet: Still shows ₦10,000 deducted
├─ Bonus cannot be used (expired)
├─ Admin LOSES the ₦10,000 (opportunity cost)
└─ No refund mechanism (by design)
```

**This is intentional** - Incentivizes admins to:
- Only create bonuses for likely-to-complete challenges
- Set appropriate expiry times
- Be strategic about bonus spending

---

## **Commission Comparison: Who Earns What**

For a ₦10,000 challenge pool:

```
WITHOUT BONUS:
├─ Platform Fee (→ Admin Wallet): ₦500
├─ Winner Receives: ₦9,500
└─ Loser: ₦0

WITH 2x BONUS (Admin spent ₦10,000 on bonus):
├─ Platform Fee (→ Admin Wallet): ₦500
├─ Winner Receives: ₦19,000 (₦9,500 + ₦9,500 bonus)
├─ Admin Cost: -₦10,000 (bonus)
├─ Admin Gain: +₦500 (commission)
├─ Admin Net: -₦9,500 per bonus
└─ Loser: ₦0
```

**Net Effect for Admin:**
- Spends ₦10,000 on bonus
- Earns ₦500 commission
- Net loss: ₦9,500 per challenge

**→ Bonuses are an INVESTMENT to attract users, not a profit center!**

---

## **Wallet Flow Diagram**

```
                    ┌─────────────────────┐
                    │   Admin Wallet      │
                    │   Balance: ₦50,000  │
                    └─────────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
           ┌────────▼────────┐   │
           │ Create Bonus    │   │
           │ -₦10,000        │   │
           │ Balance: ₦40k   │   │
           └─────────────────┘   │
                                 │
                    ┌────────────▼────────┐
                    │ Challenge Completes │
                    │ -₦500 (commission)  │
                    │ -₦9,500 (bonus spent)
                    │ +₦500 (commission awarded)
                    │ Balance: ₦30,500    │
                    └─────────────────────┘
                           │
                    ┌──────────────────┐
                    │  Winner Receives │
                    │  +₦19,000        │
                    │  (base + bonus)  │
                    └──────────────────┘
```

---

## **Transaction Audit Trail**

All these flows are logged:

```json
{
  "type": "fund_load",
  "amount": "50000.00",
  "description": "Funds loaded via Paystack",
  "status": "completed"
}

{
  "type": "bonus_sent",
  "amount": "10000.00",
  "description": "Bonus for challenge: Challenge Title",
  "status": "completed"
}

{
  "type": "commission_earned",
  "amount": "500.00",
  "description": "Commission from challenge: Challenge Title",
  "status": "completed"
}
```

---

## **Summary Answers**

### **Q1: Where does admin-created challenge commission go?**
✅ **To Admin Wallet (same as P2P challenges)**
- 5% of total pool
- Auto-awarded to admin_wallet_balance
- Tracked in admin_total_commission
- Same as P2P challenges (no difference)

### **Q2: Does bonus deduct from admin wallet and go to user?**
✅ **YES, in two phases:**

**Phase 1 (Bonus Creation):**
- Admin wallet: -₦10,000 (deducted immediately)
- Challenge marked with bonus multiplier
- Awaiting winner

**Phase 2 (Winner Paid):**
- Winner receives: Base payout × bonus multiplier
- This comes from: Challenge pool (base) + admin wallet (bonus portion)
- Admin wallet shows negative balance from phase 1
- Commission earned partially offsets the bonus cost

**End Result:**
- User gets full bonus payout
- Admin pays for it from wallet
- Commission partially recovers some cost
