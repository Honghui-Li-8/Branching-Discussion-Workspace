export const getDevAuthToken = (): string | undefined => process.env.DEV_AUTH_TOKEN
export const SESSION_COOKIE_NAME = 'bdw_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
export const SESSION_CLEANUP_INTERVAL_MS = 1000 * 60 * 15

export const getAppEnv = (): string | undefined => process.env.APP_ENV
export const isDevelopmentAppEnv = (): boolean => getAppEnv() === 'development'
export const isDevAuthEnabled = (): boolean => process.env.DEV_AUTH_ENABLED === 'true'

const LOOPBACK_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

export const isLoopbackOrigin = (origin: string | undefined): boolean =>
  typeof origin === 'string' && LOOPBACK_ORIGIN_PATTERN.test(origin)

export const evaluateLocalAuthPolicy = (input: {
  presentedToken: string
  origin: string | undefined
}): boolean => {
  if (!isDevelopmentAppEnv() || !isDevAuthEnabled()) {
    return false
  }

  const configuredToken = getDevAuthToken()
  if (!configuredToken || input.presentedToken !== configuredToken) {
    return false
  }

  return isLoopbackOrigin(input.origin)
}

const LEGACY_DEV_AUTH_ALIAS = 'AUTH_BACKDOOR_TOKEN'

export const assertSafeHostedAuthConfig = (): void => {
  if (isDevelopmentAppEnv()) {
    return
  }

  const offendingNames: string[] = []
  if (isDevAuthEnabled()) offendingNames.push('DEV_AUTH_ENABLED')
  if (process.env.DEV_AUTH_TOKEN) offendingNames.push('DEV_AUTH_TOKEN')
  if (process.env[LEGACY_DEV_AUTH_ALIAS]) offendingNames.push(LEGACY_DEV_AUTH_ALIAS)

  if (offendingNames.length > 0) {
    throw new Error(
      `Refusing to start: development-auth configuration (${offendingNames.join(', ')}) is set outside APP_ENV=development. ` +
        'For local development set APP_ENV=development. For a hosted environment unset these variables.',
    )
  }
}

// AUTH_BACKDOOR_TOKEN is no longer read as a credential. Outside development the startup guard
// above rejects it outright; inside development it would otherwise be ignored in silence, leaving
// a developer with a working-looking config and a bare 401.
export const warnOnRetiredDevAuthAlias = (warn: (message: string) => void): void => {
  if (!isDevelopmentAppEnv() || !process.env[LEGACY_DEV_AUTH_ALIAS]) {
    return
  }

  warn(
    `${LEGACY_DEV_AUTH_ALIAS} is set but no longer read; it was retired in favor of DEV_AUTH_TOKEN. ` +
      'Rename the variable, or local developer sign-in will be rejected.',
  )
}
