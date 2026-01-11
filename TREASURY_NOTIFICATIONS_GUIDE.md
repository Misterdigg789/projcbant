# Treasury Notification Integration - Complete Guide

## Overview
Users and admins receive real-time notifications when Treasury matches are created and when challenges resolve with Treasury participation.

---

## User Notifications

### 1. **When Matched with Treasury** (`match.found`)
**Triggered:** When admin fulfills Treasury matches  
**Recipient:** User matched with Treasury persona  
**Content:** "You've been matched! Competing against [Persona Name]"  
**Data:**
```json
{
  "event": "match.found",
  "userId": "user_id",
  "challengeId": "challenge_id",
  "opponentName": "Shadow Persona Name",
  "opponentStaked": 5000,
  "userStaked": 5000
}
```

**Code Location:** [server/treasuryManagement.ts](server/treasuryManagement.ts#L140-L160) - `fulfillTreasuryMatches()` calls `notifyTreasuryMatchCreated()`

---

### 2. **When Challenge Settles** (`challenge.settled`)
**Triggered:** After challenge result is finalized and Treasury matches are settled  
**Recipient:** All users with Treasury matches in challenge  
**Content:** "Challenge settled! You won ₦5,000" or "You lost ₦5,000"  
**Data:**
```json
{
  "event": "challenge.settled",
  "userId": "user_id",
  "challengeId": "challenge_id",
  "result": "won",
  "payout": 5000,
  "opponentName": "Shadow Persona Name"
}
```

**Code Location:** [server/treasurySettlementWorker.ts](server/treasurySettlementWorker.ts#L80-L120) - `settleTreasuryMatch()` calls `notifyTreasuryMatchSettled()`

---

## Admin Notifications

### 1. **When Treasury Matches Created** (`admin.treasury.match_created`)
**Triggered:** After admin fulfills Treasury matches  
**Recipient:** Admin who performed the action  
**Content:** "Treasury: Filled 15 matches on YES side, ₦75,000 allocated"  
**Data:**
```json
{
  "event": "admin.treasury.match_created",
  "adminId": "admin_id",
  "challengeId": "challenge_id",
  "matchCount": 15,
  "totalAllocated": 75000,
  "side": "YES",
  "matchedUsernames": ["persona1", "persona2", ...]
}
```

**Code Location:** [server/treasuryManagement.ts](server/treasuryManagement.ts#L155-L170) - `fulfillTreasuryMatches()` calls `notifyAdminTreasuryMatchCreated()`

---

### 2. **When Challenge Settles with Treasury** (`admin.treasury.settlement`)
**Triggered:** After all Treasury matches are settled  
**Recipient:** Admin who created the challenge  
**Content:** "Treasury Settlement: 15 matches, Net profit ₦12,500"  
**Data:**
```json
{
  "event": "admin.treasury.settlement",
  "adminId": "admin_id",
  "challengeId": "challenge_id",
  "totalMatches": 15,
  "wonMatches": 9,
  "lostMatches": 6,
  "netProfit": 12500,
  "totalPayout": 87500,
  "totalStaked": 75000
}
```

**Code Location:** [server/treasurySettlementWorker.ts](server/treasurySettlementWorker.ts#L130-L160) - `settleChallengeTreasuryMatches()` calls `sendAdminTreasurySummary()`

---

### 3. **Daily Treasury P&L Summary** (`admin.treasury.daily_summary`)
**Triggered:** Once per day (scheduled job - not yet implemented)  
**Recipient:** Admin  
**Content:** "Treasury Daily Report: ₦85,000 allocated today, Net: -₦2,500"  
**Data:**
```json
{
  "event": "admin.treasury.daily_summary",
  "adminId": "admin_id",
  "date": "2024-01-15",
  "totalAllocated": 85000,
  "totalPayout": 82500,
  "netProfit": -2500,
  "challengesCount": 8,
  "matchesCount": 127
}
```

**Code Location:** [server/treasurySettlementWorker.ts](server/treasurySettlementWorker.ts#L170-L185) - Scheduled daily execution (TODO: implement scheduler)

---

## Integration Points

### API Endpoints Modified

**1. Fulfill Treasury Matches**
```
POST /api/admin/challenges/:id/fulfill-treasury
Body: { matchCount: 10, side: "YES" }
```
- Executes `fulfillTreasuryMatches()`
- Creates matches
- Sends notification: `notifyTreasuryMatchCreated()` to each user
- Sends notification: `notifyAdminTreasuryMatchCreated()` to admin
- **File:** [server/routes.ts](server/routes.ts#L3950-L4020)

**2. Set Challenge Result**
```
POST /api/admin/challenges/:id/result
Body: { result: "challenger_won" }
```
- Sets challenge result (existing behavior)
- **NEW:** Calls `settleChallengeTreasuryMatches()` if challenge is admin-created
- Sends settlement notifications to all Treasury-matched users
- Sends admin settlement summary
- **File:** [server/routes.ts](server/routes.ts#L4316-L4380)

---

## Database Records Created

All notifications are stored in the `notifications` table:

```typescript
{
  id: number;
  userId: string;
  event: string;  // e.g., "match.found", "challenge.settled", "admin.treasury.match_created"
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}
```

### Sample Queries

**Get all Treasury match creation events for a user:**
```sql
SELECT * FROM notifications 
WHERE user_id = 'user_id' 
AND event = 'match.found' 
AND data->>'is_treasury' = 'true'
ORDER BY created_at DESC;
```

**Get settlement notifications for a challenge:**
```sql
SELECT * FROM notifications 
WHERE event = 'challenge.settled' 
AND data->>'challengeId' = 'challenge_id'
ORDER BY created_at DESC;
```

**Get admin Treasury summaries:**
```sql
SELECT * FROM notifications 
WHERE user_id = 'admin_id' 
AND event LIKE 'admin.treasury.%'
ORDER BY created_at DESC;
```

---

## Testing the Flow

### Manual Test Steps

1. **Create an admin-created challenge**
   - Title: "TEST TREASURY CHALLENGE"
   - Set admin as creator

2. **Configure Treasury**
   ```bash
   POST /api/admin/challenges/:id/treasury-config
   { "maxRisk": 50000 }
   ```
   - Creates Treasury config record

3. **Fulfill Treasury Matches**
   ```bash
   POST /api/admin/challenges/:id/fulfill-treasury
   { "matchCount": 10, "side": "YES" }
   ```
   - Creates 10 matches
   - **Expected:** 10 notifications in table with event="match.found"
   - **Admin Expected:** 1 notification with event="admin.treasury.match_created"

4. **Resolve Challenge**
   ```bash
   POST /api/admin/challenges/:id/result
   { "result": "challenger_won" }
   ```
   - Settles all Treasury matches
   - **Expected:** 10 notifications with event="challenge.settled" (some won, some lost)
   - **Admin Expected:** 1 notification with event="admin.treasury.settlement"

### Automated Test

```bash
cd /workspaces/try12345678
export DATABASE_URL='your_database_url'
npx tsx server/testTreasurySettlement.ts
```

This will:
- Verify test challenge exists
- Show Treasury configuration
- Display active vs settled matches
- Show sample settlement calculations
- Provide curl commands to test endpoints

---

## Flow Diagrams

### User Journey
```
Admin fulfills Treasury matches
         ↓
    Create match records
         ↓
Notify user "You've been matched"  ← notification event: match.found
         ↓
User views challenge (sees persona)
         ↓
Challenge resolves (admin sets result)
         ↓
   Settle Treasury matches
         ↓
Notify user "Challenge settled"  ← notification event: challenge.settled
         ↓
User sees P&L in wallet
```

### Admin Journey
```
Admin creates challenge
         ↓
Configures Treasury (max risk)
         ↓
Fulfills Treasury matches
         ↓
    Notify admin "15 matches filled"  ← notification event: admin.treasury.match_created
         ↓
Monitor imbalance (auto-refresh every 30s)
         ↓
Set challenge result
         ↓
   System settles Treasury
         ↓
  Notify admin "Settlement complete"  ← notification event: admin.treasury.settlement
         ↓
Review daily P&L (once per day)  ← notification event: admin.treasury.daily_summary
```

---

## Code Files Reference

| File | Purpose |
|------|---------|
| [server/treasuryNotifications.ts](server/treasuryNotifications.ts) | Notification creation and delivery |
| [server/treasuryManagement.ts](server/treasuryManagement.ts) | Core Treasury logic, match creation |
| [server/treasurySettlementWorker.ts](server/treasurySettlementWorker.ts) | Settlement logic, P&L calculations |
| [server/routes.ts](server/routes.ts) | API endpoints, integration points |
| [server/testTreasurySettlement.ts](server/testTreasurySettlement.ts) | E2E test suite |
| [shared/schema.ts](shared/schema.ts) | Database schema for Treasury tables |
| [client/src/lib/adminApi.ts](client/src/lib/adminApi.ts) | Admin API client with hooks |
| [client/src/components/TreasuryImbalanceMonitor.tsx](client/src/components/TreasuryImbalanceMonitor.tsx) | Admin dashboard UI |

---

## Known Limitations & TODOs

- ✅ **COMPLETE:** Notification creation and delivery
- ✅ **COMPLETE:** Settlement integration in challenge result endpoint
- ✅ **COMPLETE:** User and admin notifications
- ⏳ **PENDING:** Daily Treasury P&L scheduler (need node-cron setup)
- ⏳ **PENDING:** Scheduled daily summary notifications
- ⏳ **PENDING:** Settlement notification batching UI
- ⏳ **PENDING:** Add settlement status to admin dashboard

---

## Next Steps

1. **Test the complete flow** using manual steps or automated test
2. **Set up scheduler** for daily Treasury summaries (optional, nice-to-have)
3. **Monitor notifications** in production using dashboard
4. **Extend admin UI** to show settlement results and P&L trends
