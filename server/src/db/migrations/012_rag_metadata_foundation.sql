ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS turn_id UUID NULL REFERENCES conversation_turns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE conversation_turns
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS messages_turn_id_idx
  ON messages(turn_id)
  WHERE turn_id IS NOT NULL;
