import { Link } from '../ui/link'
import { Stack } from '../ui/layout'
import { CONTACT_URL } from '../../routePaths'
import { LegalBlock, LegalPage } from './LegalPage'

// A08 — the Terms page (route `/terms`; a footer-only landing section until
// A08b moved it here, copy unchanged). Four plain paragraphs: beta
// expectations, acceptable use, no guarantee, contact. Drafted by the agent
// for owner review in the PR; not legal advice and not written as a legal
// template (A08 Content Scope).

export const TermsRoute = () => (
  <LegalPage title="Terms">
    <Stack gap="5">
      <LegalBlock
        title="Beta expectations"
        body="Trellis is an early beta run by one person. Features, wording and behaviour change without notice, and data can be lost — especially on the hosted review environment, where data is disposable and a deploy signs everyone out. There is no support commitment."
      />
      <LegalBlock
        title="Acceptable use"
        body={
          <>
            Use Trellis for your own conversations and content, within the law. Do not try to access
            other people&rsquo;s data, disrupt the service, or use it to generate content you are not
            permitted to create.
          </>
        }
      />
      <LegalBlock
        title="No guarantee"
        body="Trellis is provided as is. There is no guarantee of availability, accuracy of generated responses, or durability of stored data. You are responsible for keeping copies of anything you need."
      />
      <LegalBlock
        title="Contact"
        body={
          <>
            Questions, problems and deletion requests go through{' '}
            <Link href={CONTACT_URL} target="_blank">
              the project&rsquo;s GitHub issues
            </Link>
            .
          </>
        }
      />
    </Stack>
  </LegalPage>
)
