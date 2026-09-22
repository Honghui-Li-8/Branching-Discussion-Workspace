import { Stack } from '../../ui/layout'

// A07 — the "How it works" section (anchor id `features`). The four steps are
// A02's approved proof language, Branch → Explore → Approve → Resume, in the
// glossary's terms; the use cases are the seed workspaces that exist today.
// Descriptive, not persuasive.

const STEPS = [
  {
    term: 'Branch',
    text: 'Select part of an assistant message and start a side conversation from it. The topic you branched from is untouched.',
  },
  {
    term: 'Explore',
    text: 'Work inside the branch for as long as it is useful. It stays attached to the point it came from, so nothing is lost or mixed into the main thread.',
  },
  {
    term: 'Approve and bring back',
    text: 'Ask for a conclusion, then edit, reject or approve it. Approving merges it into the parent topic; "merge" is the supporting term you will see in the interface.',
  },
  {
    term: 'Resume',
    text: 'The merged conclusion appears in the parent conversation, labelled with the branch it came from, and the branch becomes read-only.',
  },
] as const

const USE_CASES = [
  {
    title: 'Project decision',
    text: 'The question "Should I build this project now?" explored as personal value against team value, with branches for productivity gain, a weekly decision habit and time saved per planning cycle. Several branches were approved and merged back.',
  },
  {
    title: 'Database selection',
    text: 'PostgreSQL on RDS, MongoDB Atlas and DynamoDB, each explored as its own branch with its own risks: operational burden, document-model fit, multi-document transactions.',
  },
  {
    title: 'Project walkthrough',
    text: 'The architecture of this product as topics: the workspace tree and its conversations, the turn lifecycle and streaming, idempotency and retries, branch provenance.',
  },
] as const

export const HowItWorks = () => (
  <Stack gap="8">
    <p className="m-0 max-w-prose text-body text-text-secondary">
      A branch is a side conversation that stays visible in the tree and can return a reviewed
      conclusion to the topic it came from. That loop has four steps.
    </p>

    {/* role="list" restores list semantics that WebKit drops when list-style is none. */}
    <ol role="list" className="m-0 grid list-none gap-6 p-0 md:grid-cols-2">
      {STEPS.map((step, index) => (
        <li key={step.term} className="flex gap-4">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-label font-semibold text-accent-strong"
          >
            {index + 1}
          </span>
          <Stack gap="1">
            <h3 className="m-0 text-body font-semibold text-text-default">{step.term}</h3>
            <p className="m-0 text-label text-text-secondary">{step.text}</p>
          </Stack>
        </li>
      ))}
    </ol>

    <Stack gap="4">
      <h3 className="m-0 text-body font-semibold text-text-default">Use cases</h3>
      <ul role="list" className="m-0 grid list-none gap-4 p-0 lg:grid-cols-3">
        {USE_CASES.map((useCase) => (
          <li key={useCase.title}>
            <Stack gap="2" className="h-full rounded-lg border border-border-default bg-bg-default p-5">
              <h4 className="m-0 text-body font-medium text-text-default">{useCase.title}</h4>
              <p className="m-0 text-label text-text-secondary">{useCase.text}</p>
              <p className="m-0 mt-auto text-caption text-text-muted">Available as a starting example after sign-in.</p>
            </Stack>
          </li>
        ))}
      </ul>
    </Stack>
  </Stack>
)
