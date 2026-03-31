import {
  parseMessageMetadata,
  type Citation,
} from '@branching/shared'
import type { TreeMessage } from '../../types/tree'

export const getRenderableCitations = (
  message: TreeMessage,
): Citation[] => {
  if (message.role !== 'assistant') {
    return []
  }

  return parseMessageMetadata(message.metadata).citations ?? []
}

export const formatCitationLabel = (
  citation: Citation,
  index: number,
): string => citation.sourceLabel ?? `Source ${index + 1}`
