import {
  invalidateMessagesByNode,
  invalidateNodesByWorkspace,
} from './mutationInvalidation'

describe('mutation invalidation helpers', () => {
  test('invalidateMessagesByNode forwards node id to invalidator', async () => {
    const invalidate = jest.fn<Promise<unknown>, [{ nodeId: string }]>().mockResolvedValue(undefined)

    await invalidateMessagesByNode(invalidate, 'node-1')

    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ nodeId: 'node-1' })
  })

  test('invalidateNodesByWorkspace forwards workspace id to invalidator', async () => {
    const invalidate = jest
      .fn<Promise<unknown>, [{ workspaceId: string }]>()
      .mockResolvedValue(undefined)

    await invalidateNodesByWorkspace(invalidate, 'workspace-1')

    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ workspaceId: 'workspace-1' })
  })
})
