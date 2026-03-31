import type {
  ConversationPostprocessJobQueueSnapshot,
  ConversationPostprocessJobRecord,
  ConversationPostprocessJobStatus,
  CreateConversationPostprocessJobInput,
  CreateOrGetConversationPostprocessJobResult,
  LeaseDueConversationPostprocessJobsInput,
  MarkConversationPostprocessJobFailedInput,
  MarkConversationPostprocessJobSucceededInput,
  RequeueConversationPostprocessJobWithBackoffInput,
} from '../models/conversationPostprocessJob.js'
import { query } from '../client.js'

type ConversationPostprocessJobRow = {
  id: string
  turn_id: string
  job_type: string
  payload: unknown
  status: ConversationPostprocessJobStatus
  attempt_count: number
  max_attempts: number
  run_after: string
  last_error: string | null
  leased_at: string | null
  lease_owner: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

type ConversationPostprocessJobWithWasCreatedRow = ConversationPostprocessJobRow & {
  was_created: boolean
}

const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_LEASE_BATCH_LIMIT = 10
const DEFAULT_RETRY_BASE_DELAY_SECONDS = 5
const DEFAULT_RETRY_MAX_DELAY_SECONDS = 300

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

const mapConversationPostprocessJobRow = (
  row: ConversationPostprocessJobRow,
): ConversationPostprocessJobRecord => ({
  id: row.id,
  turnId: row.turn_id,
  jobType: row.job_type,
  payload: row.payload,
  status: row.status,
  attemptCount: row.attempt_count,
  maxAttempts: row.max_attempts,
  runAfter: row.run_after,
  lastError: row.last_error,
  leasedAt: row.leased_at,
  leaseOwner: row.lease_owner,
  finishedAt: row.finished_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const getConversationPostprocessJobById = async (
  id: string,
): Promise<ConversationPostprocessJobRecord | null> => {
  const result = await query<ConversationPostprocessJobRow>(
    `
    SELECT
      id,
      turn_id,
      job_type,
      payload,
      status,
      attempt_count,
      max_attempts,
      run_after,
      last_error,
      leased_at,
      lease_owner,
      finished_at,
      created_at,
      updated_at
    FROM conversation_postprocess_job
    WHERE id = $1
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationPostprocessJobRow(result.rows[0])
}

export const createOrGetConversationPostprocessJob = async (
  input: CreateConversationPostprocessJobInput,
): Promise<CreateOrGetConversationPostprocessJobResult | null> => {
  const result = await query<ConversationPostprocessJobWithWasCreatedRow>(
    `
    WITH target_turn AS (
      SELECT id
      FROM conversation_turns
      WHERE id = $1
    ),
    inserted_job AS (
      INSERT INTO conversation_postprocess_job (
        turn_id,
        job_type,
        payload,
        status,
        attempt_count,
        max_attempts,
        run_after,
        last_error,
        leased_at,
        lease_owner,
        finished_at
      )
      SELECT
        target_turn.id,
        $2,
        $3::jsonb,
        COALESCE($4::text, 'queued'),
        COALESCE($5::integer, 0),
        COALESCE($6::integer, $7::integer),
        COALESCE($8::timestamptz, NOW()),
        $9,
        $10::timestamptz,
        $11,
        $12::timestamptz
      FROM target_turn
      ON CONFLICT (turn_id, job_type) DO NOTHING
      RETURNING
        id,
        turn_id,
        job_type,
        payload,
        status,
        attempt_count,
        max_attempts,
        run_after,
        last_error,
        leased_at,
        lease_owner,
        finished_at,
        created_at,
        updated_at
    ),
    resolved_job AS (
      SELECT
        ij.id,
        ij.turn_id,
        ij.job_type,
        ij.payload,
        ij.status,
        ij.attempt_count,
        ij.max_attempts,
        ij.run_after,
        ij.last_error,
        ij.leased_at,
        ij.lease_owner,
        ij.finished_at,
        ij.created_at,
        ij.updated_at,
        TRUE AS was_created
      FROM inserted_job ij

      UNION ALL

      SELECT
        cpj.id,
        cpj.turn_id,
        cpj.job_type,
        cpj.payload,
        cpj.status,
        cpj.attempt_count,
        cpj.max_attempts,
        cpj.run_after,
        cpj.last_error,
        cpj.leased_at,
        cpj.lease_owner,
        cpj.finished_at,
        cpj.created_at,
        cpj.updated_at,
        FALSE AS was_created
      FROM conversation_postprocess_job cpj
      JOIN target_turn ON target_turn.id = cpj.turn_id
      WHERE cpj.turn_id = $1
        AND cpj.job_type = $2
    )
    SELECT
      id,
      turn_id,
      job_type,
      payload,
      status,
      attempt_count,
      max_attempts,
      run_after,
      last_error,
      leased_at,
      lease_owner,
      finished_at,
      created_at,
      updated_at,
      was_created
    FROM resolved_job
    ORDER BY was_created DESC
    LIMIT 1
    `,
    [
      input.turnId,
      input.jobType,
      JSON.stringify(input.payload ?? {}),
      input.status ?? null,
      input.attemptCount ?? null,
      input.maxAttempts ?? null,
      DEFAULT_MAX_ATTEMPTS,
      input.runAfter ?? null,
      input.lastError ?? null,
      input.leasedAt ?? null,
      input.leaseOwner ?? null,
      input.finishedAt ?? null,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    job: mapConversationPostprocessJobRow(row),
    wasCreated: row.was_created,
  }
}

export const createOrGetConversationPostprocessJobForAuthor = async (
  input: CreateConversationPostprocessJobInput,
  authorUserId: string,
): Promise<CreateOrGetConversationPostprocessJobResult | null> => {
  const result = await query<ConversationPostprocessJobWithWasCreatedRow>(
    `
    WITH owned_turn AS (
      SELECT ct.id
      FROM conversation_turns ct
      JOIN nodes n ON n.id = ct.node_id
      JOIN workspaces w ON w.id = n.workspace_id
      WHERE ct.id = $1
        AND w.author_user_id = $2
    ),
    inserted_job AS (
      INSERT INTO conversation_postprocess_job (
        turn_id,
        job_type,
        payload,
        status,
        attempt_count,
        max_attempts,
        run_after,
        last_error,
        leased_at,
        lease_owner,
        finished_at
      )
      SELECT
        owned_turn.id,
        $3,
        $4::jsonb,
        COALESCE($5::text, 'queued'),
        COALESCE($6::integer, 0),
        COALESCE($7::integer, $8::integer),
        COALESCE($9::timestamptz, NOW()),
        $10,
        $11::timestamptz,
        $12,
        $13::timestamptz
      FROM owned_turn
      ON CONFLICT (turn_id, job_type) DO NOTHING
      RETURNING
        id,
        turn_id,
        job_type,
        payload,
        status,
        attempt_count,
        max_attempts,
        run_after,
        last_error,
        leased_at,
        lease_owner,
        finished_at,
        created_at,
        updated_at
    ),
    resolved_job AS (
      SELECT
        ij.id,
        ij.turn_id,
        ij.job_type,
        ij.payload,
        ij.status,
        ij.attempt_count,
        ij.max_attempts,
        ij.run_after,
        ij.last_error,
        ij.leased_at,
        ij.lease_owner,
        ij.finished_at,
        ij.created_at,
        ij.updated_at,
        TRUE AS was_created
      FROM inserted_job ij

      UNION ALL

      SELECT
        cpj.id,
        cpj.turn_id,
        cpj.job_type,
        cpj.payload,
        cpj.status,
        cpj.attempt_count,
        cpj.max_attempts,
        cpj.run_after,
        cpj.last_error,
        cpj.leased_at,
        cpj.lease_owner,
        cpj.finished_at,
        cpj.created_at,
        cpj.updated_at,
        FALSE AS was_created
      FROM conversation_postprocess_job cpj
      JOIN owned_turn ON owned_turn.id = cpj.turn_id
      WHERE cpj.turn_id = $1
        AND cpj.job_type = $3
    )
    SELECT
      id,
      turn_id,
      job_type,
      payload,
      status,
      attempt_count,
      max_attempts,
      run_after,
      last_error,
      leased_at,
      lease_owner,
      finished_at,
      created_at,
      updated_at,
      was_created
    FROM resolved_job
    ORDER BY was_created DESC
    LIMIT 1
    `,
    [
      input.turnId,
      authorUserId,
      input.jobType,
      JSON.stringify(input.payload ?? {}),
      input.status ?? null,
      input.attemptCount ?? null,
      input.maxAttempts ?? null,
      DEFAULT_MAX_ATTEMPTS,
      input.runAfter ?? null,
      input.lastError ?? null,
      input.leasedAt ?? null,
      input.leaseOwner ?? null,
      input.finishedAt ?? null,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    job: mapConversationPostprocessJobRow(row),
    wasCreated: row.was_created,
  }
}

export const findDueConversationPostprocessJobs = async (
  runAt: string,
  limit = DEFAULT_LEASE_BATCH_LIMIT,
): Promise<ConversationPostprocessJobRecord[]> => {
  const result = await query<ConversationPostprocessJobRow>(
    `
    SELECT
      id,
      turn_id,
      job_type,
      payload,
      status,
      attempt_count,
      max_attempts,
      run_after,
      last_error,
      leased_at,
      lease_owner,
      finished_at,
      created_at,
      updated_at
    FROM conversation_postprocess_job
    WHERE status = 'queued'
      AND run_after <= $1
    ORDER BY run_after ASC, created_at ASC
    LIMIT $2
    `,
    [runAt, Math.max(1, limit)],
  )

  return result.rows.map(mapConversationPostprocessJobRow)
}

export const getConversationPostprocessJobQueueSnapshot = async (
  asOf: string = new Date().toISOString(),
): Promise<ConversationPostprocessJobQueueSnapshot> => {
  const result = await query<{
    queued_count: number | string
    running_count: number | string
    succeeded_count: number | string
    failed_count: number | string
    oldest_queued_age_seconds: number | string | null
  }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'queued')::int AS queued_count,
      COUNT(*) FILTER (WHERE status = 'running')::int AS running_count,
      COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded_count,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
      CASE
        WHEN COUNT(*) FILTER (WHERE status = 'queued') = 0 THEN NULL
        ELSE GREATEST(
          EXTRACT(EPOCH FROM (
            $1::timestamptz - MIN(run_after) FILTER (WHERE status = 'queued')
          )),
          0
        )::double precision
      END AS oldest_queued_age_seconds
    FROM conversation_postprocess_job
    `,
    [asOf],
  )

  const row = result.rows[0]
  if (!row) {
    return {
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      oldestQueuedAgeSeconds: null,
    }
  }

  return {
    queued: toFiniteNumber(row.queued_count) ?? 0,
    running: toFiniteNumber(row.running_count) ?? 0,
    succeeded: toFiniteNumber(row.succeeded_count) ?? 0,
    failed: toFiniteNumber(row.failed_count) ?? 0,
    oldestQueuedAgeSeconds: toFiniteNumber(row.oldest_queued_age_seconds),
  }
}

export const leaseDueConversationPostprocessJobs = async (
  input: LeaseDueConversationPostprocessJobsInput,
): Promise<ConversationPostprocessJobRecord[]> => {
  const leaseAt = input.leaseAt ?? new Date().toISOString()
  const staleLeaseBefore = input.staleLeaseBefore ?? leaseAt
  const limit = Math.max(1, input.limit ?? DEFAULT_LEASE_BATCH_LIMIT)

  const result = await query<ConversationPostprocessJobRow>(
    `
    WITH candidates AS (
      SELECT cpj.id
      FROM conversation_postprocess_job cpj
      WHERE (
        cpj.status = 'queued'
        AND cpj.run_after <= $1::timestamptz
      ) OR (
        cpj.status = 'running'
        AND cpj.leased_at IS NOT NULL
        AND cpj.leased_at <= $2::timestamptz
      )
      ORDER BY cpj.run_after ASC, cpj.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT $3
    )
    UPDATE conversation_postprocess_job cpj
    SET
      status = 'running',
      leased_at = $1::timestamptz,
      lease_owner = $4,
      last_error = NULL
    FROM candidates
    WHERE cpj.id = candidates.id
    RETURNING
      cpj.id,
      cpj.turn_id,
      cpj.job_type,
      cpj.payload,
      cpj.status,
      cpj.attempt_count,
      cpj.max_attempts,
      cpj.run_after,
      cpj.last_error,
      cpj.leased_at,
      cpj.lease_owner,
      cpj.finished_at,
      cpj.created_at,
      cpj.updated_at
    `,
    [leaseAt, staleLeaseBefore, limit, input.leaseOwner],
  )

  return result.rows.map(mapConversationPostprocessJobRow)
}

export const markConversationPostprocessJobSucceeded = async (
  input: MarkConversationPostprocessJobSucceededInput,
): Promise<ConversationPostprocessJobRecord | null> => {
  const enforceLeaseOwner = typeof input.leaseOwner === 'string' && input.leaseOwner.length > 0
  const result = await query<ConversationPostprocessJobRow>(
    `
    UPDATE conversation_postprocess_job
    SET
      status = 'succeeded',
      finished_at = COALESCE($2::timestamptz, NOW()),
      leased_at = NULL,
      lease_owner = NULL,
      last_error = NULL
    WHERE id = $1
      AND status = 'running'
      AND ($3::boolean = FALSE OR lease_owner = $4)
    RETURNING
      id,
      turn_id,
      job_type,
      payload,
      status,
      attempt_count,
      max_attempts,
      run_after,
      last_error,
      leased_at,
      lease_owner,
      finished_at,
      created_at,
      updated_at
    `,
    [input.id, input.finishedAt ?? null, enforceLeaseOwner, input.leaseOwner ?? null],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationPostprocessJobRow(result.rows[0])
}

export const markConversationPostprocessJobFailed = async (
  input: MarkConversationPostprocessJobFailedInput,
): Promise<ConversationPostprocessJobRecord | null> => {
  const enforceLeaseOwner = typeof input.leaseOwner === 'string' && input.leaseOwner.length > 0
  const result = await query<ConversationPostprocessJobRow>(
    `
    UPDATE conversation_postprocess_job
    SET
      status = 'failed',
      last_error = $2,
      finished_at = COALESCE($3::timestamptz, NOW()),
      leased_at = NULL,
      lease_owner = NULL
    WHERE id = $1
      AND status = 'running'
      AND ($4::boolean = FALSE OR lease_owner = $5)
    RETURNING
      id,
      turn_id,
      job_type,
      payload,
      status,
      attempt_count,
      max_attempts,
      run_after,
      last_error,
      leased_at,
      lease_owner,
      finished_at,
      created_at,
      updated_at
    `,
    [
      input.id,
      input.lastError,
      input.finishedAt ?? null,
      enforceLeaseOwner,
      input.leaseOwner ?? null,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationPostprocessJobRow(result.rows[0])
}

export const requeueConversationPostprocessJobWithBackoff = async (
  input: RequeueConversationPostprocessJobWithBackoffInput,
): Promise<ConversationPostprocessJobRecord | null> => {
  const enforceLeaseOwner = typeof input.leaseOwner === 'string' && input.leaseOwner.length > 0
  const baseDelaySeconds = Math.max(1, input.baseDelaySeconds ?? DEFAULT_RETRY_BASE_DELAY_SECONDS)
  const maxDelaySeconds = Math.max(baseDelaySeconds, input.maxDelaySeconds ?? DEFAULT_RETRY_MAX_DELAY_SECONDS)

  const result = await query<ConversationPostprocessJobRow>(
    `
    UPDATE conversation_postprocess_job
    SET
      status = 'queued',
      attempt_count = attempt_count + 1,
      run_after = CASE
        WHEN $3::timestamptz IS NOT NULL THEN $3::timestamptz
        ELSE NOW() + make_interval(
          secs => LEAST(
            ($4::numeric * power(2, GREATEST(attempt_count, 0)))::int,
            $5::int
          )
        )
      END,
      last_error = $2,
      leased_at = NULL,
      lease_owner = NULL,
      finished_at = NULL
    WHERE id = $1
      AND status = 'running'
      AND ($6::boolean = FALSE OR lease_owner = $7)
    RETURNING
      id,
      turn_id,
      job_type,
      payload,
      status,
      attempt_count,
      max_attempts,
      run_after,
      last_error,
      leased_at,
      lease_owner,
      finished_at,
      created_at,
      updated_at
    `,
    [
      input.id,
      input.lastError,
      input.runAfter ?? null,
      baseDelaySeconds,
      maxDelaySeconds,
      enforceLeaseOwner,
      input.leaseOwner ?? null,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationPostprocessJobRow(result.rows[0])
}
