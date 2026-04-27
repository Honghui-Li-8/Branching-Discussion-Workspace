type RuntimeFlagOptions = {
  viteEnv?: Record<string, unknown>
  locationSearch?: string
  locationHash?: string
  localStorageValue?: string | null
}

const TRUE_FLAG_VALUES = new Set(['1', 'true', 'yes', 'on'])

const isTruthyFlag = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  return typeof value === 'string' && TRUE_FLAG_VALUES.has(value.trim().toLowerCase())
}

const getSearchParamFlag = (searchLike: string | undefined, key: string): string | null => {
  if (!searchLike) return null

  const queryStartIndex = searchLike.indexOf('?')
  const normalizedSearch =
    queryStartIndex >= 0
      ? searchLike.slice(queryStartIndex)
      : searchLike.startsWith('#')
        ? searchLike.slice(1)
        : searchLike

  try {
    return new URLSearchParams(normalizedSearch).get(key)
  } catch {
    return null
  }
}

const getLocalStorageFlag = (key: string): string | null => {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export const isDebugRawMarkdownEnabled = ({
  viteEnv,
  locationSearch,
  locationHash,
  localStorageValue,
}: RuntimeFlagOptions = {}): boolean => {
  const currentLocation =
    typeof globalThis.location === 'undefined' ? undefined : globalThis.location

  return (
    isTruthyFlag(viteEnv?.VITE_DEBUG_RAW_MARKDOWN) ||
    isTruthyFlag(
      getSearchParamFlag(locationSearch ?? currentLocation?.search, 'debugRawMarkdown'),
    ) ||
    isTruthyFlag(
      getSearchParamFlag(locationHash ?? currentLocation?.hash, 'debugRawMarkdown'),
    ) ||
    isTruthyFlag(localStorageValue ?? getLocalStorageFlag('debugRawMarkdown')) ||
    isTruthyFlag(localStorageValue ?? getLocalStorageFlag('VITE_DEBUG_RAW_MARKDOWN'))
  )
}
