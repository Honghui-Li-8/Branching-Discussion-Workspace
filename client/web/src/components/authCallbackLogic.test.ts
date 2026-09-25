import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  DESTINATION_STORAGE_KEY,
  clearRequestedDestination,
  navigateAfterLogin,
  navigateAfterLoginFailure,
  peekRequestedDestination,
  rememberRequestedDestination,
  resolvePostLoginDestination,
  runAuthExchange,
  takeRequestedDestination,
  type AuthExchangeDeps,
} from './authCallbackLogic'

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
  test('null session calls setAuthError with non-empty message and navigates to /login', async () => {
    const deps = makeDeps()

    await runAuthExchange(deps)

    expect(deps.setAuthError).toHaveBeenCalledWith(expect.stringMatching(/.+/))
    expect(deps.navigate).toHaveBeenCalledWith('/login', { replace: true })
    expect(deps.dispatchAuthUser).not.toHaveBeenCalled()
    expect(deps.postLogin).not.toHaveBeenCalled()
  })

  test('session error calls setAuthError with non-empty message and navigates to /login', async () => {
    const deps = makeDeps({
      getSession: jest.fn<AuthExchangeDeps['getSession']>().mockResolvedValue({
        data: { session: null },
        error: new Error('network error'),
      }),
    })

    await runAuthExchange(deps)

    expect(deps.setAuthError).toHaveBeenCalledWith(expect.stringMatching(/.+/))
    expect(deps.navigate).toHaveBeenCalledWith('/login', { replace: true })
    expect(deps.dispatchAuthUser).not.toHaveBeenCalled()
  })

  test('server non-200 calls setAuthError with server error message and navigates to /login', async () => {
    const deps = makeDeps({
      ...makeSession('valid-token'),
      postLogin: jest.fn<AuthExchangeDeps['postLogin']>().mockResolvedValue({
        ok: false,
        payload: { error: 'Invalid credential' },
      }),
    })

    await runAuthExchange(deps)

    expect(deps.setAuthError).toHaveBeenCalledWith('Invalid credential')
    expect(deps.navigate).toHaveBeenCalledWith('/login', { replace: true })
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

describe('post-login navigation seam (A06)', () => {
  test('navigateAfterLogin lands on the authenticated root, replacing history', () => {
    const navigate = jest.fn()
    navigateAfterLogin(navigate)
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  test('navigateAfterLoginFailure lands on /login, replacing history', () => {
    const navigate = jest.fn()
    navigateAfterLoginFailure(navigate)
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  test('an unexpected success payload is a failure: no user dispatched, error set, /login', async () => {
    const deps = makeDeps({
      ...makeSession('valid-token'),
      postLogin: jest.fn<AuthExchangeDeps['postLogin']>().mockResolvedValue({
        ok: true,
        payload: { authenticated: true, user: { id: 'missing-fields' } },
      }),
    })

    await runAuthExchange(deps)

    expect(deps.dispatchAuthUser).not.toHaveBeenCalled()
    expect(deps.setAuthError).toHaveBeenCalledWith('Unexpected sign-in response.')
    expect(deps.navigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  test('a missing Supabase configuration reads as "not configured", not as a generic failure', async () => {
    const deps = makeDeps({
      getSession: jest.fn<AuthExchangeDeps['getSession']>().mockRejectedValue(
        new Error('Supabase is not configured.'),
      ),
    })

    await runAuthExchange(deps)

    expect(deps.setAuthError).toHaveBeenCalledWith('Sign-in is not configured yet.')
    expect(deps.navigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})

describe('requested-destination preservation (A10)', () => {
  test.each([
    ['/terms', '/terms'],
    ['/terms?from=footer#top', '/terms?from=footer#top'],
    ['/privacy', '/privacy'],
  ])('accepts the same-origin relative path %s', (candidate, expected) => {
    expect(resolvePostLoginDestination(candidate)).toBe(expected)
  })

  test.each([
    ['absolute URL', 'https://evil.example/steal'],
    ['protocol-relative URL', '//evil.example'],
    ['the sign-in page', '/login'],
    ['the sign-in page with a query', '/login?next=/terms'],
    ['the callback', '/auth/callback'],
    ['the root', '/'],
    ['nothing', undefined],
    ['null', null],
    ['a bare word', 'terms'],
  ])('falls back to the root for %s', (_label, candidate) => {
    expect(resolvePostLoginDestination(candidate)).toBe('/')
  })

  test('navigateAfterLogin honours an accepted destination and replaces history', () => {
    const navigate = jest.fn()
    navigateAfterLogin(navigate, '/terms')
    expect(navigate).toHaveBeenCalledWith('/terms', { replace: true })
  })

  test('navigateAfterLogin without a destination still lands on the root', () => {
    const navigate = jest.fn()
    navigateAfterLogin(navigate, null)
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  test('the exchange success path navigates to the destination', async () => {
    const deps = makeDeps({
      ...makeSession('valid-token'),
      postLogin: makeSuccessPostLogin(),
      destination: '/terms',
    })

    await runAuthExchange(deps)

    expect(deps.navigate).toHaveBeenCalledWith('/terms', { replace: true })
  })

  test('the exchange failure path ignores the destination and lands on /login', async () => {
    const deps = makeDeps({ destination: '/terms' })

    await runAuthExchange(deps)

    expect(deps.navigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  test('the destination is consumed on success only, so a retry after failure keeps it', async () => {
    const failed = makeDeps({ destination: '/terms', clearDestination: jest.fn() })
    await runAuthExchange(failed)
    expect(failed.clearDestination).not.toHaveBeenCalled()

    const succeeded = makeDeps({
      ...makeSession('valid-token'),
      postLogin: makeSuccessPostLogin(),
      destination: '/terms',
      clearDestination: jest.fn(),
    })
    await runAuthExchange(succeeded)
    expect(succeeded.clearDestination).toHaveBeenCalledTimes(1)
  })
})

describe('destination storage (A10)', () => {
  const store = new Map<string, string>()
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }

  beforeEach(() => {
    store.clear()
    Object.defineProperty(globalThis, 'window', {
      value: { sessionStorage },
      configurable: true,
      writable: true,
    })
  })

  test('remember then take returns the path once and clears it', () => {
    rememberRequestedDestination('/terms')
    expect(store.get(DESTINATION_STORAGE_KEY)).toBe('/terms')
    expect(takeRequestedDestination()).toBe('/terms')
    expect(takeRequestedDestination()).toBeNull()
  })

  test('starting sign-in from the flow\'s own pages keeps the saved page', () => {
    rememberRequestedDestination('/terms')
    rememberRequestedDestination('/login')
    rememberRequestedDestination('/login?next=/x')
    rememberRequestedDestination('/auth/callback')
    expect(store.get(DESTINATION_STORAGE_KEY)).toBe('/terms')
  })

  test('peek leaves the path in place; clear removes it', () => {
    rememberRequestedDestination('/terms')
    expect(peekRequestedDestination()).toBe('/terms')
    expect(peekRequestedDestination()).toBe('/terms')
    clearRequestedDestination()
    expect(peekRequestedDestination()).toBeNull()
  })

  test('a throwing storage is swallowed: remember is a no-op and take yields null', () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        sessionStorage: {
          getItem: () => {
            throw new Error('blocked')
          },
          setItem: () => {
            throw new Error('blocked')
          },
          removeItem: () => {},
        },
      },
      configurable: true,
      writable: true,
    })
    expect(() => rememberRequestedDestination('/terms')).not.toThrow()
    expect(takeRequestedDestination()).toBeNull()
  })
})
