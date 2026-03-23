import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { PoolClient } from 'pg'
import { z } from 'zod'
import { getClient, query } from '../../db/client.js'
import type { MessageRole } from '../../db/models/message.js'
import type { NodeConfidence, NodeStatus, NodeType } from '../../db/models/node.js'
import type { WorkspaceRecord } from '../../db/models/workspace.js'
import { listNodesByWorkspace } from '../../db/queries/node.js'
import { getWorkspaceById } from '../../db/queries/workspace.js'

const nodeTypeSchema = z.enum(['decision', 'question', 'option', 'constraint'])
const nodeStatusSchema = z.enum([
  'open',
  'exploring',
  'needs_approval',
  'approved',
  'deferred',
  'closed',
])
const nodeConfidenceSchema = z.enum(['low', 'medium', 'high'])
const messageRoleSchema = z.enum(['user', 'assistant', 'system'])

const workspaceExportNodeSchema = z.object({
  sourceNodeId: z.uuid(),
  sourceParentNodeId: z.uuid(),
  workspaceSourceId: z.uuid(),
  authorUserId: z.uuid(),
  depth: z.number().int().nonnegative(),
  type: nodeTypeSchema,
  title: z.string(),
  status: nodeStatusSchema,
  confidence: nodeConfidenceSchema,
  summary: z.string(),
  conclusion: z.string().nullable(),
  rationale: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

const workspaceExportMessageSchema = z.object({
  sourceMessageId: z.uuid(),
  nodeSourceId: z.uuid(),
  authorUserId: z.uuid(),
  role: messageRoleSchema,
  content: z.string(),
  createdAt: z.string().min(1),
})

const workspaceExportSchema = z.object({
  formatVersion: z.literal('workspace-export.v1'),
  exportedAt: z.string().min(1),
  workspace: z.object({
    sourceWorkspaceId: z.uuid(),
    title: z.string(),
    authorUserId: z.uuid(),
    rootNodeSourceId: z.uuid(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  }),
  nodes: z.array(workspaceExportNodeSchema),
  messages: z.array(workspaceExportMessageSchema),
})

type ExportMessageRow = {
  id: string
  node_id: string
  author_user_id: string
  role: MessageRole
  content: string
  created_at: string
}

type GeneratedIdsRow = {
  workspace_id: string
  root_node_id: string
}

type IdRow = {
  id: string
}

type WorkspaceRow = {
  id: string
  title: string
  summary: string | null
  author_user_id: string
  root_node_id: string
  created_at: string
  updated_at: string
}

export type WorkspaceExportPayload = z.infer<typeof workspaceExportSchema>

export type CreateWorkspaceFromRestoredDataInput = {
  restoredData: WorkspaceExportPayload
  targetAuthorUserId: string
  workspaceTitle?: string
  preserveOriginalAuthors?: boolean
}

export type CreateWorkspaceFromRestoredDataResult = {
  workspace: WorkspaceRecord
  sourceToPersistedNodeId: Record<string, string>
  sourceToPersistedMessageId: Record<string, string>
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

const validateWorkspaceExportPayload = (payload: WorkspaceExportPayload): WorkspaceExportPayload => {
  if (payload.nodes.length === 0) {
    throw new Error('Workspace export must contain at least one node.')
  }

  const nodeById = new Map<string, WorkspaceExportPayload['nodes'][number]>()
  for (const node of payload.nodes) {
    if (node.workspaceSourceId !== payload.workspace.sourceWorkspaceId) {
      throw new Error(`Node ${node.sourceNodeId} references an unexpected workspace id.`)
    }
    if (nodeById.has(node.sourceNodeId)) {
      throw new Error(`Duplicate node source id found: ${node.sourceNodeId}`)
    }
    nodeById.set(node.sourceNodeId, node)
  }

  const rootNode = nodeById.get(payload.workspace.rootNodeSourceId)
  if (!rootNode) {
    throw new Error('Root node not found in exported nodes array.')
  }
  if (rootNode.sourceParentNodeId !== rootNode.sourceNodeId || rootNode.depth !== 0) {
    throw new Error('Root node must be self-parented and have depth=0.')
  }

  const selfParentNodeCount = payload.nodes.filter(
    (node) => node.sourceParentNodeId === node.sourceNodeId,
  ).length
  if (selfParentNodeCount !== 1) {
    throw new Error('Export must contain exactly one self-parented root node.')
  }

  for (const node of payload.nodes) {
    if (node.sourceNodeId === payload.workspace.rootNodeSourceId) {
      continue
    }
    if (node.sourceParentNodeId === node.sourceNodeId) {
      throw new Error(`Non-root node ${node.sourceNodeId} cannot be self-parented.`)
    }
    const parentNode = nodeById.get(node.sourceParentNodeId)
    if (!parentNode) {
      throw new Error(`Parent node ${node.sourceParentNodeId} not found for node ${node.sourceNodeId}.`)
    }
    if (node.depth <= parentNode.depth) {
      throw new Error(`Node ${node.sourceNodeId} depth must be greater than its parent depth.`)
    }
  }

  const messageIdSet = new Set<string>()
  for (const message of payload.messages) {
    if (messageIdSet.has(message.sourceMessageId)) {
      throw new Error(`Duplicate message source id found: ${message.sourceMessageId}`)
    }
    messageIdSet.add(message.sourceMessageId)

    if (!nodeById.has(message.nodeSourceId)) {
      throw new Error(`Message ${message.sourceMessageId} references unknown node ${message.nodeSourceId}.`)
    }
  }

  return payload
}

const parseWorkspaceExportPayload = (value: unknown): WorkspaceExportPayload => {
  const parsed = workspaceExportSchema.parse(value)
  return validateWorkspaceExportPayload(parsed)
}

const listMessagesByWorkspace = async (workspaceId: string): Promise<ExportMessageRow[]> => {
  const result = await query<ExportMessageRow>(
    `
    SELECT m.id, m.node_id, m.author_user_id, m.role, m.content, m.created_at
    FROM messages m
    JOIN nodes n ON n.id = m.node_id
    WHERE n.workspace_id = $1
    ORDER BY m.created_at ASC, m.id ASC
    `,
    [workspaceId],
  )
  return result.rows
}

export const exportWorkspaceToJsonFile = async (
  workspaceId: string,
  filePath: string,
): Promise<WorkspaceExportPayload> => {
  const workspace = await getWorkspaceById(workspaceId)
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found.`)
  }

  const nodes = await listNodesByWorkspace(workspaceId)
  if (nodes.length === 0) {
    throw new Error(`Workspace ${workspaceId} has no nodes and cannot be exported.`)
  }

  const messages = await listMessagesByWorkspace(workspaceId)

  const payload = parseWorkspaceExportPayload({
    formatVersion: 'workspace-export.v1',
    exportedAt: new Date().toISOString(),
    workspace: {
      sourceWorkspaceId: workspace.id,
      title: workspace.title,
      authorUserId: workspace.authorUserId,
      rootNodeSourceId: workspace.rootNodeId,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    },
    nodes: nodes.map((node) => ({
      sourceNodeId: node.id,
      sourceParentNodeId: node.parentNodeId,
      workspaceSourceId: node.workspaceId,
      authorUserId: node.authorUserId,
      depth: node.depth,
      type: node.type,
      title: node.title,
      status: node.status,
      confidence: node.confidence,
      summary: node.summary,
      conclusion: node.conclusion,
      rationale: node.rationale,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    })),
    messages: messages.map((message) => ({
      sourceMessageId: message.id,
      nodeSourceId: message.node_id,
      authorUserId: message.author_user_id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
    })),
  })

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  return payload
}

export const restoreWorkspaceFromJsonFile = async (filePath: string): Promise<WorkspaceExportPayload> => {
  const raw = await readFile(filePath, 'utf8')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid JSON format in file: ${filePath}`)
  }

  return parseWorkspaceExportPayload(parsed)
}

const ensureUsersExist = async (client: PoolClient, userIds: string[]): Promise<void> => {
  if (userIds.length === 0) {
    return
  }

  const uniqueIds = [...new Set(userIds)]
  const existingUsers = await client.query<IdRow>(
    `
    SELECT id
    FROM users
    WHERE id = ANY($1::uuid[])
    `,
    [uniqueIds],
  )

  const found = new Set(existingUsers.rows.map((row) => row.id))
  const missing = uniqueIds.filter((id) => !found.has(id))
  if (missing.length > 0) {
    throw new Error(`Cannot import workspace. Missing users: ${missing.join(', ')}`)
  }
}

const selectWorkspaceById = async (client: PoolClient, workspaceId: string): Promise<WorkspaceRecord> => {
  const result = await client.query<WorkspaceRow>(
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
    [workspaceId],
  )

  if (result.rows.length === 0) {
    throw new Error(`Failed to load imported workspace ${workspaceId}.`)
  }

  return mapWorkspaceRow(result.rows[0])
}

const sortNodesForInsert = (
  nodes: WorkspaceExportPayload['nodes'],
): WorkspaceExportPayload['nodes'] =>
  [...nodes].sort(
    (left, right) =>
      left.depth - right.depth ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.sourceNodeId.localeCompare(right.sourceNodeId),
  )

const sortMessagesForInsert = (
  messages: WorkspaceExportPayload['messages'],
): WorkspaceExportPayload['messages'] =>
  [...messages].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.sourceMessageId.localeCompare(right.sourceMessageId),
  )

const resolveAuthor = (
  sourceAuthorId: string,
  targetAuthorUserId: string,
  preserveOriginalAuthors: boolean,
): string => (preserveOriginalAuthors ? sourceAuthorId : targetAuthorUserId)

export const createWorkspaceFromRestoredData = async (
  input: CreateWorkspaceFromRestoredDataInput,
): Promise<CreateWorkspaceFromRestoredDataResult> => {
  const restoredData = validateWorkspaceExportPayload(input.restoredData)
  const preserveOriginalAuthors = input.preserveOriginalAuthors ?? false
  const workspaceTitle = input.workspaceTitle?.trim() ? input.workspaceTitle.trim() : restoredData.workspace.title
  const rootNode = restoredData.nodes.find(
    (node) => node.sourceNodeId === restoredData.workspace.rootNodeSourceId,
  )

  if (!rootNode) {
    throw new Error('Root node missing from restored data.')
  }

  const sortedNodes = sortNodesForInsert(restoredData.nodes)
  const nonRootNodes = sortedNodes.filter((node) => node.sourceNodeId !== rootNode.sourceNodeId)
  const sortedMessages = sortMessagesForInsert(restoredData.messages)

  const client = await getClient()
  try {
    await client.query('BEGIN')

    if (preserveOriginalAuthors) {
      await ensureUsersExist(client, [
        restoredData.workspace.authorUserId,
        ...restoredData.nodes.map((node) => node.authorUserId),
        ...restoredData.messages.map((message) => message.authorUserId),
      ])
    } else {
      await ensureUsersExist(client, [input.targetAuthorUserId])
    }

    const idsResult = await client.query<GeneratedIdsRow>(
      'SELECT gen_random_uuid() AS workspace_id, gen_random_uuid() AS root_node_id',
    )
    if (idsResult.rows.length === 0) {
      throw new Error('Failed to generate new workspace IDs.')
    }

    const { workspace_id: workspaceId, root_node_id: rootNodeId } = idsResult.rows[0]

    await client.query(
      `
      INSERT INTO workspaces (id, title, root_node_id, author_user_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        workspaceId,
        workspaceTitle,
        rootNodeId,
        resolveAuthor(
          restoredData.workspace.authorUserId,
          input.targetAuthorUserId,
          preserveOriginalAuthors,
        ),
        restoredData.workspace.createdAt,
        restoredData.workspace.updatedAt,
      ],
    )

    await client.query(
      `
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
        rationale,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $1, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        rootNodeId,
        workspaceId,
        resolveAuthor(rootNode.authorUserId, input.targetAuthorUserId, preserveOriginalAuthors),
        rootNode.type,
        rootNode.title,
        rootNode.status,
        rootNode.confidence,
        rootNode.summary,
        rootNode.conclusion,
        rootNode.rationale,
        rootNode.createdAt,
        rootNode.updatedAt,
      ],
    )

    const sourceToPersistedNodeId: Record<string, string> = {
      [rootNode.sourceNodeId]: rootNodeId,
    }

    for (const node of nonRootNodes) {
      const parentNodeId = sourceToPersistedNodeId[node.sourceParentNodeId]
      if (!parentNodeId) {
        throw new Error(`Parent node mapping not found for source node ${node.sourceNodeId}.`)
      }

      const insertedNode = await client.query<IdRow>(
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
          rationale,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
        `,
        [
          workspaceId,
          resolveAuthor(node.authorUserId, input.targetAuthorUserId, preserveOriginalAuthors),
          parentNodeId,
          node.type,
          node.title,
          node.status,
          node.confidence,
          node.summary,
          node.conclusion,
          node.rationale,
          node.createdAt,
          node.updatedAt,
        ],
      )

      if (insertedNode.rows.length === 0) {
        throw new Error(`Failed to insert node for source id ${node.sourceNodeId}.`)
      }

      sourceToPersistedNodeId[node.sourceNodeId] = insertedNode.rows[0].id
    }

    const sourceToPersistedMessageId: Record<string, string> = {}
    for (const message of sortedMessages) {
      const nodeId = sourceToPersistedNodeId[message.nodeSourceId]
      if (!nodeId) {
        throw new Error(`Node mapping not found for message ${message.sourceMessageId}.`)
      }

      const insertedMessage = await client.query<IdRow>(
        `
        INSERT INTO messages (node_id, author_user_id, role, content, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [
          nodeId,
          resolveAuthor(message.authorUserId, input.targetAuthorUserId, preserveOriginalAuthors),
          message.role,
          message.content,
          message.createdAt,
        ],
      )

      if (insertedMessage.rows.length === 0) {
        throw new Error(`Failed to insert message for source id ${message.sourceMessageId}.`)
      }

      sourceToPersistedMessageId[message.sourceMessageId] = insertedMessage.rows[0].id
    }

    const workspace = await selectWorkspaceById(client, workspaceId)

    await client.query('COMMIT')

    return {
      workspace,
      sourceToPersistedNodeId,
      sourceToPersistedMessageId,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export type {
  MessageRole,
  NodeConfidence,
  NodeStatus,
  NodeType,
}
