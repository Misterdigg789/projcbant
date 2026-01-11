# Treasury Wallet - Quick Reference Card

## ⚡ Deploy in 5 Minutes

```bash
# 1. Apply database migration
npm run migration:apply

# 2. Verify TypeScript
npx tsc --noEmit

# 3. Commit changes
git add -A
git commit -m "feat: Treasury wallet implementation"

# 4. Push to production
git push origin main

# 5. Monitor deployment
vercel logs
```

---

## 📂 Key Files

**Migration:** `migrations/0006_treasury_wallet.sql`  
**Service:** `server/treasuryWalletService.ts`  
**Component:** `client/src/components/TreasuryWalletPanel.tsx`  
**Routes:** `server/routes.ts` (4 endpoints)  
**Tests:** `server/treasuryE2ETest.ts` (2 new steps)  
**Settlement:** `server/treasurySettlementWorker.ts` (updated)  

---

## 🔌 API Endpoints

```
GET  /api/admin/treasury/wallet
POST /api/admin/treasury/wallet/deposit/initiate
POST /api/admin/treasury/wallet/deposit/verify
GET  /api/admin/treasury/wallet/transactions
```

---

## 💾 Database Tables

### treasury_wallets
```
id | admin_id | balance | total_deposited | total_used | total_earned | status | created_at | updated_at
```

### treasury_wallet_transactions
```
id | admin_id | type | amount | description | related_match_id | related_challenge_id | reference | status | balance_before | balance_after | created_at
```

---

## 🧩 Integration Points

**Deposit:** User → Paystack → API → Wallet DB  
**Debit:** Treasury Match Created → treasuryManagement.ts → Wallet Service  
**Credit:** Settlement Executes → treasurySettlementWorker.ts → creditTreasuryWallet()  

---

## 📋 Environment Variables

```
PAYSTACK_SECRET_KEY=sk_live_...      (Backend)
PAYSTACK_PUBLIC_KEY=pk_live_...      (Frontend)
VITE_PAYSTACK_PUBLIC_KEY=pk_live_... (React)
DATABASE_URL=postgresql://...        (Required)
```

---

## ✅ Verification Commands

```bash
# TypeScript check
npx tsc --noEmit

# E2E tests
npx tsx server/treasuryE2ETest.ts

# Database migration (production)
psql $DATABASE_URL -f migrations/0006_treasury_wallet.sql

# Verify tables
psql $DATABASE_URL -c "\dt treasury_*"

# Test API endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://your-app.com/api/admin/treasury/wallet
```

---

## 🚨 Rollback

```bash
git revert HEAD
git push origin main

# To drop database (if needed)
psql $DATABASE_URL -c "DROP TABLE treasury_wallet_transactions; DROP TABLE treasury_wallets;"
```

---

## 📚 Documentation

| Doc | Purpose | Time |
|-----|---------|------|
| TREASURY_WALLET_DEPLOYMENT_CHECKLIST.md | Quick checklist | 5 min |
| TREASURY_WALLET_DEPLOYMENT_GUIDE.md | Full steps | 20 min |
| TREASURY_WALLET_ENVIRONMENT_SETUP.md | Env config | 15 min |
| TREASURY_WALLET_DEPLOYMENT_COMPLETE.md | Summary | 10 min |

---

## 🎯 Success Criteria

✅ Migration applied  
✅ No TypeScript errors  
✅ Paystack keys in environment  
✅ API endpoints responding  
✅ Admin can deposit funds  
✅ Wallet balance updates  
✅ Settlement credits wallet  
✅ E2E tests passing  

---

## 💡 Quick Tips

- **Test First:** Run E2E tests before deploying
- **Env Vars:** Set Paystack keys BEFORE deploying
- **Logs:** Check logs immediately after deploy
- **DB:** Always backup before running migration
- **Monitor:** Watch for errors in first hour after deploy
- **Rollback:** Keep previous version ready

---

## 🆘 Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| "PAYSTACK_SECRET_KEY not set" | Add to environment variables |
| Tables don't exist | Run migration manually |
| Paystack payment fails | Verify API keys in Paystack dashboard |
| Settlement doesn't credit | Check treasurySettlementWorker.ts imports |
| Component not loading | Verify in admin dashboard imports |

---

## 📞 Support

See full documentation in:
- `TREASURY_WALLET_DEPLOYMENT_GUIDE.md` - Comprehensive guide with troubleshooting
- `TREASURY_WALLET_ENVIRONMENT_SETUP.md` - Env configuration details

---

**Status:** ✅ PRODUCTION READY  
**Last Updated:** January 1, 2026  
**Version:** 1.0.0
