import { useEffect } from 'react'

const PRODUCT = 'Trellis'

/**
 * A08 — per-route document titles without a head-management dependency.
 * `useDocumentTitle('Sign in')` → "Sign in · Trellis"; `useDocumentTitle()` →
 * "Trellis". The previous title is restored on unmount so nested surfaces
 * hand back cleanly.
 */
export const formatDocumentTitle = (title?: string): string =>
  title ? `${title} · ${PRODUCT}` : PRODUCT

export const useDocumentTitle = (title?: string): void => {
  useEffect(() => {
    const previous = document.title
    document.title = formatDocumentTitle(title)
    return () => {
      document.title = previous
    }
  }, [title])
}
