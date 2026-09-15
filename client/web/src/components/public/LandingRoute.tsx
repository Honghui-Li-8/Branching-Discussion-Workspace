import { Link, useHashFocus } from '../ui/link'
import { Container, Stack } from '../ui/layout'
import { PATHS, SECTIONS } from '../../routePaths'

// A06 — the public landing route, as an explicit placeholder.
//
// No copywriting happens here (A07 owns the story, the section list and all
// content). What this surface commits to: the A02-approved name and plain
// descriptor as the page's one h1, and heading-only section stubs with stable
// ids so navigation and anchor links have real targets until A07 replaces them.
//
// The interim sign-in link exists because, until Commit 4's header CTA lands,
// it is a visitor's only path to `/login`.
export const LandingRoute = () => {
  useHashFocus()

  return (
    <main id="main" tabIndex={-1}>
      <Container>
        <Stack gap="12" className="py-12">
          <Stack as="header" gap="3">
            <h1 className="text-display font-semibold text-text-default">Trellis</h1>
            <p className="max-w-narrow text-body text-text-secondary">
              A chat tool where you branch off any message into a side conversation, then
              bring the conclusion back to the main thread.
            </p>
            <p className="text-label">
              <Link to={PATHS.login}>Sign in</Link>
            </p>
          </Stack>

          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              tabIndex={-1}
              aria-labelledby={`${section.id}-heading`}
              className="scroll-mt-6"
            >
              <h2 id={`${section.id}-heading`} className="text-heading font-medium text-text-default">
                {section.label}
              </h2>
            </section>
          ))}
        </Stack>
      </Container>
    </main>
  )
}
