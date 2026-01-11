# Treasury E2E Testing Guide - Step 5

## Overview

Comprehensive end-to-end test that validates the entire Treasury flow from match creation through settlement. Tests verify:

✅ Database state at each step  
✅ Notifications created correctly  
✅ Settlement logic working properly  
✅ P&L calculations accurate  
✅ Admin wallet transactions recorded  

---

## Prerequisites

1. **Database URL set:**
   ```bash
   export DATABASE_URL='postgresql://...'
   ```

2. **Test admin user exists:**
   - Username: `test_admin_treasury`
   - Must have admin permissions

3. **Shadow personas seeded:**
   - Run: `npx tsx server/seedShadowPersonas.ts`
   - Need at least 49 personas

4. **Test challenge exists:**
   - Title: `E2E_TEST_TREASURY_CHALLENGE`
   - Must be admin-created (`adminCreated: true`)
   - Must not be resolved yet (`result: null`)

---

## Quick Setup (5 minutes)

### 1. Create test admin user
```bash
# Using psql or your database client
INSERT INTO users (username, email, is_admin, is_shadow_persona)
VALUES ('test_admin_treasury', 'test_admin@treasury.local', true, false);
```

### 2. Create test challenge
```bash
INSERT INTO challenges (
  title, description, stake, max_participants, 
  time_limit, admin_created, created_by
) VALUES (
  'E2E_TEST_TREASURY_CHALLENGE',
  'Test challenge for E2E testing',
  5000,
  30,
  600,
  true,
  (SELECT id FROM users WHERE username = 'test_admin_treasury' LIMIT 1)
);
```

### 3. Seed shadow personas (if not already done)
```bash
export DATABASE_URL='your_database_url'
npx tsx server/seedShadowPersonas.ts
```

---

## Run E2E Tests

### Option A: Standard Run
```bash
export DATABASE_URL='postgresql://user:pass@host/db'
npx tsx server/treasuryE2ETest.ts
```

### Option B: With Logging
```bash
export DATABASE_URL='postgresql://user:pass@host/db'
npx tsx server/treasuryE2ETest.ts 2>&1 | tee test_results.log
```

### Option C: From npm script
Add to `package.json`:
```json
{
  "scripts": {
    "test:treasury-e2e": "tsx server/treasuryE2ETest.ts"
  }
}
```

Then run:
```bash
npm run test:treasury-e2e
```

---

## What Each Step Tests

### Step 1: Verify Setup
- ✅ Admin user exists
- ✅ Shadow personas are seeded
- ✅ Ready to proceed

**Success:** Both checks pass

### Step 2: Create Challenge
- ✅ Test challenge exists
- ✅ Challenge is admin-created
- ✅ Challenge not yet resolved

**Success:** Challenge found and ready

### Step 3: Add Participants
- ✅ Created 10 YES-side users
- ✅ Created 2 NO-side users
- ✅ Imbalance detected (8 unmatched YES)

**Success:** 12 total participants, 40,000 gap

### Step 4: Configure Treasury
- ✅ Treasury config created
- ✅ Max risk: ₦50,000
- ✅ Allocation starts at 0

**Success:** Config ready for matches

### Step 5: Fulfill Matches
- ✅ Created 8 Treasury matches
- ✅ Allocated ₦40,000
- ✅ Marked matches as 'active'
- ✅ Created user notifications (8)
- ✅ Created admin notification (1)

**Success:** 8 matches created, 9 notifications

### Step 6: Verify Notifications
- ✅ 8+ match.found notifications exist
- ✅ 1+ admin creation notifications exist
- ✅ Notifications have proper data structure
- ✅ Notifications marked as unread

**Success:** All notifications in database

### Step 7: Resolve Challenge
- ✅ Challenge result set to 'challenger_won'
- ✅ Challenge shows result in database
- ✅ Ready for settlement

**Success:** Challenge resolved with YES side winning

### Step 8: Simulate Settlement
- ✅ Settlement logic executed
- ✅ Treasury win/loss determined correctly
- ✅ Payouts calculated
- ✅ User settlement notifications created (8)
- ✅ Admin settlement notification created (1)
- ✅ Admin wallet transaction recorded

**Success:** All matches settled with correct outcomes

### Step 9: Verify Settlement
- ✅ All matches have status='settled'
- ✅ All matches have result (won/lost)
- ✅ All matches have payout amount
- ✅ All matches have settled_at timestamp
- ✅ Settlement notifications exist

**Success:** All settlement data persisted correctly

### Step 10: Final Summary
- ✅ Shows pass/fail count
- ✅ Lists any errors
- ✅ Overall pass/fail determination

---

## Expected Output

### Successful Run
```
════════════════════════════════════════════════════════════════
  TREASURY BALANCING - COMPREHENSIVE END-TO-END TEST
════════════════════════════════════════════════════════════════

▶ STEP 1: VERIFY TEST DATA SETUP
✅ Admin user exists (test_admin_treasury)
✅ Shadow personas seeded (49 personas available)

▶ STEP 2: CREATE TEST CHALLENGE
✅ Found existing test challenge (ID: 123)
✅ Challenge is admin-created
✅ Challenge not yet resolved

▶ STEP 3: ADD IMBALANCED PARTICIPANTS
✅ Created 10 YES-side users
✅ Created 2 NO-side users
✅ Imbalance created (Gap: ₦40,000)
✅ 8 unmatched YES users

▶ STEP 4: CONFIGURE TREASURY FOR CHALLENGE
✅ Treasury config created (Max risk: ₦50,000)
✅ Config has max risk
✅ Config allocated is 0

▶ STEP 5: FULFILL TREASURY MATCHES
✅ Enough shadow personas available (Need: 8, Available: 49)
✅ Created treasury matches (8 matches)
✅ All matches status is active (8 matches active)
✅ Treasury allocation recorded (₦40,000 allocated)
✅ User notifications created
✅ Admin notification created

▶ STEP 6: VERIFY NOTIFICATIONS
✅ User match notifications created (8 notifications)
✅ Admin match notification created (1 notifications)
✅ Notification has title
✅ Notification has message
✅ Notification has data
✅ Notification not read

▶ STEP 7: RESOLVE CHALLENGE
✅ Challenge result set (Result: challenger_won)
✅ Challenge shows result
✅ Challenge resolved

▶ STEP 8: SIMULATE SETTLEMENT
✅ Found treasury matches to settle (8 matches)
✅ Settled all matches
✅ Treasury won some (3 wins)
✅ Treasury lost some (5 losses)
✅ Treasury P&L calculated (Won: ₦30,000, Lost: ₦25,000, Net: ₦5,000)
✅ Settlement notification created
✅ Treasury transaction recorded

▶ STEP 9: VERIFY SETTLEMENT STATE
✅ All matches settled (8 matches)
✅ Matches have result
✅ Matches have payout
✅ Matches have settled_at
✅ Settlement notifications created (8 notifications)
✅ Admin settlement notification created (1 notifications)

▶ STEP 10: FINAL SUMMARY

TEST RESULTS
✅ Passed: 42
❌ Failed: 0
📊 Total:  42

✨ ALL TESTS PASSED! 🎉

TREASURY STATE AT END
  Challenge ID: 123
  Matches Created: 8
  Matches Settled: 8
  Net Profit/Loss: ₦5,000
```

### Failed Run Example
If a test fails, you'll see:
```
❌ Treasury won some (0 wins)
```

And errors listed at the end:
```
ERRORS:
1. Settlement simulation failed: No matches found to settle
```

---

## Troubleshooting

### Error: "Admin user not found"
**Solution:** Create test_admin_treasury user
```sql
INSERT INTO users (username, email, is_admin, is_shadow_persona)
VALUES ('test_admin_treasury', 'admin@test.local', true, false);
```

### Error: "No shadow personas found"
**Solution:** Run seeding script
```bash
npx tsx server/seedShadowPersonas.ts
```

### Error: "E2E_TEST_TREASURY_CHALLENGE not found"
**Solution:** Create challenge in database
```sql
INSERT INTO challenges (title, description, stake, max_participants, time_limit, admin_created, created_by)
VALUES ('E2E_TEST_TREASURY_CHALLENGE', 'Test', 5000, 30, 600, true, [admin_id]);
```

### Error: "Challenge is not resolved"
**Solution:** Delete old test challenge or create new one with unique title
```sql
DELETE FROM challenges WHERE title = 'E2E_TEST_TREASURY_CHALLENGE';
```

### Error: "Insufficient shadow personas"
**Solution:** Need more personas in database
```sql
SELECT COUNT(*) FROM shadow_personas;
-- Should return 49 or more
```

---

## Test Data Cleanup

After testing, optionally clean up test data:

```bash
# Delete test users created by this run
DELETE FROM users WHERE username LIKE 'e2e_test_%';

# Delete test challenge (if desired)
DELETE FROM challenges WHERE title = 'E2E_TEST_TREASURY_CHALLENGE';

# Delete test notifications (if desired)
DELETE FROM notifications WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Interpreting Results

### Green ✅ = Test Passed
- Assertion true
- Database state correct
- Logic working as expected

### Red ❌ = Test Failed
- Assertion false
- Database state unexpected
- Logic error or bug

### Pass/Fail Determination
- **ALL PASS:** 0 failures = Ready for production
- **SOME FAIL:** Review error messages and fix issues
- **ALL FAIL:** Major issue - check setup prerequisites

---

## Running in CI/CD

### Add to GitHub Actions
```yaml
name: Treasury Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: |
          export DATABASE_URL=${{ secrets.TEST_DATABASE_URL }}
          npm run test:treasury-e2e
```

### Add to GitLab CI
```yaml
treasury_e2e_test:
  image: node:20
  script:
    - npm install
    - export DATABASE_URL=$CI_DATABASE_URL
    - npx tsx server/treasuryE2ETest.ts
  only:
    - main
```

---

## Next Steps After Testing

✅ **All Tests Pass?**
1. Review test results
2. Verify P&L calculations
3. Check notification database
4. Move to Step 6: Frontend Notification Display

❌ **Tests Fail?**
1. Read error messages carefully
2. Check database state with SQL queries
3. Verify settlement logic in code
4. Fix the issue and re-run tests

---

## Test File Location

**Main Test:** [server/treasuryE2ETest.ts](server/treasuryE2ETest.ts)

**Run Guide:** This file

**Related Guides:**
- [TREASURY_QUICK_TEST_GUIDE.md](TREASURY_QUICK_TEST_GUIDE.md) - Manual testing with curl
- [TREASURY_VISUAL_FLOWS.md](TREASURY_VISUAL_FLOWS.md) - Flow diagrams
- [TREASURY_NOTIFICATIONS_GUIDE.md](TREASURY_NOTIFICATIONS_GUIDE.md) - Notification details

---

**Status: READY TO RUN**

Run the test now with:
```bash
export DATABASE_URL='your_database_url'
npx tsx server/treasuryE2ETest.ts
```
