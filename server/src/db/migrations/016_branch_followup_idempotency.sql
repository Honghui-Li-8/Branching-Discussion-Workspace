CREATE UNIQUE INDEX messages_branch_event_per_node_unique
ON messages (node_id)
WHERE turn_id IS NULL
  AND role = 'user'
  AND (metadata->>'eventType') = 'branch_event';
