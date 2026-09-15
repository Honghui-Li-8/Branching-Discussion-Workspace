/**
 * @jest-environment jsdom
 *
 * The route table that ships is not the one the other tests render: jest's env
 * stand-in reports a dev build, which registers the dev-only gallery route.
 * This pins the production shape by forcing DEV off for one isolated import.
 */
// The workspace subtree is ESM-only under this CommonJS jest (see App.routes.test.tsx).
jest.mock('./components/WorkspaceLayout', () => ({ WorkspaceLayout: () => null }))

describe('route table (A06 / A-T3d)', () => {
  it('registers the dev gallery route only in dev builds', () => {
    jest.isolateModules(() => {
      jest.doMock('./lib/env', () => ({
        ...jest.requireActual('./lib/env'),
        isDev: false,
      }))
      const { ROUTES } = jest.requireActual<typeof import('./routes')>('./routes')
      expect(ROUTES.map((r) => r.path)).toEqual(['/', '/login', '/auth/callback', '*'])
    })

    jest.isolateModules(() => {
      jest.doMock('./lib/env', () => ({
        ...jest.requireActual('./lib/env'),
        isDev: true,
      }))
      const { ROUTES } = jest.requireActual<typeof import('./routes')>('./routes')
      expect(ROUTES.map((r) => r.path)).toEqual([
        '/dev/system-showcase',
        '/',
        '/login',
        '/auth/callback',
        '*',
      ])
    })
  })
})
