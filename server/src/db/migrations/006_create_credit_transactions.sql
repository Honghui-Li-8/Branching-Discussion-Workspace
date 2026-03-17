CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('grant', 'usage', 'refund', 'adjustment')),
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_created_idx
  ON credit_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS credit_transactions_type_idx
  ON credit_transactions(type);
