import { describe, expect, test } from '@jest/globals'
import { findAnnotationIdFromClick } from './assistantAnnotationHitTest'

// Jest runs with testEnvironment: 'node', so none of the DOM globals this module touches
// exist. findAnnotationIdFromClick evaluates `target instanceof Element` before anything
// else, so Element has to be defined for the module to be callable at all.
class StubElement {}
;(globalThis as unknown as { Element: unknown }).Element = StubElement

type CaretDoc = {
  caretRangeFromPointCalls: Array<[number, number]>
  elementsFromPoint: () => Element[]
  caretRangeFromPoint: (x: number, y: number) => Range | null
}

// Chromium throws "TypeError: Illegal invocation" when a Document method is invoked with
// anything other than its own document as the receiver. This stub reproduces that, so the
// test fails the same way the browser did rather than only checking `this` by identity.
const createCaretDoc = (): CaretDoc => {
  const doc = {
    caretRangeFromPointCalls: [] as Array<[number, number]>,
    elementsFromPoint: () => [],
    caretRangeFromPoint(this: unknown, x: number, y: number): Range | null {
      if (this !== doc) {
        throw new TypeError('Illegal invocation')
      }

      doc.caretRangeFromPointCalls.push([x, y])
      return null
    },
  }

  return doc
}

describe('findAnnotationIdFromClick', () => {
  test('invokes caretRangeFromPoint with the document as receiver', () => {
    const doc = createCaretDoc()

    const annotationId = findAnnotationIdFromClick({
      target: null,
      clientX: 12,
      clientY: 34,
      doc: doc as unknown as Document,
      annotatorElement: {} as HTMLElement,
      annotations: [],
    })

    expect(doc.caretRangeFromPointCalls).toEqual([[12, 34]])
    expect(annotationId).toBeNull()
  })
})
