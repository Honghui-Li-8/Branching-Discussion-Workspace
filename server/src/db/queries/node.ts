import type {
  CreateNodeInput,
  NodeConfidence,
  NodeRecord,
  NodeStatus,
  NodeType,
} from '../models/node.js'
import { query } from '../client.js'

type NodeRow = {
  id: string
  workspace_id: string
  parent_node_id: string
  depth: number
  type: NodeType
  title: string
  status: NodeStatus
  confidence: NodeConfidence
  summary: string
  conclusion: string | null
  rationale: string | null
  created_at: string
  updated_at: string
}

const mapNodeRow = (row: NodeRow): NodeRecord => ({
  id: row.id,
  workspaceId: row.workspace_id,
  parentNodeId: row.parent_node_id,
  depth: row.depth,
  type: row.type,
  title: row.title,
  status: row.status,
  confidence: row.confidence,
  summary: row.summary,
  conclusion: row.conclusion,
  rationale: row.rationale,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const listNodesByWorkspace = async (workspaceId: string): Promise<NodeRecord[]> => {
  const result = await query<NodeRow>(
    `
    SELECT
      id,
      workspace_id,
      parent_node_id,
      depth,
      type,
      title,
      status,
      confidence,
      summary,
      conclusion,
      rationale,
      created_at,
      updated_at
    FROM nodes
    WHERE workspace_id = $1
    ORDER BY created_at ASC
    `,
    [workspaceId],
  )

  return result.rows.map(mapNodeRow)
}

export const getNodeById = async (id: string): Promise<NodeRecord | null> => {
  const result = await query<NodeRow>(
    `
    SELECT
      id,
      workspace_id,
      parent_node_id,
      depth,
      type,
      title,
      status,
      confidence,
      summary,
      conclusion,
      rationale,
      created_at,
      updated_at
    FROM nodes
    WHERE id = $1
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapNodeRow(result.rows[0])
}

export const createNode = async (input: CreateNodeInput): Promise<NodeRecord> => {
  const result = await query<NodeRow>(
    `
    INSERT INTO nodes (
      workspace_id,
      parent_node_id,
      depth,
      type,
      title,
      status,
      confidence,
      summary,
      conclusion,
      rationale
    )
    SELECT
      $1,
      $2,
      parent.depth + 1,
      $3,
      $4,
      COALESCE($5, 'open'),
      COALESCE($6, 'medium'),
      $7,
      $8,
      $9
    FROM nodes AS parent
    WHERE parent.id = $2
      AND parent.workspace_id = $1
    RETURNING
      id,
      workspace_id,
      parent_node_id,
      depth,
      type,
      title,
      status,
      confidence,
      summary,
      conclusion,
      rationale,
      created_at,
      updated_at
    `,
    [
      input.workspaceId,
      input.parentNodeId,
      input.type,
      input.title,
      input.status ?? null,
      input.confidence ?? null,
      input.summary,
      input.conclusion ?? null,
      input.rationale ?? null,
    ],
  )

  if (result.rows.length === 0) {
    throw new Error('Parent node not found in workspace')
  }

  return mapNodeRow(result.rows[0])
}
