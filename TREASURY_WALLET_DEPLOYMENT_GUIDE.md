# Treasury Wallet - Complete Deployment Guide

**Status:** ✅ READY FOR PRODUCTION

All components are complete and integrated. Follow these steps to deploy Treasury wallet functionality.

## Pre-Deployment Checklist

- [x] Database migration created (`migrations/0006_treasury_wallet.sql`)
- [x] Treasury wallet service implemented (`server/treasuryWalletService.ts`)
- [x] Settlement worker updated to credit wallet on wins
- [x] API endpoints added (`server/routes.ts`)
- [x] React component created (`client/src/components/TreasuryWalletPanel.tsx`)
- [x] E2E tests updated with wallet verification
- [x] Environment variables documented
- [x] Paystack API keys configured

## Step 1: Pre-Deployment Verification

### 1.1 Verify Code Compilation

```bash
# Type check the entire project
npx tsc --noEmit

# Should complete without errors
# Expected output: (no output means success)
```

### 1.2 Verify File Structure

```bash
# Check all required files exist
ls -l server/treasuryWalletService.ts
ls -l client/src/components/TreasuryWalletPanel.tsx
ls -l migrations/0006_treasury_wallet.sql

# All three files should exist
```

### 1.3 Verify Git Status

```bash
# Check all changes are staged
git status

# Should show:
# modified:   .env (if local)
# modified:   .env.production
# new file:   migrations/0006_treasury_wallet.sql
# new file:   server/treasuryWalletService.ts
# new file:   client/src/components/TreasuryWalletPanel.tsx
# modified:   server/treasurySettlementWorker.ts
# modified:   server/routes.ts
# modified:   server/treasuryE2ETest.ts
```

## Step 2: Local Testing

### 2.1 Run E2E Tests Locally

```bash
# Set up test database (if using local PostgreSQL)
export DATABASE_URL="postgresql://user:password@localhost/test_db"

# Run the E2E test suite
npx tsx server/treasuryE2ETest.ts

# Expected output:
# ✅ Passed: 40+ tests
# ❌ Failed: 0 tests
# ✨ ALL TESTS PASSED!
```

### 2.2 Manual Testing - Create Test Admin

```bash
# Connect to your test database
psql $DATABASE_URL

# Create test admin account
INSERT INTO users (username, email, is_shadow_persona)
VALUES ('test_admin_wallet', 'test@wallet.local', false)
RETURNING id;

# Note the ID (we'll use it below)
```

### 2.3 Test Wallet API Endpoints

```bash
# 1. Get wallet balance (before deposit)
curl -X GET http://localhost:5000/api/admin/treasury/wallet \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Should return:
# {
#   "balance": 0,
#   "totalDeposited": 0,
#   "totalUsed": 0,
#   "totalEarned": 0,
#   "status": "active"
# }

# 2. Initiate deposit (test Paystack)
curl -X POST http://localhost:5000/api/admin/treasury/wallet/deposit/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "amount": 10000,
    "email": "test@wallet.local"
  }'

# Should return:
# {
#   "authorizationUrl": "https://checkout.paystack.com/...",
#   "accessCode": "...",
#   "reference": "..."
# }
```

### 2.4 Test Settlement Wallet Credit

```bash
# After running E2E test with Treasury win, check wallet:
curl -X GET http://localhost:5000/api/admin/treasury/wallet \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Should show positive balance if Treasury won
```

## Step 3: Database Migration

### 3.1 Apply Migration to Production Database

**Option A: Using Vercel Environment (Recommended)**

```bash
# Vercel uses the built app, so migration runs automatically
# on first deployment. However, you can also run manually:

# Connect to Vercel PostgreSQL
psql $(vercel env get DATABASE_URL)

# Run migration SQL manually
\i migrations/0006_treasury_wallet.sql

# Verify tables created
\d treasury_wallets
\d treasury_wallet_transactions
```

**Option B: Using Supabase Dashboard**

1. Go to Supabase Dashboard → Your Project → SQL Editor
2. Click "New Query"
3. Copy contents of `migrations/0006_treasury_wallet.sql`
4. Paste into editor
5. Click "Run" button
6. Verify success message

**Option C: Using Drizzle Kit (If configured)**

```bash
npm run migration:apply

# Drizzle will automatically connect to DATABASE_URL
# and apply all pending migrations
```

### 3.2 Verify Migration Success

```bash
# Connect to production database
psql $DATABASE_URL

# Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('treasury_wallets', 'treasury_wallet_transactions');

# Should return:
# treasury_wallets
# treasury_wallet_transactions

# Verify indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('treasury_wallets', 'treasury_wallet_transactions');

# Should return multiple indexes for performance
```

## Step 4: Environment Variables

### 4.1 Vercel Deployment

```bash
# Using Vercel CLI
vercel env add PAYSTACK_SECRET_KEY
# Paste: sk_live_... (for production)

vercel env add PAYSTACK_PUBLIC_KEY
# Paste: pk_live_... (for production)

# OR using Vercel Dashboard:
# Settings → Environment Variables
# Add PAYSTACK_SECRET_KEY with live key
# Add PAYSTACK_PUBLIC_KEY with live key
```

### 4.2 Render/Heroku Deployment

```bash
# Using CLI
render env set PAYSTACK_SECRET_KEY "sk_live_..."
render env set PAYSTACK_PUBLIC_KEY "pk_live_..."

# OR via Dashboard: Service → Environment
```

### 4.3 Verify Environment Variables

```bash
# After deployment, check logs for:
# "Treasury wallet service initialized"
# "Paystack integration ready"

# Or test endpoint:
curl https://your-app.vercel.app/api/admin/treasury/wallet \
  -H "Authorization: Bearer token"

# Should NOT return "PAYSTACK_SECRET_KEY not set" error
```

## Step 5: Deploy Code

### 5.1 Git Commit and Push

```bash
# Ensure all changes are added
git add -A

# Commit with descriptive message
git commit -m "feat: Implement Treasury wallet with Paystack integration

- Add treasuryWallets and treasuryWalletTransactions tables
- Implement treasuryWalletService with deposit/debit/credit operations
- Integrate wallet into Treasury settlement workflow
- Add 4 API endpoints for wallet operations
- Create React component for wallet UI
- Update E2E tests with wallet verification
- Add environment setup documentation"

# Push to main (triggers deployment)
git push origin main
```

### 5.2 Deployment Status

```bash
# For Vercel - check deployment
vercel list

# For other platforms - check dashboard
# GitHub Actions → Workflows → Deploy
```

## Step 6: Post-Deployment Verification

### 6.1 Verify Deployment

```bash
# Wait for deployment to complete (2-5 minutes)

# Check application health
curl https://your-app.com/health
# Should return 200 OK

# Check if API is responding
curl https://your-app.com/api/admin/treasury/wallet \
  -H "Authorization: Bearer admin_token"
# Should return wallet data (not error)
```

### 6.2 Check Server Logs

```bash
# Vercel Logs
vercel logs
# Should see: "Treasury wallet service ready"

# Check for errors
vercel logs | grep -i error

# Should see NO errors related to PAYSTACK_SECRET_KEY
```

### 6.3 Database Verification

```bash
# Verify tables in production
psql $DATABASE_URL -c "SELECT COUNT(*) FROM treasury_wallets;"

# Should return: (empty or 0)
# This is expected - wallets are created per admin on first use

# Verify schema
psql $DATABASE_URL -c "\d treasury_wallets"

# Should show all 8 columns:
# id, admin_id, balance, total_deposited, total_used, total_earned, status, created_at, updated_at
```

### 6.4 Test Production Endpoints

```bash
# Get wallet balance
curl -X GET https://your-app.com/api/admin/treasury/wallet \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Should return: {"balance": 0, "totalDeposited": 0, ...}

# Test deposit initiation
curl -X POST https://your-app.com/api/admin/treasury/wallet/deposit/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"amount": 50000, "email": "admin@example.com"}'

# Should return: {"authorizationUrl": "...", "reference": "..."}

# Test transactions endpoint
curl -X GET https://your-app.com/api/admin/treasury/wallet/transactions?limit=10 \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Should return: {"transactions": [...]}
```

## Step 7: Integration Verification

### 7.1 Admin Dashboard Integration

```bash
# Login to admin dashboard
# Navigate to /admin/treasury

# Should see:
# 1. TreasuryWalletPanel (new)
#    - Current balance
#    - Deposit button
#    - Transaction history
# 2. TreasuryImbalanceMonitor (existing)
#    - Imbalance visualization
# 3. TreasuryAnalyticsDashboard (existing)
#    - Performance metrics
```

### 7.2 Test Admin Deposit Flow

1. Navigate to `/admin/treasury`
2. Click "Deposit to Treasury" button
3. Enter amount (e.g., ₦100,000)
4. Click "Continue to Payment"
5. Redirected to Paystack checkout
6. Use test card: 4111 1111 1111 1111, 01/25, 123
7. Complete payment
8. Redirected back to app
9. Check balance increased
10. Verify transaction in history

### 7.3 Test Settlement Wallet Credit

1. Create a challenge with Treasury matches
2. Resolve challenge (with Treasury winning)
3. Settlement executes automatically
4. Check admin's Treasury wallet
5. Balance should increase by win amount

## Step 8: Monitoring & Logging

### 8.1 Set Up Alerts

```bash
# Monitor for errors (Vercel)
vercel monitoring create

# Watch for:
# - "PAYSTACK_SECRET_KEY not set"
# - "Insufficient Treasury balance"
# - "Database connection error"
# - Settlement failures
```

### 8.2 Create CloudWatch Alarms

```bash
# For AWS deployments
aws cloudwatch put-metric-alarm \
  --alarm-name treasury-wallet-errors \
  --alarm-description "Alert on Treasury wallet errors" \
  --metric-name Errors \
  --threshold 5
```

### 8.3 Monitor Transaction Volume

```bash
# Check transaction count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM treasury_wallet_transactions;"

# Monitor over time to detect anomalies
```

## Step 9: Rollback Plan

If deployment fails, follow these steps:

### 9.1 Immediate Rollback

```bash
# If critical error, rollback immediately
git revert HEAD
git push origin main

# Vercel will auto-redeploy previous version
```

### 9.2 Database Rollback

```bash
# If migration caused issues
# Drop tables (WARNING: loses data)
psql $DATABASE_URL -c "DROP TABLE treasury_wallet_transactions; DROP TABLE treasury_wallets;"

# OR restore from backup
vercel env pull # Get backup info
```

### 9.3 Partial Rollback

```bash
# Keep migration, revert code changes
git revert HEAD~1..HEAD  # Revert last commit

# This keeps database tables but disables wallet feature
# Users can still use Treasury without deposits
```

## Troubleshooting

### Issue: "PAYSTACK_SECRET_KEY not set"

**Solution:**
```bash
# 1. Verify env var in dashboard
vercel env pull

# 2. Redeploy after setting variable
vercel deploy --prod

# 3. Check logs
vercel logs | grep PAYSTACK
```

### Issue: Tables don't exist after migration

**Solution:**
```bash
# 1. Manually run migration
psql $DATABASE_URL -f migrations/0006_treasury_wallet.sql

# 2. Verify creation
psql $DATABASE_URL -c "\dt treasury_*"

# 3. Check for SQL errors
psql $DATABASE_URL -f migrations/0006_treasury_wallet.sql --echo-errors
```

### Issue: Deposits not working

**Solution:**
```bash
# 1. Test Paystack key
curl -H "Authorization: Bearer $PAYSTACK_SECRET_KEY" \
  https://api.paystack.co/verification/account

# 2. Check server logs
vercel logs | grep -i paystack

# 3. Test with sandbox key first
```

## Success Criteria

✅ Deployment is complete when:

1. **Code Deployed**
   - All files pushed to main branch
   - Vercel/hosting shows successful deployment
   - No build errors in logs

2. **Database Ready**
   - treasury_wallets table exists
   - treasury_wallet_transactions table exists
   - All indexes created

3. **Environment Configured**
   - PAYSTACK_SECRET_KEY set in production
   - PAYSTACK_PUBLIC_KEY set in production
   - Verified in environment variables

4. **API Functional**
   - GET /api/admin/treasury/wallet returns 200
   - POST /api/admin/treasury/wallet/deposit/initiate returns valid Paystack URL
   - GET /api/admin/treasury/wallet/transactions returns transaction history

5. **Integration Complete**
   - TreasuryWalletPanel visible in admin dashboard
   - Settlement worker credits wallet on wins
   - E2E tests pass (if run in production)

6. **Testing Verified**
   - Admin can successfully deposit funds
   - Treasury matches properly debit wallet
   - Settlement properly credits wallet on wins
   - Transaction history shows all operations

---

## Summary

Treasury wallet deployment is complete when all steps are followed. The system is now ready for production use with:

✅ Per-admin Treasury wallets  
✅ Paystack integration for deposits  
✅ Automatic debits on match creation  
✅ Automatic credits on settlement wins  
✅ Full transaction history and audit trail  
✅ Real-time wallet UI updates  

**Expected Timeline:**
- Pre-deployment checks: 10 minutes
- Local testing: 15 minutes
- Database migration: 5 minutes
- Environment setup: 5 minutes
- Code deployment: 2-5 minutes
- Post-deployment verification: 10 minutes

**Total: ~45-50 minutes**

---

**Next Steps After Deployment:**

1. **Monitor Production**
   - Watch logs for errors
   - Check transaction volume
   - Monitor API performance

2. **Admin Onboarding**
   - Provide Paystack account setup guide
   - Train admins on Treasury wallet usage
   - Create admin documentation

3. **Ongoing Maintenance**
   - Regular database backups
   - Transaction reconciliation
   - Performance optimization
   - Security audits

---

**Deployment Status: ✅ READY FOR PRODUCTION**
