import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { runConversationTurnFlow } from './runConversationTurnFlow.js'
import {
  buildTurnFlowContext,
  runConversationTurnPreflight,
  scheduleInputClassificationTask,
} from './turnFlowPreflight.js'
import { buildTurnFlowRuntime } from './turnFlowRuntime.js'
import {
  executeTurnPipeline,
  persistUserMessageWithFailureHandling,
} from './turnExecutionPipeline.js'
import { getCreditBalance } from '../db/index.js'

jest.mock('./turnFlowPreflight.js', () => ({
  buildTurnFlowContext: jest.fn(),
  runConversationTurnPreflight: jest.fn(),
  scheduleInputClassificationTask: jest.fn(),
}))
jest.mock('./turnFlowRuntime.js', () => ({
  buildTurnFlowRuntime: jest.fn(),
}))
jest.mock('./turnExecutionPipeline.js', () => ({
  persistUserMessageWithFailureHandling: jest.fn(),
  executeTurnPipeline: jest.fn(),
}))
jest.mock('../db/index.js', () => ({
  getCreditBalance: jest.fn(),
}))

const buildTurnFlowContextMock =
  buildTurnFlowContext as jest.MockedFunction<
    typeof buildTurnFlowContext
  >
const runConversationTurnPreflightMock =
  runConversationTurnPreflight as jest.MockedFunction<
    typeof runConversationTurnPreflight
>
const scheduleInputClassificationTaskMock =
  scheduleInputClassificationTask as jest.MockedFunction<
    typeof scheduleInputClassificationTask
  >
const buildTurnFlowRuntimeMock = buildTurnFlowRuntime as jest.MockedFunction<
  typeof buildTurnFlowRuntime
>
const persistUserMessageWithFailureHandlingMock =
  persistUserMessageWithFailureHandling as jest.MockedFunction<
    typeof persistUserMessageWithFailureHandling
  >
const executeTurnPipelineMock = executeTurnPipeline as jest.MockedFunction<
  typeof executeTurnPipeline
>
const getCreditBalanceMock = getCreditBalance as jest.MockedFunction<typeof getCreditBalance>

const input = {
  nodeId: 'node-1',
  text: 'hello',
  model: 'gpt-5',
  idempotencyKey: 'idem-1',
}

const flowContext = {
  node_id: 'node-1',
  author_user_id: 'user-1',
  model: 'gpt-5',
  idempotency_key: 'idem-1',
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
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
  wasCreated: true as const,
}

const userMessage = {
  id: 'm-user',
  nodeId: 'node-1',
  turnId: 'turn-1',
  authorUserId: 'user-1',
  role: 'user' as const,
  content: 'hello',
  metadata: {},
  createdAt: '2026-04-10T00:00:00.000Z',
}

const completedResult = {
  turnId: 'turn-1',
  status: 'completed' as const,
  userMessage,
  assistantMessage: {
    id: 'm-assistant',
    nodeId: 'node-1',
    turnId: 'turn-1',
    authorUserId: 'user-1',
    role: 'assistant' as const,
    content: 'assistant reply',
    metadata: {},
    createdAt: '2026-04-10T00:00:01.000Z',
  },
  error: null,
}

const runtime = {
  input,
  currentUserId: 'user-1',
  turn: resolvedTurn.turn,
  requestStartedAtMs: 1,
  publishTurnEvent: jest.fn(),
}

const markTurnFailedOnce = jest.fn(async () => undefined)
const handleFailure = jest.fn(async () => {
  throw new Error('handled')
})

describe('runConversationTurnFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getCreditBalanceMock.mockResolvedValue(100_000)
    buildTurnFlowContextMock.mockReturnValue(flowContext)
    runConversationTurnPreflightMock.mockResolvedValue({
      resolvedTurn,
      idempotentReplay: null,
    } as any)
    buildTurnFlowRuntimeMock.mockResolvedValue({
      runtime,
      markTurnFailedOnce,
      handleFailure,
    } as any)
    persistUserMessageWithFailureHandlingMock.mockResolvedValue(userMessage as any)
    executeTurnPipelineMock.mockResolvedValue(completedResult as any)
  })

  test('returns replay result and skips runtime/pipeline when preflight resolves replay', async () => {
    const idempotentReplay = {
      ...completedResult,
      status: 'processing' as const,
      assistantMessage: null,
    }
    runConversationTurnPreflightMock.mockResolvedValueOnce({
      resolvedTurn,
      idempotentReplay,
    } as any)

    const result = await runConversationTurnFlow({
      input,
      currentUserId: 'user-1',
    })

    expect(buildTurnFlowContextMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
    })
    expect(runConversationTurnPreflightMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
      requestStartedAtMs: expect.any(Number),
    })
    expect(scheduleInputClassificationTaskMock).not.toHaveBeenCalled()
    expect(buildTurnFlowRuntimeMock).not.toHaveBeenCalled()
    expect(result).toEqual(idempotentReplay)
  })

  test('returns processing by default and runs pipeline in background', async () => {
    let releasePipeline = () => {}
    const pipelineGate = new Promise<void>((resolve) => {
      releasePipeline = resolve
    })
    executeTurnPipelineMock.mockImplementationOnce(async () => {
      await pipelineGate
      return completedResult as any
    })

    const result = await runConversationTurnFlow({
      input,
      currentUserId: 'user-1',
    })

    expect(scheduleInputClassificationTaskMock).toHaveBeenCalledWith({
      input,
      flowContext,
    })
    expect(buildTurnFlowRuntimeMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
      resolvedTurn,
      requestStartedAtMs: expect.any(Number),
    })
    expect(persistUserMessageWithFailureHandlingMock).toHaveBeenCalledWith({
      runtime,
      markTurnFailedOnce,
      handleFailure,
    })
    expect(executeTurnPipelineMock).toHaveBeenCalledWith({
      runtime,
      userMessage,
      markTurnFailedOnce,
      handleFailure,
    })
    expect(result).toEqual({
      turnId: 'turn-1',
      status: 'processing',
      userMessage,
      assistantMessage: null,
      error: null,
    })

    releasePipeline()
    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
  })

  test('returns pipeline result when awaitCompletion is true', async () => {
    const result = await runConversationTurnFlow({
      input,
      currentUserId: 'user-1',
      awaitCompletion: true,
    })

    expect(executeTurnPipelineMock).toHaveBeenCalledWith({
      runtime,
      userMessage,
      markTurnFailedOnce,
      handleFailure,
    })
    expect(result).toEqual(completedResult)
  })

  test('throws FORBIDDEN when credit balance is zero or negative', async () => {
    getCreditBalanceMock.mockResolvedValueOnce(0)

    await expect(
      runConversationTurnFlow({ input, currentUserId: 'user-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'INSUFFICIENT_CREDITS' })

    expect(runConversationTurnPreflightMock).not.toHaveBeenCalled()
  })
})
