# 🚀 Supabase Migration - Quick Reference

## ⚡ 5-Minute Setup

### Step 1: Run Migration
```bash
supabase migration up
# OR via dashboard: Copy SQL from supabase/migrations/20251216_add_pairing_engine_schema.sql
```

### Step 2: Verify
```sql
SELECT COUNT(*) FROM pair_queue;           -- Should return 0
SELECT fcm_token FROM users LIMIT 1;       -- Should have column
```

### Step 3: Done! ✅

---

## 📦 What Gets Created

| Item | Type | Details |
|------|------|---------|
| `pair_queue` | Table | Challenge queue matching |
| `fcm_token` | Field | Firebase push tokens |
| `match_challenge_pair()` | Function | Atomic matching |
| 4 indexes | Indexes | Performance optimization |

---

## 🧪 Test It

```sql
-- Insert test entry
INSERT INTO pair_queue (challenge_id, user_id, side, stake_amount)
VALUES (1, 'test-user-1', 'YES', 1000);

-- Verify
SELECT * FROM pair_queue WHERE user_id = 'test-user-1';
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Table exists error | Already migrated, safe to ignore |
| Foreign key error | Ensure challenges table exists |
| RLS blocking | Use Supabase auth client |

---

## 📚 Full Docs

- [Full Guide](./SUPABASE_MIGRATION_GUIDE.md)
- [Implementation](./server/pairingEngine.ts)
- [Tests](./server/tests/pairingEngine.test.ts)

---

**Status**: ✅ Ready to deploy

**File**: `supabase/migrations/20251216_add_pairing_engine_schema.sql`
