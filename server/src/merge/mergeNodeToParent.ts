import { randomUUID } from 'node:crypto'
import { type AppRouterContext, type MergeProposalMetadata, STRUCTURAL_MESSAGE_TYPES } from '@branching/shared'
import { TRPCError } from '@trpc/server'
import { getClient } from '../db/client.js'
import type { MessageRecord, NodeRecord } from '../db/models/index.js'
import {
  createMergeEventMessageForAuthorInTransaction,
  createMergeProposalMessageForAuthorInTransaction,
  createPendingMergeProposalMessageForAuthorIdempotent,
  getBranchOriginMetadataForNodeForAuthor,
  getMergeProposalMessageForNodeForAuthor,
  getMergeProposalMessageForNodeForAuthorInTransaction,
  getMergeProposalMetadataFromRecord,
  getPendingMergeProposalForAuthor,
  getPendingMergeProposalForAuthorInTransaction,
  listMessagesForNodeForAuthor,
  updateMergeProposalStatusForAuthorInTransaction,
} from '../db/queries/message.js'
import {
  getNodeByIdForAuthor,
  markNodeMergedForAuthorInTransaction,
} from '../db/queries/node.js'
import { selectProvider } from '../chat/providers/selectProvider.js'
import {
  buildInitialMergeConclusionPrompt,
  buildRejectedMergeConclusionPrompt,
  parseMergeConclusionOutput,
} from '../chat/systemPrompts/merge.js'

type InitiateNodeMergeInput = Parameters<AppRouterContext['initiateNodeMerge']>[0]
type InitiateNodeMergeOutput = Awaited<ReturnType<AppRouterContext['initiateNodeMerge']>>
type ReviseMergeProposalInput = Parameters<AppRouterContext['reviseMergeProposal']>[0]
type ReviseMergeProposalOutput = Awaited<ReturnType<AppRouterContext['reviseMergeProposal']>>
type CancelMergeInput = Parameters<AppRouterContext['cancelMerge']>[0]
type CancelMergeOutput = Awaited<ReturnType<AppRouterContext['cancelMerge']>>
type ApproveMergeInput = Parameters<AppRouterContext['approveMerge']>[0]
type ApproveMergeOutput = Awaited<ReturnType<AppRouterContext['approveMerge']>>

type MergeProvider = ReturnType<typeof selectProvider>

type MergeNodeToParentDeps = {
  selectProvider: typeof selectProvider
  getNodeByIdForAuthor: typeof getNodeByIdForAuthor
  listMessagesForNodeForAuthor: typeof listMessagesForNodeForAuthor
  createPendingMergeProposalMessageForAuthorIdempotent: typeof createPendingMergeProposalMessageForAuthorIdempotent
  getPendingMergeProposalForAuthor: typeof getPendingMergeProposalForAuthor
  getMergeProposalMessageForNodeForAuthor: typeof getMergeProposalMessageForNodeForAuthor
  getBranchOriginMetadataForNodeForAuthor: typeof getBranchOriginMetadataForNodeForAuthor
  getClient: typeof getClient
  now: () => Date
  createProposalId: () => string
  mergeModel: string
}

const DEFAULT_MERGE_MODEL = 'gpt-5'

const defaultDeps: MergeNodeToParentDeps = {
  selectProvider,
  getNodeByIdForAuthor,
  listMessagesForNodeForAuthor,
  createPendingMergeProposalMessageForAuthorIdempotent,
  getPendingMergeProposalForAuthor,
  getMergeProposalMessageForNodeForAuthor,
  getBranchOriginMetadataForNodeForAuthor,
  getClient,
  now: () => new Date(),
  createProposalId: randomUUID,
  mergeModel: process.env.MERGE_CONCLUSION_MODEL ?? DEFAULT_MERGE_MODEL,
}

const invalidProposal = (): TRPCError =>
  new TRPCError({ code: 'BAD_REQUEST', message: 'INVALID_PROPOSAL' })

const nodeIsMerged = (): TRPCError =>
  new TRPCError({ code: 'CONFLICT', message: 'NODE_IS_MERGED' })

const emptyMergeConclusion = (): TRPCError =>
  new TRPCError({ code: 'BAD_REQUEST', message: 'EMPTY_MERGE_CONCLUSION' })

const requireBranchNode = (node: NodeRecord | null): NodeRecord => {
  if (!node || node.parentNodeId === node.id) {
    throw invalidProposal()
  }

  return node
}

const rejectIfMerged = (node: NodeRecord): void => {
  if (node.status === 'merged') {
    throw nodeIsMerged()
  }
}

const getProposalMetadataOrThrow = (proposal: MessageRecord): MergeProposalMetadata => {
  const metadata = getMergeProposalMetadataFromRecord(proposal)
  if (!metadata) {
    throw invalidProposal()
  }
  return metadata
}

const getPendingProposalMetadataOrThrow = (proposal: MessageRecord): MergeProposalMetadata => {
  const metadata = getProposalMetadataOrThrow(proposal)
  if (metadata.mergeStatus !== 'pending') {
    throw invalidProposal()
  }
  return metadata
}

const getNonEmptyConclusionOrThrow = (metadata: MergeProposalMetadata): string => {
  const conclusion = metadata.proposedConclusion.trim()
  if (conclusion.length === 0) {
    throw invalidProposal()
  }
  return conclusion
}

const proposalOutput = (
  proposal: MessageRecord,
  metadata: MergeProposalMetadata,
): InitiateNodeMergeOutput => ({
  proposalMessageId: proposal.id,
  proposedConclusion: metadata.proposedConclusion,
})

const branchMessagesForAi = (messages: MessageRecord[]): MessageRecord[] =>
  messages.filter((message) => getMergeProposalMetadataFromRecord(message) === null)

const generateConclusion = async ({
  provider,
  model,
  prompt,
}: {
  provider: MergeProvider
  model: string
  prompt: Parameters<MergeProvider['generate']>[0]['prompt']
}): Promise<string> => {
  const result = await provider.generate({ model, prompt })
  return parseMergeConclusionOutput(result.content)
}

const buildMergeEventContent = ({
  branchTitle,
  sourceBranchOriginMessageId,
  conclusion,
}: {
  branchTitle: string
  sourceBranchOriginMessageId: string
  conclusion: string
}): string =>
  `Merged from "${branchTitle}" (branched from message ${sourceBranchOriginMessageId}): ${conclusion}`

export const createMergeNodeToParentService = (
  deps: Partial<MergeNodeToParentDeps> = {},
) => {
  const resolvedDeps = { ...defaultDeps, ...deps }

  const initiateNodeMerge = async ({
    input,
    currentUserId,
  }: {
    input: InitiateNodeMergeInput
    currentUserId: string
  }): Promise<InitiateNodeMergeOutput> => {
    const node = requireBranchNode(
      await resolvedDeps.getNodeByIdForAuthor(input.nodeId, currentUserId),
    )
    rejectIfMerged(node)

    const existingProposal = await resolvedDeps.getPendingMergeProposalForAuthor(
      input.nodeId,
      currentUserId,
    )
    if (existingProposal) {
      const metadata = getPendingProposalMetadataOrThrow(existingProposal)
      return proposalOutput(existingProposal, metadata)
    }

    const messages = branchMessagesForAi(
      await resolvedDeps.listMessagesForNodeForAuthor(input.nodeId, currentUserId),
    )
    const provider = resolvedDeps.selectProvider({ model: resolvedDeps.mergeModel })
    const conclusion = await generateConclusion({
      provider,
      model: resolvedDeps.mergeModel,
      prompt: buildInitialMergeConclusionPrompt({
        branchTitle: node.title,
        branchSummary: node.summary,
        existingConclusion: node.conclusion,
        messages,
      }),
    })
    const metadata: MergeProposalMetadata & { mergeStatus: 'pending' } = {
      eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
      proposalId: resolvedDeps.createProposalId(),
      proposedConclusion: conclusion,
      mergeStatus: 'pending',
      revisionRound: 1,
    }
    const proposal = await resolvedDeps.createPendingMergeProposalMessageForAuthorIdempotent({
      nodeId: input.nodeId,
      authorUserId: currentUserId,
      content: conclusion,
      metadata,
    })
    if (!proposal) {
      throw invalidProposal()
    }

    return proposalOutput(proposal, getPendingProposalMetadataOrThrow(proposal))
  }

  const reviseMergeProposal = async ({
    input,
    currentUserId,
  }: {
    input: ReviseMergeProposalInput
    currentUserId: string
  }): Promise<ReviseMergeProposalOutput> => {
    const node = requireBranchNode(
      await resolvedDeps.getNodeByIdForAuthor(input.nodeId, currentUserId),
    )
    rejectIfMerged(node)

    const existingProposal = await resolvedDeps.getMergeProposalMessageForNodeForAuthor(
      input.nodeId,
      input.proposalMessageId,
      currentUserId,
    )
    if (!existingProposal) {
      throw invalidProposal()
    }
    getPendingProposalMetadataOrThrow(existingProposal)

    const nextConclusion = input.revision.mode === 'edit'
      ? input.revision.editedText.trim()
      : await generateConclusion({
          provider: resolvedDeps.selectProvider({ model: resolvedDeps.mergeModel }),
          model: resolvedDeps.mergeModel,
          prompt: buildRejectedMergeConclusionPrompt({
            branchTitle: node.title,
            branchSummary: node.summary,
            existingConclusion: node.conclusion,
            messages: branchMessagesForAi(
              await resolvedDeps.listMessagesForNodeForAuthor(input.nodeId, currentUserId),
            ),
            rejectionInstructions: input.revision.revisionInstruction,
          }),
        })

    if (nextConclusion.length === 0) {
      throw emptyMergeConclusion()
    }

    const client = await resolvedDeps.getClient()
    try {
      await client.query('BEGIN')
      const lockedProposal = await getMergeProposalMessageForNodeForAuthorInTransaction(
        client,
        input.nodeId,
        input.proposalMessageId,
        currentUserId,
        { lock: true },
      )
      if (!lockedProposal) {
        throw invalidProposal()
      }
      const lockedMetadata = getPendingProposalMetadataOrThrow(lockedProposal)
      await updateMergeProposalStatusForAuthorInTransaction(client, {
        nodeId: input.nodeId,
        proposalMessageId: input.proposalMessageId,
        authorUserId: currentUserId,
        mergeStatus: 'superseded',
      })
      const nextMetadata: MergeProposalMetadata = {
        eventType: STRUCTURAL_MESSAGE_TYPES.mergeProposal,
        proposalId: resolvedDeps.createProposalId(),
        proposedConclusion: nextConclusion,
        mergeStatus: 'pending',
        revisionRound: lockedMetadata.revisionRound + 1,
      }
      const nextProposal = await createMergeProposalMessageForAuthorInTransaction(client, {
        nodeId: input.nodeId,
        authorUserId: currentUserId,
        content: nextConclusion,
        metadata: nextMetadata,
      })
      if (!nextProposal) {
        throw invalidProposal()
      }
      await client.query('COMMIT')
      return proposalOutput(nextProposal, getPendingProposalMetadataOrThrow(nextProposal))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  const cancelMerge = async ({
    input,
    currentUserId,
  }: {
    input: CancelMergeInput
    currentUserId: string
  }): Promise<CancelMergeOutput> => {
    const node = requireBranchNode(
      await resolvedDeps.getNodeByIdForAuthor(input.nodeId, currentUserId),
    )
    rejectIfMerged(node)

    const client = await resolvedDeps.getClient()
    try {
      await client.query('BEGIN')
      const pendingProposal = await getPendingMergeProposalForAuthorInTransaction(
        client,
        input.nodeId,
        currentUserId,
        { lock: true },
      )
      if (!pendingProposal) {
        await client.query('COMMIT')
        return { cancelledCount: 0 }
      }
      await updateMergeProposalStatusForAuthorInTransaction(client, {
        nodeId: input.nodeId,
        proposalMessageId: pendingProposal.id,
        authorUserId: currentUserId,
        mergeStatus: 'cancelled',
      })
      await client.query('COMMIT')
      return { cancelledCount: 1 }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  const approveMerge = async ({
    input,
    currentUserId,
  }: {
    input: ApproveMergeInput
    currentUserId: string
  }): Promise<ApproveMergeOutput> => {
    const node = requireBranchNode(
      await resolvedDeps.getNodeByIdForAuthor(input.nodeId, currentUserId),
    )
    rejectIfMerged(node)

    const proposal = await resolvedDeps.getMergeProposalMessageForNodeForAuthor(
      input.nodeId,
      input.proposalMessageId,
      currentUserId,
    )
    if (!proposal) {
      throw invalidProposal()
    }
    getPendingProposalMetadataOrThrow(proposal)

    const branchOriginMetadata = await resolvedDeps.getBranchOriginMetadataForNodeForAuthor(
      input.nodeId,
      currentUserId,
    )
    const sourceBranchOriginMessageId = branchOriginMetadata?.sourceMessageId.trim()
    if (!sourceBranchOriginMessageId) {
      throw invalidProposal()
    }

    const client = await resolvedDeps.getClient()
    try {
      await client.query('BEGIN')
      const lockedProposal = await getMergeProposalMessageForNodeForAuthorInTransaction(
        client,
        input.nodeId,
        input.proposalMessageId,
        currentUserId,
        { lock: true },
      )
      if (!lockedProposal) {
        throw invalidProposal()
      }
      const lockedMetadata = getPendingProposalMetadataOrThrow(lockedProposal)
      const conclusion = getNonEmptyConclusionOrThrow(lockedMetadata)

      await updateMergeProposalStatusForAuthorInTransaction(client, {
        nodeId: input.nodeId,
        proposalMessageId: input.proposalMessageId,
        authorUserId: currentUserId,
        mergeStatus: 'approved',
      })
      const mergedNode = await markNodeMergedForAuthorInTransaction(client, {
        nodeId: input.nodeId,
        authorUserId: currentUserId,
        conclusion,
      })
      if (!mergedNode) {
        throw invalidProposal()
      }
      const parentMessage = await createMergeEventMessageForAuthorInTransaction(client, {
        parentNodeId: node.parentNodeId,
        authorUserId: currentUserId,
        content: buildMergeEventContent({
          branchTitle: node.title,
          sourceBranchOriginMessageId,
          conclusion,
        }),
        metadata: {
          eventType: STRUCTURAL_MESSAGE_TYPES.mergeEvent,
          sourceNodeId: node.id,
          sourceBranchTitle: node.title,
          sourceBranchOriginMessageId,
          conclusion,
          mergedAt: resolvedDeps.now().toISOString(),
        },
      })
      if (!parentMessage) {
        throw invalidProposal()
      }
      await client.query('COMMIT')
      return { parentMessageId: parentMessage.id }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  return {
    initiateNodeMerge,
    reviseMergeProposal,
    cancelMerge,
    approveMerge,
  }
}

const defaultService = createMergeNodeToParentService()

export const initiateNodeMerge = defaultService.initiateNodeMerge
export const reviseMergeProposal = defaultService.reviseMergeProposal
export const cancelMerge = defaultService.cancelMerge
export const approveMerge = defaultService.approveMerge
