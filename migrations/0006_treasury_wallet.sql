-- Treasury Wallet Tables
-- Manages per-admin wallets for Treasury match funding

-- Treasury Wallets Table
CREATE TABLE IF NOT EXISTS treasury_wallets (
  id SERIAL PRIMARY KEY,
  admin_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_deposited DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_used DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_earned DECIMAL(15, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on admin_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_treasury_wallets_admin_id ON treasury_wallets(admin_id);

-- Treasury Wallet Transactions Table
CREATE TABLE IF NOT EXISTS treasury_wallet_transactions (
  id SERIAL PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'debit', 'credit', 'settlement')),
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT NOT NULL,
  related_match_id INTEGER REFERENCES treasury_matches(id) ON DELETE SET NULL,
  related_challenge_id INTEGER REFERENCES challenges(id) ON DELETE SET NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  balance_before DECIMAL(15, 2),
  balance_after DECIMAL(15, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes on admin_id and related IDs for queries
CREATE INDEX IF NOT EXISTS idx_treasury_wallet_transactions_admin_id ON treasury_wallet_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_treasury_wallet_transactions_challenge_id ON treasury_wallet_transactions(related_challenge_id);
CREATE INDEX IF NOT EXISTS idx_treasury_wallet_transactions_match_id ON treasury_wallet_transactions(related_match_id);
CREATE INDEX IF NOT EXISTS idx_treasury_wallet_transactions_created_at ON treasury_wallet_transactions(created_at DESC);
