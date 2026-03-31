import {
  parseConversationTurnMetadata,
  serializeConversationTurnMetadata,
} from '@branching/shared'
import type {
  CreateConversationTurnInput,
  CreateOrGetConversationTurnResult,
  ConversationTurnRecord,
  ConversationTurnStatus,
  UpdateConversationTurnInput,
} from '../models/conversationTurn.js'
import { query } from '../client.js'

type ConversationTurnRow = {
  id: string
  node_id: string
  author_user_id: string
  status: ConversationTurnStatus
  model: string
  idempotency_key: string
  error: string | null
  completed_at: string | null
  metadata: unknown
  created_at: string
  updated_at: string
}

type ConversationTurnWithWasCreatedRow = ConversationTurnRow & {
  was_created: boolean
}

const mapConversationTurnRow = (
  row: ConversationTurnRow,
): ConversationTurnRecord => ({
  id: row.id,
  nodeId: row.node_id,
  authorUserId: row.author_user_id,
  status: row.status,
  model: row.model,
  idempotencyKey: row.idempotency_key,
  error: row.error,
  completedAt: row.completed_at,
  metadata: parseConversationTurnMetadata(row.metadata),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const getConversationTurnById = async (
  id: string,
): Promise<ConversationTurnRecord | null> => {
  const result = await query<ConversationTurnRow>(
    `
    SELECT
      id,
      node_id,
      author_user_id,
      status,
      model,
      idempotency_key,
      error,
      completed_at,
      metadata,
      created_at,
      updated_at
    FROM conversation_turns
    WHERE id = $1
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationTurnRow(result.rows[0])
}

export const getConversationTurnByIdForAuthor = async (
  id: string,
  authorUserId: string,
): Promise<ConversationTurnRecord | null> => {
  const result = await query<ConversationTurnRow>(
    `
    SELECT
      ct.id,
      ct.node_id,
      ct.author_user_id,
      ct.status,
      ct.model,
      ct.idempotency_key,
      ct.error,
      ct.completed_at,
      ct.metadata,
      ct.created_at,
      ct.updated_at
    FROM conversation_turns ct
    JOIN nodes n ON n.id = ct.node_id
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE ct.id = $1
      AND w.author_user_id = $2
    `,
    [id, authorUserId],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationTurnRow(result.rows[0])
}

export const getConversationTurnByIdempotencyKey = async (
  nodeId: string,
  authorUserId: string,
  idempotencyKey: string,
): Promise<ConversationTurnRecord | null> => {
  const result = await query<ConversationTurnRow>(
    `
    SELECT
      id,
      node_id,
      author_user_id,
      status,
      model,
      idempotency_key,
      error,
      completed_at,
      metadata,
      created_at,
      updated_at
    FROM conversation_turns
    WHERE node_id = $1
      AND author_user_id = $2
      AND idempotency_key = $3
    `,
    [nodeId, authorUserId, idempotencyKey],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationTurnRow(result.rows[0])
}

export const getConversationTurnByIdempotencyKeyForAuthor = async (
  nodeId: string,
  authorUserId: string,
  idempotencyKey: string,
): Promise<ConversationTurnRecord | null> => {
  const result = await query<ConversationTurnRow>(
    `
    SELECT
      ct.id,
      ct.node_id,
      ct.author_user_id,
      ct.status,
      ct.model,
      ct.idempotency_key,
      ct.error,
      ct.completed_at,
      ct.metadata,
      ct.created_at,
      ct.updated_at
    FROM conversation_turns ct
    JOIN nodes n ON n.id = ct.node_id
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE ct.node_id = $1
      AND w.author_user_id = $2
      AND ct.idempotency_key = $3
    `,
    [nodeId, authorUserId, idempotencyKey],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationTurnRow(result.rows[0])
}

export const conversationTurnExists = async (id: string): Promise<boolean> => {
  const result = await query<{ id: string }>(
    `
    SELECT id
    FROM conversation_turns
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  )
  return result.rows.length > 0
}

export const createOrGetConversationTurn = async (
  input: CreateConversationTurnInput,
): Promise<CreateOrGetConversationTurnResult | null> => {
  const result = await query<ConversationTurnWithWasCreatedRow>(
    `
    WITH target_node AS (
      SELECT id
      FROM nodes
      WHERE id = $1
    ),
    inserted_turn AS (
      INSERT INTO conversation_turns (
        node_id,
        author_user_id,
        status,
        model,
        idempotency_key,
        error,
        completed_at
      )
      SELECT
        target_node.id,
        $2,
        CASE WHEN $3::boolean THEN $4 ELSE 'pending' END,
        $5,
        $6,
        CASE WHEN $7::boolean THEN $8 ELSE NULL END,
        CASE WHEN $9::boolean THEN $10 ELSE NULL END
      FROM target_node
      ON CONFLICT (author_user_id, node_id, idempotency_key) DO NOTHING
      RETURNING
        id,
        node_id,
        author_user_id,
        status,
        model,
        idempotency_key,
        error,
        completed_at,
        metadata,
        created_at,
        updated_at
    ),
    resolved_turn AS (
      SELECT
        it.id,
        it.node_id,
        it.author_user_id,
        it.status,
        it.model,
        it.idempotency_key,
        it.error,
        it.completed_at,
        it.metadata,
        it.created_at,
        it.updated_at,
        TRUE AS was_created
      FROM inserted_turn it

      UNION ALL

      SELECT
        ct.id,
        ct.node_id,
        ct.author_user_id,
        ct.status,
        ct.model,
        ct.idempotency_key,
        ct.error,
        ct.completed_at,
        ct.metadata,
        ct.created_at,
        ct.updated_at,
        FALSE AS was_created
      FROM conversation_turns ct
      JOIN target_node ON target_node.id = ct.node_id
      WHERE ct.author_user_id = $2
        AND ct.node_id = $1
        AND ct.idempotency_key = $6
    )
    SELECT
      id,
      node_id,
      author_user_id,
      status,
      model,
      idempotency_key,
      error,
      completed_at,
      metadata,
      created_at,
      updated_at,
      was_created
    FROM resolved_turn
    ORDER BY was_created DESC
    LIMIT 1
    `,
    [
      input.nodeId,
      input.authorUserId,
      input.status !== undefined,
      input.status ?? null,
      input.model,
      input.idempotencyKey,
      input.error !== undefined,
      input.error ?? null,
      input.completedAt !== undefined,
      input.completedAt ?? null,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    turn: mapConversationTurnRow(row),
    wasCreated: row.was_created,
  }
}

export const createOrGetConversationTurnForAuthor = async (
  input: CreateConversationTurnInput,
): Promise<CreateOrGetConversationTurnResult | null> => {
  const result = await query<ConversationTurnWithWasCreatedRow>(
    `
    WITH owned_node AS (
      SELECT n.id
      FROM nodes n
      JOIN workspaces w ON w.id = n.workspace_id
      WHERE n.id = $1
        AND w.author_user_id = $2
    ),
    inserted_turn AS (
      INSERT INTO conversation_turns (
        node_id,
        author_user_id,
        status,
        model,
        idempotency_key,
        error,
        completed_at
      )
      SELECT
        owned_node.id,
        $2,
        CASE WHEN $3::boolean THEN $4 ELSE 'pending' END,
        $5,
        $6,
        CASE WHEN $7::boolean THEN $8 ELSE NULL END,
        CASE WHEN $9::boolean THEN $10 ELSE NULL END
      FROM owned_node
      ON CONFLICT (author_user_id, node_id, idempotency_key) DO NOTHING
      RETURNING
        id,
        node_id,
        author_user_id,
        status,
        model,
        idempotency_key,
        error,
        completed_at,
        metadata,
        created_at,
        updated_at
    ),
    resolved_turn AS (
      SELECT
        it.id,
        it.node_id,
        it.author_user_id,
        it.status,
        it.model,
        it.idempotency_key,
        it.error,
        it.completed_at,
        it.metadata,
        it.created_at,
        it.updated_at,
        TRUE AS was_created
      FROM inserted_turn it

      UNION ALL

      SELECT
        ct.id,
        ct.node_id,
        ct.author_user_id,
        ct.status,
        ct.model,
        ct.idempotency_key,
        ct.error,
        ct.completed_at,
        ct.metadata,
        ct.created_at,
        ct.updated_at,
        FALSE AS was_created
      FROM conversation_turns ct
      JOIN owned_node ON owned_node.id = ct.node_id
      WHERE ct.author_user_id = $2
        AND ct.node_id = $1
        AND ct.idempotency_key = $6
    )
    SELECT
      id,
      node_id,
      author_user_id,
      status,
      model,
      idempotency_key,
      error,
      completed_at,
      metadata,
      created_at,
      updated_at,
      was_created
    FROM resolved_turn
    ORDER BY was_created DESC
    LIMIT 1
    `,
    [
      input.nodeId,
      input.authorUserId,
      input.status !== undefined,
      input.status ?? null,
      input.model,
      input.idempotencyKey,
      input.error !== undefined,
      input.error ?? null,
      input.completedAt !== undefined,
      input.completedAt ?? null,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    turn: mapConversationTurnRow(row),
    wasCreated: row.was_created,
  }
}

export const updateConversationTurn = async (
  input: UpdateConversationTurnInput,
): Promise<ConversationTurnRecord | null> => {
  const hasMetadata = input.metadata !== undefined
  const metadata = hasMetadata
    ? JSON.stringify(serializeConversationTurnMetadata(input.metadata))
    : null
  const result = await query<ConversationTurnRow>(
    `
    UPDATE conversation_turns
    SET
      status = CASE WHEN $2::boolean THEN $3 ELSE status END,
      error = CASE WHEN $4::boolean THEN $5 ELSE error END,
      completed_at = CASE WHEN $6::boolean THEN $7 ELSE completed_at END,
      metadata = CASE WHEN $8::boolean THEN $9::jsonb ELSE metadata END
    WHERE id = $1
    RETURNING
      id,
      node_id,
      author_user_id,
      status,
      model,
      idempotency_key,
      error,
      completed_at,
      metadata,
      created_at,
      updated_at
    `,
    [
      input.id,
      input.status !== undefined,
      input.status ?? null,
      input.error !== undefined,
      input.error ?? null,
      input.completedAt !== undefined,
      input.completedAt ?? null,
      hasMetadata,
      metadata,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationTurnRow(result.rows[0])
}

export const updateConversationTurnForAuthor = async (
  input: UpdateConversationTurnInput,
  authorUserId: string,
): Promise<ConversationTurnRecord | null> => {
  const hasMetadata = input.metadata !== undefined
  const metadata = hasMetadata
    ? JSON.stringify(serializeConversationTurnMetadata(input.metadata))
    : null
  const result = await query<ConversationTurnRow>(
    `
    UPDATE conversation_turns ct
    SET
      status = CASE WHEN $2::boolean THEN $3 ELSE ct.status END,
      error = CASE WHEN $4::boolean THEN $5 ELSE ct.error END,
      completed_at = CASE WHEN $6::boolean THEN $7 ELSE ct.completed_at END,
      metadata = CASE WHEN $8::boolean THEN $9::jsonb ELSE ct.metadata END
    FROM nodes n
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE ct.id = $1
      AND n.id = ct.node_id
      AND w.author_user_id = $10
    RETURNING
      ct.id,
      ct.node_id,
      ct.author_user_id,
      ct.status,
      ct.model,
      ct.idempotency_key,
      ct.error,
      ct.completed_at,
      ct.metadata,
      ct.created_at,
      ct.updated_at
    `,
    [
      input.id,
      input.status !== undefined,
      input.status ?? null,
      input.error !== undefined,
      input.error ?? null,
      input.completedAt !== undefined,
      input.completedAt ?? null,
      hasMetadata,
      metadata,
      authorUserId,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapConversationTurnRow(result.rows[0])
}
