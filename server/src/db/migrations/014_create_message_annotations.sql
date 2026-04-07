CREATE TABLE IF NOT EXISTS message_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  leads_to_node_id UUID NULL REFERENCES nodes(id) ON DELETE SET NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('suggestion', 'branch', 'suggestion-branch')),
  quote TEXT NOT NULL,
  start_offset INTEGER NULL,
  end_offset INTEGER NULL,
  selector_json JSONB NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT message_annotations_quote_not_empty
    CHECK (btrim(quote) <> ''),
  CONSTRAINT message_annotations_start_offset_nonnegative
    CHECK (start_offset IS NULL OR start_offset >= 0),
  CONSTRAINT message_annotations_end_offset_nonnegative
    CHECK (end_offset IS NULL OR end_offset >= 0),
  CONSTRAINT message_annotations_offset_order
    CHECK (start_offset IS NULL OR end_offset IS NULL OR end_offset > start_offset),
  CONSTRAINT message_annotations_selector_json_shape
    CHECK (
      jsonb_typeof(selector_json) = 'object'
      AND selector_json ? 'selector'
      AND jsonb_typeof(selector_json -> 'selector') = 'array'
      AND jsonb_array_length(selector_json -> 'selector') > 0
    ),
  CONSTRAINT message_annotations_idempotency_key_not_empty
    CHECK (btrim(idempotency_key) <> '')
);

CREATE INDEX IF NOT EXISTS message_annotations_message_active_idx
  ON message_annotations(message_id, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS message_annotations_leads_to_node_active_idx
  ON message_annotations(leads_to_node_id)
  WHERE deleted_at IS NULL AND leads_to_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS message_annotations_kind_active_idx
  ON message_annotations(kind, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS message_annotations_author_active_idx
  ON message_annotations(created_by_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS message_annotations_author_message_idempotency_uq
  ON message_annotations(created_by_user_id, message_id, idempotency_key)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS message_annotations_active_selection_identity_uq
  ON message_annotations(
    created_by_user_id,
    message_id,
    kind,
    md5(quote),
    COALESCE(start_offset, -1),
    COALESCE(end_offset, -1),
    md5(selector_json::text)
  )
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS message_annotations_set_updated_at ON message_annotations;
CREATE TRIGGER message_annotations_set_updated_at
BEFORE UPDATE ON message_annotations
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();
