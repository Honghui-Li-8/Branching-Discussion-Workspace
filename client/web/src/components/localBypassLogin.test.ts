import { describe, expect, jest, test } from '@jest/globals'
import type { AuthUser } from '../store/slices/authSlice'
import { runLocalBypassLogin, type LocalBypassLoginResponse } from './localBypassLogin'

const localDevUser: AuthUser = {
  id: 'user-local-dev',
  authUserId: 'local:dev-user',
  email: 'dev@example.com',
  displayName: 'Local Dev',
  creditBalance: 100,
}

const createDeps = (response: LocalBypassLoginResponse) => {
  const dispatchAuthUser = jest.fn<(user: AuthUser) => void>()
  const setError = jest.fn<(message: string | null) => void>()

  return {
    deps: {
      postLogin: async () => response,
      dispatchAuthUser,
      setError,
    },
    dispatchAuthUser,
    setError,
  }
}

describe('runLocalBypassLogin', () => {
  test('dispatches the authenticated user and clears the error on success', async () => {
    const { deps, dispatchAuthUser, setError } = createDeps({
      ok: true,
      payload: { authenticated: true, user: localDevUser },
    })

    await expect(runLocalBypassLogin(deps)).resolves.toBeUndefined()

    expect(dispatchAuthUser).toHaveBeenCalledWith(localDevUser)
    expect(setError).toHaveBeenCalledWith(null)
  })

  test('surfaces the server message and rethrows on a non-ok response', async () => {
    const { deps, dispatchAuthUser, setError } = createDeps({
      ok: false,
      payload: { error: 'Local developer sign-in is not available on this server.' },
    })

    await expect(runLocalBypassLogin(deps)).rejects.toThrow(
      'Local developer sign-in is not available on this server.',
    )

    expect(dispatchAuthUser).not.toHaveBeenCalled()
    expect(setError).toHaveBeenCalledWith(
      'Local developer sign-in is not available on this server.',
    )
  })

  test('falls back to a generic message when the server sends no error string', async () => {
    const { deps, setError } = createDeps({ ok: false, payload: {} })

    await expect(runLocalBypassLogin(deps)).rejects.toThrow('Local developer sign-in failed.')

    expect(setError).toHaveBeenCalledWith('Local developer sign-in failed.')
  })

  test('rejects a 200 response whose user payload is malformed', async () => {
    const { deps, dispatchAuthUser, setError } = createDeps({
      ok: true,
      payload: { authenticated: true, user: { id: 'user-local-dev' } },
    })

    await expect(runLocalBypassLogin(deps)).rejects.toThrow('Local developer sign-in failed.')

    expect(dispatchAuthUser).not.toHaveBeenCalled()
    expect(setError).toHaveBeenCalledWith('Local developer sign-in failed.')
  })

  test('rejects a 200 response that is not marked authenticated', async () => {
    const { deps, dispatchAuthUser } = createDeps({
      ok: true,
      payload: { authenticated: false, user: localDevUser },
    })

    await expect(runLocalBypassLogin(deps)).rejects.toThrow('Local developer sign-in failed.')

    expect(dispatchAuthUser).not.toHaveBeenCalled()
  })

  test('surfaces and rethrows a transport failure', async () => {
    const dispatchAuthUser = jest.fn<(user: AuthUser) => void>()
    const setError = jest.fn<(message: string | null) => void>()

    await expect(
      runLocalBypassLogin({
        postLogin: async () => {
          throw new Error('Failed to fetch')
        },
        dispatchAuthUser,
        setError,
      }),
    ).rejects.toThrow('Failed to fetch')

    expect(dispatchAuthUser).not.toHaveBeenCalled()
    expect(setError).toHaveBeenCalledWith('Failed to fetch')
  })
})
