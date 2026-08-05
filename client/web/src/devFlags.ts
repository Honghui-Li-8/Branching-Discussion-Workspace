// Source-only debug flag for inspecting assistant Markdown before rendering.
// Keep false in committed code. Temporarily flip locally when debugging.
export const DEBUG_RAW_MARKDOWN = false

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

export type LocalAuthBypassGateInput = {
  isViteDev: boolean
  bypassEnabledFlag: string | undefined
  hostname: string
  devToken: string | undefined
}

export const isLocalAuthBypassAvailable = (input: LocalAuthBypassGateInput): boolean => {
  if (!input.isViteDev) return false
  if (input.bypassEnabledFlag !== 'true') return false
  if (!LOOPBACK_HOSTNAMES.has(input.hostname)) return false
  return Boolean(input.devToken && input.devToken.length > 0)
}

export const describeLocalAuthBypassMisconfiguration = (
  input: LocalAuthBypassGateInput,
): string | null => {
  if (!input.isViteDev) {
    return null
  }

  const missing: string[] = []
  if (input.bypassEnabledFlag !== 'true') missing.push('VITE_ENABLE_LOCAL_AUTH_BYPASS')
  if (!LOOPBACK_HOSTNAMES.has(input.hostname)) missing.push('a loopback hostname (localhost/127.0.0.1/[::1])')
  if (!input.devToken) missing.push('VITE_DEV_AUTH_TOKEN')

  if (missing.length === 0) {
    return null
  }

  return `Local developer sign-in is unavailable: missing/invalid ${missing.join(', ')}.`
}
