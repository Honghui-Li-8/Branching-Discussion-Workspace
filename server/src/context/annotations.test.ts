import { describe, expect, test } from '@jest/globals'
import { STRUCTURAL_MESSAGE_TYPES } from '@branching/shared'
import { getFollowupUserMessageForTurn } from './annotationHelpers.js'

const fixedNow = '2026-04-18T00:00:00.000Z'

describe('getFollowupUserMessageForTurn', () => {
  test('skips branch_event user rows and returns the actual follow-up user message', () => {
    const result = getFollowupUserMessageForTurn([
      {
        id: 'branch-event-1',
        nodeId: 'n1',
        authorUserId: 'u1',
        turnId: 't1',
        role: 'user',
        content: 'branch context',
        metadata: {
          eventType: STRUCTURAL_MESSAGE_TYPES.branchEvent,
          sourceNodeId: 'n-parent',
          sourceMessageId: 'm-parent',
          branchNodeId: 'n1',
        },
        createdAt: fixedNow,
      },
      {
        id: 'followup-1',
        nodeId: 'n1',
        authorUserId: 'u1',
        turnId: 't1',
        role: 'user',
        content: 'What do you mean by this?',
        metadata: {},
        createdAt: fixedNow,
      },
    ])

    expect(result?.id).toBe('followup-1')
  })
})
