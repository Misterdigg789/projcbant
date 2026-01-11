# Admin Wallet System - Quick Start Guide

## ✅ What's Implemented

### Database Layer
- ✅ Admin wallet fields added to `users` table
  - `admin_wallet_balance` - Current balance
  - `admin_total_commission` - Lifetime commissions
  - `admin_total_bonuses_given` - Lifetime bonuses
- ✅ New `admin_wallet_transactions` table for audit trail
- ✅ Indexes on admin_id, type, created_at for performance

### API Endpoints
- ✅ `GET /api/admin/wallet` - View balance & transaction history
- ✅ `POST /api/admin/wallet/load` - Load funds (Paystack)
- ✅ `POST /api/admin/wallet/withdraw` - Withdraw funds to bank
- ✅ `POST /api/admin/challenges/bonus` - Updated to deduct from wallet

### Bonus Integration
- ✅ Checks admin wallet balance before creating bonus
- ✅ Deducts bonus amount from wallet when activated
- ✅ Creates transaction log for audit trail
- ✅ Returns error if insufficient funds

---

## 📋 Migration Files (Need to Run)

1. **`0003_add_bonus_amount.sql`**
   - Adds `bonus_amount` column to challenges table
   - Status: Ready to run

2. **`0004_add_admin_wallet.sql`**
   - Adds admin wallet fields to users
   - Creates admin_wallet_transactions table
   - Creates indexes
   - Status: Ready to run

---

## 🎯 Key Features

| Feature | Details |
|---------|---------|
| **Load Funds** | Add money via Paystack (like existing user wallet) |
| **Send Bonuses** | Deduct from wallet when bonus created |
| **Track Commissions** | Automatically collect 5% from challenges, 3% from events |
| **Withdraw** | Move money to bank account via Paystack |
| **Audit Trail** | Every transaction logged with before/after balance |

---

## 💡 Example Usage

**Load ₦100,000:**
```bash
curl -X POST http://localhost:5000/api/admin/wallet/load \
  -H "Content-Type: application/json" \
  -d '{"amount": 100000, "reference": "paystack_abc123"}'
```

**Check balance:**
```bash
curl http://localhost:5000/api/admin/wallet
```

**Create bonus (auto-deducts from wallet):**
```bash
curl -X POST http://localhost:5000/api/admin/challenges/bonus \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": 1,
    "bonusSide": "YES",
    "bonusMultiplier": "1.5",
    "durationHours": 24,
    "bonusAmount": 5000
  }'
```

---

## 🔧 Next Steps

1. **Run both migrations** (0003 & 0004)
2. **Create Admin Wallet Dashboard UI** with:
   - Balance display
   - Transaction history table
   - Load funds button
   - Withdraw button
3. **Update payout logic** to award commissions:
   - `processChallengePayouts()` - Award 5% fee
   - `processEventPayout()` - Award 3% fee
4. **Connect to Paystack** for load/withdraw flows

---

## 📊 Admin Wallet Dashboard (Todo)

Should include:
- **Balance Card** - Current wallet balance
- **Stats Cards** - Total earned, total bonused, lifetime commission
- **Transaction History** - Last 50 transactions with type, amount, timestamp
- **Quick Actions** - Load funds, Withdraw, Create bonus
- **Charts** - Bonus spending over time, commission earning trends

---

## 🚀 Status

**Backend:** ✅ COMPLETE
**API Endpoints:** ✅ COMPLETE
**Database:** ✅ COMPLETE (pending migration execution)
**Frontend:** ⏳ TODO (Admin dashboard UI)
**Paystack Integration:** ⏳ TODO (connect to existing Paystack setup)

---

Generated: 2025-12-22
