-- Add bonus_amount column to challenges table
ALTER TABLE challenges
ADD COLUMN bonus_amount INTEGER DEFAULT 0;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'challenges'
AND column_name = 'bonus_amount';
