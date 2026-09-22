import { Link } from '../../ui/link'
import { Stack } from '../../ui/layout'
import { CONTACT_URL } from '../../../routePaths'

// A08 — the Terms section (footer-only anchor id `terms`). Four plain
// paragraphs: beta expectations, acceptable use, no guarantee, contact.
// Drafted by the agent for owner review in the PR; not legal advice and not
// written as a legal template (A08 Content Scope).

export const Terms = () => (
  <Stack gap="4" className="max-w-prose">
    <div>
      <h3 className="m-0 text-body font-semibold text-text-default">Beta expectations</h3>
      <p className="m-0 mt-1 text-label text-text-secondary">
        Trellis is an early beta run by one person. Features, wording and behaviour change without
        notice, and data can be lost — especially on the hosted review environment, where data is
        disposable and a deploy signs everyone out. There is no support commitment.
      </p>
    </div>
    <div>
      <h3 className="m-0 text-body font-semibold text-text-default">Acceptable use</h3>
      <p className="m-0 mt-1 text-label text-text-secondary">
        Use Trellis for your own conversations and content, within the law. Do not try to access
        other people&rsquo;s data, disrupt the service, or use it to generate content you are not
        permitted to create.
      </p>
    </div>
    <div>
      <h3 className="m-0 text-body font-semibold text-text-default">No guarantee</h3>
      <p className="m-0 mt-1 text-label text-text-secondary">
        Trellis is provided as is. There is no guarantee of availability, accuracy of generated
        responses, or durability of stored data. You are responsible for keeping copies of anything
        you need.
      </p>
    </div>
    <div>
      <h3 className="m-0 text-body font-semibold text-text-default">Contact</h3>
      <p className="m-0 mt-1 text-label text-text-secondary">
        Questions, problems and deletion requests go through{' '}
        <Link href={CONTACT_URL} target="_blank">
          the project&rsquo;s GitHub issues
        </Link>
        .
      </p>
    </div>
  </Stack>
)
