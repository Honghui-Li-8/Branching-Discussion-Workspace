export interface BranchRecord {
  id: string
  discussionId: string
  parentBranchId: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export interface CreateBranchInput {
  discussionId: string
  parentBranchId?: string | null
  content: string
}
