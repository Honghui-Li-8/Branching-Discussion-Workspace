import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { getNodeByIdForAuthor } from '../db/queries/node.js'
import { recoverIdempotentConversationTurnReplay } from './recoverIdempotentConversationTurnReplay.js'
import { resolveConversationTurnOrThrow } from './resolveConversationTurnOrThrow.js'
import { runConversationTurnPreflight } from './turnFlowPreflight.js'

jest.mock('../db/queries/node.js', () => ({
  getNodeByIdForAuthor: jest.fn(),
}))
jest.mock('./config.js', () => ({
  validateAllowedModelOrThrow: jest.fn(),
  validateProviderRuntimeConfigOrThrow: jest.fn(),
}))
jest.mock('./enqueuePostprocessJobsForTurn.js', () => ({
  enqueuePostprocessJobsForTurn: jest.fn(),
}))
jest.mock('./resolveConversationTurnOrThrow.js', () => ({
  resolveConversationTurnOrThrow: jest.fn(),
}))
jest.mock('./recoverIdempotentConversationTurnReplay.js', () => ({
  recoverIdempotentConversationTurnReplay: jest.fn(),
}))

const getNodeByIdForAuthorMock = getNodeByIdForAuthor as jest.MockedFunction<
  typeof getNodeByIdForAuthor
>
const resolveConversationTurnOrThrowMock =
  resolveConversationTurnOrThrow as jest.MockedFunction<typeof resolveConversationTurnOrThrow>
const recoverIdempotentConversationTurnReplayMock =
  recoverIdempotentConversationTurnReplay as jest.MockedFunction<
    typeof recoverIdempotentConversationTurnReplay
  >

const input = {
  nodeId: 'node-1',
  text: 'hello',
  model: 'gpt-5',
  idempotencyKey: 'idem-1',
}

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

const resolvedTurn = {
  turn: {
    id: 'turn-1',
    nodeId: 'node-1',
    authorUserId: 'user-1',
    status: 'processing' as const,
    model: 'gpt-5',
    idempotencyKey: 'idem-1',
    error: null,
    completedAt: null,
    metadata: {},
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
  },
  wasCreated: true as const,
}

describe('runConversationTurnPreflight', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getNodeByIdForAuthorMock.mockResolvedValue(node)
    resolveConversationTurnOrThrowMock.mockResolvedValue(resolvedTurn)
    recoverIdempotentConversationTurnReplayMock.mockResolvedValue(null)
  })

  test('rejects merged nodes before resolving a turn', async () => {
    getNodeByIdForAuthorMock.mockResolvedValueOnce({
      ...node,
      status: 'merged',
    })

    await expect(
      runConversationTurnPreflight({
        input,
        currentUserId: 'user-1',
        requestStartedAtMs: 1,
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'NODE_IS_MERGED',
    })

    expect(resolveConversationTurnOrThrowMock).not.toHaveBeenCalled()
    expect(recoverIdempotentConversationTurnReplayMock).not.toHaveBeenCalled()
  })

  test('preserves normal preflight behavior for open nodes', async () => {
    const result = await runConversationTurnPreflight({
      input,
      currentUserId: 'user-1',
      requestStartedAtMs: 1,
    })

    expect(result).toEqual({
      resolvedTurn,
      idempotentReplay: null,
    })
    expect(resolveConversationTurnOrThrowMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
    })
  })
})
