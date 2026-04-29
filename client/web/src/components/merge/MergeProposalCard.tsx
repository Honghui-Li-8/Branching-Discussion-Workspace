import { useRef, useState } from 'react'
import { parseMergeProposalMetadata } from '@branching/shared'
import { trpc } from '../../trpc'
import type { TreeMessage } from '../../types/tree'
import { invalidateMessagesByNode } from '../discussion-tree/hooks/mutationInvalidation'
import {
  classifyMergeError,
  isMergeProposalApproved,
  shouldRenderMergeProposalCard,
} from './mergeProposalCardLogic'

type MergeProposalCardProps = {
  message: TreeMessage
  nodeId: string
  onNodeIsMerged?: () => void
  onMergeActionPending?: (label: string) => number
  onMergeActionSettled?: (token: number) => void
}

type CardMode = 'pending' | 'editing' | 'rejecting'

export const MergeProposalCard = ({
  message,
  nodeId,
  onNodeIsMerged,
  onMergeActionPending,
  onMergeActionSettled,
}: MergeProposalCardProps) => {
  const metadata = parseMergeProposalMetadata(message.metadata)

  const [mode, setMode] = useState<CardMode>('pending')
  const [editText, setEditText] = useState(metadata?.proposedConclusion ?? '')
  const [rejectInstruction, setRejectInstruction] = useState('')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const currentActionTokenRef = useRef(0)

  const utils = trpc.useUtils()

  const invalidateMessages = () => invalidateMessagesByNode(utils.messagesByNode.invalidate, nodeId)

  const reviseMutation = trpc.reviseMergeProposal.useMutation({
    onError: async (error) => {
      const kind = classifyMergeError(error.message)
      if (kind === 'invalid_proposal') {
        await invalidateMessages()
        setMode('pending')
        setInlineError('This merge proposal is no longer active.')
        return
      }
      if (kind === 'empty_conclusion') {
        setInlineError('Conclusion cannot be empty.')
        return
      }
      setInlineError('Something went wrong. Please try again.')
    },
    onSuccess: async () => {
      setMode('pending')
      setRejectInstruction('')
      setInlineError(null)
      await invalidateMessages()
    },
    onSettled: () => {
      onMergeActionSettled?.(currentActionTokenRef.current)
    },
  })

  const approveMutation = trpc.approveMerge.useMutation({
    onError: async (error) => {
      const kind = classifyMergeError(error.message)
      if (kind === 'node_is_merged') {
        onNodeIsMerged?.()
        return
      }
      if (kind === 'invalid_proposal') {
        await invalidateMessages()
        setInlineError('This merge proposal is no longer active.')
        return
      }
      setInlineError('Something went wrong. Please try again.')
    },
    onSuccess: async () => {
      setInlineError(null)
      await invalidateMessages()
    },
    onSettled: () => {
      onMergeActionSettled?.(currentActionTokenRef.current)
    },
  })

  if (!shouldRenderMergeProposalCard(metadata)) {
    return null
  }

  if (isMergeProposalApproved(metadata)) {
    return (
      <div key={message.id} className="flex justify-center">
        <div className="rounded-full border border-[#b8d9c8] bg-[#f0f9f4] px-4 py-2 text-[12px] text-[#3a7a5a]">
          ↩ Merged — conclusion approved
        </div>
      </div>
    )
  }

  const isSubmitting = reviseMutation.isPending || approveMutation.isPending
  const editTextTrimmed = editText.trim()
  const isEditEmpty = editTextTrimmed.length === 0

  const handleApprove = () => {
    if (isSubmitting) return
    setInlineError(null)
    currentActionTokenRef.current = onMergeActionPending?.('Approving merge') ?? 0
    approveMutation.mutate({ nodeId, proposalMessageId: message.id })
  }

  const handleEditConfirm = () => {
    if (isSubmitting || isEditEmpty) return
    setInlineError(null)
    currentActionTokenRef.current = onMergeActionPending?.('Saving edit') ?? 0
    reviseMutation.mutate({
      nodeId,
      proposalMessageId: message.id,
      revision: { mode: 'edit', editedText: editTextTrimmed },
    })
  }

  const handleDiscardEdit = () => {
    setMode('pending')
    setEditText(metadata?.proposedConclusion ?? '')
    setInlineError(null)
  }

  const handleRejectSubmit = () => {
    const instruction = rejectInstruction.trim()
    if (isSubmitting || instruction.length === 0) return
    setInlineError(null)
    currentActionTokenRef.current = onMergeActionPending?.('Revising proposal') ?? 0
    reviseMutation.mutate({
      nodeId,
      proposalMessageId: message.id,
      revision: { mode: 'reject', revisionInstruction: instruction },
    })
  }

  if (mode === 'editing') {
    return (
      <div key={message.id} className="rounded-2xl border border-[#c6ddea] bg-white px-4 py-3">
        <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4d7186]">
          Edit conclusion
        </p>
        <textarea
          className="w-full resize-none rounded-md border border-[#c6ddea] bg-[#f8fcff] px-3 py-2 text-sm text-[#12384c] focus:border-[#6ba3bf] focus:outline-none"
          rows={4}
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value)
            setInlineError(null)
          }}
          disabled={isSubmitting}
        />
        {isEditEmpty ? (
          <p className="m-0 mt-1 text-[11px] text-[#8a3f2b]">Conclusion cannot be empty.</p>
        ) : inlineError ? (
          <p className="m-0 mt-1 text-[11px] text-[#8a3f2b]">{inlineError}</p>
        ) : null}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="rounded border border-[#b8d9c8] bg-[#f0f9f4] px-3 py-1 text-sm text-[#3a7a5a] hover:bg-[#e4f4ec] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleEditConfirm}
            disabled={isSubmitting || isEditEmpty}
          >
            {reviseMutation.isPending ? 'Saving…' : 'Confirm edit'}
          </button>
          <button
            type="button"
            className="rounded border border-[#d8e7f0] bg-white px-3 py-1 text-sm text-[#55798e] hover:bg-[#f4f9fc]"
            onClick={handleDiscardEdit}
            disabled={isSubmitting}
          >
            Discard edit
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'rejecting') {
    return (
      <div key={message.id} className="rounded-2xl border border-[#c6ddea] bg-white px-4 py-3">
        <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4d7186]">
          Request revision
        </p>
        <p className="m-0 mb-3 text-sm leading-relaxed text-[#3a5e72] opacity-70">
          {metadata?.proposedConclusion}
        </p>
        <input
          type="text"
          className="w-full rounded-md border border-[#c6ddea] bg-[#f8fcff] px-3 py-2 text-sm text-[#12384c] focus:border-[#6ba3bf] focus:outline-none"
          placeholder="What should be changed?"
          value={rejectInstruction}
          onChange={(e) => {
            setRejectInstruction(e.target.value)
            setInlineError(null)
          }}
          disabled={isSubmitting}
        />
        {inlineError ? (
          <p className="m-0 mt-1 text-[11px] text-[#8a3f2b]">{inlineError}</p>
        ) : null}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="rounded border border-[#b8d9c8] bg-[#f0f9f4] px-3 py-1 text-sm text-[#3a7a5a] hover:bg-[#e4f4ec] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleRejectSubmit}
            disabled={isSubmitting || rejectInstruction.trim().length === 0}
          >
            {reviseMutation.isPending ? 'Revising…' : 'Submit'}
          </button>
          <button
            type="button"
            className="rounded border border-[#d8e7f0] bg-white px-3 py-1 text-sm text-[#55798e] hover:bg-[#f4f9fc]"
            onClick={() => {
              setMode('pending')
              setInlineError(null)
            }}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div key={message.id} className="rounded-2xl border border-[#c6ddea] bg-white px-4 py-3">
      <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4d7186]">
        Proposed conclusion
      </p>
      <p className="m-0 mb-3 text-sm leading-relaxed text-[#12384c]">
        {metadata?.proposedConclusion}
      </p>
      {inlineError ? (
        <p className="m-0 mb-2 text-[11px] text-[#8a3f2b]">{inlineError}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-[#b8d9c8] bg-[#f0f9f4] px-3 py-1 text-sm text-[#3a7a5a] hover:bg-[#e4f4ec] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleApprove}
          disabled={isSubmitting}
        >
          {approveMutation.isPending ? 'Approving…' : '✓ Approve'}
        </button>
        <button
          type="button"
          className="rounded border border-[#d8e7f0] bg-white px-3 py-1 text-sm text-[#55798e] hover:bg-[#f4f9fc] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            setMode('editing')
            setEditText(metadata?.proposedConclusion ?? '')
            setInlineError(null)
          }}
          disabled={isSubmitting}
        >
          ✎ Edit
        </button>
        <button
          type="button"
          className="rounded border border-[#d8e7f0] bg-white px-3 py-1 text-sm text-[#55798e] hover:bg-[#f4f9fc] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            setMode('rejecting')
            setInlineError(null)
          }}
          disabled={isSubmitting}
        >
          ✗ Reject
        </button>
      </div>
    </div>
  )
}
