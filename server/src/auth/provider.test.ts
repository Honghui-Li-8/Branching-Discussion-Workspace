import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import { verifyThirdPartyToken } from './provider'

jest.mock('@supabase/supabase-js')
jest.mock('../db/index.js', () => ({
  getOrCreateUserByAuthIdentity: jest.fn(),
}))

const mockGetUser = jest.fn<(token: string) => Promise<unknown>>()

;(createClient as jest.Mock).mockReturnValue({
  auth: {
    getUser: mockGetUser,
  },
})

describe('auth provider', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    mockGetUser.mockReset()
  })

  afterEach(() => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  test('verifyThirdPartyToken returns verified identity for valid Supabase token', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'uid-1',
          email: 'a@b.com',
          user_metadata: {
            full_name: 'A B',
          },
        },
      },
      error: null,
    })

    await expect(verifyThirdPartyToken('valid-token', 'supabase')).resolves.toEqual({
      provider: 'supabase',
      externalUserId: 'uid-1',
      email: 'a@b.com',
      displayName: 'A B',
    })
    expect(mockGetUser).toHaveBeenCalledWith('valid-token')
  })

  test('verifyThirdPartyToken throws INVALID_TOKEN for expired Supabase token', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: new Error('JWT expired'),
    })

    await expect(verifyThirdPartyToken('expired-token', 'supabase')).rejects.toThrow(
      'INVALID_TOKEN',
    )
  })

  test('verifyThirdPartyToken throws THIRD_PARTY_AUTH_NOT_IMPLEMENTED for unsupported provider', async () => {
    await expect(verifyThirdPartyToken('google-token', 'google')).rejects.toThrow(
      'THIRD_PARTY_AUTH_NOT_IMPLEMENTED',
    )
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  test('verifyThirdPartyToken throws SUPABASE_UNAVAILABLE when SDK throws', async () => {
    mockGetUser.mockRejectedValue(new Error('network failure'))

    await expect(verifyThirdPartyToken('valid-token', 'supabase')).rejects.toThrow(
      'SUPABASE_UNAVAILABLE',
    )
  })
})
