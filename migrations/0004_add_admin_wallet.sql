-- Add admin wallet fields to users table
ALTER TABLE users
ADD COLUMN admin_wallet_balance NUMERIC(15, 2) DEFAULT 0.00,
ADD COLUMN admin_total_commission NUMERIC(15, 2) DEFAULT 0.00,
ADD COLUMN admin_total_bonuses_given NUMERIC(15, 2) DEFAULT 0.00;

-- Create admin wallet transactions table
CREATE TABLE admin_wallet_transactions (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  description TEXT,
  related_id INTEGER,
  related_type VARCHAR,
  reference VARCHAR,
  status VARCHAR DEFAULT 'completed',
  balance_before NUMERIC(15, 2),
  balance_after NUMERIC(15, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX idx_admin_wallet_admin_id ON admin_wallet_transactions(admin_id);
CREATE INDEX idx_admin_wallet_type ON admin_wallet_transactions(type);
CREATE INDEX idx_admin_wallet_created_at ON admin_wallet_transactions(created_at);

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('admin_wallet_balance', 'admin_total_commission', 'admin_total_bonuses_given');
