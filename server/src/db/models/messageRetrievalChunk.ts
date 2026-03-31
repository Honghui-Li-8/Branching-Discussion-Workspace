export interface MessageRetrievalChunkRecord {
  id: string
  messageId: string
  nodeId: string
  authorUserId: string
  chunkIndex: number
  content: string
  tokenCount: number
  createdAt: string
  updatedAt: string
}

export interface UpsertMessageRetrievalChunkInput {
  messageId: string
  nodeId: string
  authorUserId: string
  chunkIndex: number
  content: string
  tokenCount: number
  embedding: number[]
}

export interface SearchMessageRetrievalChunksInput {
  nodeId: string
  authorUserId: string
  embedding: number[]
  limit: number
}

export interface ScoredMessageRetrievalChunkRecord extends MessageRetrievalChunkRecord {
  score: number
}
