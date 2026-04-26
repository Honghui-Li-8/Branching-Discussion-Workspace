import type { MessageMetadata } from '@branching/shared'

export type TreeStatus = 'Open' | 'Exploring' | 'Approved' | 'Merged'

export type TreeMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: MessageMetadata
}

export type FoldedNodeSummary = {
  id: string
  title: string
}

export type TreeNode = {
  id: string
  title: string
  status: TreeStatus
  depth: number
  folded?: boolean
  messages?: TreeMessage[]
  children?: TreeNode[]
}
