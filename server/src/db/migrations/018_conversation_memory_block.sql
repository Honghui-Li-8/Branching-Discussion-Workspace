CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS conversation_memory_block (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  turn_id UUID NOT NULL UNIQUE REFERENCES conversation_turns(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  full_text TEXT NOT NULL,
  full_text_tokens INT NOT NULL,
  topic_brief TEXT NULL,
  topic_tokens INT NULL,
  summary_brief TEXT NULL,
  summary_tokens INT NULL,
  summary_context_selected TEXT NULL,
  context_summary_tokens INT NULL,
  importance_score REAL NULL,
  embedding vector(1536) NULL,
  enrichment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (enrichment_status IN ('pending', 'partial', 'complete', 'failed')),
  metadata JSONB NULL
);

CREATE INDEX IF NOT EXISTS conversation_memory_block_node_created_idx
  ON conversation_memory_block(node_id, created_at DESC);

CREATE INDEX IF NOT EXISTS conversation_memory_block_author_node_created_idx
  ON conversation_memory_block(author_user_id, node_id, created_at DESC);
