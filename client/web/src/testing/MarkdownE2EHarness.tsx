import type { ReactNode } from 'react'
import { AssistantMessageAnnotationWrapper } from '../components/conversation/AssistantMessageAnnotations'
import { ModelMarkdown } from '../components/conversation/ModelMarkdown'
import {
  MD_ANNOTATION_TARGET,
  MD_BLOCKQUOTE,
  MD_CODE_BASH,
  MD_CODE_JS,
  MD_CODE_JSON,
  MD_CODE_PLAIN,
  MD_CODE_TS,
  MD_CODE_TSX,
  MD_CODE_UNKNOWN,
  MD_DIVIDER,
  MD_EMPHASIS,
  MD_HEADINGS,
  MD_IMAGE,
  MD_INLINE_CODE,
  MD_LOOSE_ORDERED_LIST,
  MD_NESTED_LISTS,
  MD_ORDERED_LIST,
  MD_RAW_HTML,
  MD_REPEATED_ONE_LIST,
  MD_TABLE,
  MD_TASK_LIST,
} from './markdownFixture'

// Stable UUID so AssistantMessageAnnotationWrapper enables full annotation behavior.
// Non-UUID ids disable annotation queries; this value must remain stable across runs
// so Commit 5 Playwright mocks can key off the same id.
const ANNOTATION_FIXTURE_MESSAGE_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890'

const Section = ({
  testId,
  label,
  children,
}: {
  testId: string
  label: string
  children: ReactNode
}) => (
  <div data-testid={testId} className="mb-6">
    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6a8fa8]">{label}</p>
    <div className="rounded-xl border border-[#a6cde2] bg-white/80 p-4">{children}</div>
  </div>
)

export const MarkdownE2EHarness = () => {
  return (
    <div className="min-h-screen bg-[#f4fbff] p-6 text-[#1f4f68]">
      <h1 data-testid="e2e-page-title" className="m-0 text-xl font-semibold">
        Markdown Rendering Fixture
      </h1>
      <p className="mt-2 mb-6 max-w-2xl text-sm">
        Assistant Markdown rendering fixture. Open via{' '}
        <code className="rounded bg-[#eef6fb] px-1 font-mono text-xs">/e2e.html?fixture=markdown</code>.
      </p>

      <div className="max-w-2xl">
        <Section testId="fixture-ordered-list" label="Ordered list (1. 2. 3.)">
          <ModelMarkdown content={MD_ORDERED_LIST} />
        </Section>

        <Section testId="fixture-repeated-one-list" label="Repeated 1. input">
          <ModelMarkdown content={MD_REPEATED_ONE_LIST} />
        </Section>

        <Section testId="fixture-loose-ordered-list" label="Loose ordered list">
          <ModelMarkdown content={MD_LOOSE_ORDERED_LIST} />
        </Section>

        <Section testId="fixture-nested-lists" label="Nested ul / ol">
          <ModelMarkdown content={MD_NESTED_LISTS} />
        </Section>

        <Section testId="fixture-headings" label="Headings h1–h6">
          <ModelMarkdown content={MD_HEADINGS} />
        </Section>

        <Section testId="fixture-emphasis" label="Emphasis / strikethrough">
          <ModelMarkdown content={MD_EMPHASIS} />
        </Section>

        <Section testId="fixture-divider" label="Divider">
          <ModelMarkdown content={MD_DIVIDER} />
        </Section>

        <Section testId="fixture-blockquote" label="Blockquote">
          <ModelMarkdown content={MD_BLOCKQUOTE} />
        </Section>

        <Section testId="fixture-table" label="Table">
          <ModelMarkdown content={MD_TABLE} />
        </Section>

        <Section testId="fixture-task-list" label="Task list">
          <ModelMarkdown content={MD_TASK_LIST} />
        </Section>

        <Section testId="fixture-inline-code" label="Inline code">
          <ModelMarkdown content={MD_INLINE_CODE} />
        </Section>

        <Section testId="fixture-raw-html" label="Raw HTML (must not become live DOM)">
          <ModelMarkdown content={MD_RAW_HTML} />
        </Section>

        <Section testId="fixture-image" label="Image Markdown (must not render as img)">
          <ModelMarkdown content={MD_IMAGE} />
        </Section>

        <Section testId="fixture-code-ts" label="Code: TypeScript (ts)">
          <ModelMarkdown content={MD_CODE_TS} />
        </Section>

        <Section testId="fixture-code-tsx" label="Code: TSX">
          <ModelMarkdown content={MD_CODE_TSX} />
        </Section>

        <Section testId="fixture-code-js" label="Code: JavaScript (js)">
          <ModelMarkdown content={MD_CODE_JS} />
        </Section>

        <Section testId="fixture-code-json" label="Code: JSON">
          <ModelMarkdown content={MD_CODE_JSON} />
        </Section>

        <Section testId="fixture-code-bash" label="Code: Bash">
          <ModelMarkdown content={MD_CODE_BASH} />
        </Section>

        <Section testId="fixture-code-unknown" label="Code: Unknown language (must not throw)">
          <ModelMarkdown content={MD_CODE_UNKNOWN} />
        </Section>

        <Section testId="fixture-code-plain" label="Code: No language tag">
          <ModelMarkdown content={MD_CODE_PLAIN} />
        </Section>

        {/*
          Annotation offset target — label and wrapper div are OUTSIDE AssistantMessageAnnotationWrapper.
          Only ModelMarkdown sits inside the wrapper boundary so Playwright offset assertions
          target production-like message content, not fixture chrome.
        */}
        <div data-testid="markdown-annotation-section" className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6a8fa8]">
            Annotation offset target (UUID message id: {ANNOTATION_FIXTURE_MESSAGE_ID})
          </p>
          <div className="rounded-xl border border-[#a6cde2] bg-white/80 p-4">
            <AssistantMessageAnnotationWrapper messageId={ANNOTATION_FIXTURE_MESSAGE_ID}>
              <ModelMarkdown content={MD_ANNOTATION_TARGET} />
            </AssistantMessageAnnotationWrapper>
          </div>
        </div>
      </div>
    </div>
  )
}
