import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { sendConversationTurn } from './sendConversationTurn.js'
import { runConversationTurnFlow } from './runConversationTurnFlow'
import { scheduleInputClassifier } from './flow/inputClassifier.js'

jest.mock('./sendConversationTurn.js', () => ({
  sendConversationTurn: jest.fn(),
}))
jest.mock('./flow/inputClassifier.js', () => ({
  scheduleInputClassifier: jest.fn(),
}))

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

describe('runConversationTurnFlow', () => {
  beforeEach(() => {
    sendConversationTurnMock.mockReset()
    sendConversationTurnMock.mockResolvedValue(flowResult)
    scheduleInputClassifierMock.mockReset()
    scheduleInputClassifierMock.mockResolvedValue({
      intent: 'follow_up_discussion',
      confidence: 0.6,
      matchedSignals: [],
      classifiedAt: '2026-04-10T00:00:00.000Z',
    })
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
    })
  })
})
