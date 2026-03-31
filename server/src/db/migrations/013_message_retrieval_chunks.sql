CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS message_retrieval_chunk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL CHECK (token_count >= 0),
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_retrieval_chunk_content_not_empty
    CHECK (btrim(content) <> ''),
  CONSTRAINT message_retrieval_chunk_message_chunk_uq
    UNIQUE (message_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS message_retrieval_chunk_message_idx
  ON message_retrieval_chunk(message_id, chunk_index ASC);

CREATE INDEX IF NOT EXISTS message_retrieval_chunk_node_idx
  ON message_retrieval_chunk(node_id, created_at DESC);

CREATE INDEX IF NOT EXISTS message_retrieval_chunk_author_idx
  ON message_retrieval_chunk(author_user_id, created_at DESC);

DROP TRIGGER IF EXISTS message_retrieval_chunk_set_updated_at ON message_retrieval_chunk;
CREATE TRIGGER message_retrieval_chunk_set_updated_at
BEFORE UPDATE ON message_retrieval_chunk
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();
