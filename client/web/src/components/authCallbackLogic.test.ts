import { describe, expect, jest, test } from '@jest/globals'
import { runAuthExchange, type AuthExchangeDeps } from './authCallbackLogic'

const validUser = {
  id: 'user-1',
  authUserId: 'supabase:user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  creditBalance: 100,
}

const makeSession = (token: string | null) => ({
  getSession: jest.fn<AuthExchangeDeps['getSession']>().mockResolvedValue({
    data: { session: token ? { access_token: token } : null },
    error: null,
  }),
})

const makeSuccessPostLogin = () =>
  jest.fn<AuthExchangeDeps['postLogin']>().mockResolvedValue({
    ok: true,
    payload: { authenticated: true, user: validUser },
  })

const makeDeps = (overrides: Partial<AuthExchangeDeps> = {}): AuthExchangeDeps => ({
  ...makeSession(null),
  postLogin: jest.fn<AuthExchangeDeps['postLogin']>(),
  dispatchAuthUser: jest.fn(),
  setAuthError: jest.fn(),
  navigate: jest.fn(),
  ...overrides,
})

describe('runAuthExchange', () => {
  test('null session calls setAuthError with non-empty message and navigates to /', async () => {
    const deps = makeDeps()

    await runAuthExchange(deps)

    expect(deps.setAuthError).toHaveBeenCalledWith(expect.stringMatching(/.+/))
    expect(deps.navigate).toHaveBeenCalledWith('/', expect.anything())
    expect(deps.dispatchAuthUser).not.toHaveBeenCalled()
    expect(deps.postLogin).not.toHaveBeenCalled()
  })

  test('session error calls setAuthError with non-empty message and navigates to /', async () => {
    const deps = makeDeps({
      getSession: jest.fn<AuthExchangeDeps['getSession']>().mockResolvedValue({
        data: { session: null },
        error: new Error('network error'),
      }),
    })

    await runAuthExchange(deps)

    expect(deps.setAuthError).toHaveBeenCalledWith(expect.stringMatching(/.+/))
    expect(deps.navigate).toHaveBeenCalledWith('/', expect.anything())
    expect(deps.dispatchAuthUser).not.toHaveBeenCalled()
  })

  test('server non-200 calls setAuthError with server error message and navigates to /', async () => {
    const deps = makeDeps({
      ...makeSession('valid-token'),
      postLogin: jest.fn<AuthExchangeDeps['postLogin']>().mockResolvedValue({
        ok: false,
        payload: { error: 'Invalid credential' },
      }),
    })

    await runAuthExchange(deps)

    expect(deps.setAuthError).toHaveBeenCalledWith('Invalid credential')
    expect(deps.navigate).toHaveBeenCalledWith('/', expect.anything())
    expect(deps.dispatchAuthUser).not.toHaveBeenCalled()
  })

  test('success dispatches auth user, clears error, and navigates to /', async () => {
    const deps = makeDeps({
      ...makeSession('valid-token'),
      postLogin: makeSuccessPostLogin(),
    })

    await runAuthExchange(deps)

    expect(deps.dispatchAuthUser).toHaveBeenCalledWith(validUser)
    expect(deps.setAuthError).toHaveBeenCalledWith(null)
    expect(deps.navigate).toHaveBeenCalledWith('/', { replace: true })
  })
})
