export const getDevAuthToken = (): string | undefined =>
  process.env.DEV_AUTH_TOKEN ?? process.env.AUTH_BACKDOOR_TOKEN
export const SESSION_COOKIE_NAME = 'bdw_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
export const SESSION_CLEANUP_INTERVAL_MS = 1000 * 60 * 15
