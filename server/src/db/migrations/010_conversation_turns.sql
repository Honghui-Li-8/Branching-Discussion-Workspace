CREATE TABLE IF NOT EXISTS conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  model TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  error TEXT NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_turns_idempotency_key_not_empty
    CHECK (btrim(idempotency_key) <> ''),
  CONSTRAINT conversation_turns_model_not_empty
    CHECK (btrim(model) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_turns_user_node_idempotency_uq
  ON conversation_turns(author_user_id, node_id, idempotency_key);

CREATE INDEX IF NOT EXISTS conversation_turns_node_created_idx
  ON conversation_turns(node_id, created_at ASC);

CREATE INDEX IF NOT EXISTS conversation_turns_author_created_idx
  ON conversation_turns(author_user_id, created_at DESC);

DROP TRIGGER IF EXISTS conversation_turns_set_updated_at ON conversation_turns;
CREATE TRIGGER conversation_turns_set_updated_at
BEFORE UPDATE ON conversation_turns
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();
