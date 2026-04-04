import {
  Annotorious,
  useAnnotations,
  useAnnotator,
  useSelection,
} from '@annotorious/react'
import {
  TextAnnotationPopup,
  TextAnnotator,
  W3CTextFormat,
  type RecogitoTextAnnotator,
  type TextAnnotation,
  type W3CTextAnnotation,
} from '@recogito/react-text-annotator'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { AssistantSelectionMenu } from './AssistantSelectionMenu'

type AssistantMessageAnnotationWrapperProps = {
  messageId: string
  children: ReactNode
}

const ANNOTATION_STORAGE_PREFIX = 'assistant-message-annotations-v1'

const buildAnnotationStorageKey = (messageId: string) =>
  `${ANNOTATION_STORAGE_PREFIX}:${messageId}`

const buildAnnotationSource = (messageId: string) => `assistant-message:${messageId}`

const readStoredAnnotations = (storageKey: string): W3CTextAnnotation[] => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const serialized = window.localStorage.getItem(storageKey)
    if (!serialized) {
      return []
    }

    const parsed = JSON.parse(serialized)
    return Array.isArray(parsed) ? (parsed as W3CTextAnnotation[]) : []
  } catch (error) {
    console.error('[assistant-annotation] failed to parse stored annotations', error)
    return []
  }
}

const getSelectedTextFromAnnotation = (annotation: TextAnnotation): string =>
  annotation.target.selector
    .map((selector) => selector.quote.trim())
    .filter(Boolean)
    .join(' ')

const isWordCharacter = (value: string): boolean =>
  /[\p{L}\p{N}_]/u.test(value)

const buildRangeFromOffsets = (
  offsetReference: HTMLElement,
  start: number,
  end: number,
): Range | null => {
  const doc = offsetReference.ownerDocument
  if (!doc) {
    return null
  }

  const walker = doc.createTreeWalker(offsetReference, NodeFilter.SHOW_TEXT)

  let currentOffset = 0
  let startNode: Node | null = null
  let endNode: Node | null = null
  let startNodeOffset = 0
  let endNodeOffset = 0

  let textNode = walker.nextNode()
  while (textNode) {
    const text = textNode.textContent ?? ''
    const nextOffset = currentOffset + text.length

    if (!startNode && start <= nextOffset) {
      startNode = textNode
      startNodeOffset = Math.max(0, start - currentOffset)
    }

    if (!endNode && end <= nextOffset) {
      endNode = textNode
      endNodeOffset = Math.max(0, end - currentOffset)
      break
    }

    currentOffset = nextOffset
    textNode = walker.nextNode()
  }

  if (!startNode || !endNode) {
    return null
  }

  const nextRange = doc.createRange()
  nextRange.setStart(startNode, startNodeOffset)
  nextRange.setEnd(endNode, endNodeOffset)
  return nextRange
}

const snapSelectorToWholeWord = (
  selector: TextAnnotation['target']['selector'][number],
  fallbackReference: HTMLElement,
): TextAnnotation['target']['selector'][number] => {
  const offsetReference = selector.offsetReference ?? fallbackReference
  const textContent = offsetReference.textContent ?? ''

  if (!textContent.length) {
    return selector
  }

  const maxOffset = textContent.length
  let start = Math.max(0, Math.min(selector.start, maxOffset))
  let end = Math.max(start, Math.min(selector.end, maxOffset))

  while (start < end && !isWordCharacter(textContent[start]!)) {
    start += 1
  }

  while (end > start && !isWordCharacter(textContent[end - 1]!)) {
    end -= 1
  }

  while (start > 0 && isWordCharacter(textContent[start - 1]!)) {
    start -= 1
  }

  while (end < maxOffset && isWordCharacter(textContent[end]!)) {
    end += 1
  }

  if (start >= end) {
    return selector
  }

  const nextRange = buildRangeFromOffsets(offsetReference, start, end)
  if (!nextRange) {
    return selector
  }

  return {
    ...selector,
    start,
    end,
    quote: textContent.slice(start, end),
    range: nextRange,
  }
}

const getWholeWordTarget = (
  annotation: TextAnnotation,
  fallbackReference: HTMLElement,
): TextAnnotation['target'] | null => {
  let hasChanges = false

  const selectors = annotation.target.selector.map((selector) => {
    const nextSelector = snapSelectorToWholeWord(selector, fallbackReference)
    if (
      nextSelector.start !== selector.start ||
      nextSelector.end !== selector.end ||
      nextSelector.quote !== selector.quote
    ) {
      hasChanges = true
    }

    return nextSelector
  })

  if (!hasChanges) {
    return null
  }

  return {
    ...annotation.target,
    selector: selectors,
  }
}

type AssistantAnnotationPersistenceProps = {
  storageKey: string
  initialAnnotations: W3CTextAnnotation[]
}

const AssistantAnnotationPersistence = ({
  storageKey,
  initialAnnotations,
}: AssistantAnnotationPersistenceProps) => {
  const annotator = useAnnotator<
    RecogitoTextAnnotator<TextAnnotation, W3CTextAnnotation> | undefined
  >()
  const annotations = useAnnotations<TextAnnotation>()
  const restoredFromStorageRef = useRef(false)

  useEffect(() => {
    if (!annotator || restoredFromStorageRef.current) {
      return
    }

    if (initialAnnotations.length > 0) {
      annotator.setAnnotations(initialAnnotations, true)
    }

    restoredFromStorageRef.current = true
  }, [annotator, initialAnnotations])

  useEffect(() => {
    if (!annotator || !restoredFromStorageRef.current || typeof window === 'undefined') {
      return
    }

    try {
      const serialized = JSON.stringify(annotator.getAnnotations())
      window.localStorage.setItem(storageKey, serialized)
    } catch (error) {
      console.error('[assistant-annotation] failed to store annotations', error)
    }
  }, [annotations, annotator, storageKey])

  return null
}

type AssistantAnnotationPopupProps = {
  messageId: string
}

const AssistantAnnotationPopup = ({ messageId }: AssistantAnnotationPopupProps) => {
  const annotator = useAnnotator<
    RecogitoTextAnnotator<TextAnnotation, W3CTextAnnotation> | undefined
  >()

  return (
    <TextAnnotationPopup
      asPortal={false}
      popup={({ annotation }) => {
        const selectedText = getSelectedTextFromAnnotation(annotation)

        const handleCancelSelection = () => {
          if (!annotator) {
            return
          }

          annotator.removeAnnotation(annotation.id)
          annotator.cancelSelected()
        }

        const handleConfirmSelection = () => {
          console.log('[assistant-selection] selected text', {
            messageId,
            text: selectedText,
            annotationId: annotation.id,
          })

          annotator?.cancelSelected()
        }

        return (
          <AssistantSelectionMenu
            selectedText={selectedText}
            onCancelSelection={handleCancelSelection}
            onConfirmSelection={handleConfirmSelection}
          />
        )
      }}
    />
  )
}

const AssistantWholeWordSelectionEnforcer = () => {
  const annotator = useAnnotator<
    RecogitoTextAnnotator<TextAnnotation, W3CTextAnnotation> | undefined
  >()
  const { selected } = useSelection<TextAnnotation>()

  useEffect(() => {
    if (!annotator || selected.length === 0) {
      return
    }

    const annotation = selected[0]?.annotation
    if (!annotation) {
      return
    }

    const wholeWordTarget = getWholeWordTarget(annotation, annotator.element)
    if (!wholeWordTarget) {
      return
    }

    annotator.state.store.updateTarget(wholeWordTarget)
  }, [annotator, selected])

  return null
}

export const AssistantMessageAnnotationWrapper = ({
  messageId,
  children,
}: AssistantMessageAnnotationWrapperProps) => {
  const storageKey = useMemo(() => buildAnnotationStorageKey(messageId), [messageId])
  const annotationSource = useMemo(() => buildAnnotationSource(messageId), [messageId])
  const initialAnnotations = useMemo(
    () => readStoredAnnotations(storageKey),
    [storageKey],
  )

  return (
    <Annotorious>
      <TextAnnotator
        className="assistant-annotation-scope"
        adapter={(container) => W3CTextFormat(annotationSource, container)}
        style={{
          fill: '#f59e0b',
          fillOpacity: 0.3,
          underlineStyle: 'solid',
          underlineColor: '#f59e0b',
          underlineThickness: 2,
          underlineOffset: 2,
        }}
      >
        {children}
        <AssistantWholeWordSelectionEnforcer />
        <AssistantAnnotationPopup messageId={messageId} />
      </TextAnnotator>
      <AssistantAnnotationPersistence
        storageKey={storageKey}
        initialAnnotations={initialAnnotations}
      />
    </Annotorious>
  )
}
