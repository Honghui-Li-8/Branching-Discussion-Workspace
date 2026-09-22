// A08 — the public changelog, as data. The only source the landing reads;
// edit here, never in the component. Entries are what actually shipped or is
// actually in progress; nothing planned is listed, because nothing planned is
// committed or scheduled (A08: no promises of dates or features).

export type ChangelogStatus = 'shipped' | 'in-progress'

export type ChangelogEntry = {
  version: string
  label: string
  status: ChangelogStatus
  summary: string
  bullets: readonly string[]
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: 'MVP 1.5',
    label: 'Current preview',
    status: 'in-progress',
    summary: 'The current development pass: a public face, a refreshed visual system, and continued polish across the product.',
    bullets: [
      'Public landing, sign-in and not-found pages inside one shared shell',
      'Design system rebuilt on semantic tokens, with accessibility and reflow checks in CI',
      'Sign-in surface, callback handling and a not-found page with recovery links',
    ],
  },
  {
    version: 'MVP 1',
    label: 'Initial release',
    status: 'shipped',
    summary: 'The first working version: conversations with AI responses, branching, and merging back.',
    bullets: [
      'Conversation interface with streamed AI responses',
      'Branch from a selection, explore, then approve and bring the conclusion back',
      'Google sign-in',
    ],
  },
]
