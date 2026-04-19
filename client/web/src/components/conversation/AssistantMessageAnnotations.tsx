import {
  Annotorious,
  useAnnotations,
  useAnnotator,
  useSelection,
} from '@annotorious/react'
import {
  TextAnnotationPopup,
  TextAnnotator,
  UserSelectAction,
  W3CTextFormat,
  type RecogitoTextAnnotator,
  type TextAnnotation,
  type W3CTextAnnotation,
} from '@recogito/react-text-annotator'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@branching/shared'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { trpc } from '../../trpc'
import { AssistantSelectionMenu } from './AssistantSelectionMenu'
import {
  buildBranchSelectionPayload,
  canSubmitBranchRequest,
} from './assistantBranchRequest'
import { buildSourceContextWindow } from './sourceContextWindow'
import {
  ASSISTANT_ANNOTATION_KIND_PREFIX,
  getBranchActionKind,
  parseAnnotationKindTag,
  resolveAnnotationKind,
  type AssistantAnnotationKind,
} from './assistantAnnotationLogic'
import { useAssistantAnnotationSession } from './assistantAnnotationSession'
import { findAnnotationIdFromClick } from './assistantAnnotationHitTest'

type AssistantMessageAnnotationWrapperProps = {
  messageId: string
  conversationModel?: string
  sourceText?: string
  readOnly?: boolean
  onBranchFollowupCreated?: (
    nodeId: string,
    branchFollowupBootstrap: {
      turnId: string
      userFollowupMessageId: string | null
      text: string
      status: RouterOutputs['branchAndSendFollowup']['status']
    },
  ) => void
  children: ReactNode
}

const LOCAL_ANNOTATION_USER = {
  id: 'local-assistant-annotation-user',
  name: 'Local Assistant Annotator',
}

const buildAnnotationSource = (messageId: string) => `assistant-message:${messageId}`
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value: string): boolean => UUID_REGEX.test(value)

type RouterOutputs = inferRouterOutputs<AppRouter>
type RouterInputs = inferRouterInputs<AppRouter>
type BackendMessageAnnotation = RouterOutputs['messageAnnotationsByMessage'][number]
type BranchAndSendFollowupInput = RouterInputs['branchAndSendFollowup']

const mapBackendAnnotationToW3C = (
  annotation: BackendMessageAnnotation,
  source: string,
): W3CTextAnnotation => {
  const targets = annotation.selectorJson.selector.map((selector, index) => ({
    id: `${annotation.id}-target-${index}`,
    source,
    selector: [
      {
        type: 'TextQuoteSelector' as const,
        exact: selector.quote,
      },
      {
        type: 'TextPositionSelector' as const,
        start: selector.start,
        end: selector.end,
      },
    ],
  }))

  return {
    '@context': 'http://www.w3.org/ns/anno.jsonld',
    type: 'Annotation',
    id: annotation.id,
    body: [
      {
        purpose: 'tagging',
        value: `${ASSISTANT_ANNOTATION_KIND_PREFIX}${annotation.kind}`,
      },
    ],
    target: targets.length === 1 ? targets[0]! : targets,
    created: annotation.createdAt,
    modified: annotation.updatedAt,
    properties: {
      kind: annotation.kind,
    },
  }
}

const createIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const getSelectedTextFromAnnotation = (annotation: TextAnnotation): string =>
  annotation.target.selector
    .map((selector) => selector.quote.trim())
    .filter(Boolean)
    .join(' ')

const getAnnotationTextLength = (annotation: TextAnnotation): number =>
  annotation.target.selector.reduce(
    (total, selector) => total + selector.quote.trim().length,
    0,
  )

const getKindBody = (annotation: TextAnnotation) =>
  annotation.bodies.find((body) => parseAnnotationKindTag(body.value) !== null)

const getAnnotationKind = (annotation: TextAnnotation): AssistantAnnotationKind => {
  return resolveAnnotationKind({
    propertiesKind: annotation.properties?.kind,
    legacyTagValue: getKindBody(annotation)?.value,
  })
}

const setAnnotationKind = (
  annotator: RecogitoTextAnnotator<TextAnnotation, W3CTextAnnotation>,
  annotation: TextAnnotation,
  kind: AssistantAnnotationKind,
) => {
  annotator.state.store.updateAnnotation(annotation.id, {
    ...annotation,
    properties: {
      ...(annotation.properties ?? {}),
      kind,
    },
  })
}

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

type AssistantAnnotationHydrationProps = {
  initialAnnotations: W3CTextAnnotation[]
  suspendHydration: boolean
}

const AssistantAnnotationHydration = ({
  initialAnnotations,
  suspendHydration,
}: AssistantAnnotationHydrationProps) => {
  const annotator = useAnnotator<
    RecogitoTextAnnotator<TextAnnotation, W3CTextAnnotation> | undefined
  >()

  useEffect(() => {
    if (!annotator || suspendHydration) {
      return
    }

    annotator.setAnnotations(initialAnnotations, true)
  }, [annotator, initialAnnotations, suspendHydration])

  return null
}

type AssistantAnnotationPopupProps = {
  messageId: string
  conversationModel: string
  sourceText: string
  initiallyPersistedAnnotationIds: string[]
  onBranchPendingStateChange: (pending: boolean) => void
  onBranchFollowupCreated?: AssistantMessageAnnotationWrapperProps['onBranchFollowupCreated']
  isBranchPending: boolean
}

const AssistantAnnotationPopup = ({
  messageId,
  conversationModel,
  sourceText,
  initiallyPersistedAnnotationIds,
  onBranchPendingStateChange,
  onBranchFollowupCreated,
  isBranchPending,
}: AssistantAnnotationPopupProps) => {
  const annotator = useAnnotator<
    RecogitoTextAnnotator<TextAnnotation, W3CTextAnnotation> | undefined
  >()
  const utils = trpc.useUtils()
  const branchAndSendFollowupMutation = trpc.branchAndSendFollowup.useMutation()
  const suggestMutation = trpc.messageSuggestFromSelection.useMutation()
  const deleteAnnotationMutation = trpc.messageAnnotationDelete.useMutation()
  const persistedAnnotationIdSet = useMemo(
    () => new Set(initiallyPersistedAnnotationIds),
    [initiallyPersistedAnnotationIds],
  )
  const {
    clearPendingDismissState,
    consumePendingDismiss,
    markAnnotationPersisted,
    removeAnnotationTracking,
    setPendingDismissAnnotation,
  } = useAssistantAnnotationSession({
    annotator,
    initiallyPersistedAnnotationIds,
  })
  const isBranchActionPending = !canSubmitBranchRequest({
    hasPendingBranchRequest: isBranchPending,
    isBranchMutationPending: branchAndSendFollowupMutation.isPending,
  })

  return (
    <TextAnnotationPopup
      asPortal={false}
      onClose={() => {
        if (!annotator) {
          return
        }

        const { annotationId, shouldDelete } = consumePendingDismiss()
        if (!annotationId || !shouldDelete) {
          return
        }

        annotator.removeAnnotation(annotationId)
        removeAnnotationTracking(annotationId)
      }}
      popup={({ annotation }) => {
        const selectedText = getSelectedTextFromAnnotation(annotation)
        setPendingDismissAnnotation(annotation.id)

        // Dismiss — closes the popup without deleting the annotation.
        // For transient annotations (just selected, not yet saved) the selection is cancelled.
        // Deletion of persisted annotations is routed to the 5 s long-press on Branch.
        const handleDismiss = () => {
          if (!annotator) {
            return
          }

          clearPendingDismissState()

          const isPersistedAnnotation = persistedAnnotationIdSet.has(annotation.id)
          if (!isPersistedAnnotation) {
            // Cancel the just-made selection
            annotator.removeAnnotation(annotation.id)
            removeAnnotationTracking(annotation.id)
          }

          annotator.cancelSelected()
        }

        // Delete — removes the annotation locally and from the backend if persisted.
        // Triggered by the 5 s long-press on the Branch button.
        const handleDeleteAnnotation = () => {
          if (!annotator) {
            return
          }

          clearPendingDismissState()
          annotator.removeAnnotation(annotation.id)
          removeAnnotationTracking(annotation.id)
          annotator.cancelSelected()

          const isPersistedAnnotation = persistedAnnotationIdSet.has(annotation.id)
          if (!isPersistedAnnotation) {
            return
          }

          deleteAnnotationMutation.mutate(
            { annotationId: annotation.id },
            {
              onSuccess: async () => {
                await Promise.all([
                  utils.messageAnnotationsByMessage.invalidate({ messageId }),
                  utils.nodesByWorkspace.invalidate(),
                ])
              },
              onError: async (error) => {
                console.error('[assistant-selection] failed to delete annotation', {
                  messageId,
                  annotationId: annotation.id,
                  error: error.message,
                })
                await Promise.all([
                  utils.messageAnnotationsByMessage.invalidate({ messageId }),
                  utils.nodesByWorkspace.invalidate(),
                ])
              },
            },
          )
        }

        const handleConfirmSelection = (inputText: string) => {
          if (!annotator || isBranchActionPending) {
            return
          }

          const trimmedInputText = inputText.trim()
          if (!trimmedInputText.length) {
            return
          }

          const selection = buildBranchSelectionPayload(annotation.target.selector)
          if (!selection) {
            console.error('[assistant-selection] unable to build valid branch selection payload', {
              messageId,
              annotationId: annotation.id,
            })
            clearPendingDismissState()
            annotator.cancelSelected()
            return
          }
          const currentKind = getAnnotationKind(annotation)
          const nextBranchKind = getBranchActionKind(currentKind)
          const sourceAnnotationId =
            nextBranchKind === 'suggestion-branch' && persistedAnnotationIdSet.has(annotation.id)
              ? annotation.id
              : undefined
          const branchActionKind: BranchAndSendFollowupInput['annotationKind'] =
            nextBranchKind === 'suggestion-branch' && !sourceAnnotationId
              ? 'branch'
              : nextBranchKind === 'suggestion-branch'
                ? 'suggestion-branch'
                : 'branch'
          const branchInput: BranchAndSendFollowupInput = {
            messageId,
            sourceAnnotationId,
            annotationKind: branchActionKind,
            idempotencyKey: createIdempotencyKey(),
            selection,
            sourceContext:
              buildSourceContextWindow({
                sourceText: annotator.element.textContent ?? sourceText,
                startOffset: selection.startOffset,
                endOffset: selection.endOffset,
              }) || selectedText.trim(),
            text: trimmedInputText,
            model: conversationModel,
          }
          setAnnotationKind(annotator, annotation, branchActionKind)

          markAnnotationPersisted(annotation.id)
          clearPendingDismissState()
          onBranchPendingStateChange(true)
          console.log('[assistant-selection] selected text', {
            messageId,
            kind: branchActionKind,
            text: selectedText,
            inputText: trimmedInputText,
            annotationId: annotation.id,
          })

          annotator.cancelSelected()
          branchAndSendFollowupMutation.mutate(branchInput, {
            onSuccess: async (result) => {
              onBranchFollowupCreated?.(result.branchNodeId, {
                turnId: result.turnId,
                userFollowupMessageId: result.userFollowupMessageId,
                text: trimmedInputText,
                status: result.status,
              })

              await Promise.all([
                utils.messageAnnotationsByMessage.invalidate({ messageId }),
                utils.nodesByWorkspace.invalidate(),
              ])
            },
            onError: (error) => {
              console.error('[assistant-selection] failed to branch and send follow-up', {
                messageId,
                annotationId: annotation.id,
                error: error.message,
              })
            },
            onSettled: () => {
              onBranchPendingStateChange(false)
            },
          })
        }

        const handleSuggestSelection = (inputText: string) => {
          if (!annotator || suggestMutation.isPending) {
            return
          }

          const selection = buildBranchSelectionPayload(annotation.target.selector)
          if (!selection) {
            console.error('[assistant-selection] unable to build valid suggest selection payload', {
              messageId,
              annotationId: annotation.id,
            })
            clearPendingDismissState()
            annotator.cancelSelected()
            return
          }

          setAnnotationKind(annotator, annotation, 'suggestion')
          markAnnotationPersisted(annotation.id)
          clearPendingDismissState()
          console.log('[assistant-selection] selected text', {
            messageId,
            kind: 'suggestion',
            text: selectedText,
            inputText,
            annotationId: annotation.id,
          })
          annotator.cancelSelected()

          suggestMutation.mutate(
            {
              messageId,
              sourceAnnotationId: persistedAnnotationIdSet.has(annotation.id)
                ? annotation.id
                : undefined,
              selection,
              idempotencyKey: createIdempotencyKey(),
            },
            {
              onSuccess: async (result) => {
                utils.messageAnnotationsByMessage.setData(
                  { messageId },
                  (currentAnnotations) => {
                    const current = currentAnnotations ?? []
                    const alreadyPresent = current.some(
                      (existingAnnotation) => existingAnnotation.id === result.id,
                    )
                    if (alreadyPresent) {
                      return current
                    }

                    return [...current, result]
                  },
                )
                await utils.messageAnnotationsByMessage.invalidate({ messageId })
              },
              onError: async (error) => {
                console.error('[assistant-selection] failed to create suggestion from selection', {
                  messageId,
                  annotationId: annotation.id,
                  error: error.message,
                })
                await utils.messageAnnotationsByMessage.invalidate({ messageId })
              },
            },
          )
        }

        return (
          <AssistantSelectionMenu
            selectedText={selectedText}
            onBranch={handleConfirmSelection}
            onSuggest={handleSuggestSelection}
            onDelete={handleDeleteAnnotation}
            onDismiss={handleDismiss}
            isBranchActionPending={isBranchActionPending}
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

const AssistantExistingAnnotationClickHandler = () => {
  const annotator = useAnnotator<
    RecogitoTextAnnotator<TextAnnotation, W3CTextAnnotation> | undefined
  >()

  useEffect(() => {
    if (!annotator) {
      return
    }

    const handleClick = (event: MouseEvent) => {
      const annotationId = findAnnotationIdFromClick({
        target: event.target,
        clientX: event.clientX,
        clientY: event.clientY,
        doc: document,
        annotatorElement: annotator.element,
        annotations: annotator.state.store.all(),
      })

      if (annotationId) {
        annotator.setSelected(annotationId, true)
      }
    }

    annotator.element.addEventListener('click', handleClick)
    return () => {
      annotator.element.removeEventListener('click', handleClick)
    }
  }, [annotator])

  return null
}

type AssistantAnnotationLoadAnimatorProps = {
  shouldAnimateOnLoad: boolean
}

const AssistantAnnotationLoadAnimator = ({
  shouldAnimateOnLoad,
}: AssistantAnnotationLoadAnimatorProps) => {
  const annotator = useAnnotator<
    RecogitoTextAnnotator<TextAnnotation, W3CTextAnnotation> | undefined
  >()
  const annotations = useAnnotations<TextAnnotation>()
  const hasAnimatedRef = useRef(false)
  const animationCleanupTimeoutRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (
      !shouldAnimateOnLoad ||
      !annotator ||
      hasAnimatedRef.current ||
      annotations.length === 0
    ) {
      return
    }

    let attempts = 0
    const maxAttempts = 12

    const applyLoadAnimation = () => {
      if (typeof window === 'undefined') {
        return
      }

      const highlightSegments = Array.from(
        annotator.element.querySelectorAll<HTMLElement>(
          '.r6o-span-highlight-layer .r6o-annotation',
        ),
      )

      if (highlightSegments.length === 0) {
        attempts += 1
        if (attempts < maxAttempts) {
          animationFrameRef.current = window.requestAnimationFrame(applyLoadAnimation)
        }
        return
      }

      hasAnimatedRef.current = true

      const lengthByAnnotationId = new Map<string, number>(
        annotations.map((annotation) => [annotation.id, getAnnotationTextLength(annotation)]),
      )

      let maxDurationMs = 0
      highlightSegments.forEach((segment) => {
        const annotationId = segment.dataset.annotation
        const textLength = annotationId ? lengthByAnnotationId.get(annotationId) ?? 0 : 0
        const durationMs = Math.max(
          320,
          Math.min(900, Math.round(320 + Math.sqrt(textLength) * 34)),
        )

        segment.classList.remove('assistant-annotation-load-anim')
        segment.style.setProperty('--assistant-annotation-delay', '0ms')
        segment.style.setProperty('--assistant-annotation-duration', `${durationMs}ms`)
        segment.classList.add('assistant-annotation-load-anim')

        if (durationMs > maxDurationMs) {
          maxDurationMs = durationMs
        }
      })

      const totalDurationMs = maxDurationMs + 80
      animationCleanupTimeoutRef.current = window.setTimeout(() => {
        highlightSegments.forEach((segment) => {
          segment.classList.remove('assistant-annotation-load-anim')
          segment.style.removeProperty('--assistant-annotation-delay')
          segment.style.removeProperty('--assistant-annotation-duration')
        })
      }, totalDurationMs)
    }

    if (typeof window !== 'undefined') {
      animationFrameRef.current = window.requestAnimationFrame(applyLoadAnimation)
    }

    return () => {
      if (typeof window === 'undefined') {
        return
      }

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }

      if (animationCleanupTimeoutRef.current !== null) {
        window.clearTimeout(animationCleanupTimeoutRef.current)
      }
    }
  }, [shouldAnimateOnLoad, annotator, annotations])

  return null
}

export const AssistantMessageAnnotationWrapper = ({
  messageId,
  conversationModel = 'gpt-5',
  sourceText = '',
  readOnly = false,
  onBranchFollowupCreated,
  children,
}: AssistantMessageAnnotationWrapperProps) => {
  const [isBranchPending, setIsBranchPending] = useState(false)
  const isPersistedMessageId = useMemo(() => isUuid(messageId), [messageId])
  const shouldEnableAnnotations = isPersistedMessageId && !readOnly

  useEffect(() => {
    setIsBranchPending(false)
  }, [messageId])

  const annotationSource = useMemo(() => buildAnnotationSource(messageId), [messageId])
  const messageAnnotationsQuery = trpc.messageAnnotationsByMessage.useQuery(
    { messageId },
    { enabled: shouldEnableAnnotations },
  )
  const initialAnnotations = useMemo(
    () =>
      (messageAnnotationsQuery.data ?? []).map((annotation) =>
        mapBackendAnnotationToW3C(annotation, annotationSource),
      ),
    [annotationSource, messageAnnotationsQuery.data],
  )
  const initialPersistedAnnotationIds = useMemo(
    () => initialAnnotations.map((annotation) => annotation.id),
    [initialAnnotations],
  )

  if (!shouldEnableAnnotations) {
    return <>{children}</>
  }

  return (
    <Annotorious>
      <TextAnnotator
        className="assistant-annotation-scope"
        adapter={(container) => W3CTextFormat(annotationSource, container)}
        user={LOCAL_ANNOTATION_USER}
        userSelectAction={UserSelectAction.EDIT}
        style={(annotation) => {
          const kind = getAnnotationKind(annotation)

          if (kind === 'suggestion') {
            return {
              fill: '#f9d97a',
              fillOpacity: 0.18,
            }
          }

          return {
            fill: '#f59e0b',
            fillOpacity: 0.3,
            underlineStyle: 'solid',
            underlineColor: '#f59e0b',
            underlineThickness: 2,
            underlineOffset: 2,
          }
        }}
      >
        {children}
        <AssistantAnnotationLoadAnimator
          shouldAnimateOnLoad={initialAnnotations.length > 0}
        />
        <AssistantExistingAnnotationClickHandler />
        <AssistantWholeWordSelectionEnforcer />
        <AssistantAnnotationPopup
          messageId={messageId}
          conversationModel={conversationModel}
          sourceText={sourceText}
          initiallyPersistedAnnotationIds={initialPersistedAnnotationIds}
          onBranchPendingStateChange={setIsBranchPending}
          onBranchFollowupCreated={onBranchFollowupCreated}
          isBranchPending={isBranchPending}
        />
      </TextAnnotator>
      <AssistantAnnotationHydration
        initialAnnotations={initialAnnotations}
        suspendHydration={isBranchPending}
      />
    </Annotorious>
  )
}
