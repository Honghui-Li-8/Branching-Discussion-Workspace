import { useEffect, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'

// A06 — the single navigation component. Three render paths, chosen by which
// prop is given:
//
//   to="/login"        internal route  → react-router Link (client-side; the
//                                        app never re-bootstraps mid-visit)
//   to="/#features"    section anchor  → router Link, then scroll + move focus
//                                        to the target section (keyboard and
//                                        screen-reader users land there too)
//   href="https://…"   external        → plain <a>, with rel safety attributes
//                                        whenever it opens a new tab
//
// Same "import from one place, never the library directly" discipline as
// lib/icons.ts: surfaces import Link from here, not react-router.

const FOCUS_CLASSES =
  'text-text-link outline-none transition-colors hover:text-accent-hover focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2 rounded-sm'

type StyleProps = {
  underline?: 'always' | 'hover'
}

type InternalLinkProps = StyleProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    /** Internal route (`/login`) or section anchor (`/#features`). */
    to: string
    href?: never
  }

type ExternalLinkProps = StyleProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    /** External URL — rendered as a plain anchor. */
    href: string
    to?: never
  }

export type LinkProps = InternalLinkProps | ExternalLinkProps

/**
 * Scroll to and focus the element a hash names. Returns whether a target was
 * found — a caller that gets `false` (target not mounted yet, e.g. a
 * cross-route click) leaves the work to `useHashFocus` on the destination.
 */
export function focusHashTarget(hash: string): boolean {
  const id = hash.replace(/^#/, '')
  if (!id) return false
  const target = document.getElementById(id)
  if (!target) return false
  // Instant, not smooth: motion must never be the only carrier of a state
  // change (A-T3e §7), and the global reduced-motion rule cannot reach a
  // scroll option.
  target.scrollIntoView?.({ block: 'start' })
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  return true
}

/**
 * Mount on any page that has anchor targets. When the page mounts with a
 * hash, or the hash changes while mounted, the matching section receives
 * scroll and focus. This is the cross-route half of anchor navigation —
 * a click on `/login` cannot focus a section that only exists on `/`.
 */
export function useHashFocus(): void {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) focusHashTarget(hash)
  }, [hash])
}

export function Link(props: LinkProps) {
  const { className, underline = 'hover', ...rest } = props
  const classes = cn(
    FOCUS_CLASSES,
    underline === 'always' ? 'underline' : 'no-underline hover:underline',
    className,
  )

  if ('to' in rest && typeof rest.to === 'string') {
    const { to, onClick, ...anchorProps } = rest
    const hashIndex = to.indexOf('#')
    const hash = hashIndex >= 0 ? to.slice(hashIndex) : ''

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      // Same-page anchor: the target is already mounted, so focus it now.
      // If the hash is unchanged the router fires no location update, which
      // is exactly the case useHashFocus cannot see. Cross-route anchors
      // return false here and are handled on arrival.
      if (hash && !event.defaultPrevented) focusHashTarget(hash)
    }

    return <RouterLink to={to} className={classes} onClick={handleClick} {...anchorProps} />
  }

  const { href, target, rel, ...anchorProps } = rest as ExternalLinkProps
  const safeRel = target === '_blank' ? cn('noopener noreferrer', rel) : rel

  return <a href={href} target={target} rel={safeRel} className={classes} {...anchorProps} />
}
