import { useState, type ReactNode } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuthStatus } from '../../store/slices/authSlice'
import { ICONS } from '../../lib/icons'
import { cn } from '../../lib/utils'
import { HEADER_SECTIONS, PATHS, SECTIONS, sectionHref, type Section } from '../../routePaths'
import { buttonVariants } from '../ui/button'
import { Cluster, Container, Stack } from '../ui/layout'
import { Link } from '../ui/link'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '../ui/sheet'

// A06 — the one shared public shell. Every public surface (landing, sign-in,
// not-found, bootstrap) renders inside it; the signed-in workspace does not.
//
// Anatomy, per the spec and A-T3e §4:
//   skip link  → first tabbable, visible on focus, targets the one `main`
//   header     → product identity, section navigation, auth-aware CTA
//                (near-black, owner decision 2026-08-10; `data-surface="dark"`
//                repoints the focus-ring offset so rings compose on it)
//   main       → single landmark, focusable so the skip link lands on it
//   footer     → section links, contact placeholder (allowed until phase
//                exit; A08 supplies the fact), repository link, copyright
//
// Narrow widths (below `lg`, ADR-0004's canonical boundary) collapse the
// section navigation into the Sheet primitive, inheriting its focus trap,
// escape and scroll lock. The CTA stays in the header at every width.
//
// No copy lives here beyond labels: the product name, the A02 descriptor and
// the section labels routePaths.ts already owns.

const REPOSITORY_URL = 'https://github.com/Honghui-Li-8/Branching-Discussion-Workspace'

const headerLinkClasses = 'text-gray-200 hover:text-text-inverse focus-visible:ring-accent-wash'

const AuthCta = ({ className }: { className?: string }) => {
  const authStatus = useAppSelector(selectAuthStatus)
  // While sign-in status is unknown the shell promises nothing: showing
  // either action would be the wrong-surface flash the root state machine
  // exists to prevent.
  if (authStatus === 'unknown') return null

  const cta =
    authStatus === 'authenticated'
      ? { to: PATHS.root, label: 'Open workspace' }
      : { to: PATHS.login, label: 'Sign in' }

  return (
    <Link
      to={cta.to}
      underline="hover"
      className={cn(
        buttonVariants({ variant: 'primary', size: 'sm' }),
        'no-underline hover:no-underline hover:text-white focus-visible:ring-accent-wash',
        className,
      )}
    >
      {cta.label}
    </Link>
  )
}

const SectionLinks = ({
  sections,
  onNavigate,
  className,
}: {
  sections: readonly Section[]
  onNavigate?: () => void
  className?: string
}) => (
  <>
    {sections.map((section) => (
      <li key={section.id}>
        <Link to={sectionHref(section.id)} onClick={onNavigate} className={cn('inline-block py-2', className)}>
          {section.label}
        </Link>
      </li>
    ))}
  </>
)

export const PublicShell = ({ children }: { children: ReactNode }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const authStatus = useAppSelector(selectAuthStatus)
  // Section anchors target the landing, and `/` resolves to the workspace for a
  // signed-in user — so for them the section navigation (header, sheet, footer)
  // would be dead links. The shell keeps identity, CTA and the footer facts.
  // Rendered only once the visitor is known to be signed out — like the CTA,
  // nothing is promised while status is unknown, so nothing flashes away.
  const showSections = authStatus === 'unauthenticated'
  const MenuIcon = ICONS.menu
  const CloseIcon = ICONS.close

  return (
    <div className="relative flex min-h-screen flex-col bg-bg-subtlest text-text-default">
      {/* Parked above the viewport until focused, then slides into view. Not
          sr-only: Tailwind's not-sr-only resets position to static, which
          would push the header down on focus instead of overlaying it. */}
      <Link
        to="#main"
        className="absolute left-4 top-0 z-50 -translate-y-full rounded-md bg-bg-default px-4 py-2 text-label text-text-default no-underline shadow-card transition-transform hover:no-underline focus:translate-y-4"
      >
        Skip to main content
      </Link>

      <header data-surface="dark" className="bg-gray-900 text-text-inverse">
        <Container>
          <Cluster justify="between" gap="4" className="py-3">
            <Link
              to={PATHS.root}
              underline="hover"
              className="inline-flex items-center gap-2 text-label font-semibold text-text-inverse no-underline hover:text-text-inverse focus-visible:ring-accent-wash"
            >
              {/* The mark is decorative beside the wordmark; the link's name is "Trellis". */}
              <img src="/favicon.svg" alt="" aria-hidden="true" width={28} height={28} className="size-7" />
              Trellis
            </Link>

            {showSections ? (
              <nav aria-label="Sections" className="hidden lg:block">
                <Cluster as="ul" gap="6" className="list-none p-0">
                  <SectionLinks sections={HEADER_SECTIONS} className={headerLinkClasses} />
                </Cluster>
              </nav>
            ) : null}

            <Cluster gap="3">
              <AuthCta />

              {showSections ? (
              <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    'text-text-inverse hover:bg-gray-700 hover:text-text-inverse focus-visible:ring-accent-wash lg:hidden',
                  )}
                  aria-label="Open navigation menu"
                >
                  <MenuIcon aria-hidden="true" focusable="false" className="size-5" />
                </SheetTrigger>
                <SheetContent aria-describedby={undefined}>
                  <Stack gap="4">
                    <Cluster justify="between">
                      <SheetTitle>Navigation</SheetTitle>
                      <SheetClose
                        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                        aria-label="Close navigation menu"
                      >
                        <CloseIcon aria-hidden="true" focusable="false" className="size-5" />
                      </SheetClose>
                    </Cluster>
                    <SheetDescription className="sr-only">Sections of this page</SheetDescription>
                    <nav aria-label="Sections menu">
                      <Stack as="ul" gap="1" className="list-none p-0">
                        <SectionLinks sections={HEADER_SECTIONS} onNavigate={() => setIsMenuOpen(false)} />
                      </Stack>
                    </nav>
                  </Stack>
                </SheetContent>
              </Sheet>
              ) : null}
            </Cluster>
          </Cluster>
        </Container>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <footer className="border-t border-border-default bg-bg-subtle text-label text-text-secondary">
        <Container>
          <Stack gap="4" className="py-8">
            <nav aria-label="Footer">
              <Cluster as="ul" gap="6" className="list-none p-0">
                {showSections ? <SectionLinks sections={SECTIONS} /> : null}
                <li>
                  <Link href={REPOSITORY_URL} target="_blank" className="inline-block py-2">
                    GitHub
                  </Link>
                </li>
              </Cluster>
            </nav>
            <Cluster justify="between" gap="4">
              <p className="m-0 inline-flex items-center gap-2">
                <img src="/favicon.svg" alt="" aria-hidden="true" width={20} height={20} className="size-5" />
                Trellis — a branching discussion workspace
              </p>
              {/* Verified contact is A08's fact; a placeholder is allowed until phase exit. */}
              <p className="m-0 text-text-muted">Contact: coming soon</p>
              <p className="m-0 text-text-muted">© {new Date().getFullYear()} Trellis</p>
            </Cluster>
          </Stack>
        </Container>
      </footer>
    </div>
  )
}
