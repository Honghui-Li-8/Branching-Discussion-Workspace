export type AssistantAnnotationKind = 'suggestion' | 'branch' | 'suggestion-branch' | 'branch-origin'
export type AnnotationInteractionMode = 'edit' | 'select' | 'none'

export const ASSISTANT_ANNOTATION_KIND_PREFIX = 'assistant-kind:'

export const isAnnotationKind = (kind: string): kind is AssistantAnnotationKind =>
  kind === 'suggestion' || kind === 'branch' || kind === 'suggestion-branch' || kind === 'branch-origin'

export const parseAnnotationKindTag = (
  value?: string,
): AssistantAnnotationKind | null => {
  if (!value || !value.startsWith(ASSISTANT_ANNOTATION_KIND_PREFIX)) {
    return null
  }

  const nextKind = value.slice(ASSISTANT_ANNOTATION_KIND_PREFIX.length)
  return isAnnotationKind(nextKind) ? nextKind : null
}

export const resolveAnnotationKind = ({
  propertiesKind,
  legacyTagValue,
}: {
  propertiesKind?: unknown
  legacyTagValue?: string
}): AssistantAnnotationKind => {
  if (typeof propertiesKind === 'string' && isAnnotationKind(propertiesKind)) {
    return propertiesKind
  }

  const kindFromLegacyTag = parseAnnotationKindTag(legacyTagValue)
  return kindFromLegacyTag ?? 'branch'
}

export const getBranchActionKind = (
  currentKind: AssistantAnnotationKind,
): AssistantAnnotationKind =>
  currentKind === 'suggestion' ? 'suggestion-branch' : 'branch'

export const isDisplayOnlyAnnotationKind = (
  kind: AssistantAnnotationKind,
): boolean =>
  kind === 'branch-origin'

export const getAnnotationInteractionMode = ({
  kind,
  readOnly,
}: {
  kind: AssistantAnnotationKind
  readOnly: boolean
}): AnnotationInteractionMode => {
  if (readOnly) {
    return 'none'
  }

  return isDisplayOnlyAnnotationKind(kind) ? 'select' : 'edit'
}

export const shouldDeleteAnnotationOnDismiss = (
  annotationId: string,
  transientAnnotationIds: Set<string>,
  persistedAnnotationIds: Set<string>,
): boolean =>
  transientAnnotationIds.has(annotationId) || !persistedAnnotationIds.has(annotationId)
