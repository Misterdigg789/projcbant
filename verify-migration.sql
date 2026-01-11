-- Verify pair_queue table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'pair_queue';

-- Verify fcm_token field in users
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'users' 
AND column_name = 'fcm_token';

-- Verify challenge bonus fields
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'challenges' 
AND column_name IN ('admin_created', 'bonus_side', 'bonus_multiplier', 'yes_stake_total', 'no_stake_total');
