import { useEffect } from 'react'

const PRODUCT = 'Trellis'

/**
 * A08 — per-route document titles without a head-management dependency.
 * `useDocumentTitle('Sign in')` → "Sign in · Trellis"; `useDocumentTitle()` →
 * "Trellis". One owner per page: the route-level surface sets it and the next
 * route overwrites it. Nothing is restored on unmount — a restore would race the
 * next route's effect and is a no-op under StrictMode's double invocation.
 */
export const formatDocumentTitle = (title?: string): string =>
  title ? `${title} · ${PRODUCT}` : PRODUCT

export const useDocumentTitle = (title?: string): void => {
  useEffect(() => {
    document.title = formatDocumentTitle(title)
  }, [title])
}
