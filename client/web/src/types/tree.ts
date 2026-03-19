export type TreeStatus = 'Open' | 'Exploring' | 'Approved'

export type TreeMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type FoldedNodeSummary = {
  id: string
  title: string
}

export type TreeNode = {
  id: string
  title: string
  status: TreeStatus
  folded?: boolean
  messages?: TreeMessage[]
  children?: TreeNode[]
}
