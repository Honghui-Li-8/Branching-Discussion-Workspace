import { Link } from '../ui/link'
import { Stack } from '../ui/layout'
import { CONTACT_URL } from '../../routePaths'
import { LegalBlock, LegalPage } from './LegalPage'

// A08 — the Privacy page (route `/privacy`; a footer-only landing section
// until A08b moved it here, copy unchanged). Five blocks, the reviewed Figma
// Privacy structure, with every statement checked against the schema, the
// environment configuration and A00b's hosting decisions (2026-09-15 decisions
// report, Q8). Owner-reviewed in the PR. No claim about encryption,
// compliance, non-training or deletion timing.

const BLOCKS = [
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

export const PrivacyRoute = () => (
  <LegalPage title="Privacy">
    <p className="m-0 text-body text-text-secondary">
      What Trellis collects, how it is stored, and which third parties are involved — described
      plainly, without claims the code cannot back.
    </p>
    <Stack gap="5">
      {BLOCKS.map((block) => (
        <LegalBlock
          key={block.title}
          title={block.title}
          body={block.body}
          link={
            'contact' in block ? (
              <Link href={CONTACT_URL} target="_blank">
                Request deletion via GitHub
              </Link>
            ) : null
          }
        />
      ))}
    </Stack>
  </LegalPage>
)
