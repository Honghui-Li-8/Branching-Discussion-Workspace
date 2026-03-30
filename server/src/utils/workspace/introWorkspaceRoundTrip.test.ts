import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { getClient, query } from '../../db/client.js'
import { listNodesByWorkspace } from '../../db/queries/node.js'
import { getWorkspaceById } from '../../db/queries/workspace.js'
import {
  createWorkspaceFromRestoredData,
  exportWorkspaceToJsonFile,
  restoreWorkspaceFromJsonFile,
  type CreateWorkspaceFromRestoredDataResult,
  type WorkspaceExportPayload,
} from './importExport'

jest.mock('../../db/client.js', () => ({
  getClient: jest.fn(),
  query: jest.fn(),
}))

jest.mock('../../db/queries/workspace.js', () => ({
  getWorkspaceById: jest.fn(),
}))

jest.mock('../../db/queries/node.js', () => ({
  listNodesByWorkspace: jest.fn(),
}))

const getClientMock = getClient as jest.MockedFunction<typeof getClient>
const queryMock = query as jest.MockedFunction<typeof query>
const getWorkspaceByIdMock = getWorkspaceById as jest.MockedFunction<typeof getWorkspaceById>
const listNodesByWorkspaceMock = listNodesByWorkspace as jest.MockedFunction<typeof listNodesByWorkspace>

type StoredWorkspace = {
  id: string
  title: string
  author_user_id: string
  root_node_id: string
  created_at: string
  updated_at: string
}

type StoredNode = {
  id: string
  workspace_id: string
  author_user_id: string
  parent_node_id: string
  depth: number
  type: WorkspaceExportPayload['nodes'][number]['type']
  title: string
  status: WorkspaceExportPayload['nodes'][number]['status']
  confidence: WorkspaceExportPayload['nodes'][number]['confidence']
  summary: string
  conclusion: string | null
  rationale: string | null
  created_at: string
  updated_at: string
}

type StoredMessage = {
  id: string
  node_id: string
  author_user_id: string
  role: WorkspaceExportPayload['messages'][number]['role']
  content: string
  created_at: string
}

type FakeStore = {
  workspaceById: Map<string, StoredWorkspace>
  nodeById: Map<string, StoredNode>
  messageById: Map<string, StoredMessage>
  users: Set<string>
}

const INTRO_WORKSPACE_JSON_PATH = resolve(
  process.cwd(),
  'server/src/db/seeds/introWorkspace.json',
)

const makeUuid = (index: number): string =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`

const invertMap = (input: Record<string, string>): Record<string, string> => {
  const output: Record<string, string> = {}
  for (const [source, persisted] of Object.entries(input)) {
    output[persisted] = source
  }
  return output
}

const canonicalizePayload = (payload: WorkspaceExportPayload): WorkspaceExportPayload => ({
  ...payload,
  nodes: [...payload.nodes].sort((left, right) => left.sourceNodeId.localeCompare(right.sourceNodeId)),
  messages: [...payload.messages].sort((left, right) =>
    left.sourceMessageId.localeCompare(right.sourceMessageId),
  ),
})

const setupFakeDatabase = (
  payload: WorkspaceExportPayload,
): { store: FakeStore } => {
  const users = new Set<string>([
    payload.workspace.authorUserId,
    ...payload.nodes.map((node) => node.authorUserId),
    ...payload.messages.map((message) => message.authorUserId),
  ])

  const store: FakeStore = {
    workspaceById: new Map<string, StoredWorkspace>(),
    nodeById: new Map<string, StoredNode>(),
    messageById: new Map<string, StoredMessage>(),
    users,
  }

  let nextGeneratedId = 1
  let generatedWorkspaceId = ''
  let generatedRootNodeId = ''

  const clientQueryMock = jest.fn(async (sql: string, params?: unknown[]) => {
    const compactSql = sql.replace(/\s+/g, ' ').trim()
    if (compactSql === 'BEGIN' || compactSql === 'COMMIT' || compactSql === 'ROLLBACK') {
      return { rows: [] } as never
    }

    if (compactSql.includes('FROM users') && compactSql.includes('ANY($1::uuid[])')) {
      const requested = ((params?.[0] as string[]) ?? []).filter((userId) => store.users.has(userId))
      return { rows: requested.map((id) => ({ id })) } as never
    }

    if (compactSql.includes('SELECT gen_random_uuid() AS workspace_id, gen_random_uuid() AS root_node_id')) {
      generatedWorkspaceId = makeUuid(nextGeneratedId)
      nextGeneratedId += 1
      generatedRootNodeId = makeUuid(nextGeneratedId)
      nextGeneratedId += 1
      return {
        rows: [
          {
            workspace_id: generatedWorkspaceId,
            root_node_id: generatedRootNodeId,
          },
        ],
      } as never
    }

    if (compactSql.startsWith('INSERT INTO workspaces (id, title, root_node_id, author_user_id, created_at, updated_at)')) {
      const [id, title, rootNodeId, authorUserId, createdAt, updatedAt] = (params ?? []) as [
        string,
        string,
        string,
        string,
        string,
        string,
      ]

      store.workspaceById.set(id, {
        id,
        title,
        author_user_id: authorUserId,
        root_node_id: rootNodeId,
        created_at: createdAt,
        updated_at: updatedAt,
      })
      return { rows: [] } as never
    }

    if (compactSql.startsWith('INSERT INTO nodes ( id, workspace_id, author_user_id, parent_node_id')) {
      const [
        id,
        workspaceId,
        authorUserId,
        type,
        title,
        status,
        confidence,
        summary,
        conclusion,
        rationale,
        createdAt,
        updatedAt,
      ] = (params ?? []) as [string, string, string, StoredNode['type'], string, StoredNode['status'], StoredNode['confidence'], string, string | null, string | null, string, string]

      store.nodeById.set(id, {
        id,
        workspace_id: workspaceId,
        author_user_id: authorUserId,
        parent_node_id: id,
        depth: 0,
        type,
        title,
        status,
        confidence,
        summary,
        conclusion,
        rationale,
        created_at: createdAt,
        updated_at: updatedAt,
      })
      return { rows: [] } as never
    }

    if (compactSql.startsWith('INSERT INTO nodes ( workspace_id, author_user_id, parent_node_id') && compactSql.includes('RETURNING id')) {
      const [
        workspaceId,
        authorUserId,
        parentNodeId,
        type,
        title,
        status,
        confidence,
        summary,
        conclusion,
        rationale,
        createdAt,
        updatedAt,
      ] = (params ?? []) as [string, string, string, StoredNode['type'], string, StoredNode['status'], StoredNode['confidence'], string, string | null, string | null, string, string]

      const parentNode = store.nodeById.get(parentNodeId)
      if (!parentNode) {
        throw new Error(`Parent node ${parentNodeId} not found in fake DB`)
      }

      const id = makeUuid(nextGeneratedId)
      nextGeneratedId += 1
      store.nodeById.set(id, {
        id,
        workspace_id: workspaceId,
        author_user_id: authorUserId,
        parent_node_id: parentNodeId,
        depth: parentNode.depth + 1,
        type,
        title,
        status,
        confidence,
        summary,
        conclusion,
        rationale,
        created_at: createdAt,
        updated_at: updatedAt,
      })
      return { rows: [{ id }] } as never
    }

    if (compactSql.startsWith('INSERT INTO messages (node_id, author_user_id, role, content, created_at)')) {
      const [nodeId, authorUserId, role, content, createdAt] = (params ?? []) as [
        string,
        string,
        StoredMessage['role'],
        string,
        string,
      ]
      const id = makeUuid(nextGeneratedId)
      nextGeneratedId += 1
      store.messageById.set(id, {
        id,
        node_id: nodeId,
        author_user_id: authorUserId,
        role,
        content,
        created_at: createdAt,
      })
      return { rows: [{ id }] } as never
    }

    if (
      compactSql.includes('FROM workspaces w') &&
      compactSql.includes('LEFT JOIN nodes rn ON rn.id = w.root_node_id') &&
      compactSql.includes('WHERE w.id = $1')
    ) {
      const workspaceId = (params?.[0] as string) ?? ''
      const workspace = store.workspaceById.get(workspaceId)
      if (!workspace) {
        return { rows: [] } as never
      }

      const rootNode = store.nodeById.get(workspace.root_node_id)
      const summary = rootNode?.summary.trim() ? rootNode.summary : null

      return {
        rows: [
          {
            ...workspace,
            summary,
          },
        ],
      } as never
    }

    throw new Error(`Unexpected SQL in fake DB: ${compactSql}`)
  })

  getClientMock.mockResolvedValue({
    query: clientQueryMock,
    release: jest.fn(),
  } as never)

  getWorkspaceByIdMock.mockImplementation(async (workspaceId: string) => {
    const workspace = store.workspaceById.get(workspaceId)
    if (!workspace) return null
    const rootNode = store.nodeById.get(workspace.root_node_id)
    const summary = rootNode?.summary.trim() ? rootNode.summary : null

    return {
      id: workspace.id,
      title: workspace.title,
      summary,
      authorUserId: workspace.author_user_id,
      rootNodeId: workspace.root_node_id,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
    }
  })

  listNodesByWorkspaceMock.mockImplementation(async (workspaceId: string) =>
    [...store.nodeById.values()]
      .filter((node) => node.workspace_id === workspaceId)
      .sort(
        (left, right) =>
          left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
      )
      .map((node) => ({
        id: node.id,
        workspaceId: node.workspace_id,
        authorUserId: node.author_user_id,
        parentNodeId: node.parent_node_id,
        depth: node.depth,
        type: node.type,
        title: node.title,
        status: node.status,
        confidence: node.confidence,
        summary: node.summary,
        conclusion: node.conclusion,
        rationale: node.rationale,
        createdAt: node.created_at,
        updatedAt: node.updated_at,
      })),
  )

  queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql.includes('FROM messages m') && sql.includes('JOIN nodes n')) {
      const workspaceId = (params?.[0] as string) ?? ''
      const rows = [...store.messageById.values()]
        .filter((message) => store.nodeById.get(message.node_id)?.workspace_id === workspaceId)
        .sort(
          (left, right) =>
            left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
        )
        .map((message) => ({
          id: message.id,
          node_id: message.node_id,
          author_user_id: message.author_user_id,
          role: message.role,
          content: message.content,
          created_at: message.created_at,
        }))
      return { rows } as never
    }

    throw new Error(`Unexpected query() SQL in fake DB: ${sql}`)
  })

  return { store }
}

const runIntroImport = async (): Promise<{
  sourcePayload: WorkspaceExportPayload
  imported: CreateWorkspaceFromRestoredDataResult
  store: FakeStore
}> => {
  const sourcePayload = await restoreWorkspaceFromJsonFile(INTRO_WORKSPACE_JSON_PATH)
  const { store } = setupFakeDatabase(sourcePayload)

  const imported = await createWorkspaceFromRestoredData({
    restoredData: sourcePayload,
    targetAuthorUserId: sourcePayload.workspace.authorUserId,
    workspaceTitle: sourcePayload.workspace.title,
    preserveOriginalAuthors: true,
  })

  return { sourcePayload, imported, store }
}

const remapExportedPayloadToSourceIds = (
  exportedPayload: WorkspaceExportPayload,
  sourcePayload: WorkspaceExportPayload,
  imported: CreateWorkspaceFromRestoredDataResult,
): WorkspaceExportPayload => {
  const persistedToSourceNodeId = invertMap(imported.sourceToPersistedNodeId)
  const persistedToSourceMessageId = invertMap(imported.sourceToPersistedMessageId)

  return {
    formatVersion: exportedPayload.formatVersion,
    exportedAt: sourcePayload.exportedAt,
    workspace: {
      ...exportedPayload.workspace,
      sourceWorkspaceId: sourcePayload.workspace.sourceWorkspaceId,
      rootNodeSourceId: persistedToSourceNodeId[exportedPayload.workspace.rootNodeSourceId],
    },
    nodes: exportedPayload.nodes.map((node) => ({
      ...node,
      sourceNodeId: persistedToSourceNodeId[node.sourceNodeId],
      sourceParentNodeId: persistedToSourceNodeId[node.sourceParentNodeId],
      workspaceSourceId: sourcePayload.workspace.sourceWorkspaceId,
    })),
    messages: exportedPayload.messages.map((message) => ({
      ...message,
      sourceMessageId: persistedToSourceMessageId[message.sourceMessageId],
      nodeSourceId: persistedToSourceNodeId[message.nodeSourceId],
    })),
  }
}

describe('intro workspace import/export round-trip', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('imports intro workspace with correct node/message data and relations', async () => {
    const { sourcePayload, imported, store } = await runIntroImport()

    expect(Object.keys(imported.sourceToPersistedNodeId)).toHaveLength(sourcePayload.nodes.length)
    expect(Object.keys(imported.sourceToPersistedMessageId)).toHaveLength(sourcePayload.messages.length)
    expect(store.nodeById.size).toBe(sourcePayload.nodes.length)
    expect(store.messageById.size).toBe(sourcePayload.messages.length)

    for (const sourceNode of sourcePayload.nodes) {
      const persistedNodeId = imported.sourceToPersistedNodeId[sourceNode.sourceNodeId]
      expect(persistedNodeId).toBeDefined()

      const persistedNode = store.nodeById.get(persistedNodeId)
      expect(persistedNode).toBeDefined()
      expect(persistedNode?.workspace_id).toBe(imported.workspace.id)
      expect(persistedNode?.title).toBe(sourceNode.title)
      expect(persistedNode?.type).toBe(sourceNode.type)
      expect(persistedNode?.status).toBe(sourceNode.status)
      expect(persistedNode?.confidence).toBe(sourceNode.confidence)
      expect(persistedNode?.summary).toBe(sourceNode.summary)
      expect(persistedNode?.conclusion).toBe(sourceNode.conclusion)
      expect(persistedNode?.rationale).toBe(sourceNode.rationale)
      expect(persistedNode?.created_at).toBe(sourceNode.createdAt)
      expect(persistedNode?.updated_at).toBe(sourceNode.updatedAt)

      if (sourceNode.sourceNodeId === sourcePayload.workspace.rootNodeSourceId) {
        expect(persistedNode?.parent_node_id).toBe(persistedNodeId)
        expect(persistedNode?.depth).toBe(0)
      } else {
        expect(persistedNode?.parent_node_id).toBe(
          imported.sourceToPersistedNodeId[sourceNode.sourceParentNodeId],
        )
        expect(persistedNode?.depth).toBe(sourceNode.depth)
      }
    }

    for (const sourceMessage of sourcePayload.messages) {
      const persistedMessageId = imported.sourceToPersistedMessageId[sourceMessage.sourceMessageId]
      expect(persistedMessageId).toBeDefined()

      const persistedMessage = store.messageById.get(persistedMessageId)
      expect(persistedMessage).toBeDefined()
      expect(persistedMessage?.node_id).toBe(imported.sourceToPersistedNodeId[sourceMessage.nodeSourceId])
      expect(persistedMessage?.role).toBe(sourceMessage.role)
      expect(persistedMessage?.content).toBe(sourceMessage.content)
      expect(persistedMessage?.created_at).toBe(sourceMessage.createdAt)
      expect(persistedMessage?.author_user_id).toBe(sourceMessage.authorUserId)
    }
  })

  test('exports imported intro workspace into equivalent JSON payload', async () => {
    const { sourcePayload, imported } = await runIntroImport()
    const tempDir = await mkdtemp(join(tmpdir(), 'intro-workspace-roundtrip-'))
    const outputPath = join(tempDir, 'introWorkspace.exported.json')

    const exportedPayload = await exportWorkspaceToJsonFile(imported.workspace.id, outputPath)
    const exportedFilePayload = JSON.parse(await readFile(outputPath, 'utf8')) as WorkspaceExportPayload
    expect(exportedFilePayload).toEqual(exportedPayload)

    const remappedToSourcePayload = remapExportedPayloadToSourceIds(
      exportedPayload,
      sourcePayload,
      imported,
    )

    expect(canonicalizePayload(remappedToSourcePayload)).toEqual(canonicalizePayload(sourcePayload))

    await rm(tempDir, { recursive: true, force: true })
  })
})
