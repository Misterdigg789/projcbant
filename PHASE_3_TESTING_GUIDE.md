# Phase 3: Testing Guide

## Quick Start

### Prerequisites
- Server running with Phase 3 code deployed
- Admin panel access
- Postman or API client (for manual testing)

## Test Scenarios

### Test 1: Small Challenge Payout (10 Winners)
**Objective:** Verify basic payout job creation and completion

**Setup:**
1. Create a challenge with 10 YES stakers and 10 NO stakers (20 total)
2. Set challenge as active and past due date
3. Navigate to Admin Payouts page

**Steps:**
1. Click "Challenger Won" to resolve challenge
2. Verify response shows: `{ challenge, payoutJobId, message }`
3. Check admin UI shows payout job progress row
4. Wait 5 minutes or manually trigger worker (see manual trigger below)
5. Observe progress bar: 0% → 50% → 100%
6. Verify progress bar disappears when complete

**Expected Result:**
- ✅ Payout job created with status "queued"
- ✅ Progress shows 10/10 winners processed
- ✅ Job status transitions: queued → running → completed
- ✅ All 10 winners receive payout
- ✅ Total time: < 5 minutes

**Query to Verify:**
```sql
-- Check job
SELECT * FROM payout_jobs WHERE challengeId = 123;

-- Should show:
-- id: uuid
-- status: 'completed'
-- totalWinners: 10
-- processedWinners: 10
-- completedAt: timestamp

-- Check entries
SELECT status, COUNT(*) FROM payout_entries 
WHERE jobId = 'job-uuid' 
GROUP BY status;

-- Should show:
-- status | count
-- completed | 10
```

### Test 2: Large Challenge Payout (1,000 Winners)
**Objective:** Verify batch processing with multiple intervals

**Setup:**
1. Create a challenge with 500 YES stakers and 500 NO stakers (1,000 total)
2. Set challenge as active and past due date

**Steps:**
1. Click "Challenged Won" to resolve challenge
2. Verify progress bar shows 0%
3. Wait 5 minutes for first batch (500 users)
4. Verify progress: ~50% (500/1000)
5. Wait another 5 minutes for second batch
6. Verify progress: 100% (1000/1000)
7. Check users table - all winners should have increased coins

**Expected Result:**
- ✅ Payout job processes in 2 batches (500 each)
- ✅ Progress updates: 0% → 50% → 100% over ~10 minutes
- ✅ All 1,000 winners receive correct payout amount
- ✅ Batch 1 completes first (5 min), Batch 2 completes second (10 min)

**Query to Verify:**
```sql
-- Check batch processing
SELECT 
  status, 
  COUNT(*) as count,
  MIN(processedAt) as first_processed,
  MAX(processedAt) as last_processed
FROM payout_entries 
WHERE jobId = 'job-uuid'
GROUP BY status;

-- Expected:
-- status | count | first_processed | last_processed
-- completed | 1000 | 2024-01-20 10:05:00 | 2024-01-20 10:10:00

-- Verify winner payouts
SELECT COUNT(DISTINCT userId) 
FROM payout_entries 
WHERE jobId = 'job-uuid' AND status = 'completed';
-- Should return: 1000
```

### Test 3: Multiple Concurrent Jobs
**Objective:** Verify worker handles multiple jobs simultaneously

**Setup:**
1. Create Challenge A with 100 winners
2. Create Challenge B with 100 winners
3. Both challenges: active, past due date

**Steps:**
1. Resolve Challenge A → get payoutJobId1
2. Immediately resolve Challenge B → get payoutJobId2
3. Check admin UI shows 2 progress rows
4. Both progress bars should advance together
5. Wait 5 minutes for first batch
6. Both jobs should show ~50% (assuming 100 = 1 batch, will be 100%)

**Expected Result:**
- ✅ Both jobs created with different IDs
- ✅ Both display progress rows in admin UI
- ✅ Both jobs processed in same interval
- ✅ All winners from both challenges paid out

**Query to Verify:**
```sql
-- Check both jobs
SELECT id, challengeId, status, processedWinners, totalWinners 
FROM payout_jobs 
WHERE status = 'completed' 
ORDER BY completedAt DESC 
LIMIT 2;

-- Should show 2 completed jobs with correct winner counts
```

### Test 4: Draw Challenge (No Payout)
**Objective:** Verify draws don't create payout jobs

**Setup:**
1. Create a challenge with 50 YES and 50 NO stakers
2. Set as active and past due date

**Steps:**
1. Click "Draw" button to resolve challenge
2. Verify response: `{ challenge, message: "Draw - stakes returned" }`
3. Verify NO payout job created (payoutJobId should be null/undefined)
4. Verify NO progress row appears in admin UI
5. Check users table - both teams should have original stakes returned

**Expected Result:**
- ✅ Challenge result set to "draw"
- ✅ No payout job created
- ✅ No progress row shown
- ✅ adminSetChallengeResult() handles draw directly (not in Phase 3)
- ✅ Time: < 100ms

### Test 5: Payout Failure & Retry
**Objective:** Verify failed batches can be retried

**Setup:**
1. Create challenge with 100 winners
2. Inject error in PayoutWorker.processBatch() to simulate failure
3. Resolve challenge

**Steps:**
1. First interval: Job starts processing
2. Transaction fails partway through (simulate)
3. Entries fail mid-batch
4. Verify job status: "running" with error
5. Fix the injected error
6. Wait next interval
7. Worker retries failed entries
8. Job completes successfully

**Expected Result:**
- ✅ Failed entries marked with error status
- ✅ Job doesn't auto-complete if batch fails
- ✅ Next interval retries same batch
- ✅ Eventually completes when error fixed
- ✅ Manual retry possible via admin API

**Database Inspection:**
```sql
-- Check failed entries
SELECT id, userId, status, createdAt, processedAt 
FROM payout_entries 
WHERE jobId = 'job-uuid' AND status = 'failed'
LIMIT 5;
```

### Test 6: Progress Polling (Frontend)
**Objective:** Verify admin UI correctly polls and updates progress

**Setup:**
1. Open browser dev tools (Network tab)
2. Create challenge with 200 winners
3. Resolve challenge

**Steps:**
1. Observe Network tab shows requests to `/api/admin/payout-jobs/:jobId/status`
2. Requests should appear every 2 seconds
3. Response should include: `progressPercent`, `processedWinners`, `totalWinners`
4. Progress bar should smoothly update (0% → 100%)
5. When job completes (status: "completed"), requests should stop
6. Progress bar should show 100% and turn green

**Expected Result:**
- ✅ First request at ~1 second (before first batch)
- ✅ Requests every 2 seconds thereafter
- ✅ Response status changes: queued → running → completed
- ✅ Progress percentage increases with each batch
- ✅ Polling stops when completed (no more requests)
- ✅ UI responsive during polling (no freezing)

**Manual API Test:**
```bash
# Get job status
curl -H "Authorization: Bearer [admin-token]" \
  "http://localhost:3000/api/admin/payout-jobs/[job-id]/status"

# Expected response:
{
  "jobId": "uuid",
  "challengeId": 123,
  "status": "running",
  "totalWinners": 100,
  "processedWinners": 50,
  "progressPercent": 50,
  "createdAt": "2024-01-20T10:00:00Z",
  "completedAt": null,
  "error": null
}
```

### Test 7: Server Restart During Processing
**Objective:** Verify incomplete jobs survive server restart

**Setup:**
1. Create challenge with 500 winners
2. Trigger payout processing (wait until ~250 processed)
3. Restart server
4. Check admin UI and database

**Steps:**
1. Resolve challenge → get jobId
2. Wait 2-3 minutes (first batch starts)
3. Kill server process: `kill [pid]`
4. Restart server: `npm run dev` or `npm start`
5. Refresh admin UI
6. Verify payoutJobId still tracked
7. Wait another 5 minutes
8. Job should resume processing from where it left off
9. Eventually complete with all 500 winners processed

**Expected Result:**
- ✅ Job state persisted in database
- ✅ Job resumes processing after restart
- ✅ No duplicate payouts (entries marked "completed" skipped)
- ✅ All 500 winners processed eventually
- ✅ Job status shows correct progress

**Database Check:**
```sql
-- Entries should have createdAt < restart time and processedAt > restart time
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN processedAt < NOW() - interval '3 minutes' THEN 1 ELSE 0 END) as before_restart,
  SUM(CASE WHEN processedAt > NOW() - interval '3 minutes' THEN 1 ELSE 0 END) as after_restart
FROM payout_entries 
WHERE jobId = 'job-uuid';
```

### Test 8: Real-Time Update Accuracy
**Objective:** Verify processedWinners field updates correctly

**Setup:**
1. Create challenge with 1,000 winners
2. Resolve challenge
3. Open admin UI in two browser tabs

**Steps:**
1. In Tab 1: Watch progress bar update
2. In Tab 2: Continuously query database
3. Verify progress bar matches database `processedWinners` count
4. Check timestamp of last update
5. Verify next batch starts within 5 minutes of previous batch finish

**Expected Result:**
- ✅ Progress bar shows accurate percentage
- ✅ Database count matches UI percentage
- ✅ UI updates align with batch completions
- ✅ Batches process at 5-minute intervals
- ✅ No gaps in processing (continuous progress)

## Manual Testing Procedures

### Manually Trigger PayoutWorker
```typescript
// In server console or admin API call
import { payoutWorker } from "./server/payoutWorker";
await payoutWorker.triggerImmediate('job-uuid');
```

### Simulate Processing Delay
```typescript
// Modify PayoutWorker.processBatch() temporarily
await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
```

### Check All Payout Jobs
```sql
SELECT 
  id, 
  challengeId, 
  status, 
  totalWinners, 
  processedWinners,
  (processedWinners::float / totalWinners * 100)::int AS progress_pct,
  error
FROM payout_jobs 
ORDER BY createdAt DESC;
```

### Check Pending Entries
```sql
SELECT 
  COUNT(*) as pending_count,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
FROM payout_entries 
WHERE jobId = 'job-uuid'
GROUP BY jobId;
```

### Reset Job (for re-testing)
```typescript
// Mark all entries as pending again (CAREFUL - for testing only)
UPDATE payout_entries 
SET status = 'pending', processedAt = NULL 
WHERE jobId = 'job-uuid';

UPDATE payout_jobs 
SET status = 'queued', processedWinners = 0, completedAt = NULL, error = NULL 
WHERE id = 'job-uuid';
```

## Performance Benchmarks

### Expected Metrics
| Scenario | Time | Status |
|----------|------|--------|
| Challenge resolution (response) | < 100ms | ✅ |
| First batch processing | 5 minutes | ✅ |
| Per-batch processing | ~30 seconds | ✅ |
| 500 winners/batch | 1 batch = 30s | ✅ |
| 1,000 winners total | 2 batches = 10-12 min | ✅ |
| 10,000 winners total | 20 batches = 100 min | ✅ |
| Admin UI responsiveness | < 50ms | ✅ |
| Status polling | 2 sec intervals | ✅ |

### Database Performance
```sql
-- Check payout_jobs query performance
EXPLAIN ANALYZE SELECT * FROM payout_jobs WHERE status = 'queued';

-- Check payout_entries query performance
EXPLAIN ANALYZE SELECT * FROM payout_entries 
WHERE jobId = 'job-uuid' AND status = 'pending' 
LIMIT 500;
```

## Troubleshooting

### Issue: Progress bar not appearing
**Solution:**
1. Check browser console for errors
2. Verify admin auth token valid
3. Check network tab - status endpoint called?
4. Verify payoutJobId returned from /api/admin/challenges/:id/result

### Issue: Progress bar stuck at X%
**Solution:**
1. Check database: `SELECT * FROM payout_jobs WHERE id = 'job-uuid'`
2. If status = "running", wait for next interval (5 minutes)
3. If status = "queued", manually trigger: `payoutWorker.triggerImmediate(jobId)`
4. Check for errors in server logs

### Issue: Job marked as failed
**Solution:**
1. Check error message in payout_jobs.error field
2. Fix underlying issue (database connectivity, etc.)
3. Mark failed entries back to pending:
   ```sql
   UPDATE payout_entries SET status = 'pending' 
   WHERE jobId = 'job-uuid' AND status = 'failed';
   UPDATE payout_jobs SET status = 'queued' 
   WHERE id = 'job-uuid';
   ```
4. Manually trigger: `payoutWorker.triggerImmediate(jobId)`

### Issue: Some winners not paid
**Solution:**
1. Count completed entries: `SELECT COUNT(*) FROM payout_entries WHERE jobId = 'job-uuid' AND status = 'completed'`
2. Compare to totalWinners in payout_jobs
3. Find pending/failed entries: `SELECT * FROM payout_entries WHERE jobId = 'job-uuid' AND status != 'completed'`
4. Check user balances in transactions table
5. If missing, mark entries as pending and retry

## Test Summary

| Test | Status | Notes |
|------|--------|-------|
| Small payout (10) | Manual | Run before every deploy |
| Large payout (1,000) | Manual | Verify batching works |
| Concurrent jobs | Manual | Ensure no race conditions |
| Draw result | Manual | Ensure no payout created |
| Failure & retry | Manual | Test error handling |
| Frontend polling | Manual | Verify UI updates |
| Server restart | Manual | Verify persistence |
| Accuracy check | Manual | Verify correct payouts |

## Success Criteria

✅ All tests pass
✅ No errors in server logs
✅ All winners receive correct payout amount
✅ Admin UI responsive throughout
✅ Progress bar updates every 5 minutes (or less)
✅ Database integrity maintained
✅ Server restart doesn't lose progress
✅ Multiple jobs handled concurrently

---

**Phase 3 Testing: Ready for QA**
