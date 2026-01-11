# Admin Wallet Testing Guide

## Prerequisites

1. **Database migrations must be run** (0003_add_bonus_amount.sql, 0004_add_admin_wallet.sql)
2. **Server running** on `http://localhost:5000`
3. **Admin authenticated** - Get admin ID and auth token
4. **Curl or Postman** for API testing

---

## Phase 1: Testing Fund Deposits

### Test 1.1: Load Funds (Paystack Initialize)

**What it does:** Initializes Paystack payment modal, returns authorization URL

**Curl Command:**
```bash
curl -X POST http://localhost:5000/api/admin/wallet/load \
  -H "Content-Type: application/json" \
  -H "Cookie: your_admin_session_cookie" \
  -d '{
    "amount": 50000
  }'
```

**Expected Response:**
```json
{
  "authorization_url": "https://checkout.paystack.co/...",
  "access_code": "...",
  "reference": "adm_load_admin123_...",
  "status": "ok"
}
```

**What to Check:**
- ✅ `authorization_url` is a valid Paystack URL
- ✅ `reference` starts with "adm_load_"
- ✅ No errors about missing Paystack config

**UI Test:** In AdminWallet → Click "Load Funds" → Enter ₦50,000 → Should open Paystack iframe

---

### Test 1.2: Verify Payment (After Paystack)

**What it does:** Confirms payment with Paystack, credits wallet

**Curl Command:**
```bash
curl -X POST http://localhost:5000/api/admin/wallet/verify-payment \
  -H "Content-Type: application/json" \
  -H "Cookie: your_admin_session_cookie" \
  -d '{
    "reference": "adm_load_admin123_1735003200000"
  }'
```

**Expected Response:**
```json
{
  "message": "Payment verified and balance updated",
  "balance": 50000
}
```

**What to Check:**
- ✅ Balance increased by ₦50,000
- ✅ No "already processed" error
- ✅ Transaction logged in database

**UI Test:** After simulating Paystack payment, wallet balance should update automatically

---

### Test 1.3: Check Wallet Balance

**What it does:** Retrieves current wallet state

**Curl Command:**
```bash
curl -X GET http://localhost:5000/api/admin/wallet \
  -H "Cookie: your_admin_session_cookie"
```

**Expected Response:**
```json
{
  "balance": 50000,
  "totalCommission": 0,
  "totalBonusesGiven": 0,
  "transactions": [
    {
      "id": 1,
      "type": "fund_load",
      "amount": "50000.00",
      "description": "Funds loaded via Paystack",
      "reference": "adm_load_admin123_...",
      "status": "completed",
      "balanceBefore": "0.00",
      "balanceAfter": "50000.00",
      "createdAt": "2025-12-22T10:30:00Z"
    }
  ]
}
```

**What to Check:**
- ✅ `balance` is ₦50,000
- ✅ Transaction logged with before/after balance
- ✅ Status is "completed"

---

## Phase 2: Testing Bonus Creation (Wallet Deduction)

### Test 2.1: Create Challenge First

**Note:** You need a challenge to add a bonus to it

**Curl Command:**
```bash
curl -X POST http://localhost:5000/api/admin/challenges \
  -H "Content-Type: application/json" \
  -H "Cookie: your_admin_session_cookie" \
  -d '{
    "title": "Test Challenge for Bonus",
    "description": "Testing bonus deduction from wallet",
    "category": "sports",
    "amount": 5000,
    "status": "open",
    "adminCreated": true
  }'
```

**Expected Response:**
```json
{
  "id": 42,
  "title": "Test Challenge for Bonus",
  "amount": 5000,
  "status": "open",
  "adminCreated": true,
  ...
}
```

**Save the challenge ID** (42 in this example)

---

### Test 2.2: Create Bonus (Deduct from Wallet)

**What it does:** Creates 2x bonus multiplier, deducts ₦10,000 from wallet

**Curl Command:**
```bash
curl -X POST http://localhost:5000/api/admin/challenges/bonus \
  -H "Content-Type: application/json" \
  -H "Cookie: your_admin_session_cookie" \
  -d '{
    "challengeId": 42,
    "bonusSide": "YES",
    "bonusMultiplier": "2.0",
    "durationHours": 24,
    "bonusAmount": 10000
  }'
```

**Expected Response:**
```json
{
  "message": "Bonus activated successfully",
  "balance": 40000,
  "bonusApplied": true
}
```

**What to Check:**
- ✅ Balance decreased from 50,000 → 40,000 (deducted ₦10,000)
- ✅ Bonus side is "YES"
- ✅ Multiplier is 2.0

---

### Test 2.3: Verify Wallet After Bonus

**Curl Command:**
```bash
curl -X GET http://localhost:5000/api/admin/wallet \
  -H "Cookie: your_admin_session_cookie"
```

**Expected Response:**
```json
{
  "balance": 40000,
  "totalCommission": 0,
  "totalBonusesGiven": 10000,
  "transactions": [
    {
      "type": "fund_load",
      "amount": "50000.00",
      "status": "completed"
    },
    {
      "type": "bonus_sent",
      "amount": "10000.00",
      "description": "Bonus for challenge: Test Challenge for Bonus",
      "reference": "challenge_42_bonus",
      "status": "completed",
      "balanceBefore": "50000.00",
      "balanceAfter": "40000.00"
    }
  ]
}
```

**What to Check:**
- ✅ `balance` is ₦40,000
- ✅ `totalBonusesGiven` increased to ₦10,000
- ✅ Two transactions: fund_load + bonus_sent
- ✅ Bonus transaction shows correct before/after balance

---

### Test 2.4: Try to Create Bonus with Insufficient Balance

**What it does:** Attempts to create ₦50,000 bonus but wallet only has ₦40,000

**Curl Command:**
```bash
curl -X POST http://localhost:5000/api/admin/challenges/bonus \
  -H "Content-Type: application/json" \
  -H "Cookie: your_admin_session_cookie" \
  -d '{
    "challengeId": 42,
    "bonusSide": "NO",
    "bonusMultiplier": "1.5",
    "durationHours": 24,
    "bonusAmount": 50000
  }'
```

**Expected Response:**
```json
{
  "message": "Insufficient admin wallet balance. Have ₦40,000.00, need ₦50,000.00"
}
```

**What to Check:**
- ✅ Request rejected
- ✅ Clear error message about insufficient funds
- ✅ Wallet balance unchanged (still ₦40,000)

---

## Phase 3: Testing Commission Auto-Award

### Test 3.1: Set Challenge Result (Trigger Commission)

**What it does:** Sets challenge result, awards winner, credits admin wallet with 5% commission

**Curl Command:**
```bash
curl -X POST http://localhost:5000/api/admin/challenges/42/result \
  -H "Content-Type: application/json" \
  -H "Cookie: your_admin_session_cookie" \
  -d '{
    "result": "challenger_won"
  }'
```

**Expected Response:**
```json
{
  "message": "Challenge result set and payouts processed",
  "winnerPayout": 9500,
  "platformFee": 500,
  "winnerId": "user123"
}
```

**What to Check:**
- ✅ Winner paid ₦9,500
- ✅ Platform fee (admin commission) ₦500
- ✅ Total pool was ₦10,000 (5,000 × 2 participants)

---

### Test 3.2: Verify Commission in Wallet

**Curl Command:**
```bash
curl -X GET http://localhost:5000/api/admin/wallet \
  -H "Cookie: your_admin_session_cookie"
```

**Expected Response:**
```json
{
  "balance": 40500,
  "totalCommission": 500,
  "totalBonusesGiven": 10000,
  "transactions": [
    ...,
    {
      "type": "commission_earned",
      "amount": "500.00",
      "description": "Commission from challenge: Test Challenge for Bonus",
      "reference": "challenge_42_commission",
      "status": "completed",
      "balanceBefore": "40000.00",
      "balanceAfter": "40500.00"
    }
  ]
}
```

**What to Check:**
- ✅ `balance` increased from 40,000 → 40,500
- ✅ `totalCommission` shows ₦500
- ✅ Commission transaction logged
- ✅ Before/after balance tracking correct

---

## Phase 4: Testing Withdrawals

### Test 4.1: Withdraw Funds

**What it does:** Withdraws ₦20,000 to bank account

**Curl Command:**
```bash
curl -X POST http://localhost:5000/api/admin/wallet/withdraw \
  -H "Content-Type: application/json" \
  -H "Cookie: your_admin_session_cookie" \
  -d '{
    "amount": 20000
  }'
```

**Expected Response:**
```json
{
  "message": "Withdrawal initiated - funds pending to your registered bank account",
  "amount": 20000,
  "balance": 20500,
  "reference": "adm_withdrawal_admin123_...",
  "status": "pending",
  "note": "This withdrawal will be processed to your bank account. Please allow 1-3 business days for the funds to arrive."
}
```

**What to Check:**
- ✅ Balance deducted: 40,500 → 20,500
- ✅ Withdrawal reference generated
- ✅ Status is "pending"
- ✅ Clear message about timeline

---

### Test 4.2: Try to Withdraw More Than Balance

**Curl Command:**
```bash
curl -X POST http://localhost:5000/api/admin/wallet/withdraw \
  -H "Content-Type: application/json" \
  -H "Cookie: your_admin_session_cookie" \
  -d '{
    "amount": 50000
  }'
```

**Expected Response:**
```json
{
  "message": "Insufficient balance. Have ₦20,500.00, need ₦50,000.00"
}
```

**What to Check:**
- ✅ Request rejected
- ✅ Clear error message
- ✅ Wallet unchanged

---

### Test 4.3: Final Wallet State

**Curl Command:**
```bash
curl -X GET http://localhost:5000/api/admin/wallet \
  -H "Cookie: your_admin_session_cookie"
```

**Expected Final State:**
```json
{
  "balance": 20500,
  "totalCommission": 500,
  "totalBonusesGiven": 10000,
  "transactions": [
    {
      "type": "fund_load",
      "amount": "50000.00"
    },
    {
      "type": "bonus_sent",
      "amount": "10000.00"
    },
    {
      "type": "commission_earned",
      "amount": "500.00"
    },
    {
      "type": "withdrawal",
      "amount": "20000.00",
      "status": "pending"
    }
  ]
}
```

---

## Testing Checklist

Use this checklist to verify all functionality:

```
DEPOSITS:
☐ Load funds initializes Paystack
☐ Verify payment credits wallet
☐ Wallet balance updates correctly
☐ Transaction logged with correct type

BONUSES:
☐ Create bonus deducts from wallet
☐ Bonus amount tracked in totalBonusesGiven
☐ Cannot create bonus with insufficient balance
☐ Transaction logged as bonus_sent

COMMISSIONS:
☐ Challenge completion awards commission
☐ Commission auto-added to wallet balance
☐ totalCommission counter updates
☐ Transaction logged as commission_earned

WITHDRAWALS:
☐ Withdrawal deducts from balance
☐ Status marked as pending
☐ Cannot withdraw more than available
☐ Transaction logged as withdrawal

AUDIT TRAIL:
☐ All transactions have before/after balance
☐ Timestamps are accurate
☐ References are unique and descriptive
☐ Transaction history filters work
```

---

## Common Issues & Solutions

### Issue: "Insufficient admin wallet balance"
**Solution:** Load more funds first with `/api/admin/wallet/load`

### Issue: Paystack iframe doesn't open
**Solution:** Check PAYSTACK_SECRET_KEY is set in `.env`

### Issue: Commission not awarded
**Solution:** Verify challenge was completed and payout processed via `/api/admin/challenges/:id/result`

### Issue: Cannot find challenge
**Solution:** Create challenge first with `/api/admin/challenges` (POST)

---

## UI Testing (In Browser)

1. **Navigate to:** `http://localhost:3000/admin/wallet`
2. **Load Funds:**
   - Click "Load Funds" button
   - Enter ₦50,000
   - Paystack modal should open
   - (Skip actual payment in test)
   
3. **View Stats:**
   - Current Balance card shows loaded amount
   - Total Commission shows 0 (no challenges yet)
   - Total Bonuses shows 0 (no bonuses yet)

4. **View Transactions:**
   - Filter by type
   - See fund_load transaction with amount and timestamps

5. **Withdraw:**
   - Click "Withdraw Funds" button
   - Enter amount (must be less than balance)
   - Should show "pending" status in transactions

---

## Next Steps

After testing completes:
1. ✅ Verify all transactions logged in database
2. ✅ Check AdminWallet UI reflects correct balances
3. ✅ Confirm commission auto-awarded when challenges complete
4. ✅ Test in real Paystack environment (staging)

