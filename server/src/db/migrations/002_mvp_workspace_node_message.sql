CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  root_node_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_node_id UUID NULL REFERENCES nodes(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('decision', 'question', 'option', 'constraint')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'exploring', 'needs_approval', 'approved', 'deferred', 'closed')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  summary TEXT NOT NULL,
  conclusion TEXT NULL,
  rationale TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nodes_parent_not_self CHECK (parent_node_id IS NULL OR parent_node_id <> id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspaces_updated_idx
  ON workspaces(updated_at DESC);

CREATE INDEX IF NOT EXISTS nodes_workspace_idx
  ON nodes(workspace_id, created_at ASC);

CREATE INDEX IF NOT EXISTS nodes_parent_idx
  ON nodes(parent_node_id);

CREATE INDEX IF NOT EXISTS messages_node_idx
  ON messages(node_id, created_at ASC);
