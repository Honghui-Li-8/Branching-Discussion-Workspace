import { describe, expect, test } from '@jest/globals'
import type { TreeMessage } from '../../types/tree'
import {
  buildBranchConversationSegments,
  getBranchSummaryLabelForMessage,
  summarizeBranchSourceContext,
} from './branchConversationView'

describe('branchConversationView', () => {
  test('summarizeBranchSourceContext returns full text at or below twenty words', () => {
    expect(
      summarizeBranchSourceContext(
        'one two three four five six seven eight nine ten eleven twelve',
      ),
    ).toBe('one two three four five six seven eight nine ten eleven twelve')
  })

  test('summarizeBranchSourceContext truncates to first ten and last six words', () => {
    expect(
      summarizeBranchSourceContext(
        'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone',
      ),
    ).toBe('one two three four five six seven eight nine ten … sixteen seventeen eighteen nineteen twenty twentyone')
  })

  test('buildBranchConversationSegments separates inherited, branch event, and child-local rows', () => {
    const inheritedMessages: TreeMessage[] = [
      {
        id: 'parent-user',
        role: 'user',
        content: 'Parent message',
      },
    ]
    const localMessages: TreeMessage[] = [
      {
        id: 'branch-event',
        role: 'user',
        content: 'Selected source text',
        metadata: {
          eventType: 'branch_event',
          sourceNodeId: 'parent-node',
          sourceMessageId: 'parent-message',
          branchNodeId: 'child-node',
          sourceContext:
            'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone',
        },
      },
      {
        id: 'child-user',
        role: 'user',
        content: 'Follow-up question',
      },
      {
        id: 'child-assistant',
        role: 'assistant',
        content: 'Answer',
      },
    ]

    expect(
      buildBranchConversationSegments({
        inheritedMessages,
        localMessages,
      }),
    ).toEqual({
      inheritedMessages,
      branchEventMessage: localMessages[0],
      branchEventMetadata: {
        eventType: 'branch_event',
        sourceNodeId: 'parent-node',
        sourceMessageId: 'parent-message',
        branchNodeId: 'child-node',
        sourceContext:
          'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone',
      },
      branchSummaryLabel:
        'one two three four five six seven eight nine ten … sixteen seventeen eighteen nineteen twenty twentyone',
      childMessages: localMessages.slice(1),
    })
  })

  test('buildBranchConversationSegments leaves local messages untouched when no branch event exists', () => {
    const localMessages: TreeMessage[] = [
      {
        id: 'child-user',
        role: 'user',
        content: 'Follow-up question',
      },
    ]

    expect(
      buildBranchConversationSegments({
        inheritedMessages: [],
        localMessages,
      }),
    ).toEqual({
      inheritedMessages: [],
      branchEventMessage: null,
      branchEventMetadata: null,
      branchSummaryLabel: null,
      childMessages: localMessages,
    })
  })

  test('getBranchSummaryLabelForMessage returns deterministic label for branch events only', () => {
    const branchEventMessage: TreeMessage = {
      id: 'branch-event',
      role: 'user',
      content: 'Selected source text',
      metadata: {
        eventType: 'branch_event',
        sourceNodeId: 'parent-node',
        sourceMessageId: 'parent-message',
        branchNodeId: 'child-node',
        sourceContext:
          'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone',
      },
    }

    expect(getBranchSummaryLabelForMessage(branchEventMessage)).toBe(
      'one two three four five six seven eight nine ten … sixteen seventeen eighteen nineteen twenty twentyone',
    )
    expect(
      getBranchSummaryLabelForMessage({
        id: 'user-message',
        role: 'user',
        content: 'Hello',
      }),
    ).toBeNull()
  })
})
