import { describe, expect, test } from '@jest/globals'
import { createNodeInputSchema, nodeSchema, nodeStatusSchema } from './core.js'

describe('core router schema contracts', () => {
  test('nodeStatusSchema accepts merged status', () => {
    expect(nodeStatusSchema.parse('merged')).toBe('merged')
  })

  test('nodeSchema accepts merged node records', () => {
    expect(() =>
      nodeSchema.parse({
        id: 'node-1',
        workspaceId: 'workspace-1',
        authorUserId: 'user-1',
        parentNodeId: 'parent-node-1',
        depth: 1,
        type: 'decision',
        title: 'API choice',
        status: 'merged',
        confidence: 'medium',
        summary: 'Choose an API shape.',
        conclusion: 'Use GraphQL for realtime data.',
        rationale: null,
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z',
      }),
    ).not.toThrow()
  })

  test('createNodeInputSchema accepts merged status when provided', () => {
    expect(
      createNodeInputSchema.parse({
        workspaceId: 'workspace-1',
        parentNodeId: 'parent-node-1',
        type: 'decision',
        title: 'API choice',
        status: 'merged',
        summary: 'Choose an API shape.',
      }),
    ).toMatchObject({ status: 'merged' })
  })
})
