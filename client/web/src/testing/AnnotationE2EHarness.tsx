import { useAnnotations, useAnnotator } from '@annotorious/react'
import {
  type RecogitoTextAnnotator,
  type TextAnnotation,
  type W3CTextAnnotation,
} from '@recogito/react-text-annotator'
import { AssistantMessageAnnotationWrapper } from '../components/conversation/AssistantMessageAnnotations'

const E2E_MESSAGE_ID = 'e2e-assistant-message'
const E2E_TEXT = `This is a stable test paragraph so we can validate annotation dismiss behavior with advanced PG features and branch controls.`
const E2E_MARK_TEXT = 'advanced PG features'
const E2E_MARK_START = E2E_TEXT.indexOf(E2E_MARK_TEXT)
const E2E_MARK_END = E2E_MARK_START + E2E_MARK_TEXT.length

const AnnotationE2EControls = () => {
  const annotator = useAnnotator<
    RecogitoTextAnnotator<TextAnnotation, W3CTextAnnotation> | undefined
  >()

  const createTransientAnnotation = () => {
    if (!annotator || E2E_MARK_START < 0) {
      return
    }

    const textContainer = annotator.element.querySelector<HTMLElement>(
      '[data-testid="e2e-annotation-text"]',
    )
    const textNode = textContainer?.firstChild
    if (!textContainer || !textNode || textNode.nodeType !== Node.TEXT_NODE) {
      return
    }

    const ownerDocument = textContainer.ownerDocument
    const range = ownerDocument.createRange()
    range.setStart(textNode, E2E_MARK_START)
    range.setEnd(textNode, E2E_MARK_END)

    const id = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`

    const annotation: TextAnnotation = {
      id,
      bodies: [],
      target: {
        annotation: id,
        selector: [
          {
            id: `${id}-selector`,
            quote: E2E_MARK_TEXT,
            start: E2E_MARK_START,
            end: E2E_MARK_END,
            range,
            offsetReference: textContainer,
          },
        ],
      },
    }

    annotator.state.store.addAnnotation(annotation)
    annotator.setSelected(id, true)
  }

  const openFirstAnnotation = () => {
    if (!annotator) {
      return
    }

    const firstAnnotation = annotator.state.store.all()[0]
    if (!firstAnnotation) {
      return
    }

    annotator.setSelected(firstAnnotation.id, true)
  }

  return (
    <div className="mb-3 flex items-center gap-2">
      <button
        type="button"
        data-testid="e2e-create-transient-annotation"
        onClick={createTransientAnnotation}
        className="rounded-md border border-[#b6cfdf] bg-white px-2 py-1 text-xs font-medium text-[#2f5f7a]"
      >
        Create Transient Annotation
      </button>
      <button
        type="button"
        data-testid="e2e-open-first-annotation"
        onClick={openFirstAnnotation}
        className="rounded-md border border-[#b6cfdf] bg-white px-2 py-1 text-xs font-medium text-[#2f5f7a]"
      >
        Open First Annotation
      </button>
    </div>
  )
}

const AnnotationE2EStatus = () => {
  const annotations = useAnnotations<TextAnnotation>()

  return (
    <p
      data-testid="e2e-annotation-count"
      className="mb-2 text-xs font-medium text-[#456a82]"
    >
      Annotation count: {annotations.length}
    </p>
  )
}

export const AnnotationE2EHarness = () => {
  return (
    <div className="min-h-screen bg-[#f4fbff] p-6 text-[#1f4f68]">
      <h1 data-testid="e2e-page-title" className="m-0 text-xl font-semibold">
        Annotation E2E Harness
      </h1>
      <p className="mt-2 mb-4 max-w-2xl text-sm">
        This page exists only to verify annotation popup dismiss behavior.
      </p>

      <div
        data-testid="e2e-outside-dismiss-area"
        className="mb-4 rounded-md border border-dashed border-[#b8d6e9] bg-[#f8fdff] px-3 py-2 text-xs"
      >
        Outside area for popup dismiss clicks
      </div>

      <div className="max-w-2xl rounded-xl border border-[#a6cde2] bg-white/80 p-4">
        <AssistantMessageAnnotationWrapper messageId={E2E_MESSAGE_ID}>
          <AnnotationE2EStatus />
          <AnnotationE2EControls />
          <p data-testid="e2e-annotation-text" className="m-0 text-sm leading-relaxed">
            {E2E_TEXT}
          </p>
        </AssistantMessageAnnotationWrapper>
      </div>
    </div>
  )
}
