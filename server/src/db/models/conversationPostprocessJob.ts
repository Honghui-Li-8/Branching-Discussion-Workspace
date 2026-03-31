export type ConversationPostprocessJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'

export interface ConversationPostprocessJobRecord {
  id: string
  turnId: string
  jobType: string
  payload: unknown
  status: ConversationPostprocessJobStatus
  attemptCount: number
  maxAttempts: number
  runAfter: string
  lastError: string | null
  leasedAt: string | null
  leaseOwner: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateConversationPostprocessJobInput {
  turnId: string
  jobType: string
  payload?: unknown
  status?: ConversationPostprocessJobStatus
  attemptCount?: number
  maxAttempts?: number
  runAfter?: string
  lastError?: string | null
  leasedAt?: string | null
  leaseOwner?: string | null
  finishedAt?: string | null
}

export interface CreateOrGetConversationPostprocessJobResult {
  job: ConversationPostprocessJobRecord
  wasCreated: boolean
}

export interface LeaseDueConversationPostprocessJobsInput {
  leaseOwner: string
  leaseAt?: string
  staleLeaseBefore?: string
  limit?: number
}

export interface MarkConversationPostprocessJobSucceededInput {
  id: string
  leaseOwner?: string
  finishedAt?: string
}

export interface MarkConversationPostprocessJobFailedInput {
  id: string
  lastError: string
  leaseOwner?: string
  finishedAt?: string
}

export interface RequeueConversationPostprocessJobWithBackoffInput {
  id: string
  lastError: string
  leaseOwner?: string
  runAfter?: string
  baseDelaySeconds?: number
  maxDelaySeconds?: number
}
