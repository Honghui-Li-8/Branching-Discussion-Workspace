import { ICONS } from '../../../lib/icons'
import { Card, CardGrid } from './CardGrid'

// A07 — the two blocks this file supplies bodies for. The four steps are A02's
// approved proof language, Branch → Explore → Approve → Resume, in the
// glossary's terms; the use cases are the seed workspaces that exist today.
// Descriptive, not persuasive.
//
// A08b split them: "How it works" (anchor id `features`) and "Use cases" are
// siblings now, each introduced by its own SectionHead, so neither owns a
// wrapper heading. The intro paragraph that used to open the section became the
// "How it works" subtitle — same sentence, one place.

const STEPS = [
  {
    icon: ICONS.branch,
    term: 'Branch',
    text: 'Select part of an assistant message and start a side conversation from it. The topic you branched from is untouched.',
  },
  {
    icon: ICONS.explore,
    term: 'Explore',
    text: 'Work inside the branch for as long as it is useful. It stays attached to the point it came from, so nothing is lost or mixed into the main thread.',
  },
  {
    icon: ICONS.approve,
    term: 'Approve and bring back',
    text: 'Ask for a conclusion, then edit, reject or approve it. Approving merges it into the parent topic; "merge" is the supporting term you will see in the interface.',
  },
  {
    icon: ICONS.resume,
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

// The step number stays visible text rather than a decorative badge: the order
// is the content here, and a screen reader that meets the cards out of order
// would otherwise have nothing to go on.
export const ProofSteps = () => (
  <CardGrid as="ol" columns={4}>
    {STEPS.map((step, index) => (
      <Card key={step.term} icon={step.icon} caption={`Step ${index + 1}`} title={step.term}>
        <p className="m-0 text-label text-text-secondary">{step.text}</p>
      </Card>
    ))}
  </CardGrid>
)

export const UseCases = () => (
  <CardGrid columns={3}>
    {USE_CASES.map((useCase) => (
      <Card
        key={useCase.title}
        title={useCase.title}
        footer={
          <p className="m-0 text-caption text-text-muted">
            Available as a starting example after sign-in.
          </p>
        }
      >
        <p className="m-0 text-label text-text-secondary">{useCase.text}</p>
      </Card>
    ))}
  </CardGrid>
)
