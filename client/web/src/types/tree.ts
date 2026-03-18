export type TreeStatus = 'Open' | 'Exploring' | 'Approved'

export type TreeMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type TreeNode = {
  id: string
  title: string
  status: TreeStatus
  messages?: TreeMessage[]
  children?: TreeNode[]
}
