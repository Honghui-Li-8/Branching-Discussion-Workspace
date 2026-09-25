import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isDev } from '../../lib/env'
import { PROTOTYPE_PARAM } from './usePrototypeKey'

export type PrototypeOption = {
  /** Written to the URL, so keep it short: `A`, `W3`, `R2`. */
  key: string
  /** Shown beside the key in the switcher. */
  name: string
}

type PrototypeSwitcherProps = {
  options: readonly PrototypeOption[]
  /** The search param that carries the choice. Defaults to `variant`; read it with `usePrototypeKey`. */
  param?: string
}

// Controls that use the arrow keys themselves keep them.
const ownsArrowKeys = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true
  return Boolean(
    target.closest('[role="separator"],[role="tablist"],[role="slider"],[role="menu"],[role="listbox"]'),
  )
}

/**
 * Floating bar for comparing UI prototypes on a real page (the `/prototype`
 * skill's UI branch). Mount it on the page being prototyped with the variant
 * list; it writes the choice to `?variant=` so a view is shareable and survives
 * a reload, and the Left / Right arrow keys cycle through the options.
 *
 * Dev builds only: it renders nothing in production, so a prototype that
 * leaks into a merge cannot ship the bar. Variant code itself stays on the
 * prototype's throwaway branch; only this component lives on `main`.
 */
export const PrototypeSwitcher = ({ options, param = PROTOTYPE_PARAM }: PrototypeSwitcherProps) => {
  const [params, setParams] = useSearchParams()
  const count = options.length
  const index = Math.max(
    0,
    options.findIndex((option) => option.key === params.get(param)),
  )

  const go = (delta: number) => {
    if (count === 0) return
    const next = options[(index + delta + count) % count]
    const nextParams = new URLSearchParams(params)
    nextParams.set(param, next.key)
    setParams(nextParams, { replace: true })
  }

  useEffect(() => {
    if (!isDev) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (ownsArrowKeys(event.target)) return
      go(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (!isDev || count === 0) return null

  const current = options[index]
  return (
    <div
      role="group"
      aria-label="Prototype variant"
      className="fixed bottom-5 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-1 rounded-full bg-gray-900 p-1 text-label text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
    >
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => go(-1)}
        className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        ←
      </button>
      <span aria-live="polite" className="px-2 text-center font-medium tabular-nums">
        {current.key} · {current.name}{' '}
        <span className="text-white/60">
          ({index + 1}/{count})
        </span>
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => go(1)}
        className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        →
      </button>
    </div>
  )
}
