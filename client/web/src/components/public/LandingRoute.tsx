import { useAppSelector } from '../../store/hooks'
import { selectAuthStatus } from '../../store/slices/authSlice'
import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'
import { PATHS, SECTIONS, sectionHref, type SectionId } from '../../routePaths'
import { buttonVariants } from '../ui/button'
import { Link, useHashFocus } from '../ui/link'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { Container, Cluster, Stack } from '../ui/layout'
import { HowItWorks } from './landing/HowItWorks'
import { WhereThingsStand } from './landing/WhereThingsStand'
import { About } from './landing/About'

// A07 — the public landing page, rendered inside PublicShell.
//
// Voice and vocabulary come from A02's approved narrative package: the
// descriptor is A02's, corrected 2026-09-18 (A08b) to say "an assistant reply"
// because that is the only thing the product branches from; every noun is in
// its glossary, and nothing here is a pitch. The hero shows the real product — a screenshot of the seeded intro
// workspace produced by scripts/capture-landing-visual.mjs — never an
// illustration. The primary action is a link: /login owns sign-in and its
// pending and failure states (A06).
//
// Section ids are stable anchors shared with the shell's navigation
// (routePaths.ts); each section keeps tabIndex={-1} and aria-labelledby so
// deep links can scroll and focus it (useHashFocus).

/** Produced by `yarn workspace web capture:landing-visual`; see the client README. */
const HERO_VISUAL = {
  src: '/landing/intro-workspace-tree.png',
  width: 2540,
  height: 760,
  alt:
    'The Trellis workspace for the seed example "Project Decision": a tree of topics branching from ' +
    'the question "Should I build this project now?". Three branches are marked Exploring, two are ' +
    'Approved, and folded counts show further topics beneath each.',
}

const Hero = () => {
  const authStatus = useAppSelector(selectAuthStatus)

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
      <Stack gap="5">
        <Stack gap="3">
          <h1 className="m-0 text-display font-semibold text-text-default">Trellis</h1>
          <p className="m-0 max-w-narrow text-body text-text-secondary">
            A chat tool where you branch off an assistant reply into a side conversation, then
            bring the conclusion back to the main thread.
          </p>
          <p className="m-0 max-w-narrow text-label text-text-muted">
            An early beta and a solo side project.{' '}
            <Link to={sectionHref('roadmap')}>See where things stand.</Link>
          </p>
        </Stack>

        {/* Nothing is promised while sign-in status is unknown — the same rule as the shell's CTA. */}
        {authStatus !== 'unknown' ? (
          <Cluster gap="4">
            {authStatus === 'authenticated' ? (
              <Link
                to={PATHS.root}
                className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'no-underline hover:text-white hover:no-underline')}
              >
                Open workspace
              </Link>
            ) : (
              <Link
                to={PATHS.login}
                className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'no-underline hover:text-white hover:no-underline')}
              >
                Sign in with Google
              </Link>
            )}
            <Link to={sectionHref('features')} className="text-label">
              See how it works
            </Link>
          </Cluster>
        ) : null}
      </Stack>

      <figure className="m-0 overflow-hidden rounded-lg border border-border-default bg-bg-default shadow-card">
        <img
          src={HERO_VISUAL.src}
          width={HERO_VISUAL.width}
          height={HERO_VISUAL.height}
          alt={HERO_VISUAL.alt}
          className="block h-auto w-full"
          decoding="async"
        />
      </figure>
    </div>
  )
}

/** Section bodies by anchor id (A07: features, roadmap; A08: about). Privacy and
 *  Terms left the landing with A08b — they are routes now, not sections. */
const SECTION_BODIES: Partial<Record<SectionId, ReactNode>> = {
  features: <HowItWorks />,
  roadmap: <WhereThingsStand />,
  about: <About />,
}

export const LandingRoute = () => {
  useHashFocus()
  useDocumentTitle()

  return (
    <Container>
      <Stack gap="16" className="py-12">
        <Hero />

        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            tabIndex={-1}
            aria-labelledby={`${section.id}-heading`}
            className="scroll-mt-6 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2"
          >
            <Stack gap="6">
              <h2 id={`${section.id}-heading`} className="m-0 text-heading font-medium text-text-default">
                {section.label}
              </h2>
              {SECTION_BODIES[section.id]}
            </Stack>
          </section>
        ))}
      </Stack>
    </Container>
  )
}
