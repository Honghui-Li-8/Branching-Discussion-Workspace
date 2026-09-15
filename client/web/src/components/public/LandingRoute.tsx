import { useHashFocus } from '../ui/link'
import { Container, Stack } from '../ui/layout'
import { SECTIONS } from '../../routePaths'

// A06 — the public landing route, as an explicit placeholder.
//
// No copywriting happens here (A07 owns the story, the section list and all
// content). What this surface commits to: the A02-approved name and plain
// descriptor as the page's one h1, and heading-only section stubs with stable
// ids so navigation and anchor links have real targets until A07 replaces them.
// The shell around it supplies the sign-in action.
export const LandingRoute = () => {
  useHashFocus()

  return (
    <Container>
      <Stack gap="12" className="py-12">
        <Stack gap="3">
          <h1 className="text-display font-semibold text-text-default">Trellis</h1>
          <p className="max-w-narrow text-body text-text-secondary">
            A chat tool where you branch off any message into a side conversation, then
            bring the conclusion back to the main thread.
          </p>
        </Stack>

        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            tabIndex={-1}
            aria-labelledby={`${section.id}-heading`}
            className="scroll-mt-6 outline-none"
          >
            <h2 id={`${section.id}-heading`} className="text-heading font-medium text-text-default">
              {section.label}
            </h2>
          </section>
        ))}
      </Stack>
    </Container>
  )
}
