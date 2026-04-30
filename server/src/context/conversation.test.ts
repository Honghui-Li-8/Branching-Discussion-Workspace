import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { runConversationTurnFlow } from '../chat/runConversationTurnFlow.js'
import { getNodeByIdForAuthor } from '../db/index.js'
import { createConversationHandlers } from './conversation'

jest.mock('../db/index.js', () => ({
  getNodeByIdForAuthor: jest.fn(),
}))
jest.mock('../db/queries/node.js', () => ({
  nodeExists: jest.fn(async () => true),
}))
jest.mock('../chat/runConversationTurnFlow.js', () => ({
  runConversationTurnFlow: jest.fn(),
}))

const getNodeByIdForAuthorMock = getNodeByIdForAuthor as jest.MockedFunction<
  typeof getNodeByIdForAuthor
>
const runConversationTurnFlowMock = runConversationTurnFlow as jest.MockedFunction<
  typeof runConversationTurnFlow
>

const node = {
  id: 'node-1',
  workspaceId: 'workspace-1',
  authorUserId: 'user-1',
  parentNodeId: 'node-parent',
  depth: 1,
  type: 'question' as const,
  title: 'Branch',
  status: 'open' as const,
  confidence: 'medium' as const,
  summary: 'summary',
  conclusion: null,
  rationale: null,
  createdAt: '2026-04-26T00:00:00.000Z',
  updatedAt: '2026-04-26T00:00:00.000Z',
}

const input = {
  nodeId: 'node-1',
  text: 'hello',
  model: 'gpt-5',
  idempotencyKey: 'idem-1',
}

const createHandlers = () =>
  createConversationHandlers({
    requireSessionUserId: () => 'user-1',
    resolveOwnedRecordOrNotFound: async (record) => {
      if (!record) {
        throw new Error('not found')
      }
      return record
    },
  })

describe('createConversationHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getNodeByIdForAuthorMock.mockResolvedValue(node)
    runConversationTurnFlowMock.mockResolvedValue({
      turnId: 'turn-1',
      status: 'processing',
      userMessage: {
        id: 'message-1',
        nodeId: 'node-1',
        authorUserId: 'user-1',
        turnId: 'turn-1',
        role: 'user',
        content: 'hello',
        metadata: {},
        createdAt: '2026-04-26T00:00:00.000Z',
      },
      assistantMessage: null,
      error: null,
    })
  })

  test('rejects conversationSend on merged nodes', async () => {
    getNodeByIdForAuthorMock.mockResolvedValueOnce({
      ...node,
      status: 'merged',
    })

    await expect(createHandlers().conversationSend(input)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'NODE_IS_MERGED',
    })
    expect(runConversationTurnFlowMock).not.toHaveBeenCalled()
  })

  test('preserves conversationSend for open nodes', async () => {
    await createHandlers().conversationSend(input)

    expect(runConversationTurnFlowMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
      awaitCompletion: false,
    })
  })
})
