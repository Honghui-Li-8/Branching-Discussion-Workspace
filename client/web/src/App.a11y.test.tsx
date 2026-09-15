/**
 * @jest-environment jsdom
 *
 * A06 Commit 6 — A-T3e adoption: the jest-axe structural scan over every
 * public route composition (shell + page), at the serious/critical threshold
 * ADR-0004 sets. The Playwright reflow harness covers the layout half.
 */
import { screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

import App from './App'
import * as supabaseClient from './lib/supabaseClient'
import { pendingFetch, renderWithProviders } from './testing/renderWithProviders'

expect.extend(toHaveNoViolations)

// See App.routes.test.tsx: the workspace subtree is ESM-only under this jest
// and unchanged by A06; this scan covers the public surfaces.
jest.mock('./components/WorkspaceLayout', () => ({
  WorkspaceLayout: () => <main aria-label="Workspace">Workspace (mocked)</main>,
}))

const SERIOUS = new Set(['serious', 'critical'])
const seriousViolations = async (container: Element) => {
  const results = await axe(container)
  return results.violations.filter((v) => SERIOUS.has(String(v.impact)))
}

describe('public route compositions pass the A-T3e structural scan', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn()
  })

  it.each([
    ['/', 'unknown'],
    ['/', 'unauthenticated'],
    ['/login', 'unauthenticated'],
    ['/login', 'authenticated'],
    ['/this-does-not-exist', 'unauthenticated'],
    ['/this-does-not-exist', 'authenticated'],
  ] as const)('%s when %s', async (route, authStatus) => {
    const { container } = renderWithProviders(<App />, { route, authStatus, fetchImpl: pendingFetch })
    expect(await seriousViolations(container)).toHaveLength(0)
  })

  it('/auth/callback while the exchange is pending', async () => {
    const spy = jest.spyOn(supabaseClient, 'getSupabaseClient').mockReturnValue({
      auth: { getSession: () => new Promise(() => {}) },
    } as unknown as ReturnType<typeof supabaseClient.getSupabaseClient>)

    const { container } = renderWithProviders(<App />, {
      route: '/auth/callback',
      authStatus: 'unauthenticated',
    })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(await seriousViolations(container)).toHaveLength(0)

    spy.mockRestore()
  })
})
