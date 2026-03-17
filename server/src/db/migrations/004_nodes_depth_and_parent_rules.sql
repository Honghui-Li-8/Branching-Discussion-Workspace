ALTER TABLE nodes
ADD COLUMN IF NOT EXISTS depth INTEGER;

UPDATE nodes
SET parent_node_id = id
WHERE parent_node_id IS NULL;

WITH RECURSIVE tree AS (
  SELECT
    id,
    workspace_id,
    0 AS depth,
    ARRAY[id] AS path
  FROM nodes
  WHERE parent_node_id = id

  UNION ALL

  SELECT
    child.id,
    child.workspace_id,
    tree.depth + 1 AS depth,
    tree.path || child.id AS path
  FROM nodes AS child
  JOIN tree
    ON child.parent_node_id = tree.id
    AND child.workspace_id = tree.workspace_id
  WHERE child.id <> child.parent_node_id
    AND NOT child.id = ANY(tree.path)
),
resolved AS (
  SELECT DISTINCT ON (id, workspace_id)
    id,
    workspace_id,
    depth
  FROM tree
  ORDER BY id, workspace_id, depth
)
UPDATE nodes AS n
SET depth = resolved.depth
FROM resolved
WHERE n.id = resolved.id
  AND n.workspace_id = resolved.workspace_id;

UPDATE nodes
SET depth = 0
WHERE depth IS NULL;

UPDATE nodes
SET depth = 1
WHERE parent_node_id <> id
  AND depth = 0;

ALTER TABLE nodes
DROP CONSTRAINT IF EXISTS nodes_parent_not_self;

ALTER TABLE nodes
DROP CONSTRAINT IF EXISTS nodes_parent_node_id_fkey;

ALTER TABLE nodes
ALTER COLUMN parent_node_id SET NOT NULL;

ALTER TABLE nodes
ALTER COLUMN depth SET NOT NULL;

ALTER TABLE nodes
ALTER COLUMN depth SET DEFAULT 0;

ALTER TABLE nodes
ADD CONSTRAINT nodes_parent_node_workspace_fk
FOREIGN KEY (parent_node_id, workspace_id)
REFERENCES nodes(id, workspace_id)
ON DELETE RESTRICT
DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE nodes
ADD CONSTRAINT nodes_depth_non_negative
CHECK (depth >= 0);

ALTER TABLE nodes
ADD CONSTRAINT nodes_parent_depth_consistent
CHECK (
  (parent_node_id = id AND depth = 0)
  OR
  (parent_node_id <> id AND depth > 0)
);
