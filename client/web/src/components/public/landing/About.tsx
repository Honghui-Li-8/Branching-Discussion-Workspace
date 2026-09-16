import { Link } from '../../ui/link'
import { Stack } from '../../ui/layout'
import { sectionHref } from '../../../routePaths'

// A08 — the About section (anchor id `about`): the three cards from the
// reviewed Figma About page, in A02's plain voice. The limitations card
// points at "Where things stand" rather than restating it; the Figma
// wording "single account per user" is superseded by the corrected sentence.

const CARDS = [
  {
    title: 'Why branching',
    body: 'Linear chat threads make it hard to explore an alternate direction without losing the original context. Trellis treats exploration as a first-class action: branch from any point, follow it as far as it is useful, and decide afterwards whether it belongs in the main thread.',
  },
  {
    title: 'About this project',
    body: 'Trellis is a solo side project, built to explore what a branching, mergeable interface for AI conversations could look like, and to serve as a portfolio piece. It is not a commercial product, and there is no team or company behind it. Interface, terminology and behaviour may change as it evolves.',
  },
  {
    title: 'Current limitations',
    body: 'Trellis is in early beta. Workspaces are private to the account that created them, with no sharing or collaboration, and some interface areas are still being polished in the current development phase (MVP 1.5). Nothing here is a promise of a specific date or feature.',
    link: { to: sectionHref('roadmap'), label: 'See where things stand' },
  },
] as const

export const About = () => (
  <ul role="list" className="m-0 grid list-none gap-4 p-0 lg:grid-cols-3">
    {CARDS.map((card) => (
      <li key={card.title}>
        <Stack gap="2" className="h-full rounded-lg border border-border-default bg-bg-default p-5">
          <h3 className="m-0 text-body font-semibold text-text-default">{card.title}</h3>
          <p className="m-0 text-label text-text-secondary">{card.body}</p>
          {'link' in card ? (
            <p className="m-0 mt-auto text-label">
              <Link to={card.link.to}>{card.link.label}</Link>
            </p>
          ) : null}
        </Stack>
      </li>
    ))}
  </ul>
)
