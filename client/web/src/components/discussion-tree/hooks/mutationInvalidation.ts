type MessagesByNodeInvalidator = (input: { nodeId: string }) => Promise<unknown>
type NodesByWorkspaceInvalidator = (input: { workspaceId: string }) => Promise<unknown>

export const invalidateMessagesByNode = async (
  invalidate: MessagesByNodeInvalidator,
  nodeId: string,
) => {
  await invalidate({ nodeId })
}

export const invalidateNodesByWorkspace = async (
  invalidate: NodesByWorkspaceInvalidator,
  workspaceId: string,
) => {
  await invalidate({ workspaceId })
}
