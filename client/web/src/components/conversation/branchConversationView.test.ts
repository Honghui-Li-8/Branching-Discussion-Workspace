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

describe('branchConversationView — branch follow-up UI flow', () => {
  // Canonical message fixtures for a parent→child branch scenario.
  const parentQuestion: TreeMessage = {
    id: 'parent-user',
    role: 'user',
    content: 'What is the tradeoff between A and B?',
  }
  const parentAnswer: TreeMessage = {
    id: 'parent-assistant',
    role: 'assistant',
    content: 'A is faster but B is more reliable.',
  }
  const branchEvent: TreeMessage = {
    id: 'branch-event',
    role: 'user',
    content: 'A is faster but B is more reliable.',
    metadata: {
      eventType: 'branch_event',
      sourceNodeId: 'parent-node',
      sourceMessageId: 'parent-assistant',
      sourceAnnotationId: 'a1',
      sourceContext: 'A is faster but B is more reliable.',
      branchNodeId: 'child-node',
    },
  }
  const followup: TreeMessage = {
    id: 'child-followup',
    role: 'user',
    content: 'Can you expand on reliability?',
  }
  const reply: TreeMessage = {
    id: 'child-assistant',
    role: 'assistant',
    content: 'Reliability means fewer failures under load.',
  }

  test('collapsible parent block contains all inherited messages in insertion order', () => {
    // The inherited section (collapsible parent block) must receive every message
    // from the parent node in order so the component can render the conversation
    // history that led to the branch point.
    const result = buildBranchConversationSegments({
      inheritedMessages: [parentQuestion, parentAnswer],
      localMessages: [branchEvent, followup, reply],
    })

    expect(result.inheritedMessages).toEqual([parentQuestion, parentAnswer])
    expect(result.inheritedMessages).toHaveLength(2)
  })

  test('branch divider label is derived from the branch event source context', () => {
    // The branchSummaryLabel is what the UI renders as the divider text between
    // the parent block and the child conversation. It is computed from the branch
    // event metadata.sourceContext, not from the message content.
    const result = buildBranchConversationSegments({
      inheritedMessages: [parentQuestion, parentAnswer],
      localMessages: [branchEvent, followup, reply],
    })

    expect(result.branchSummaryLabel).toBe('A is faster but B is more reliable.')
    expect(result.branchEventMessage?.id).toBe('branch-event')
  })

  test('child message list excludes the branch event row and starts with the follow-up', () => {
    // childMessages is the sequence the child node renders. It must not include the
    // branch event row (which is displayed separately as the divider/event row) and
    // must preserve the ordering of all other local messages.
    const result = buildBranchConversationSegments({
      inheritedMessages: [parentQuestion, parentAnswer],
      localMessages: [branchEvent, followup, reply],
    })

    expect(result.childMessages).toEqual([followup, reply])
    expect(result.childMessages.some((m) => m.id === 'branch-event')).toBe(false)
  })

  test('inherited block is empty before inheritedMessagesByNode query resolves (initial load)', () => {
    // On first render the hook has not yet received data from the server, so
    // inheritedMessages = []. Segments must still correctly identify the branch
    // event and child messages from localMessages alone.
    const result = buildBranchConversationSegments({
      inheritedMessages: [],
      localMessages: [branchEvent, followup],
    })

    expect(result.inheritedMessages).toEqual([])
    expect(result.branchEventMessage?.id).toBe('branch-event')
    expect(result.childMessages).toEqual([followup])
    expect(result.branchSummaryLabel).toBe('A is faster but B is more reliable.')
  })

  test('nested branching from a child node: grandchild segments reflect its own branch boundary', () => {
    // When the user branches from a child node the grandchild receives:
    //   - inheritedMessages = child node's messages (including child's branch event + turns)
    //   - localMessages     = grandchild's own branch event + turns
    // The segments must use the grandchild's branch event for the divider and metadata,
    // not the child's, and the inherited block must contain the full child history.
    const childBranchEvent: TreeMessage = {
      id: 'child-branch-event',
      role: 'user',
      content: 'A is faster but B is more reliable.',
      metadata: {
        eventType: 'branch_event',
        sourceNodeId: 'parent-node',
        sourceMessageId: 'parent-assistant',
        sourceAnnotationId: 'a1',
        sourceContext: 'A is faster but B is more reliable.',
        branchNodeId: 'child-node',
      },
    }
    const childHistory: TreeMessage[] = [childBranchEvent, followup, reply]

    const grandchildBranchEvent: TreeMessage = {
      id: 'grandchild-branch-event',
      role: 'user',
      content: 'fewer failures under load',
      metadata: {
        eventType: 'branch_event',
        sourceNodeId: 'child-node',
        sourceMessageId: 'child-assistant',
        sourceAnnotationId: 'a2',
        sourceContext: 'fewer failures under load',
        branchNodeId: 'grandchild-node',
      },
    }
    const grandchildFollowup: TreeMessage = {
      id: 'grandchild-followup',
      role: 'user',
      content: 'How do you measure failure rate?',
    }

    const result = buildBranchConversationSegments({
      inheritedMessages: childHistory,
      localMessages: [grandchildBranchEvent, grandchildFollowup],
    })

    // Inherited block = full child history (all three child rows).
    expect(result.inheritedMessages).toEqual(childHistory)
    expect(result.inheritedMessages).toHaveLength(3)

    // Divider uses grandchild branch event, not the child's.
    expect(result.branchEventMessage?.id).toBe('grandchild-branch-event')
    expect(result.branchSummaryLabel).toBe('fewer failures under load')
    expect(result.branchEventMetadata?.sourceNodeId).toBe('child-node')
    expect(result.branchEventMetadata?.branchNodeId).toBe('grandchild-node')

    // Child messages = only the grandchild's own follow-up.
    expect(result.childMessages).toEqual([grandchildFollowup])
  })
})
