import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  validateAllowedModelOrThrow,
  validateProviderRuntimeConfigOrThrow,
} from './config.js'
import { resolveConversationTurnOrThrow } from './resolveConversationTurnOrThrow.js'
import { recoverIdempotentConversationTurnReplay } from './recoverIdempotentConversationTurnReplay.js'
import { enqueuePostprocessJobsForTurn } from './enqueuePostprocessJobsForTurn.js'
import { sendConversationTurn } from './sendConversationTurn.js'
import { runConversationTurnFlow } from './runConversationTurnFlow'
import { scheduleInputClassifier } from './flow/inputClassifier.js'

jest.mock('./config.js', () => ({
  validateAllowedModelOrThrow: jest.fn(),
  validateProviderRuntimeConfigOrThrow: jest.fn(),
}))
jest.mock('./resolveConversationTurnOrThrow.js', () => ({
  resolveConversationTurnOrThrow: jest.fn(),
}))
jest.mock('./recoverIdempotentConversationTurnReplay.js', () => ({
  recoverIdempotentConversationTurnReplay: jest.fn(),
}))
jest.mock('./enqueuePostprocessJobsForTurn.js', () => ({
  enqueuePostprocessJobsForTurn: jest.fn(),
}))
jest.mock('./sendConversationTurn.js', () => ({
  sendConversationTurn: jest.fn(),
}))
jest.mock('./flow/inputClassifier.js', () => ({
  scheduleInputClassifier: jest.fn(),
}))

const validateAllowedModelOrThrowMock = validateAllowedModelOrThrow as jest.MockedFunction<
  typeof validateAllowedModelOrThrow
>
const validateProviderRuntimeConfigOrThrowMock =
  validateProviderRuntimeConfigOrThrow as jest.MockedFunction<
    typeof validateProviderRuntimeConfigOrThrow
  >
const resolveConversationTurnOrThrowMock = resolveConversationTurnOrThrow as jest.MockedFunction<
  typeof resolveConversationTurnOrThrow
>
const recoverIdempotentConversationTurnReplayMock =
  recoverIdempotentConversationTurnReplay as jest.MockedFunction<
    typeof recoverIdempotentConversationTurnReplay
  >
const enqueuePostprocessJobsForTurnMock =
  enqueuePostprocessJobsForTurn as jest.MockedFunction<
    typeof enqueuePostprocessJobsForTurn
  >
const sendConversationTurnMock = sendConversationTurn as jest.MockedFunction<
  typeof sendConversationTurn
>
const scheduleInputClassifierMock = scheduleInputClassifier as jest.MockedFunction<
  typeof scheduleInputClassifier
>

const flowResult = {
  turnId: 'turn-1',
  status: 'processing' as const,
  userMessage: {
    id: 'message-1',
    nodeId: 'node-1',
    turnId: null,
    authorUserId: 'user-1',
    role: 'user' as const,
    content: 'hello',
    metadata: {},
    createdAt: '2026-04-10T00:00:00.000Z',
  },
  assistantMessage: null,
  error: null,
}

const resolvedTurnResult = {
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
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
  wasCreated: true,
}

describe('runConversationTurnFlow', () => {
  beforeEach(() => {
    validateAllowedModelOrThrowMock.mockReset()
    validateProviderRuntimeConfigOrThrowMock.mockReset()
    resolveConversationTurnOrThrowMock.mockReset()
    recoverIdempotentConversationTurnReplayMock.mockReset()
    enqueuePostprocessJobsForTurnMock.mockReset()
    sendConversationTurnMock.mockReset()
    sendConversationTurnMock.mockResolvedValue(flowResult)
    scheduleInputClassifierMock.mockReset()
    scheduleInputClassifierMock.mockResolvedValue({
      intent: 'follow_up_discussion',
      confidence: 0.6,
      matchedSignals: [],
      classifiedAt: '2026-04-10T00:00:00.000Z',
    })
    resolveConversationTurnOrThrowMock.mockResolvedValue(resolvedTurnResult)
    recoverIdempotentConversationTurnReplayMock.mockResolvedValue(null)
  })

  test('delegates params to sendConversationTurn and defaults awaitCompletion to false', async () => {
    const input = {
      nodeId: 'node-1',
      text: 'hello',
      model: 'gpt-5' as const,
      idempotencyKey: 'idem-1',
    }

    const result = await runConversationTurnFlow({
      input,
      currentUserId: 'user-1',
    })

    expect(sendConversationTurnMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
      awaitCompletion: false,
      resolvedTurn: resolvedTurnResult,
      requestStartedAtMs: expect.any(Number),
    })
    expect(validateAllowedModelOrThrowMock).toHaveBeenCalledWith('gpt-5')
    expect(validateProviderRuntimeConfigOrThrowMock).toHaveBeenCalledWith('gpt-5')
    expect(resolveConversationTurnOrThrowMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
    })
    expect(recoverIdempotentConversationTurnReplayMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
      resolvedTurnResult,
      requestStartedAtMs: expect.any(Number),
      enqueuePostprocessJobsForTurn: enqueuePostprocessJobsForTurnMock,
    })
    expect(scheduleInputClassifierMock).toHaveBeenCalledWith({
      input,
    })
    expect(result).toBe(flowResult)
  })

  test('passes explicit awaitCompletion to sendConversationTurn', async () => {
    const input = {
      nodeId: 'node-1',
      text: 'hello',
      model: 'gpt-5' as const,
      idempotencyKey: 'idem-2',
    }

    await runConversationTurnFlow({
      input,
      currentUserId: 'user-1',
      awaitCompletion: true,
    })

    expect(sendConversationTurnMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
      awaitCompletion: true,
      resolvedTurn: resolvedTurnResult,
      requestStartedAtMs: expect.any(Number),
    })
  })

  test('returns replay result without calling sendConversationTurn', async () => {
    const replayResult = {
      ...flowResult,
      status: 'completed' as const,
    }
    recoverIdempotentConversationTurnReplayMock.mockResolvedValueOnce(replayResult)
    const input = {
      nodeId: 'node-1',
      text: 'hello',
      model: 'gpt-5' as const,
      idempotencyKey: 'idem-3',
    }

    const result = await runConversationTurnFlow({
      input,
      currentUserId: 'user-1',
    })

    expect(sendConversationTurnMock).not.toHaveBeenCalled()
    expect(result).toEqual(replayResult)
  })
})
