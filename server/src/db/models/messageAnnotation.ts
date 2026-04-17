export type MessageAnnotationKind = 'suggestion' | 'branch' | 'suggestion-branch' | 'branch-origin'

export interface MessageAnnotationSelectorRange {
  quote: string
  start: number
  end: number
}

export interface MessageAnnotationSelectorJson {
  selector: MessageAnnotationSelectorRange[]
}

export interface MessageAnnotationRecord {
  id: string
  messageId: string
  leadsToNodeId: string | null
  kind: MessageAnnotationKind
  quote: string
  startOffset: number | null
  endOffset: number | null
  selectorJson: MessageAnnotationSelectorJson
  createdByUserId: string
  idempotencyKey: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateMessageAnnotationInput {
  messageId: string
  leadsToNodeId?: string | null
  kind: MessageAnnotationKind
  quote: string
  startOffset?: number | null
  endOffset?: number | null
  selectorJson: MessageAnnotationSelectorJson
  createdByUserId: string
  idempotencyKey: string
}

export interface CreateMessageAnnotationForAuthorInput {
  messageId: string
  leadsToNodeId?: string | null
  kind: MessageAnnotationKind
  quote: string
  startOffset?: number | null
  endOffset?: number | null
  selectorJson: MessageAnnotationSelectorJson
  authorUserId: string
  idempotencyKey: string
}

export interface UpdateMessageAnnotationLinkInput {
  id: string
  leadsToNodeId: string | null
}

export interface MessageAnnotationIdempotencyLookupInput {
  messageId: string
  authorUserId: string
  idempotencyKey: string
}
