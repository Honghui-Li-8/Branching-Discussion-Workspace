export interface WorkspaceRecord {
  id: string
  title: string
  rootNodeId: string
  createdAt: string
  updatedAt: string
}

export interface CreateWorkspaceInput {
  title: string
  rootNodeTitle?: string
  rootNodeSummary?: string
}
