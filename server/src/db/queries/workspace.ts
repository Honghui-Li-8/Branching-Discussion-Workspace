import type {
  CreateWorkspaceInput,
  DeleteWorkspaceResult,
  UpdateWorkspaceInput,
  WorkspaceRecord,
} from '../models/workspace.js'
import { query } from '../client.js'

type WorkspaceRow = {
  id: string
  title: string
  summary: string | null
  author_user_id: string
  root_node_id: string
  created_at: string
  updated_at: string
}

const mapWorkspaceRow = (row: WorkspaceRow): WorkspaceRecord => ({
  id: row.id,
  title: row.title,
  summary: row.summary,
  authorUserId: row.author_user_id,
  rootNodeId: row.root_node_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const listWorkspaces = async (): Promise<WorkspaceRecord[]> => {
  const result = await query<WorkspaceRow>(`
    SELECT
      w.id,
      w.title,
      NULLIF(BTRIM(rn.summary), '') AS summary,
      w.author_user_id,
      w.root_node_id,
      w.created_at,
      w.updated_at
    FROM workspaces w
    LEFT JOIN nodes rn ON rn.id = w.root_node_id
    ORDER BY w.created_at DESC
  `)
  return result.rows.map(mapWorkspaceRow)
}

export const getWorkspaceById = async (id: string): Promise<WorkspaceRecord | null> => {
  const result = await query<WorkspaceRow>(
    `
    SELECT
      w.id,
      w.title,
      NULLIF(BTRIM(rn.summary), '') AS summary,
      w.author_user_id,
      w.root_node_id,
      w.created_at,
      w.updated_at
    FROM workspaces w
    LEFT JOIN nodes rn ON rn.id = w.root_node_id
    WHERE w.id = $1
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapWorkspaceRow(result.rows[0])
}

export const createWorkspace = async (input: CreateWorkspaceInput): Promise<WorkspaceRecord> => {
  const result = await query<WorkspaceRow>(
    `
    WITH generated_ids AS (
      SELECT gen_random_uuid() AS workspace_id, gen_random_uuid() AS root_node_id
    ),
    inserted_workspace AS (
      INSERT INTO workspaces (id, title, root_node_id, author_user_id)
      SELECT workspace_id, $1, root_node_id, $2
      FROM generated_ids
      RETURNING id, title, author_user_id, root_node_id, created_at, updated_at
    ),
    inserted_root_node AS (
      INSERT INTO nodes (
        id,
        workspace_id,
        author_user_id,
        parent_node_id,
        type,
        title,
        status,
        confidence,
        summary,
        conclusion,
        rationale
      )
      SELECT
        generated_ids.root_node_id,
        generated_ids.workspace_id,
        $2,
        generated_ids.root_node_id,
        'decision',
        COALESCE($3, 'Root decision'),
        'open',
        'medium',
        COALESCE($4, ''),
        NULL,
        NULL
      FROM generated_ids
      RETURNING id, summary
    )
    SELECT
      iw.id,
      iw.title,
      NULLIF(BTRIM(ir.summary), '') AS summary,
      iw.author_user_id,
      iw.root_node_id,
      iw.created_at,
      iw.updated_at
    FROM inserted_workspace iw
    JOIN inserted_root_node ir ON TRUE
    `,
    [
      input.title,
      input.authorUserId,
      input.rootNodeTitle ?? null,
      input.rootNodeSummary ?? null,
    ],
  )

  if (result.rows.length === 0) {
    throw new Error('Failed to create workspace')
  }

  return mapWorkspaceRow(result.rows[0])
}

export const updateWorkspace = async (input: UpdateWorkspaceInput): Promise<WorkspaceRecord | null> => {
  const result = await query<WorkspaceRow>(
    `
    WITH updated_workspace AS (
      UPDATE workspaces
      SET title = $2
      WHERE id = $1
      RETURNING id, title, author_user_id, root_node_id, created_at, updated_at
    )
    SELECT
      uw.id,
      uw.title,
      NULLIF(BTRIM(rn.summary), '') AS summary,
      uw.author_user_id,
      uw.root_node_id,
      uw.created_at,
      uw.updated_at
    FROM updated_workspace uw
    LEFT JOIN nodes rn ON rn.id = uw.root_node_id
    `,
    [input.id, input.title],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapWorkspaceRow(result.rows[0])
}

type DeleteWorkspaceRow = {
  id: string
  deleted_node_count: number
  deleted_message_count: number
}

export const deleteWorkspace = async (id: string): Promise<DeleteWorkspaceResult | null> => {
  const result = await query<DeleteWorkspaceRow>(
    `
    WITH target_nodes AS (
      SELECT id
      FROM nodes
      WHERE workspace_id = $1
    ),
    target_messages AS (
      SELECT m.id
      FROM messages m
      JOIN target_nodes tn ON tn.id = m.node_id
    ),
    deleted_workspace AS (
      DELETE FROM workspaces
      WHERE id = $1
      RETURNING id
    )
    SELECT
      dw.id,
      (SELECT COUNT(*)::int FROM target_nodes) AS deleted_node_count,
      (SELECT COUNT(*)::int FROM target_messages) AS deleted_message_count
    FROM deleted_workspace dw
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    id: row.id,
    deletedNodeCount: row.deleted_node_count,
    deletedMessageCount: row.deleted_message_count,
  }
}
