import type { ReactNode } from 'react'
import { Container, Stack } from '../ui/layout'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

// A08b — the shared layout behind /privacy and /terms, rendered inside
// PublicShell. Deliberately plain: neither page has a Figma source, so they
// stay text in a prose-width column rather than borrowing a treatment the design
// never drew. One h1 per page (A06), titled through useDocumentTitle, with the
// last-updated line the only text A08b adds to the moved copy.

const LAST_UPDATED = 'Last updated 2026-09-18'

export const LegalPage = ({ title, children }: { title: string; children: ReactNode }) => {
  useDocumentTitle(title)

  return (
    <Container width="prose">
      <Stack gap="6" className="py-12">
        <Stack gap="1">
          <h1 className="m-0 text-title font-semibold text-text-default">{title}</h1>
          <p className="m-0 text-caption text-text-muted">{LAST_UPDATED}</p>
        </Stack>
        {children}
      </Stack>
    </Container>
  )
}

/** One block of legal copy: a heading, its paragraph, and an optional trailing link. */
export const LegalBlock = ({
  title,
  body,
  link,
}: {
  title: string
  body: ReactNode
  link?: ReactNode
}) => (
  <div>
    <h2 className="m-0 text-body font-semibold text-text-default">{title}</h2>
    <p className="m-0 mt-1 text-label text-text-secondary">{body}</p>
    {link ? <p className="m-0 mt-2 text-label">{link}</p> : null}
  </div>
)
