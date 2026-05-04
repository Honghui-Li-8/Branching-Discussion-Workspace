import { createClient, type User } from '@supabase/supabase-js'
import type { VerifiedExternalIdentity } from './types.js'
import { getOrCreateUserByAuthIdentity } from '../db/index.js'

let supabaseClient: ReturnType<typeof createClient> | null = null

const getSupabaseClient = (): ReturnType<typeof createClient> => {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }

  return supabaseClient
}

export const verifyThirdPartyToken = async (
  token: string,
  provider: string,
): Promise<VerifiedExternalIdentity> => {
  if (provider !== 'supabase') {
    throw new Error('THIRD_PARTY_AUTH_NOT_IMPLEMENTED')
  }

  let user: User
  try {
    const { data, error } = await getSupabaseClient().auth.getUser(token)
    if (error || !data.user) {
      throw new Error('INVALID_TOKEN')
    }
    user = data.user
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_TOKEN') {
      throw error
    }

    throw new Error('SUPABASE_UNAVAILABLE')
  }

  return {
    provider: 'supabase',
    externalUserId: user.id,
    email: user.email ?? null,
    displayName:
      typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : null,
  }
}

export const getOrCreateUserFromVerifiedIdentity = async (
  identity: VerifiedExternalIdentity,
): Promise<{
  id: string
  authUserId: string
  email: string | null
  displayName: string | null
}> => {
  return getOrCreateUserByAuthIdentity({
    authUserId: `${identity.provider}:${identity.externalUserId}`,
    email: identity.email,
    displayName: identity.displayName,
  })
}
