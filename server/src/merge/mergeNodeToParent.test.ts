import { describe, expect, jest, test } from '@jest/globals'
import { TRPCError } from '@trpc/server'
import { createMergeNodeToParentService } from './mergeNodeToParent'
import type { MessageRecord, NodeRecord } from '../db/models/index.js'
import type { BranchEventMetadata, MergeProposalMetadata } from '@branching/shared'
import { STRUCTURAL_MESSAGE_TYPES } from '@branching/shared'

const fixedNow = '2026-04-26T00:00:00.000Z'

const branchNode: NodeRecord = {
  id: 'node-child',
  workspaceId: 'workspace-1',
  authorUserId: 'user-1',
  parentNodeId: 'node-parent',
  depth: 1,
  type: 'question',
  title: 'Realtime API choice',
  status: 'open',
  confidence: 'medium',
  summary: 'Compared websocket and GraphQL options.',
  conclusion: null,
  rationale: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
}

const pendingMetadata: MergeProposalMetadata = {
  eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
  proposalId: 'proposal-1',
  proposedConclusion: 'Use GraphQL subscriptions.',
  mergeStatus: 'pending',
  revisionRound: 1,
}

const pendingProposal: MessageRecord = {
  id: 'message-proposal',
  authorUserId: 'user-1',
  nodeId: 'node-child',
  turnId: null,
  role: 'assistant',
  content: 'Use GraphQL subscriptions.',
  metadata: pendingMetadata,
  createdAt: fixedNow,
}

const branchOriginMetadata: BranchEventMetadata = {
  eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
  sourceNodeId: 'node-parent',
  sourceMessageId: 'message-source',
  sourceAnnotationId: 'annotation-1',
  sourceContext: 'Original parent message.',
  branchNodeId: 'node-child',
}

const messageRow = (message: MessageRecord) => ({
  id: message.id,
  node_id: message.nodeId,
  author_user_id: message.authorUserId,
  turn_id: message.turnId,
  role: message.role,
  content: message.content,
  metadata: message.metadata,
  created_at: message.createdAt,
})

const nodeRow = (node: NodeRecord) => ({
  id: node.id,
  workspace_id: node.workspaceId,
  author_user_id: node.authorUserId,
  parent_node_id: node.parentNodeId,
  depth: node.depth,
  type: node.type,
  title: node.title,
  status: node.status,
  confidence: node.confidence,
  summary: node.summary,
  conclusion: node.conclusion,
  rationale: node.rationale,
  created_at: node.createdAt,
  updated_at: node.updatedAt,
})

const createBaseDeps = () => ({
  getNodeByIdForAuthor: jest.fn(async () => branchNode),
  listMessagesForNodeForAuthor: jest.fn(async () => []),
  createPendingMergeProposalMessageForAuthorIdempotent: jest.fn(async () => pendingProposal),
  getPendingMergeProposalForAuthor: jest.fn(async () => null),
  getMergeProposalMessageForNodeForAuthor: jest.fn(async () => pendingProposal),
  getBranchOriginMetadataForNodeForAuthor: jest.fn(async () => branchOriginMetadata),
  selectProvider: jest.fn(() => ({
    id: 'test-provider',
    generate: jest.fn(async () => ({
      content: '{ "conclusion": "Use GraphQL subscriptions." }',
      finishReason: 'stop' as const,
      providerResponseId: null,
    })),
  })),
  getClient: jest.fn(async () => ({ query: jest.fn(), release: jest.fn() })),
  now: () => new Date(fixedNow),
  createProposalId: () => 'proposal-next',
  mergeModel: 'test-model',
}) as any

const rootNode: NodeRecord = { ...branchNode, id: 'node-root', parentNodeId: 'node-root' }
const mergedNode: NodeRecord = { ...branchNode, status: 'merged' }

describe('mergeNodeToParent service', () => {
  test('initiateNodeMerge rejects root node with INVALID_PROPOSAL', async () => {
    const deps = createBaseDeps()
    deps.getNodeByIdForAuthor.mockResolvedValueOnce(rootNode)
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.initiateNodeMerge({ input: { nodeId: 'node-root' }, currentUserId: 'user-1' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'INVALID_PROPOSAL' })
  })

  test('initiateNodeMerge rejects already-merged node with NODE_IS_MERGED', async () => {
    const deps = createBaseDeps()
    deps.getNodeByIdForAuthor.mockResolvedValueOnce(mergedNode)
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.initiateNodeMerge({ input: { nodeId: 'node-child' }, currentUserId: 'user-1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'NODE_IS_MERGED' })
  })

  test('initiateNodeMerge returns existing pending proposal on retry', async () => {
    const deps = createBaseDeps()
    deps.getPendingMergeProposalForAuthor.mockResolvedValueOnce(pendingProposal)
    const service = createMergeNodeToParentService(deps)

    const result = await service.initiateNodeMerge({
      input: { nodeId: 'node-child' },
      currentUserId: 'user-1',
    })

    expect(result).toEqual({
      proposalMessageId: 'message-proposal',
      proposedConclusion: 'Use GraphQL subscriptions.',
    })
    expect(deps.selectProvider).not.toHaveBeenCalled()
    expect(deps.createPendingMergeProposalMessageForAuthorIdempotent).not.toHaveBeenCalled()
  })

  test('initiateNodeMerge excludes merge proposals from AI context and creates pending proposal', async () => {
    const deps = createBaseDeps()
    const normalMessage: MessageRecord = {
      ...pendingProposal,
      id: 'message-normal',
      role: 'user',
      content: 'We need realtime updates.',
      metadata: {},
    }
    deps.listMessagesForNodeForAuthor.mockResolvedValueOnce([normalMessage, pendingProposal])
    const service = createMergeNodeToParentService(deps)

    await service.initiateNodeMerge({
      input: { nodeId: 'node-child' },
      currentUserId: 'user-1',
    })

    const provider = deps.selectProvider.mock.results[0]?.value as any
    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.objectContaining({
          conversation: [normalMessage],
        }),
      }),
    )
    expect(deps.createPendingMergeProposalMessageForAuthorIdempotent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
          mergeStatus: 'pending',
          proposedConclusion: 'Use GraphQL subscriptions.',
        }),
      }),
    )
  })

  test('reviseMergeProposal rejects empty edit before opening transaction', async () => {
    const deps = createBaseDeps()
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.reviseMergeProposal({
        input: {
          nodeId: 'node-child',
          proposalMessageId: 'message-proposal',
          revision: { mode: 'edit', editedText: '   ' },
        },
        currentUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'EMPTY_MERGE_CONCLUSION',
    })
    expect(deps.getClient).not.toHaveBeenCalled()
  })

  test('reviseMergeProposal supersedes and creates a proposal in one transaction', async () => {
    const deps = createBaseDeps()
    const nextProposal: MessageRecord = {
      ...pendingProposal,
      id: 'message-proposal-2',
      content: 'Use GraphQL subscriptions with a fallback.',
      metadata: {
        ...pendingMetadata,
        proposalId: 'proposal-next',
        proposedConclusion: 'Use GraphQL subscriptions with a fallback.',
        revisionRound: 2,
      },
    }
    const query = jest.fn(async (..._args: unknown[]) => ({ rows: [] as unknown[] }))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [messageRow(pendingProposal)] })
      .mockResolvedValueOnce({
        rows: [messageRow({
          ...pendingProposal,
          metadata: { ...pendingMetadata, mergeStatus: 'superseded' },
        })],
      })
      .mockResolvedValueOnce({ rows: [messageRow(nextProposal)] })
      .mockResolvedValueOnce({ rows: [] })
    deps.getClient.mockResolvedValueOnce({ query, release: jest.fn() })
    const service = createMergeNodeToParentService(deps)

    const result = await service.reviseMergeProposal({
      input: {
        nodeId: 'node-child',
        proposalMessageId: 'message-proposal',
        revision: {
          mode: 'edit',
          editedText: 'Use GraphQL subscriptions with a fallback.',
        },
      },
      currentUserId: 'user-1',
    })

    expect(result).toEqual({
      proposalMessageId: 'message-proposal-2',
      proposedConclusion: 'Use GraphQL subscriptions with a fallback.',
    })
    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(query.mock.calls[1]?.[0]).toContain('FOR UPDATE OF m')
    expect(query).toHaveBeenLastCalledWith('COMMIT')
  })

  test('reviseMergeProposal rejects malformed AI output before opening transaction', async () => {
    const deps = createBaseDeps()
    deps.selectProvider.mockReturnValueOnce({
      id: 'test-provider',
      generate: jest.fn(async () => ({
        content: 'Here is a conclusion: Use GraphQL.',
        finishReason: 'stop' as const,
        providerResponseId: null,
      })),
    })
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.reviseMergeProposal({
        input: {
          nodeId: 'node-child',
          proposalMessageId: 'message-proposal',
          revision: { mode: 'reject', revisionInstruction: 'Try again.' },
        },
        currentUserId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(TRPCError)
    expect(deps.getClient).not.toHaveBeenCalled()
  })

  test('reviseMergeProposal reject mode runs AI and creates new proposal', async () => {
    const deps = createBaseDeps()
    const revisedProposal: MessageRecord = {
      ...pendingProposal,
      id: 'message-proposal-rejected',
      content: 'Use REST with server-sent events.',
      metadata: {
        ...pendingMetadata,
        proposalId: 'proposal-next',
        proposedConclusion: 'Use REST with server-sent events.',
        revisionRound: 2,
      },
    }
    deps.selectProvider.mockReturnValueOnce({
      id: 'test-provider',
      generate: jest.fn(async () => ({
        content: '{ "conclusion": "Use REST with server-sent events." }',
        finishReason: 'stop' as const,
        providerResponseId: null,
      })),
    })
    const query = jest.fn(async (..._args: unknown[]) => ({ rows: [] as unknown[] }))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [messageRow(pendingProposal)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [messageRow(revisedProposal)] })
      .mockResolvedValueOnce({ rows: [] })
    deps.getClient.mockResolvedValueOnce({ query, release: jest.fn() })
    const service = createMergeNodeToParentService(deps)

    const result = await service.reviseMergeProposal({
      input: {
        nodeId: 'node-child',
        proposalMessageId: 'message-proposal',
        revision: { mode: 'reject', revisionInstruction: 'Be more specific.' },
      },
      currentUserId: 'user-1',
    })

    expect(result).toEqual({
      proposalMessageId: 'message-proposal-rejected',
      proposedConclusion: 'Use REST with server-sent events.',
    })
    expect(deps.selectProvider).toHaveBeenCalled()
    expect(query).toHaveBeenLastCalledWith('COMMIT')
  })

  test('reviseMergeProposal throws INVALID_PROPOSAL when locked proposal is no longer pending', async () => {
    const deps = createBaseDeps()
    const supersededProposal: MessageRecord = {
      ...pendingProposal,
      metadata: { ...pendingMetadata, mergeStatus: 'superseded' as const },
    }
    const query = jest.fn(async (..._args: unknown[]) => ({ rows: [] as unknown[] }))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [messageRow(supersededProposal)] })
      .mockResolvedValueOnce({ rows: [] })
    deps.getClient.mockResolvedValueOnce({ query, release: jest.fn() })
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.reviseMergeProposal({
        input: {
          nodeId: 'node-child',
          proposalMessageId: 'message-proposal',
          revision: { mode: 'edit', editedText: 'Updated conclusion.' },
        },
        currentUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'INVALID_PROPOSAL' })
    expect(query).toHaveBeenLastCalledWith('ROLLBACK')
  })

  test('cancelMerge cancels only the pending proposal', async () => {
    const deps = createBaseDeps()
    const query = jest.fn(async (..._args: unknown[]) => ({ rows: [] as unknown[] }))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [messageRow(pendingProposal)] })
      .mockResolvedValueOnce({
        rows: [messageRow({
          ...pendingProposal,
          metadata: { ...pendingMetadata, mergeStatus: 'cancelled' },
        })],
      })
      .mockResolvedValueOnce({ rows: [] })
    deps.getClient.mockResolvedValueOnce({ query, release: jest.fn() })
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.cancelMerge({
        input: { nodeId: 'node-child' },
        currentUserId: 'user-1',
      }),
    ).resolves.toEqual({ cancelledCount: 1 })
    expect(query.mock.calls[1]?.[0]).toContain("(m.metadata->>'mergeStatus') = 'pending'")
    expect(query).toHaveBeenLastCalledWith('COMMIT')
  })

  test('cancelMerge returns cancelledCount 0 when no pending proposal exists', async () => {
    const deps = createBaseDeps()
    const query = jest.fn(async (..._args: unknown[]) => ({ rows: [] as unknown[] }))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    deps.getClient.mockResolvedValueOnce({ query, release: jest.fn() })
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.cancelMerge({ input: { nodeId: 'node-child' }, currentUserId: 'user-1' }),
    ).resolves.toEqual({ cancelledCount: 0 })
  })

  test('cancelMerge rejects root node with INVALID_PROPOSAL', async () => {
    const deps = createBaseDeps()
    deps.getNodeByIdForAuthor.mockResolvedValueOnce(rootNode)
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.cancelMerge({ input: { nodeId: 'node-root' }, currentUserId: 'user-1' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'INVALID_PROPOSAL' })
  })

  test('cancelMerge rejects already-merged node with NODE_IS_MERGED', async () => {
    const deps = createBaseDeps()
    deps.getNodeByIdForAuthor.mockResolvedValueOnce(mergedNode)
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.cancelMerge({ input: { nodeId: 'node-child' }, currentUserId: 'user-1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'NODE_IS_MERGED' })
  })

  test('approveMerge rejects root node with INVALID_PROPOSAL', async () => {
    const deps = createBaseDeps()
    deps.getNodeByIdForAuthor.mockResolvedValueOnce(rootNode)
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.approveMerge({
        input: { nodeId: 'node-root', proposalMessageId: 'message-proposal' },
        currentUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'INVALID_PROPOSAL' })
  })

  test('approveMerge rejects already-merged node with NODE_IS_MERGED', async () => {
    const deps = createBaseDeps()
    deps.getNodeByIdForAuthor.mockResolvedValueOnce(mergedNode)
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.approveMerge({
        input: { nodeId: 'node-child', proposalMessageId: 'message-proposal' },
        currentUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'NODE_IS_MERGED' })
  })

  test('approveMerge throws INVALID_PROPOSAL when branch origin is missing', async () => {
    const deps = createBaseDeps()
    deps.getBranchOriginMetadataForNodeForAuthor.mockResolvedValueOnce(null)
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.approveMerge({
        input: { nodeId: 'node-child', proposalMessageId: 'message-proposal' },
        currentUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'INVALID_PROPOSAL' })
    expect(deps.getClient).not.toHaveBeenCalled()
  })

  test('approveMerge throws INVALID_PROPOSAL when locked proposal is no longer pending', async () => {
    const deps = createBaseDeps()
    const approvedProposal: MessageRecord = {
      ...pendingProposal,
      metadata: { ...pendingMetadata, mergeStatus: 'approved' as const },
    }
    const query = jest.fn(async (..._args: unknown[]) => ({ rows: [] as unknown[] }))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [messageRow(approvedProposal)] })
      .mockResolvedValueOnce({ rows: [] })
    deps.getClient.mockResolvedValueOnce({ query, release: jest.fn() })
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.approveMerge({
        input: { nodeId: 'node-child', proposalMessageId: 'message-proposal' },
        currentUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'INVALID_PROPOSAL' })
    expect(query).toHaveBeenLastCalledWith('ROLLBACK')
  })

  test('approveMerge marks child merged and creates parent merge event', async () => {
    const deps = createBaseDeps()
    const parentEvent: MessageRecord = {
      ...pendingProposal,
      id: 'message-parent-event',
      nodeId: 'node-parent',
      role: 'user',
      content: 'Merged from "Realtime API choice": Use GraphQL subscriptions.',
      metadata: {
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeEvent,
        sourceNodeId: 'node-child',
        sourceBranchTitle: 'Realtime API choice',
        sourceBranchOriginMessageId: 'message-source',
        conclusion: 'Use GraphQL subscriptions.',
        mergedAt: fixedNow,
      },
    }
    const query = jest.fn(async (..._args: unknown[]) => ({ rows: [] as unknown[] }))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [messageRow(pendingProposal)] })
      .mockResolvedValueOnce({
        rows: [messageRow({
          ...pendingProposal,
          metadata: { ...pendingMetadata, mergeStatus: 'approved' },
        })],
      })
      .mockResolvedValueOnce({
        rows: [nodeRow({
          ...branchNode,
          status: 'merged',
          conclusion: 'Use GraphQL subscriptions.',
        })],
      })
      .mockResolvedValueOnce({ rows: [messageRow(parentEvent)] })
      .mockResolvedValueOnce({ rows: [] })
    deps.getClient.mockResolvedValueOnce({ query, release: jest.fn() })
    const service = createMergeNodeToParentService(deps)

    await expect(
      service.approveMerge({
        input: {
          nodeId: 'node-child',
          proposalMessageId: 'message-proposal',
        },
        currentUserId: 'user-1',
      }),
    ).resolves.toEqual({ parentMessageId: 'message-parent-event' })
    expect(query.mock.calls[3]?.[0]).toContain("status = 'merged'")
    expect(query.mock.calls[4]?.[1]).toEqual([
      'node-parent',
      'user-1',
      expect.stringContaining('message-source'),
      expect.stringContaining('"sourceBranchOriginMessageId":"message-source"'),
    ])
    expect(query).toHaveBeenLastCalledWith('COMMIT')
  })
})
