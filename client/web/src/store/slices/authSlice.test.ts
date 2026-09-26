import reducer, {
  clearAuthenticatedUser,
  dismissSignedOutReason,
  setAuthenticatedUser,
  setAuthState,
} from './authSlice'

const USER = { id: 'u1', authUserId: 'auth:u1', email: null, displayName: 'U', creditBalance: 1 }
const signedIn = reducer(undefined, setAuthenticatedUser(USER))

describe('authSlice signed-out reason (A10)', () => {
  it('records an expired session and leaves a chosen logout unexplained', () => {
    expect(reducer(signedIn, clearAuthenticatedUser({ reason: 'session-expired' })).signedOutReason).toBe(
      'session-expired',
    )
    expect(reducer(signedIn, clearAuthenticatedUser()).signedOutReason).toBeNull()
  })

  it('clears the reason on dismiss and on the next sign-in', () => {
    const expired = reducer(signedIn, clearAuthenticatedUser({ reason: 'session-expired' }))
    expect(reducer(expired, dismissSignedOutReason()).signedOutReason).toBeNull()
    expect(reducer(expired, setAuthenticatedUser(USER)).signedOutReason).toBeNull()
    expect(reducer(expired, setAuthState({ status: 'authenticated', user: USER })).signedOutReason).toBeNull()
  })
})
