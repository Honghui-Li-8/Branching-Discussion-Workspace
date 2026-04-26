import { z } from 'zod'

const idSchema = z.string().min(1)
const nonEmptyTextSchema = z.string().trim().min(1)

export const initiateNodeMergeInputSchema = z.object({
  nodeId: idSchema,
})

export const initiateNodeMergeOutputSchema = z.object({
  proposalMessageId: idSchema,
  proposedConclusion: nonEmptyTextSchema,
})

export const reviseMergeProposalInputSchema = z.object({
  nodeId: idSchema,
  proposalMessageId: idSchema,
  revision: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('edit'),
      editedText: nonEmptyTextSchema,
    }),
    z.object({
      mode: z.literal('reject'),
      revisionInstruction: nonEmptyTextSchema,
    }),
  ]),
})

export const reviseMergeProposalOutputSchema = z.object({
  proposalMessageId: idSchema,
  proposedConclusion: nonEmptyTextSchema,
})

export const cancelMergeInputSchema = z.object({
  nodeId: idSchema,
})

export const cancelMergeOutputSchema = z.object({
  cancelledCount: z.number().int().nonnegative(),
})

export const approveMergeInputSchema = z.object({
  nodeId: idSchema,
  proposalMessageId: idSchema,
})

export const approveMergeOutputSchema = z.object({
  parentMessageId: idSchema,
})

export type InitiateNodeMergeInput = z.infer<typeof initiateNodeMergeInputSchema>
export type InitiateNodeMergeOutput = z.infer<typeof initiateNodeMergeOutputSchema>
export type ReviseMergeProposalInput = z.infer<typeof reviseMergeProposalInputSchema>
export type ReviseMergeProposalOutput = z.infer<typeof reviseMergeProposalOutputSchema>
export type CancelMergeInput = z.infer<typeof cancelMergeInputSchema>
export type CancelMergeOutput = z.infer<typeof cancelMergeOutputSchema>
export type ApproveMergeInput = z.infer<typeof approveMergeInputSchema>
export type ApproveMergeOutput = z.infer<typeof approveMergeOutputSchema>
