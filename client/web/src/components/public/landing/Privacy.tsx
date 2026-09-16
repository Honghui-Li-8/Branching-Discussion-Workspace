import { Link } from '../../ui/link'
import { Stack } from '../../ui/layout'
import { CONTACT_URL } from '../../../routePaths'

// A08 — the Privacy section (footer-only anchor id `privacy`). Five cards, the
// reviewed Figma Privacy structure, with every statement checked against the
// schema, the environment configuration and A00b's hosting decisions
// (2026-09-15 decisions report, Q8). Owner-reviewed in the PR. No claim about
// encryption, compliance, non-training or deletion timing.

const CARDS = [
  {
    title: 'What we collect',
    body: 'Your Google profile information (name and email) when you sign in, the workspaces, topics, messages, branches and annotations you create, and a credit balance with basic usage counts needed to operate the product.',
  },
  {
    title: 'How it is stored',
    body: 'Conversation and account data is stored in a Postgres database; on the hosted review environment that database is a Supabase project. A session cookie keeps you signed in.',
  },
  {
    title: 'Processing',
    body: 'The content of your messages is sent to OpenAI to generate responses. That is the only model provider in use.',
  },
  {
    title: 'Retention and deletion',
    body: 'There is no automated deletion or retention schedule. Data stays until it is removed by hand. To request deletion of your account or data, open an issue on GitHub; requests are handled manually.',
    contact: true,
  },
  {
    title: 'Third parties involved',
    body: 'Google (sign-in), Supabase (authentication and database), OpenAI (responses), Vercel (client hosting) and Fly.io (API hosting). Nothing is sold or shared for advertising.',
  },
] as const

export const Privacy = () => (
  <Stack gap="4">
    <p className="m-0 max-w-prose text-body text-text-secondary">
      What Trellis collects, how it is stored, and which third parties are involved — described
      plainly, without claims the code cannot back.
    </p>
    <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
      {CARDS.map((card) => (
        <li key={card.title}>
          <Stack gap="2" className="h-full rounded-lg border border-border-default bg-bg-default p-5">
            <h3 className="m-0 text-body font-semibold text-text-default">{card.title}</h3>
            <p className="m-0 text-label text-text-secondary">{card.body}</p>
            {'contact' in card ? (
              <p className="m-0 mt-auto text-label">
                <Link href={CONTACT_URL} target="_blank">
                  Request deletion via GitHub
                </Link>
              </p>
            ) : null}
          </Stack>
        </li>
      ))}
    </ul>
  </Stack>
)
