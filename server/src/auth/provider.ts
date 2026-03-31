import type { VerifiedExternalIdentity } from './types.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger('auth-provider')

export const verifyThirdPartyToken = async (
  token: string,
  provider: string,
): Promise<VerifiedExternalIdentity> => {
  void token

  logger.error(
    `[auth] Third-party token verification is not implemented yet for provider "${provider}".`,
  )
  throw new Error('THIRD_PARTY_AUTH_NOT_IMPLEMENTED')
}

export const getOrCreateUserFromVerifiedIdentity = async (
  identity: VerifiedExternalIdentity,
): Promise<{
  id: string
  authUserId: string
  email: string | null
  displayName: string | null
}> => {
  logger.error(
    `[auth] User lookup/provisioning is not implemented yet for provider "${identity.provider}".`,
  )
  throw new Error('THIRD_PARTY_AUTH_NOT_IMPLEMENTED')
}
