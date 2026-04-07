import type {
  CreateNodeInput,
  DeleteNodeResult,
  NodeConfidence,
  NodeRecord,
  NodeStatus,
  NodeType,
  UpdateNodeInput,
} from '../models/node.js'
import type { PoolClient } from 'pg'
import { query } from '../client.js'

type NodeRow = {
  id: string
  workspace_id: string
  author_user_id: string
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
  authorUserId: row.author_user_id,
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

const createNodeParams = (input: CreateNodeInput): unknown[] => [
  input.workspaceId,
  input.authorUserId,
  input.parentNodeId,
  input.type,
  input.title,
  input.status ?? null,
  input.confidence ?? null,
  input.summary,
  input.conclusion ?? null,
  input.rationale ?? null,
]

type NodeRowQueryExecutor = (
  sql: string,
  params: unknown[],
) => Promise<{ rows: NodeRow[] }>

const createNodeForAuthorWithExecutor = async (
  runQuery: NodeRowQueryExecutor,
  input: CreateNodeInput,
): Promise<NodeRecord | null> => {
  const result = await runQuery(
    `
    INSERT INTO nodes (
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
      $1,
      $2,
      $3,
      $4,
      $5,
      COALESCE($6, 'open'),
      COALESCE($7, 'medium'),
      $8,
      $9,
      $10
    FROM nodes AS parent
    JOIN workspaces w ON w.id = parent.workspace_id
    WHERE parent.id = $3
      AND parent.workspace_id = $1
      AND w.author_user_id = $2
    RETURNING
      id,
      workspace_id,
      author_user_id,
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
    createNodeParams(input),
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapNodeRow(result.rows[0])
}

export const listNodesByWorkspace = async (workspaceId: string): Promise<NodeRecord[]> => {
  const result = await query<NodeRow>(
    `
    SELECT
      id,
      workspace_id,
      author_user_id,
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

export const listNodesByWorkspaceForAuthor = async (
  workspaceId: string,
  authorUserId: string,
): Promise<NodeRecord[]> => {
  const result = await query<NodeRow>(
    `
    SELECT
      n.id,
      n.workspace_id,
      n.author_user_id,
      n.parent_node_id,
      n.depth,
      n.type,
      n.title,
      n.status,
      n.confidence,
      n.summary,
      n.conclusion,
      n.rationale,
      n.created_at,
      n.updated_at
    FROM nodes n
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE n.workspace_id = $1
      AND w.author_user_id = $2
    ORDER BY n.created_at ASC
    `,
    [workspaceId, authorUserId],
  )

  return result.rows.map(mapNodeRow)
}

export const getNodeById = async (id: string): Promise<NodeRecord | null> => {
  const result = await query<NodeRow>(
    `
    SELECT
      id,
      workspace_id,
      author_user_id,
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

export const getNodeByIdForAuthor = async (
  id: string,
  authorUserId: string,
): Promise<NodeRecord | null> => {
  const result = await query<NodeRow>(
    `
    SELECT
      n.id,
      n.workspace_id,
      n.author_user_id,
      n.parent_node_id,
      n.depth,
      n.type,
      n.title,
      n.status,
      n.confidence,
      n.summary,
      n.conclusion,
      n.rationale,
      n.created_at,
      n.updated_at
    FROM nodes n
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE n.id = $1
      AND w.author_user_id = $2
    `,
    [id, authorUserId],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapNodeRow(result.rows[0])
}

export const nodeExists = async (id: string): Promise<boolean> => {
  const result = await query<{ id: string }>(
    `
    SELECT id
    FROM nodes
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  )
  return result.rows.length > 0
}

export const createNode = async (input: CreateNodeInput): Promise<NodeRecord> => {
  const result = await query<NodeRow>(
    `
    INSERT INTO nodes (
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
      $1,
      $2,
      $3,
      $4,
      $5,
      COALESCE($6, 'open'),
      COALESCE($7, 'medium'),
      $8,
      $9,
      $10
    FROM nodes AS parent
    WHERE parent.id = $3
      AND parent.workspace_id = $1
    RETURNING
      id,
      workspace_id,
      author_user_id,
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
    createNodeParams(input),
  )

  if (result.rows.length === 0) {
    throw new Error('Parent node not found in workspace')
  }

  return mapNodeRow(result.rows[0])
}

export const createNodeForAuthor = async (input: CreateNodeInput): Promise<NodeRecord | null> => {
  return createNodeForAuthorWithExecutor(
    (sql, params) => query<NodeRow>(sql, params),
    input,
  )
}

export const createNodeForAuthorInTransaction = async (
  client: Pick<PoolClient, 'query'>,
  input: CreateNodeInput,
): Promise<NodeRecord | null> =>
  createNodeForAuthorWithExecutor(
    (sql, params) => client.query<NodeRow>(sql, params),
    input,
  )

export const updateNode = async (input: UpdateNodeInput): Promise<NodeRecord | null> => {
  const result = await query<NodeRow>(
    `
    UPDATE nodes
    SET
      type = CASE WHEN $2::boolean THEN $3 ELSE type END,
      title = CASE WHEN $4::boolean THEN $5 ELSE title END,
      status = CASE WHEN $6::boolean THEN $7 ELSE status END,
      confidence = CASE WHEN $8::boolean THEN $9 ELSE confidence END,
      summary = CASE WHEN $10::boolean THEN $11 ELSE summary END,
      conclusion = CASE WHEN $12::boolean THEN $13 ELSE conclusion END,
      rationale = CASE WHEN $14::boolean THEN $15 ELSE rationale END
    WHERE id = $1
    RETURNING
      id,
      workspace_id,
      author_user_id,
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
      input.id,
      input.type !== undefined,
      input.type ?? null,
      input.title !== undefined,
      input.title ?? null,
      input.status !== undefined,
      input.status ?? null,
      input.confidence !== undefined,
      input.confidence ?? null,
      input.summary !== undefined,
      input.summary ?? null,
      input.conclusion !== undefined,
      input.conclusion ?? null,
      input.rationale !== undefined,
      input.rationale ?? null,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapNodeRow(result.rows[0])
}

export const updateNodeForAuthor = async (
  input: UpdateNodeInput,
  authorUserId: string,
): Promise<NodeRecord | null> => {
  const result = await query<NodeRow>(
    `
    UPDATE nodes n
    SET
      type = CASE WHEN $2::boolean THEN $3 ELSE n.type END,
      title = CASE WHEN $4::boolean THEN $5 ELSE n.title END,
      status = CASE WHEN $6::boolean THEN $7 ELSE n.status END,
      confidence = CASE WHEN $8::boolean THEN $9 ELSE n.confidence END,
      summary = CASE WHEN $10::boolean THEN $11 ELSE n.summary END,
      conclusion = CASE WHEN $12::boolean THEN $13 ELSE n.conclusion END,
      rationale = CASE WHEN $14::boolean THEN $15 ELSE n.rationale END
    FROM workspaces w
    WHERE n.id = $1
      AND w.id = n.workspace_id
      AND w.author_user_id = $16
    RETURNING
      n.id,
      n.workspace_id,
      n.author_user_id,
      n.parent_node_id,
      n.depth,
      n.type,
      n.title,
      n.status,
      n.confidence,
      n.summary,
      n.conclusion,
      n.rationale,
      n.created_at,
      n.updated_at
    `,
    [
      input.id,
      input.type !== undefined,
      input.type ?? null,
      input.title !== undefined,
      input.title ?? null,
      input.status !== undefined,
      input.status ?? null,
      input.confidence !== undefined,
      input.confidence ?? null,
      input.summary !== undefined,
      input.summary ?? null,
      input.conclusion !== undefined,
      input.conclusion ?? null,
      input.rationale !== undefined,
      input.rationale ?? null,
      authorUserId,
    ],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapNodeRow(result.rows[0])
}

type NodeDeleteTargetRow = {
  id: string
  workspace_id: string
  is_workspace_root: boolean
}

type WorkspaceDeleteCascadeRow = {
  id: string
  deleted_node_count: number
  deleted_message_count: number
}

type SubtreeDeleteCascadeRow = {
  deleted_node_count: number
  deleted_message_count: number
}

export const deleteNode = async (id: string): Promise<DeleteNodeResult | null> => {
  const targetResult = await query<NodeDeleteTargetRow>(
    `
    SELECT
      n.id,
      n.workspace_id,
      (w.root_node_id = n.id) AS is_workspace_root
    FROM nodes n
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE n.id = $1
    `,
    [id],
  )

  if (targetResult.rows.length === 0) {
    return null
  }

  const target = targetResult.rows[0]

  if (target.is_workspace_root) {
    const workspaceDeleteResult = await query<WorkspaceDeleteCascadeRow>(
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
      [target.workspace_id],
    )

    if (workspaceDeleteResult.rows.length === 0) {
      return null
    }

    const row = workspaceDeleteResult.rows[0]
    return {
      id: target.id,
      deletedWorkspace: true,
      deletedNodeCount: row.deleted_node_count,
      deletedMessageCount: row.deleted_message_count,
    }
  }

  const subtreeDeleteResult = await query<SubtreeDeleteCascadeRow>(
    `
    WITH RECURSIVE subtree AS (
      SELECT id, parent_node_id
      FROM nodes
      WHERE id = $1

      UNION

      SELECT child.id, child.parent_node_id
      FROM nodes child
      JOIN subtree parent ON child.parent_node_id = parent.id
      WHERE child.id <> child.parent_node_id
    ),
    target_messages AS (
      SELECT m.id
      FROM messages m
      JOIN subtree s ON s.id = m.node_id
    ),
    deleted_nodes AS (
      DELETE FROM nodes n
      USING subtree s
      WHERE n.id = s.id
      RETURNING n.id
    )
    SELECT
      (SELECT COUNT(*)::int FROM deleted_nodes) AS deleted_node_count,
      (SELECT COUNT(*)::int FROM target_messages) AS deleted_message_count
    `,
    [id],
  )

  const row = subtreeDeleteResult.rows[0]
  return {
    id: target.id,
    deletedWorkspace: false,
    deletedNodeCount: row.deleted_node_count,
    deletedMessageCount: row.deleted_message_count,
  }
}

export const deleteNodeForAuthor = async (
  id: string,
  authorUserId: string,
): Promise<DeleteNodeResult | null> => {
  const targetResult = await query<NodeDeleteTargetRow>(
    `
    SELECT
      n.id,
      n.workspace_id,
      (w.root_node_id = n.id) AS is_workspace_root
    FROM nodes n
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE n.id = $1
      AND w.author_user_id = $2
    `,
    [id, authorUserId],
  )

  if (targetResult.rows.length === 0) {
    return null
  }

  const target = targetResult.rows[0]

  if (target.is_workspace_root) {
    const workspaceDeleteResult = await query<WorkspaceDeleteCascadeRow>(
      `
      WITH target_nodes AS (
        SELECT n.id
        FROM nodes n
        JOIN workspaces w ON w.id = n.workspace_id
        WHERE n.workspace_id = $1
          AND w.author_user_id = $2
      ),
      target_messages AS (
        SELECT m.id
        FROM messages m
        JOIN target_nodes tn ON tn.id = m.node_id
      ),
      deleted_workspace AS (
        DELETE FROM workspaces w
        WHERE w.id = $1
          AND w.author_user_id = $2
        RETURNING w.id
      )
      SELECT
        dw.id,
        (SELECT COUNT(*)::int FROM target_nodes) AS deleted_node_count,
        (SELECT COUNT(*)::int FROM target_messages) AS deleted_message_count
      FROM deleted_workspace dw
      `,
      [target.workspace_id, authorUserId],
    )

    if (workspaceDeleteResult.rows.length === 0) {
      return null
    }

    const row = workspaceDeleteResult.rows[0]
    return {
      id: target.id,
      deletedWorkspace: true,
      deletedNodeCount: row.deleted_node_count,
      deletedMessageCount: row.deleted_message_count,
    }
  }

  const subtreeDeleteResult = await query<SubtreeDeleteCascadeRow>(
    `
    WITH RECURSIVE subtree AS (
      SELECT n.id, n.parent_node_id
      FROM nodes n
      JOIN workspaces w ON w.id = n.workspace_id
      WHERE n.id = $1
        AND w.author_user_id = $2

      UNION

      SELECT child.id, child.parent_node_id
      FROM nodes child
      JOIN subtree parent ON child.parent_node_id = parent.id
      WHERE child.id <> child.parent_node_id
    ),
    target_messages AS (
      SELECT m.id
      FROM messages m
      JOIN subtree s ON s.id = m.node_id
    ),
    deleted_nodes AS (
      DELETE FROM nodes n
      USING subtree s, workspaces w
      WHERE n.id = s.id
        AND w.id = n.workspace_id
        AND w.author_user_id = $2
      RETURNING n.id
    )
    SELECT
      (SELECT COUNT(*)::int FROM deleted_nodes) AS deleted_node_count,
      (SELECT COUNT(*)::int FROM target_messages) AS deleted_message_count
    `,
    [id, authorUserId],
  )

  const row = subtreeDeleteResult.rows[0]
  return {
    id: target.id,
    deletedWorkspace: false,
    deletedNodeCount: row.deleted_node_count,
    deletedMessageCount: row.deleted_message_count,
  }
}
