import type {
  CreateMessageInput,
  CreateNodeInput,
  CreateWorkspaceInput,
  Message,
  Node,
  UpdateMessageInput,
  UpdateNodeInput,
  UpdateWorkspaceInput,
  User,
  Workspace,
} from './schemas/core.js'
import type {
  MessageAnnotation,
  MessageAnnotationDeleteInput,
  MessageAnnotationDeleteResult,
  MessageBranchFromSelectionInput,
  MessageBranchFromSelectionResult,
  MessageSuggestFromSelectionInput,
} from './schemas/annotations.js'
import type {
  ConversationSendInput,
  ConversationSendResult,
} from './schemas/conversation.js'

export type AppRouterContext = {
  sessionUserId: string | null
  listUsers: () => Promise<User[]>
  getUserById: (id: string) => Promise<User | null>
  listWorkspaces: () => Promise<Workspace[]>
  getWorkspaceById: (id: string) => Promise<Workspace | null>
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>
  updateWorkspace: (
    input: UpdateWorkspaceInput,
  ) => Promise<Workspace | null>
  deleteWorkspace: (
    id: string,
  ) => Promise<{
    id: string
    deletedNodeCount: number
    deletedMessageCount: number
  } | null>
  listNodesByWorkspace: (workspaceId: string) => Promise<Node[]>
  getNodeById: (id: string) => Promise<Node | null>
  createNode: (input: CreateNodeInput) => Promise<Node>
  updateNode: (input: UpdateNodeInput) => Promise<Node | null>
  deleteNode: (
    id: string,
  ) => Promise<{
    id: string
    deletedWorkspace: boolean
    deletedNodeCount: number
    deletedMessageCount: number
  } | null>
  listMessagesForNode: (nodeId: string) => Promise<Message[]>
  createMessage: (input: CreateMessageInput) => Promise<Message>
  updateMessage: (input: UpdateMessageInput) => Promise<Message | null>
  deleteMessage: (id: string) => Promise<{ id: string } | null>
  listMessageAnnotationsByMessage: (messageId: string) => Promise<MessageAnnotation[]>
  messageSuggestFromSelection: (
    input: MessageSuggestFromSelectionInput,
  ) => Promise<MessageAnnotation>
  messageAnnotationDelete: (
    input: MessageAnnotationDeleteInput,
  ) => Promise<MessageAnnotationDeleteResult>
  messageBranchFromSelection: (
    input: MessageBranchFromSelectionInput,
  ) => Promise<MessageBranchFromSelectionResult>
  conversationSend: (
    input: ConversationSendInput,
  ) => Promise<ConversationSendResult>
}
