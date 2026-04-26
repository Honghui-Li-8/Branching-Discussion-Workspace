ALTER TABLE nodes DROP CONSTRAINT nodes_status_check;

ALTER TABLE nodes ADD CONSTRAINT nodes_status_check
  CHECK (status IN ('open', 'exploring', 'needs_approval', 'approved', 'deferred', 'closed', 'merged'));

ALTER TABLE nodes ADD COLUMN merged_at TIMESTAMPTZ;

CREATE UNIQUE INDEX messages_merge_proposal_pending_per_node_unique
ON messages (node_id)
WHERE (metadata->>'eventType') = 'merge_proposal'
  AND (metadata->>'mergeStatus') = 'pending';
