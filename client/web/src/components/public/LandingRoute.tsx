import { useAppSelector } from '../../store/hooks'
import { selectAuthStatus } from '../../store/slices/authSlice'
import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'
import { PATHS, sectionHref } from '../../routePaths'
import { buttonVariants } from '../ui/button'
import { Link, useHashFocus } from '../ui/link'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { Cluster, Stack } from '../ui/layout'
import { Band } from './landing/Band'
import { SectionHead } from './landing/SectionHead'
import { LANDING_BLOCKS, type LandingBlockKey } from './landing/sections'
import { ProofSteps, UseCases } from './landing/HowItWorks'
import { WhereThingsStand } from './landing/WhereThingsStand'
import { Changelog } from './landing/Changelog'
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
//
// A08b composition: the page is a sequence of full-bleed Bands, not one
// container-wrapped Stack. landing/sections.ts lists the five blocks in order
// with their head copy and band tone; three of them carry an anchor, and the
// two that do not (use cases, the changelog) are still labelled regions — they
// are simply not navigation targets, so they take no tabIndex.

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

/** Block bodies by block key. Privacy and Terms left the landing with A08b —
 *  they are routes now, not sections. */
const SECTION_BODIES: Record<LandingBlockKey, ReactNode> = {
  'how-it-works': <ProofSteps />,
  'use-cases': <UseCases />,
  'where-things-stand': <WhereThingsStand />,
  changelog: <Changelog />,
  about: <About />,
}

/** Only an anchored section is a focus target, so only it carries a ring. */
const ANCHOR_CLASSES =
  'scroll-mt-6 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2'

export const LandingRoute = () => {
  useHashFocus()
  useDocumentTitle()

  return (
    <>
      <Band tone="subtle">
        <Hero />
      </Band>

      {LANDING_BLOCKS.map((block) => {
        // The three anchored blocks keep the heading ids their deep links and
        // the shell's navigation have always pointed at.
        const headingId = `${block.anchorId ?? block.key}-heading`

        return (
          <Band key={block.key} tone={block.tone}>
            <section
              id={block.anchorId}
              tabIndex={block.anchorId ? -1 : undefined}
              aria-labelledby={headingId}
              className={cn(block.anchorId && ANCHOR_CLASSES)}
            >
              <Stack gap="12">
                <SectionHead
                  id={headingId}
                  eyebrow={block.eyebrow}
                  title={block.title}
                  subtitle={block.subtitle}
                />
                {SECTION_BODIES[block.key]}
              </Stack>
            </section>
          </Band>
        )
      })}
    </>
  )
}
