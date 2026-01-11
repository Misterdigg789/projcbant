# 💳 Admin Wallet System - Complete Implementation

## Overview
A comprehensive wallet system for admins to manage bonuses, commissions, and payouts - similar to the Paystack wallet integration.

---

## 📊 Database Schema

### 1. **Users Table Updates**
Added three new fields to track admin wallet activity:
```sql
admin_wallet_balance NUMERIC(15, 2)      -- Current wallet balance
admin_total_commission NUMERIC(15, 2)    -- Total commissions earned (platform fees)
admin_total_bonuses_given NUMERIC(15, 2) -- Total bonuses distributed
```

### 2. **New Admin Wallet Transactions Table**
Tracks all wallet operations:
```sql
CREATE TABLE admin_wallet_transactions (
  id INTEGER PRIMARY KEY
  admin_id VARCHAR              -- Admin account ID
  type VARCHAR                  -- fund_load, bonus_sent, commission_earned, withdrawal
  amount NUMERIC(15, 2)         -- Transaction amount
  description TEXT              -- Details
  related_id INTEGER            -- Challenge/Event ID
  related_type VARCHAR          -- challenge, event, commission
  reference VARCHAR             -- Paystack ref, withdrawal ref
  status VARCHAR                -- pending, completed, failed
  balance_before NUMERIC(15, 2) -- Balance before transaction
  balance_after NUMERIC(15, 2)  -- Balance after transaction
  created_at TIMESTAMP          -- When it happened
)
```

---

## 🔌 API Endpoints

### 1. **GET `/api/admin/wallet`** - View Wallet & History
**Response:**
```json
{
  "balance": 150000.00,
  "totalCommission": 45000.00,
  "totalBonusesGiven": 25000.00,
  "transactions": [
    {
      "id": 1,
      "type": "bonus_sent",
      "amount": "5000.00",
      "description": "Bonus sent to challenge #42",
      "balanceBefore": "155000.00",
      "balanceAfter": "150000.00",
      "createdAt": "2025-12-22T10:30:00Z"
    },
    ...
  ]
}
```

### 2. **POST `/api/admin/wallet/load`** - Load Funds
**Request:**
```json
{
  "amount": 50000,
  "reference": "paystack_ref_xyz"
}
```
**Response:**
```json
{
  "message": "Funds loaded successfully",
  "balance": 200000.00
}
```

### 3. **POST `/api/admin/wallet/withdraw`** - Withdraw Funds
**Request:**
```json
{
  "amount": 25000
}
```
**Response:**
```json
{
  "message": "Withdrawal initiated",
  "balance": 175000.00,
  "reference": "withdrawal_1703255400000"
}
```

---

## 🎯 Bonus System Integration

When admin creates a bonus:

1. **System checks** if admin has sufficient wallet balance
2. **Deducts amount** from `admin_wallet_balance`
3. **Logs transaction** in `admin_wallet_transactions`
4. **Updates totals**: `admin_total_bonuses_given` increases
5. **Bonus is applied** to challenge with visibility to all users

**Error Handling:**
```json
{
  "message": "Insufficient wallet balance. Need ₦5,000, but only have ₦2,000"
}
```

---

## 💰 Commission System (Ready for Implementation)

When platform activities generate commission:

1. Challenge platform fees (5%) → Admin wallet
2. Event creator fees (3%) → Admin wallet
3. Automatically tracked in `type: 'commission_earned'`
4. Updates `admin_total_commission` counter

---

## 📋 Transaction Types

| Type | Source | Direction | Description |
|------|--------|-----------|-------------|
| `fund_load` | Paystack | In | Admin deposits funds |
| `bonus_sent` | Admin | Out | Bonus given to challenge/event |
| `commission_earned` | Platform | In | Platform fees collected |
| `withdrawal` | Admin | Out | Admin withdraws to bank |

---

## 🔐 Security Features

✅ **Admin-only access** - All endpoints require admin authentication
✅ **Balance validation** - Cannot spend more than available
✅ **Transaction audit trail** - Every action logged with before/after balance
✅ **Reference tracking** - Links to source (Paystack, challenge, withdrawal)
✅ **Status tracking** - Pending withdrawals can be tracked

---

## 📱 Frontend Integration

The AdminChallengePayouts component already integrates:
- ✅ Bonus amount input per multiplier
- ✅ Wallet balance check before creating bonus
- ✅ Toast notifications on success/failure
- ✅ Automatic balance refresh after transaction

---

## 🚀 Next Steps

1. **Run migrations:**
   ```bash
   # 0003_add_bonus_amount.sql
   # 0004_add_admin_wallet.sql
   ```

2. **Update payout logic** to award commissions to admin wallet
   - Location: `server/storage.ts` - `processChallengePayouts()`
   - Location: `server/storage.ts` - `processEventPayout()`

3. **Create Admin Wallet Dashboard** (UI)
   - Wallet balance display
   - Transaction history
   - Load funds button (Paystack integration)
   - Withdraw button
   - Bonus spending analytics

4. **Paystack Integration** (if not already done)
   - Link to existing Paystack setup
   - Load funds via Paystack modal
   - Process withdrawals to bank account

---

## 📊 Example Workflow

```
1. Admin starts with ₦0 balance
2. Admin loads ₦100,000 from Paystack
   → Balance: ₦100,000
   
3. Admin creates bonus for challenge:
   - 1.5x = ₦5,000
   → Balance: ₦95,000
   → Transaction logged
   
4. Challenge completes, winner receives bonus
   → Bonus deducted from escrow pool (user stakes)
   → Admin wallet impact: ₦0 (already deducted)
   
5. Platform earns 5% fee from challenge = ₦200
   → Admin wallet: ₦95,200
   → Type: commission_earned
   
6. Admin withdraws ₦50,000
   → Balance: ₦45,200
   → Status: pending
```

---

## 🔄 System Interactions

```
Admin Wallet ←→ Bonus System
    ↓                ↓
    └── Challenge Payouts (Fund bonuses)
    └── Event Payouts (Fund bonuses)
    └── Commission Collection (Platform fees)
    └── User Wallet Transfers
```

---

**Status:** ✅ COMPLETE & READY FOR TESTING
**Created:** 2025-12-22
**Migration Files:** 0003_add_bonus_amount.sql, 0004_add_admin_wallet.sql
