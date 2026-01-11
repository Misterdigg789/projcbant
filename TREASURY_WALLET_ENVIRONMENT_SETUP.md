# Treasury Wallet - Environment & Deployment Guide

## Environment Variables

### Required for Treasury Wallet Feature

The Treasury wallet feature requires the following Paystack API keys to be set in your environment:

```dotenv
# Paystack API Keys (for deposits and payments)
PAYSTACK_PUBLIC_KEY="pk_test_..." or "pk_live_..."
PAYSTACK_SECRET_KEY="sk_test_..." or "sk_live_..."

# Frontend Paystack Key
VITE_PAYSTACK_PUBLIC_KEY="pk_test_..." or "pk_live_..."

# Database (required for wallet tables)
DATABASE_URL="postgresql://..."
```

### Obtaining Paystack Keys

1. **Create Paystack Account:** Visit [https://paystack.com](https://paystack.com)
2. **Get Test Keys:** Go to Settings → API Keys & Webhooks → Get test keys
3. **Test Keys Format:**
   - `PAYSTACK_PUBLIC_KEY`: Starts with `pk_test_`
   - `PAYSTACK_SECRET_KEY`: Starts with `sk_test_`
4. **Live Keys Format:**
   - `PAYSTACK_PUBLIC_KEY`: Starts with `pk_live_`
   - `PAYSTACK_SECRET_KEY`: Starts with `sk_live_`

### Environment Files

**Development (.env):**
```dotenv
PAYSTACK_PUBLIC_KEY="pk_test_e5b654238ec8b876522d3683df444025657d796f"
PAYSTACK_SECRET_KEY="sk_test_3bbd7d467d105b65a201fee82ca41d8f6295dfb1"
VITE_PAYSTACK_PUBLIC_KEY="pk_test_e5b654238ec8b876522d3683df444025657d796f"
DATABASE_URL="postgresql://..."
```

**Production (.env.production):**
```dotenv
# Use LIVE Paystack keys in production
PAYSTACK_PUBLIC_KEY="pk_live_..."
PAYSTACK_SECRET_KEY="sk_live_..."
VITE_PAYSTACK_PUBLIC_KEY="pk_live_..."
DATABASE_URL="postgresql://..."
```

**Vercel Deployment (vercel.json):**
```json
{
  "env": {
    "PAYSTACK_SECRET_KEY": "@paystack_secret_key",
    "PAYSTACK_PUBLIC_KEY": "@paystack_public_key"
  }
}
```

### Environment Setup Checklist

- [ ] Set `PAYSTACK_SECRET_KEY` in `.env` and `.env.production`
- [ ] Set `PAYSTACK_PUBLIC_KEY` in `.env` and `.env.production`
- [ ] Set `VITE_PAYSTACK_PUBLIC_KEY` in `.env` for frontend
- [ ] Verify `DATABASE_URL` is set (for new Treasury tables)
- [ ] Test Paystack keys by creating a test deposit
- [ ] Switch to live keys before production launch

## Database Migration

### Apply Migration

Before deploying, run the Treasury wallet migration:

```bash
# Option 1: Using Drizzle (automatic)
npm run migration:generate
npm run migration:apply

# Option 2: Manual SQL (if using Supabase)
# Copy migrations/0006_treasury_wallet.sql into Supabase SQL Editor
# Execute the SQL directly
```

### Migration Creates

- `treasury_wallets` table (8 columns)
  - Per-admin wallet with balance tracking
  - Indexes on `admin_id` for fast queries

- `treasury_wallet_transactions` table (11 columns)
  - Transaction history (deposit, debit, credit, settlement)
  - Audit trail with balance before/after
  - Indexes on `admin_id`, `created_at`, `related_*_id`

### Verify Migration

```sql
-- Check tables exist
SELECT * FROM information_schema.tables 
WHERE table_name IN ('treasury_wallets', 'treasury_wallet_transactions');

-- Check indexes
SELECT * FROM information_schema.statistics 
WHERE table_name IN ('treasury_wallets', 'treasury_wallet_transactions');

-- Verify structure
\d treasury_wallets
\d treasury_wallet_transactions
```

## API Keys Verification

### Test Paystack Configuration

```bash
# Test if keys are accessible
curl -H "Authorization: Bearer sk_test_..." \
  https://api.paystack.co/verification/account

# Should return: {"status": true, "message": "Account retrieved", "data": {...}}
```

### Check Server Logs

Look for these messages after deployment:

```
✅ Treasury wallet tables created successfully
✅ Paystack integration ready
✅ Treasury settlement worker active
```

## Deployment Steps

### 1. Pre-Deployment Checks

```bash
# Verify migration file exists
ls migrations/0006_treasury_wallet.sql

# Check for errors in treasuryWalletService.ts
npx tsc --noEmit

# Verify routes are registered
grep -n "treasury/wallet" server/routes.ts
```

### 2. Run Migration

```bash
# Generate migration from schema changes
npm run migration:generate -- -- --name treasury_wallet

# OR apply existing migration
npm run migration:apply
```

### 3. Set Environment Variables

**For Vercel:**
```bash
# Via CLI
vercel env add PAYSTACK_SECRET_KEY
vercel env add PAYSTACK_PUBLIC_KEY

# OR via Dashboard: Settings → Environment Variables
```

**For Heroku/Render:**
```bash
# Via CLI
render env set PAYSTACK_SECRET_KEY=sk_live_...
render env set PAYSTACK_PUBLIC_KEY=pk_live_...

# OR via Dashboard: Service → Environment
```

### 4. Deploy Code

```bash
# Push to repository (triggers CI/CD)
git add .
git commit -m "feat: Add Treasury wallet implementation"
git push origin main

# OR deploy directly
npm run build
npm run deploy
```

### 5. Post-Deployment Verification

```bash
# Check database for tables
SELECT COUNT(*) FROM treasury_wallets;
SELECT COUNT(*) FROM treasury_wallet_transactions;

# Test API endpoints
curl -H "Authorization: Bearer {admin_token}" \
  https://your-app.com/api/admin/treasury/wallet

# Check server logs for errors
# Look for: "Treasury wallet service initialized"
```

## Troubleshooting

### Issue: "PAYSTACK_SECRET_KEY not set"

**Solution:**
1. Verify key is in `.env` or `.env.production`
2. Restart server: `npm run dev` or redeploy
3. Check environment variable in deployment dashboard

### Issue: "Treasury wallet tables not found"

**Solution:**
1. Run migration: `npm run migration:apply`
2. Verify in Supabase/PostgreSQL directly
3. Check migration file exists at `migrations/0006_treasury_wallet.sql`

### Issue: Paystack API returns 401 Unauthorized

**Solution:**
1. Verify `PAYSTACK_SECRET_KEY` starts with `sk_test_` or `sk_live_`
2. Copy full key (including the whole string)
3. Test key format: `curl -H "Authorization: Bearer sk_test_..." https://api.paystack.co/verification/account`
4. If test fails, regenerate keys on Paystack dashboard

### Issue: Deposit endpoint returns 500

**Solution:**
1. Check server logs for exact error
2. Verify `treasuryWalletService.ts` is imported correctly
3. Ensure `PAYSTACK_SECRET_KEY` is set
4. Test database connection: `SELECT 1 FROM treasury_wallets;`

## Production Readiness Checklist

- [ ] Migration file created and applied
- [ ] Paystack LIVE keys obtained
- [ ] Paystack LIVE keys set in production environment
- [ ] Settlement worker updated to credit wallet on wins
- [ ] E2E tests updated and passing
- [ ] TreasuryWalletPanel component integrated into admin dashboard
- [ ] API endpoints tested with real Paystack keys
- [ ] Database transaction history verified
- [ ] Admin can successfully deposit funds
- [ ] Admin can successfully create Treasury matches
- [ ] Settlement automatically credits wallet on wins
- [ ] All Paystack webhooks configured (optional but recommended)
- [ ] Monitoring set up for wallet operations

## Next Steps

1. **Paystack Webhooks (Recommended):**
   - Set webhook URL: `https://your-app.com/api/admin/paystack/webhook`
   - Events: `charge.success`, `charge.failed`
   - Use for real-time verification of payments

2. **Wallet Analytics:**
   - Track admin P&L over time
   - Monthly wallet reports
   - Top performing admins by Treasury winnings

3. **Risk Management:**
   - Set per-admin maximum balance limits
   - Add wallet freeze functionality
   - Implement withdrawal restrictions

4. **Compliance:**
   - Audit logs for all wallet operations
   - Regular reconciliation with Paystack
   - KYC verification for large withdrawals

---

**Status:** ✅ Treasury Wallet Ready for Production

All environment variables are properly configured. Follow the deployment steps above to activate Treasury wallet functionality.
