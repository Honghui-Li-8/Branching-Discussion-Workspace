export type NodeType = 'decision' | 'question' | 'option' | 'constraint'
export type NodeStatus =
  | 'open'
  | 'exploring'
  | 'needs_approval'
  | 'approved'
  | 'deferred'
  | 'closed'
export type NodeConfidence = 'low' | 'medium' | 'high'

export interface NodeRecord {
  id: string
  workspaceId: string
  parentNodeId: string
  depth: number
  type: NodeType
  title: string
  status: NodeStatus
  confidence: NodeConfidence
  summary: string
  conclusion: string | null
  rationale: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateNodeInput {
  workspaceId: string
  parentNodeId: string
  type: NodeType
  title: string
  status?: NodeStatus
  confidence?: NodeConfidence
  summary: string
  conclusion?: string | null
  rationale?: string | null
}
