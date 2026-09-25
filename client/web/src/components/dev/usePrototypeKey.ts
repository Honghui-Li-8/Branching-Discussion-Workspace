import { useSearchParams } from 'react-router-dom'

/** The search param a prototype's variant travels in, unless one is named. */
export const PROTOTYPE_PARAM = 'variant'

/**
 * The current prototype key from the URL, or `null` when none is set. A
 * prototype reads this to decide what to render; everything else about the
 * page (data, auth, routing) stays as it is. Pair with `PrototypeSwitcher`.
 */
export const usePrototypeKey = (param: string = PROTOTYPE_PARAM): string | null => {
  const [params] = useSearchParams()
  return params.get(param)
}
