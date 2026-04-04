import { useEffect, useRef } from 'react'
import type {
  RecogitoTextAnnotator,
  TextAnnotation,
  W3CTextAnnotation,
} from '@recogito/react-text-annotator'
import { shouldDeleteAnnotationOnDismiss } from './assistantAnnotationLogic'

type UseAssistantAnnotationSessionParams = {
  annotator: RecogitoTextAnnotator<TextAnnotation, W3CTextAnnotation> | undefined
  initiallyPersistedAnnotationIds: string[]
}

export const useAssistantAnnotationSession = ({
  annotator,
  initiallyPersistedAnnotationIds,
}: UseAssistantAnnotationSessionParams) => {
  const transientAnnotationIdsRef = useRef<Set<string>>(new Set())
  const persistedAnnotationIdsRef = useRef<Set<string>>(
    new Set(initiallyPersistedAnnotationIds),
  )
  const pendingDismissAnnotationIdRef = useRef<string | null>(null)
  const pendingDismissShouldDeleteRef = useRef(false)

  useEffect(() => {
    if (!annotator) {
      return
    }

    const handleCreateAnnotation = (annotation: W3CTextAnnotation) => {
      transientAnnotationIdsRef.current.add(annotation.id)
    }

    const handleDeleteAnnotation = (annotation: W3CTextAnnotation) => {
      transientAnnotationIdsRef.current.delete(annotation.id)
      persistedAnnotationIdsRef.current.delete(annotation.id)
    }

    annotator.on('createAnnotation', handleCreateAnnotation)
    annotator.on('deleteAnnotation', handleDeleteAnnotation)

    return () => {
      annotator.off('createAnnotation', handleCreateAnnotation)
      annotator.off('deleteAnnotation', handleDeleteAnnotation)
    }
  }, [annotator])

  const clearPendingDismissState = () => {
    pendingDismissAnnotationIdRef.current = null
    pendingDismissShouldDeleteRef.current = false
  }

  const shouldDeleteOnDismiss = (annotationId: string): boolean =>
    shouldDeleteAnnotationOnDismiss(
      annotationId,
      transientAnnotationIdsRef.current,
      persistedAnnotationIdsRef.current,
    )

  const setPendingDismissAnnotation = (annotationId: string) => {
    pendingDismissAnnotationIdRef.current = annotationId
    pendingDismissShouldDeleteRef.current = shouldDeleteOnDismiss(annotationId)
  }

  const consumePendingDismiss = () => {
    const pending = {
      annotationId: pendingDismissAnnotationIdRef.current,
      shouldDelete: pendingDismissShouldDeleteRef.current,
    }
    clearPendingDismissState()
    return pending
  }

  const markAnnotationPersisted = (annotationId: string) => {
    transientAnnotationIdsRef.current.delete(annotationId)
    persistedAnnotationIdsRef.current.add(annotationId)
  }

  const removeAnnotationTracking = (annotationId: string) => {
    transientAnnotationIdsRef.current.delete(annotationId)
    persistedAnnotationIdsRef.current.delete(annotationId)
  }

  return {
    clearPendingDismissState,
    consumePendingDismiss,
    markAnnotationPersisted,
    removeAnnotationTracking,
    setPendingDismissAnnotation,
  }
}
