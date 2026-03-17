DROP TABLE IF EXISTS branches;
DROP TABLE IF EXISTS discussions;

INSERT INTO users (id, auth_user_id, email, display_name, credit_balance)
VALUES (gen_random_uuid(), 'system:migration', NULL, 'System', 0)
ON CONFLICT (auth_user_id) DO UPDATE
SET display_name = EXCLUDED.display_name;

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS author_user_id UUID;

ALTER TABLE nodes
ADD COLUMN IF NOT EXISTS author_user_id UUID;

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS author_user_id UUID;

UPDATE workspaces
SET author_user_id = (
  SELECT id
  FROM users
  WHERE auth_user_id = 'system:migration'
  LIMIT 1
)
WHERE author_user_id IS NULL;

UPDATE nodes
SET author_user_id = (
  SELECT id
  FROM users
  WHERE auth_user_id = 'system:migration'
  LIMIT 1
)
WHERE author_user_id IS NULL;

UPDATE messages
SET author_user_id = (
  SELECT id
  FROM users
  WHERE auth_user_id = 'system:migration'
  LIMIT 1
)
WHERE author_user_id IS NULL;

ALTER TABLE workspaces
ALTER COLUMN author_user_id SET NOT NULL;

ALTER TABLE nodes
ALTER COLUMN author_user_id SET NOT NULL;

ALTER TABLE messages
ALTER COLUMN author_user_id SET NOT NULL;

ALTER TABLE workspaces
ADD CONSTRAINT workspaces_author_user_fk
FOREIGN KEY (author_user_id)
REFERENCES users(id)
ON DELETE RESTRICT;

ALTER TABLE nodes
ADD CONSTRAINT nodes_author_user_fk
FOREIGN KEY (author_user_id)
REFERENCES users(id)
ON DELETE RESTRICT;

ALTER TABLE messages
ADD CONSTRAINT messages_author_user_fk
FOREIGN KEY (author_user_id)
REFERENCES users(id)
ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS workspaces_author_user_idx
  ON workspaces(author_user_id);

CREATE INDEX IF NOT EXISTS nodes_author_user_idx
  ON nodes(author_user_id);

CREATE INDEX IF NOT EXISTS messages_author_user_idx
  ON messages(author_user_id);

CREATE OR REPLACE FUNCTION enforce_node_depth_from_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_depth INTEGER;
BEGIN
  IF NEW.parent_node_id = NEW.id THEN
    NEW.depth := 0;
    RETURN NEW;
  END IF;

  SELECT depth
  INTO parent_depth
  FROM nodes
  WHERE id = NEW.parent_node_id
    AND workspace_id = NEW.workspace_id;

  IF parent_depth IS NULL THEN
    RAISE EXCEPTION 'Parent node % not found in workspace %', NEW.parent_node_id, NEW.workspace_id;
  END IF;

  NEW.depth := parent_depth + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nodes_enforce_parent_depth ON nodes;

CREATE TRIGGER nodes_enforce_parent_depth
BEFORE INSERT OR UPDATE OF id, workspace_id, parent_node_id, depth
ON nodes
FOR EACH ROW
EXECUTE FUNCTION enforce_node_depth_from_parent();

CREATE OR REPLACE FUNCTION enforce_workspace_root_node_shape()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM nodes
    WHERE id = NEW.root_node_id
      AND workspace_id = NEW.id
      AND parent_node_id = id
      AND depth = 0
  ) THEN
    RAISE EXCEPTION 'Workspace root node must be a depth=0 self-parent node in the same workspace';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_validate_root_node ON workspaces;

CREATE CONSTRAINT TRIGGER workspaces_validate_root_node
AFTER INSERT OR UPDATE OF id, root_node_id
ON workspaces
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_workspace_root_node_shape();

CREATE OR REPLACE FUNCTION enforce_root_node_row_shape_on_nodes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM workspaces
    WHERE id = NEW.workspace_id
      AND root_node_id = NEW.id
  ) AND (NEW.parent_node_id <> NEW.id OR NEW.depth <> 0) THEN
    RAISE EXCEPTION 'A workspace root node must keep parent_node_id=id and depth=0';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nodes_validate_workspace_roots ON nodes;

CREATE CONSTRAINT TRIGGER nodes_validate_workspace_roots
AFTER INSERT OR UPDATE OF id, workspace_id, parent_node_id, depth
ON nodes
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_root_node_row_shape_on_nodes();
