import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { runConversationTurnFlow } from './runConversationTurnFlow.js'
import {
  buildConversationTurnFlowContext,
  runTurnFlowPreflight,
  scheduleInputClassificationTask,
} from './turnFlowPreflight.js'
import { buildTurnFlowRuntime } from './turnFlowRuntime.js'
import {
  persistUserMessageOrHandleFailure,
  runTurnPipeline,
} from './turnExecutionPipeline.js'

jest.mock('./turnFlowPreflight.js', () => ({
  buildConversationTurnFlowContext: jest.fn(),
  runTurnFlowPreflight: jest.fn(),
  scheduleInputClassificationTask: jest.fn(),
}))
jest.mock('./turnFlowRuntime.js', () => ({
  buildTurnFlowRuntime: jest.fn(),
}))
jest.mock('./turnExecutionPipeline.js', () => ({
  persistUserMessageOrHandleFailure: jest.fn(),
  runTurnPipeline: jest.fn(),
}))

const buildConversationTurnFlowContextMock =
  buildConversationTurnFlowContext as jest.MockedFunction<
    typeof buildConversationTurnFlowContext
  >
const runTurnFlowPreflightMock = runTurnFlowPreflight as jest.MockedFunction<
  typeof runTurnFlowPreflight
>
const scheduleInputClassificationTaskMock =
  scheduleInputClassificationTask as jest.MockedFunction<
    typeof scheduleInputClassificationTask
  >
const buildTurnFlowRuntimeMock = buildTurnFlowRuntime as jest.MockedFunction<
  typeof buildTurnFlowRuntime
>
const persistUserMessageOrHandleFailureMock =
  persistUserMessageOrHandleFailure as jest.MockedFunction<
    typeof persistUserMessageOrHandleFailure
  >
const runTurnPipelineMock = runTurnPipeline as jest.MockedFunction<
  typeof runTurnPipeline
>

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
  turn: resolvedTurnResult.turn,
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

    buildConversationTurnFlowContextMock.mockReturnValue(flowContext)
    runTurnFlowPreflightMock.mockResolvedValue({
      resolvedTurnResult,
      replayResult: null,
    } as any)
    buildTurnFlowRuntimeMock.mockResolvedValue({
      runtime,
      markTurnFailedOnce,
      handleFailure,
    } as any)
    persistUserMessageOrHandleFailureMock.mockResolvedValue(userMessage as any)
    runTurnPipelineMock.mockResolvedValue(completedResult as any)
  })

  test('returns replay result and skips runtime/pipeline when preflight resolves replay', async () => {
    const replayResult = {
      ...completedResult,
      status: 'processing' as const,
      assistantMessage: null,
    }
    runTurnFlowPreflightMock.mockResolvedValueOnce({
      resolvedTurnResult,
      replayResult,
    } as any)

    const result = await runConversationTurnFlow({
      input,
      currentUserId: 'user-1',
    })

    expect(buildConversationTurnFlowContextMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
    })
    expect(runTurnFlowPreflightMock).toHaveBeenCalledWith({
      input,
      currentUserId: 'user-1',
      requestStartedAtMs: expect.any(Number),
    })
    expect(scheduleInputClassificationTaskMock).not.toHaveBeenCalled()
    expect(buildTurnFlowRuntimeMock).not.toHaveBeenCalled()
    expect(result).toEqual(replayResult)
  })

  test('returns processing by default and runs pipeline in background', async () => {
    let releasePipeline = () => {}
    const pipelineGate = new Promise<void>((resolve) => {
      releasePipeline = resolve
    })
    runTurnPipelineMock.mockImplementationOnce(async () => {
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
      resolvedTurn: resolvedTurnResult,
      requestStartedAtMs: expect.any(Number),
    })
    expect(persistUserMessageOrHandleFailureMock).toHaveBeenCalledWith({
      runtime,
      markTurnFailedOnce,
      handleFailure,
    })
    expect(runTurnPipelineMock).toHaveBeenCalledWith({
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

    expect(runTurnPipelineMock).toHaveBeenCalledWith({
      runtime,
      userMessage,
      markTurnFailedOnce,
      handleFailure,
    })
    expect(result).toEqual(completedResult)
  })
})
