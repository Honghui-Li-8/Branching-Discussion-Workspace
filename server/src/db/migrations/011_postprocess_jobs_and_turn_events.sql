CREATE TABLE IF NOT EXISTS conversation_postprocess_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL REFERENCES conversation_turns(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5
    CHECK (max_attempts > 0),
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT NULL,
  leased_at TIMESTAMPTZ NULL,
  lease_owner TEXT NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_postprocess_job_job_type_not_empty
    CHECK (btrim(job_type) <> ''),
  CONSTRAINT conversation_postprocess_job_lease_owner_not_empty
    CHECK (lease_owner IS NULL OR btrim(lease_owner) <> ''),
  CONSTRAINT conversation_postprocess_job_turn_type_uq
    UNIQUE (turn_id, job_type)
);

CREATE INDEX IF NOT EXISTS conversation_postprocess_job_status_run_after_idx
  ON conversation_postprocess_job(status, run_after ASC);

CREATE INDEX IF NOT EXISTS conversation_postprocess_job_status_leased_at_idx
  ON conversation_postprocess_job(status, leased_at ASC);

DROP TRIGGER IF EXISTS conversation_postprocess_job_set_updated_at ON conversation_postprocess_job;
CREATE TRIGGER conversation_postprocess_job_set_updated_at
BEFORE UPDATE ON conversation_postprocess_job
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

CREATE TABLE IF NOT EXISTS conversation_turn_event (
  id BIGSERIAL PRIMARY KEY,
  turn_id UUID NOT NULL REFERENCES conversation_turns(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq > 0),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_turn_event_event_type_not_empty
    CHECK (btrim(event_type) <> ''),
  CONSTRAINT conversation_turn_event_turn_seq_uq
    UNIQUE (turn_id, seq)
);

CREATE INDEX IF NOT EXISTS conversation_turn_event_turn_id_id_idx
  ON conversation_turn_event(turn_id, id ASC);
