export type DiscussionStatus = 'open' | 'closed' | 'archived'

export interface DiscussionRecord {
  id: string
  title: string
  status: DiscussionStatus
  createdAt: string
  updatedAt: string
}

export interface CreateDiscussionInput {
  title: string
  status?: DiscussionStatus
}
