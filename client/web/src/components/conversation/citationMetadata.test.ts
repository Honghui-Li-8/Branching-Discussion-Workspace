import { describe, expect, test } from '@jest/globals'
import {
  formatCitationLabel,
  getRenderableCitations,
} from './citationMetadata'

describe('citationMetadata', () => {
  test('returns assistant citations when metadata is present', () => {
    expect(
      getRenderableCitations({
        id: 'm1',
        role: 'assistant',
        content: 'answer',
        metadata: {
          citations: [
            {
              messageId: 'm-source',
              nodeId: 'n1',
              chunkIndex: 0,
              excerpt: 'supporting text',
            },
          ],
        },
      }),
    ).toEqual([
      {
        messageId: 'm-source',
        nodeId: 'n1',
        chunkIndex: 0,
        excerpt: 'supporting text',
      },
    ])
  })

  test('rejects malformed metadata before render', () => {
    expect(
      getRenderableCitations({
        id: 'm1',
        role: 'assistant',
        content: 'answer',
        metadata: {
          citations: [
            {
              messageId: '',
              nodeId: 'n1',
            },
          ],
        },
      }),
    ).toEqual([])
  })

  test('does not render citations for user messages', () => {
    expect(
      getRenderableCitations({
        id: 'm1',
        role: 'user',
        content: 'question',
        metadata: {
          citations: [
            {
              messageId: 'm-source',
              nodeId: 'n1',
            },
          ],
        },
      }),
    ).toEqual([])
  })

  test('prefers explicit source labels when present', () => {
    expect(
      formatCitationLabel(
        {
          messageId: 'm-source',
          nodeId: 'n1',
          sourceLabel: 'Root note',
        },
        2,
      ),
    ).toBe('Root note')
    expect(
      formatCitationLabel(
        {
          messageId: 'm-source',
          nodeId: 'n1',
        },
        2,
      ),
    ).toBe('Source 3')
  })
})
