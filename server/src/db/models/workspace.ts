export interface WorkspaceRecord {
  id: string
  title: string
  authorUserId: string
  rootNodeId: string
  createdAt: string
  updatedAt: string
}

export interface CreateWorkspaceInput {
  authorUserId: string
  title: string
  rootNodeTitle?: string
  rootNodeSummary?: string
}
