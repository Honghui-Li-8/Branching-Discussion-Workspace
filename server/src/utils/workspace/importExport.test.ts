import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getClient, query } from '../../db/client.js'
import { listNodesByWorkspace } from '../../db/queries/node.js'
import { getWorkspaceById } from '../../db/queries/workspace.js'
import {
  createWorkspaceFromRestoredData,
  exportWorkspaceToJsonFile,
  restoreWorkspaceFromJsonFile,
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

const SOURCE_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ROOT_NODE_ID = '22222222-2222-4222-8222-222222222221'
const SOURCE_CHILD_NODE_ID = '22222222-2222-4222-8222-222222222222'
const SOURCE_AUTHOR_ID = '33333333-3333-4333-8333-333333333333'
const TARGET_AUTHOR_ID = '44444444-4444-4444-8444-444444444444'
const SOURCE_ROOT_MESSAGE_ID = '55555555-5555-4555-8555-555555555551'
const SOURCE_CHILD_MESSAGE_ID = '55555555-5555-4555-8555-555555555552'

const makePayload = (): WorkspaceExportPayload => ({
  formatVersion: 'workspace-export.v1',
  exportedAt: '2026-03-22T12:00:00.000Z',
  workspace: {
    sourceWorkspaceId: SOURCE_WORKSPACE_ID,
    title: 'Source Workspace',
    authorUserId: SOURCE_AUTHOR_ID,
    rootNodeSourceId: SOURCE_ROOT_NODE_ID,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
  nodes: [
    {
      sourceNodeId: SOURCE_ROOT_NODE_ID,
      sourceParentNodeId: SOURCE_ROOT_NODE_ID,
      workspaceSourceId: SOURCE_WORKSPACE_ID,
      authorUserId: SOURCE_AUTHOR_ID,
      depth: 0,
      type: 'decision',
      title: 'Root Decision',
      status: 'open',
      confidence: 'medium',
      summary: 'Root summary',
      conclusion: null,
      rationale: null,
      createdAt: '2026-03-21T00:00:00.000Z',
      updatedAt: '2026-03-21T00:00:00.000Z',
    },
    {
      sourceNodeId: SOURCE_CHILD_NODE_ID,
      sourceParentNodeId: SOURCE_ROOT_NODE_ID,
      workspaceSourceId: SOURCE_WORKSPACE_ID,
      authorUserId: SOURCE_AUTHOR_ID,
      depth: 1,
      type: 'option',
      title: 'Child Option',
      status: 'exploring',
      confidence: 'low',
      summary: 'Child summary',
      conclusion: null,
      rationale: 'Child rationale',
      createdAt: '2026-03-21T00:10:00.000Z',
      updatedAt: '2026-03-21T00:10:00.000Z',
    },
  ],
  messages: [
    {
      sourceMessageId: SOURCE_ROOT_MESSAGE_ID,
      nodeSourceId: SOURCE_ROOT_NODE_ID,
      authorUserId: SOURCE_AUTHOR_ID,
      role: 'user',
      content: 'Root message',
      createdAt: '2026-03-21T00:01:00.000Z',
    },
    {
      sourceMessageId: SOURCE_CHILD_MESSAGE_ID,
      nodeSourceId: SOURCE_CHILD_NODE_ID,
      authorUserId: SOURCE_AUTHOR_ID,
      role: 'assistant',
      content: 'Child message',
      createdAt: '2026-03-21T00:11:00.000Z',
    },
  ],
})

describe('workspace import/export utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(async () => {
    jest.restoreAllMocks()
  })

  test('exportWorkspaceToJsonFile exports workspace, nodes, and messages', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'workspace-export-test-'))
    const filePath = join(tempDir, 'workspace.json')

    getWorkspaceByIdMock.mockResolvedValue({
      id: SOURCE_WORKSPACE_ID,
      title: 'Source Workspace',
      authorUserId: SOURCE_AUTHOR_ID,
      rootNodeId: SOURCE_ROOT_NODE_ID,
      createdAt: '2026-03-21T00:00:00.000Z',
      updatedAt: '2026-03-21T00:00:00.000Z',
    })

    listNodesByWorkspaceMock.mockResolvedValue([
      {
        id: SOURCE_ROOT_NODE_ID,
        workspaceId: SOURCE_WORKSPACE_ID,
        authorUserId: SOURCE_AUTHOR_ID,
        parentNodeId: SOURCE_ROOT_NODE_ID,
        depth: 0,
        type: 'decision',
        title: 'Root Decision',
        status: 'open',
        confidence: 'medium',
        summary: 'Root summary',
        conclusion: null,
        rationale: null,
        createdAt: '2026-03-21T00:00:00.000Z',
        updatedAt: '2026-03-21T00:00:00.000Z',
      },
      {
        id: SOURCE_CHILD_NODE_ID,
        workspaceId: SOURCE_WORKSPACE_ID,
        authorUserId: SOURCE_AUTHOR_ID,
        parentNodeId: SOURCE_ROOT_NODE_ID,
        depth: 1,
        type: 'option',
        title: 'Child Option',
        status: 'exploring',
        confidence: 'low',
        summary: 'Child summary',
        conclusion: null,
        rationale: 'Child rationale',
        createdAt: '2026-03-21T00:10:00.000Z',
        updatedAt: '2026-03-21T00:10:00.000Z',
      },
    ])

    queryMock.mockResolvedValue({
      rows: [
        {
          id: SOURCE_ROOT_MESSAGE_ID,
          node_id: SOURCE_ROOT_NODE_ID,
          author_user_id: SOURCE_AUTHOR_ID,
          role: 'user',
          content: 'Root message',
          created_at: '2026-03-21T00:01:00.000Z',
        },
        {
          id: SOURCE_CHILD_MESSAGE_ID,
          node_id: SOURCE_CHILD_NODE_ID,
          author_user_id: SOURCE_AUTHOR_ID,
          role: 'assistant',
          content: 'Child message',
          created_at: '2026-03-21T00:11:00.000Z',
        },
      ],
    } as never)

    const exported = await exportWorkspaceToJsonFile(SOURCE_WORKSPACE_ID, filePath)

    expect(exported.formatVersion).toBe('workspace-export.v1')
    expect(exported.workspace.sourceWorkspaceId).toBe(SOURCE_WORKSPACE_ID)
    expect(exported.nodes).toHaveLength(2)
    expect(exported.messages).toHaveLength(2)

    const savedContent = await readFile(filePath, 'utf8')
    const parsedFile = JSON.parse(savedContent) as WorkspaceExportPayload
    expect(parsedFile.workspace.rootNodeSourceId).toBe(SOURCE_ROOT_NODE_ID)

    await rm(tempDir, { recursive: true, force: true })
  })

  test('restoreWorkspaceFromJsonFile rejects invalid message node references', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'workspace-restore-test-'))
    const filePath = join(tempDir, 'invalid-workspace.json')
    const payload = makePayload()
    payload.messages[0].nodeSourceId = '99999999-9999-4999-8999-999999999999'

    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')

    await expect(restoreWorkspaceFromJsonFile(filePath)).rejects.toThrow(
      'references unknown node',
    )

    await rm(tempDir, { recursive: true, force: true })
  })

  test('createWorkspaceFromRestoredData persists with new generated ids', async () => {
    const NEW_WORKSPACE_ID = '66666666-6666-4666-8666-666666666666'
    const NEW_ROOT_NODE_ID = '77777777-7777-4777-8777-777777777771'
    const NEW_CHILD_NODE_ID = '77777777-7777-4777-8777-777777777772'
    const NEW_ROOT_MESSAGE_ID = '88888888-8888-4888-8888-888888888881'
    const NEW_CHILD_MESSAGE_ID = '88888888-8888-4888-8888-888888888882'

    let messageInsertCount = 0
    const clientQueryMock = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [] } as never
      }
      if (sql.includes('FROM users')) {
        return { rows: [{ id: TARGET_AUTHOR_ID }] } as never
      }
      if (sql.includes('SELECT gen_random_uuid() AS workspace_id')) {
        return {
          rows: [{ workspace_id: NEW_WORKSPACE_ID, root_node_id: NEW_ROOT_NODE_ID }],
        } as never
      }
      if (sql.includes('INSERT INTO workspaces')) {
        return { rows: [] } as never
      }
      if (sql.includes('INSERT INTO nodes') && !sql.includes('RETURNING id')) {
        return { rows: [] } as never
      }
      if (sql.includes('INSERT INTO nodes') && sql.includes('RETURNING id')) {
        return { rows: [{ id: NEW_CHILD_NODE_ID }] } as never
      }
      if (sql.includes('INSERT INTO messages')) {
        messageInsertCount += 1
        if (messageInsertCount === 1) {
          return { rows: [{ id: NEW_ROOT_MESSAGE_ID }] } as never
        }
        return { rows: [{ id: NEW_CHILD_MESSAGE_ID }] } as never
      }
      if (sql.includes('SELECT id, title, author_user_id, root_node_id, created_at, updated_at')) {
        return {
          rows: [
            {
              id: NEW_WORKSPACE_ID,
              title: 'Imported Workspace',
              author_user_id: TARGET_AUTHOR_ID,
              root_node_id: NEW_ROOT_NODE_ID,
              created_at: '2026-03-21T00:00:00.000Z',
              updated_at: '2026-03-21T00:00:00.000Z',
            },
          ],
        } as never
      }

      throw new Error(`Unexpected SQL in test: ${sql}`)
    })

    const mockClient = {
      query: clientQueryMock,
      release: jest.fn(),
    }
    getClientMock.mockResolvedValue(mockClient as never)

    const payload = makePayload()
    const result = await createWorkspaceFromRestoredData({
      restoredData: payload,
      targetAuthorUserId: TARGET_AUTHOR_ID,
      workspaceTitle: 'Imported Workspace',
    })

    expect(result.workspace.id).toBe(NEW_WORKSPACE_ID)
    expect(result.sourceToPersistedNodeId[SOURCE_ROOT_NODE_ID]).toBe(NEW_ROOT_NODE_ID)
    expect(result.sourceToPersistedNodeId[SOURCE_CHILD_NODE_ID]).toBe(NEW_CHILD_NODE_ID)
    expect(result.sourceToPersistedMessageId[SOURCE_ROOT_MESSAGE_ID]).toBe(NEW_ROOT_MESSAGE_ID)
    expect(result.sourceToPersistedMessageId[SOURCE_CHILD_MESSAGE_ID]).toBe(NEW_CHILD_MESSAGE_ID)

    const messageCalls = clientQueryMock.mock.calls.filter(([sql]) =>
      (sql as string).includes('INSERT INTO messages'),
    )
    expect(messageCalls).toHaveLength(2)
    expect(messageCalls[0][1]?.[0]).toBe(NEW_ROOT_NODE_ID)
    expect(messageCalls[1][1]?.[0]).toBe(NEW_CHILD_NODE_ID)
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })
})
