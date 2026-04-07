ALTER TABLE message_annotations
  ADD CONSTRAINT message_annotations_suggestion_without_node
  CHECK (kind <> 'suggestion' OR leads_to_node_id IS NULL);
