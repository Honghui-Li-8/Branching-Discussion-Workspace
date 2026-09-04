import type { TextAnnotation } from '@recogito/react-text-annotator'

type CaretPoint = {
  node: Node
  offset: number
}

type FindAnnotationIdFromClickParams = {
  target: EventTarget | null
  clientX: number
  clientY: number
  doc: Document
  annotatorElement: HTMLElement
  annotations: TextAnnotation[]
}

const getTextOffsetWithinElement = (
  root: HTMLElement,
  targetNode: Node,
  targetOffset: number,
): number | null => {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let total = 0
  let current = walker.nextNode()

  while (current) {
    const text = current.textContent ?? ''

    if (current === targetNode) {
      return total + Math.max(0, Math.min(targetOffset, text.length))
    }

    total += text.length
    current = walker.nextNode()
  }

  return null
}

const getCaretPoint = (doc: Document, x: number, y: number): CaretPoint | null => {
  // caretRangeFromPoint is read off the document because it is non-standard and absent in
  // some engines. It must still be invoked with `doc` as the receiver — calling the
  // extracted reference bare throws "TypeError: Illegal invocation" in Chromium, which
  // killed the whole caret fallback and surfaced as an uncaught error on every click
  // inside an annotated message.
  const caretRangeFromPoint = (doc as unknown as Record<string, unknown>)['caretRangeFromPoint']
  const range =
    typeof caretRangeFromPoint === 'function'
      ? (
          caretRangeFromPoint as (
            this: Document,
            pointX: number,
            pointY: number,
          ) => Range | null
        ).call(doc, x, y)
      : null
  if (range) {
    return {
      node: range.startContainer,
      offset: range.startOffset,
    }
  }

  const position = doc.caretPositionFromPoint?.(x, y)
  if (position) {
    return {
      node: position.offsetNode,
      offset: position.offset,
    }
  }

  return null
}

const getAnnotationIdFromDirectTarget = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) {
    return null
  }

  return (
    target.closest<HTMLElement>('.r6o-annotation[data-annotation]')?.dataset.annotation ??
    null
  )
}

const getAnnotationIdFromPointStack = (
  doc: Document,
  clientX: number,
  clientY: number,
): string | null => {
  const pointMatch = doc
    .elementsFromPoint(clientX, clientY)
    .find((element) => element.matches('.r6o-annotation[data-annotation]')) as
    | HTMLElement
    | undefined

  return pointMatch?.dataset.annotation ?? null
}

const getAnnotationIdFromCaret = ({
  doc,
  clientX,
  clientY,
  annotatorElement,
  annotations,
}: Omit<FindAnnotationIdFromClickParams, 'target'>): string | null => {
  const caretPoint = getCaretPoint(doc, clientX, clientY)
  if (!caretPoint) {
    return null
  }

  for (const annotation of annotations) {
    for (const selector of annotation.target.selector) {
      const offsetReference = selector.offsetReference ?? annotatorElement
      if (!offsetReference.contains(caretPoint.node)) {
        continue
      }

      const caretOffset = getTextOffsetWithinElement(
        offsetReference,
        caretPoint.node,
        caretPoint.offset,
      )
      if (caretOffset === null) {
        continue
      }

      if (caretOffset >= selector.start && caretOffset <= selector.end) {
        return annotation.id
      }
    }
  }

  return null
}

export const findAnnotationIdFromClick = ({
  target,
  clientX,
  clientY,
  doc,
  annotatorElement,
  annotations,
}: FindAnnotationIdFromClickParams): string | null => {
  const directId = getAnnotationIdFromDirectTarget(target)
  if (directId) {
    return directId
  }

  const stackedId = getAnnotationIdFromPointStack(doc, clientX, clientY)
  if (stackedId) {
    return stackedId
  }

  return getAnnotationIdFromCaret({
    doc,
    clientX,
    clientY,
    annotatorElement,
    annotations,
  })
}
