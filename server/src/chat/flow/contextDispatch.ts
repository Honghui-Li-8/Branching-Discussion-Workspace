import { buildConversationContext } from '../buildConversationContext.js'
import type { ConversationContext } from '../types.js'

type DispatchConversationContextBuildParams = {
  nodeId: string
  currentUserId: string
  userInput: string
}

export const dispatchConversationContextBuild = ({
  nodeId,
  currentUserId,
  userInput,
}: DispatchConversationContextBuildParams): Promise<ConversationContext> =>
  buildConversationContext({
    nodeId,
    currentUserId,
    userInput,
  })
