import { describe, expect, jest, test } from '@jest/globals'
import { appRouter, type AppRouterContext } from '../index'

const fixedNow = '2026-03-17T00:00:00.000Z'

const makeContext = (): AppRouterContext => {
  const user = {
    id: 'u1',
    authUserId: 'auth-u1',
    email: 'u1@example.com',
    displayName: 'User One',
    creditBalance: 100,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  }

  const annotation = {
    id: 'a1',
    messageId: '11111111-1111-4111-8111-111111111111',
    leadsToNodeId: 'n-child-1',
    kind: 'branch' as const,
    quote: 'hello',
    startOffset: 0,
    endOffset: 5,
    selectorJson: {
      selector: [
        {
          quote: 'hello',
          start: 0,
          end: 5,
        },
      ],
    },
    createdByUserId: user.id,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    deletedAt: null,
  }

  return {
    sessionUserId: 'u1',
    listUsers: jest.fn(async () => [user]),
    getUserById: jest.fn(async (id: string) => (id === user.id ? user : null)),
    listWorkspaces: jest.fn(async () => []),
    getWorkspaceById: jest.fn(async () => null),
    createWorkspace: jest.fn(async () => {
      throw new Error('Not implemented in annotation test context')
    }),
    updateWorkspace: jest.fn(async () => null),
    deleteWorkspace: jest.fn(async () => null),
    listNodesByWorkspace: jest.fn(async () => []),
    getNodeById: jest.fn(async () => null),
    createNode: jest.fn(async () => {
      throw new Error('Not implemented in annotation test context')
    }),
    updateNode: jest.fn(async () => null),
    deleteNode: jest.fn(async () => null),
    listMessagesForNode: jest.fn(async () => []),
    createMessage: jest.fn(async () => {
      throw new Error('Not implemented in annotation test context')
    }),
    updateMessage: jest.fn(async () => null),
    deleteMessage: jest.fn(async () => null),
    listMessageAnnotationsByMessage: jest.fn(async () => [annotation]),
    messageSuggestFromSelection: jest.fn(async () => ({
      ...annotation,
      id: 'a2',
      kind: 'suggestion' as const,
      leadsToNodeId: null,
    })),
    messageAnnotationDelete: jest.fn(async () => ({
      annotationId: annotation.id,
      deletedBranchNodeId: annotation.leadsToNodeId,
      deletedNodeCount: 1,
      deletedMessageCount: 0,
    })),
    messageBranchFromSelection: jest.fn(async () => ({
      annotation,
      branchNodeId: 'n-child-1',
    })),
    branchAndSendFollowup: jest.fn(async () => {
      throw new Error('Not implemented in annotation test context')
    }),
    conversationSend: jest.fn(async () => {
      throw new Error('Not implemented in annotation test context')
    }),
  }
}

describe('appRouter annotation routes', () => {
  test('annotation procedures require authenticated context', async () => {
    const caller = appRouter.createCaller({
      ...makeContext(),
      sessionUserId: null,
    })

    await expect(
      caller.messageAnnotationsByMessage({
        messageId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow('Authentication required.')
    await expect(
      caller.messageBranchFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        newNodeMeta: {
          type: 'question',
        },
        idempotencyKey: 'branch-idem-1',
      }),
    ).rejects.toThrow('Authentication required.')
    await expect(
      caller.messageSuggestFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'suggest-idem-1',
      }),
    ).rejects.toThrow('Authentication required.')
    await expect(
      caller.messageAnnotationDelete({
        annotationId: 'a1',
      }),
    ).rejects.toThrow('Authentication required.')
  })

  test('annotation procedures delegate to context', async () => {
    const ctx = makeContext()
    const caller = appRouter.createCaller(ctx)
    const listInput = { messageId: '11111111-1111-4111-8111-111111111111' }
    const suggestInput = {
      messageId: '11111111-1111-4111-8111-111111111111',
      selection: {
        quote: 'hello',
        selectorJson: {
          selector: [
            {
              quote: 'hello',
              start: 0,
              end: 5,
            },
          ],
        },
      },
      idempotencyKey: 'suggest-idem-1',
    }
    const deleteInput = { annotationId: 'a1' }
    const branchInput = {
      messageId: '11111111-1111-4111-8111-111111111111',
      selection: {
        quote: 'hello',
        selectorJson: {
          selector: [
            {
              quote: 'hello',
              start: 0,
              end: 5,
            },
          ],
        },
        startOffset: 0,
        endOffset: 5,
      },
      newNodeMeta: {
        title: 'Branch node title',
        summary: 'Branch summary',
        type: 'question' as const,
      },
      idempotencyKey: 'branch-idem-1',
    }

    const listResult = await caller.messageAnnotationsByMessage(listInput)
    const suggestResult = await caller.messageSuggestFromSelection(suggestInput)
    const deleteResult = await caller.messageAnnotationDelete(deleteInput)
    const branchResult = await caller.messageBranchFromSelection(branchInput)

    expect(ctx.listMessageAnnotationsByMessage).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
    expect(ctx.messageSuggestFromSelection).toHaveBeenCalledWith(suggestInput)
    expect(ctx.messageAnnotationDelete).toHaveBeenCalledWith(deleteInput)
    expect(ctx.messageBranchFromSelection).toHaveBeenCalledTimes(1)
    const messageBranchFromSelectionCalls = (ctx.messageBranchFromSelection as jest.Mock).mock
      .calls
    expect(messageBranchFromSelectionCalls[0]?.[0]).toEqual(branchInput)
    expect(listResult[0]?.id).toBe('a1')
    expect(suggestResult.kind).toBe('suggestion')
    expect(deleteResult.annotationId).toBe('a1')
    expect(branchResult.annotation.id).toBe('a1')
    expect(branchResult.branchNodeId).toBe('n-child-1')
  })

  test('messageBranchFromSelection validates input', async () => {
    const caller = appRouter.createCaller(makeContext())

    await expect(
      caller.messageSuggestFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: '   ',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'suggest-idem-1',
      }),
    ).rejects.toThrow()

    await expect(
      caller.messageSuggestFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: '',
      } as never),
    ).rejects.toThrow()

    await expect(
      caller.messageAnnotationDelete({
        annotationId: '',
      } as never),
    ).rejects.toThrow()

    await expect(
      caller.messageBranchFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: '   ',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: 'branch-idem-1',
      }),
    ).rejects.toThrow()

    await expect(
      caller.messageBranchFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        idempotencyKey: '',
      } as never),
    ).rejects.toThrow()

    await expect(
      caller.messageBranchFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        newNodeMeta: {
          title: '',
        },
        idempotencyKey: 'branch-idem-1',
      }),
    ).rejects.toThrow()

    await expect(
      caller.messageBranchFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: 'hello',
          selectorJson: 42,
        },
        idempotencyKey: 'branch-idem-1',
      } as never),
    ).rejects.toThrow()

    await expect(
      caller.messageBranchFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [
              {
                start: Number.POSITIVE_INFINITY,
                quote: 'hello',
                end: 5,
              },
            ],
          },
        },
        idempotencyKey: 'branch-idem-1',
      } as never),
    ).rejects.toThrow()

    await expect(
      caller.messageBranchFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 4, end: 4 }],
          },
        },
        idempotencyKey: 'branch-idem-1',
      } as never),
    ).rejects.toThrow()

    await expect(
      caller.messageBranchFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [],
          },
        },
        idempotencyKey: 'branch-idem-1',
      } as never),
    ).rejects.toThrow()

    await expect(
      caller.messageBranchFromSelection({
        messageId: '11111111-1111-4111-8111-111111111111',
        selection: {
          quote: 'hello',
          selectorJson: {
            selector: [{ quote: 'hello', start: 0, end: 5 }],
          },
        },
        annotationKind: 'suggestion-branch',
        idempotencyKey: 'branch-idem-1',
      } as never),
    ).rejects.toThrow()
  })
})
