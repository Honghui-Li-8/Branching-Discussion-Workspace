ALTER TABLE nodes
ADD CONSTRAINT nodes_id_workspace_unique UNIQUE (id, workspace_id);

ALTER TABLE workspaces
ADD CONSTRAINT workspaces_root_node_matches_workspace_fk
FOREIGN KEY (root_node_id, id)
REFERENCES nodes(id, workspace_id)
DEFERRABLE INITIALLY DEFERRED;
