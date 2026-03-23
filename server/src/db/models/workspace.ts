export interface WorkspaceRecord {
  id: string
  title: string
  summary: string | null
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

export interface UpdateWorkspaceInput {
  id: string
  title: string
}

export interface DeleteWorkspaceResult {
  id: string
  deletedNodeCount: number
  deletedMessageCount: number
}
