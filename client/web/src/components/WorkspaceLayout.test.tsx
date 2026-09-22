/**
 * @jest-environment jsdom
 *
 * A10 — the signed-in shell seam. The layout renders through the real provider
 * stack with the tree view replaced by a named stand-in: the tree subtree pulls
 * ESM-only dependencies (@annotorious) this CommonJS jest cannot transform, so
 * the highest seam jest can reach is the layout — sidebar, empty state, create
 * menu, account row — one level above the canvas. Asserts by role, name, text
 * and store-visible outcome only; every state also runs the ADR-0004 axe scan
 * at the serious/critical threshold.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

import { WorkspaceLayout } from './WorkspaceLayout'
import { pendingFetch, renderWithProviders } from '../testing/renderWithProviders'

expect.extend(toHaveNoViolations)

// The real tree view renders the empty state itself when no workspace is
// active; the stand-in keeps that branch real and mocks only the canvas.
jest.mock('./DiscussionTreeView', () => {
  const { IntroScreen } = jest.requireActual<typeof import('./IntroScreen')>('./IntroScreen')
  const { useAppSelector } = jest.requireActual<typeof import('../store/hooks')>('../store/hooks')
  const { selectActiveWorkspace } =
    jest.requireActual<typeof import('../store/slices/appShellSlice')>('../store/slices/appShellSlice')
  const DiscussionTreeView = () =>
    useAppSelector(selectActiveWorkspace) ? (
      <section aria-label="Discussion tree (mocked)">tree</section>
    ) : (
      <IntroScreen />
    )
  return { DiscussionTreeView }
})

const SERIOUS = new Set(['serious', 'critical'])
const seriousViolations = async (container: Element) => {
  const results = await axe(container)
  return results.violations.filter((v) => SERIOUS.has(String(v.impact)))
}

type Handlers = Record<string, (input: unknown) => unknown>

/**
 * Answers batched tRPC requests by procedure name, the way the reflow harness
 * does: the path after `/trpc/` lists the procedures, comma-separated, and the
 * response is one `{ result: { data } }` per procedure in the same order.
 * Anything not handled answers `[]`. Non-tRPC URLs never settle.
 */
const trpcFetch = (handlers: Handlers, calls: string[] = []): typeof fetch =>
  async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = url.split('/trpc/')[1]
    if (!path) return new Promise<Response>(() => {})
    const procedures = path.split('?')[0].split(',')
    let batchInput: Record<string, { json?: unknown } | unknown> = {}
    if (init?.method === 'POST' && typeof init.body === 'string') {
      batchInput = JSON.parse(init.body) as typeof batchInput
    } else {
      const raw = new URL(url).searchParams.get('input')
      if (raw) batchInput = JSON.parse(raw) as typeof batchInput
    }
    const body = procedures.map((procedure, index) => {
      calls.push(procedure)
      const entry = batchInput[String(index)] as { json?: unknown } | undefined
      const inputValue = entry && typeof entry === 'object' && 'json' in entry ? entry.json : entry
      const handler = handlers[procedure]
      return { result: { data: handler ? handler(inputValue) : [] } }
    })
    // jsdom has no `Response`; a plain object with what the tRPC link reads.
    const text = JSON.stringify(body)
    return {
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => body,
      text: async () => text,
    } as unknown as Response
  }

const WORKSPACES = [
  { id: 'w1', title: 'MVP Branching Decisions', summary: 'Should we branch?' },
  { id: 'w2', title: 'Choose a Database', summary: null },
]

const sidebar = () => screen.getByRole('complementary', { name: 'Workspace navigation' })
const mockedTree = () => screen.queryByRole('region', { name: 'Discussion tree (mocked)' })

describe('signed-in shell layout (A10)', () => {
  it('bootstrap: account row reports the check and create is disabled', async () => {
    const { container } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'unknown',
      fetchImpl: pendingFetch,
    })

    expect(within(sidebar()).getByRole('button', { name: 'Create workspace' })).toHaveProperty('disabled', true)
    expect(within(sidebar()).getByRole('button', { name: /checking/i })).toHaveProperty('disabled', true)
    expect(await seriousViolations(container)).toHaveLength(0)
  })

  it('loading: the list shows a loading state and no rows', async () => {
    const { container } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: pendingFetch,
    })

    expect(within(sidebar()).getByText(/loading workspaces/i)).toBeTruthy()
    expect(within(sidebar()).queryByRole('button', { name: WORKSPACES[0].title })).toBeNull()
    expect(await seriousViolations(container)).toHaveLength(0)
  })

  it('no workspaces: the empty state is the main heading and the tree is absent', async () => {
    const { container } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => [] }),
    })

    await waitFor(() => expect(within(sidebar()).getByText(/no workspaces yet/i)).toBeTruthy())
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/opening or creating a workspace/i)
    expect(mockedTree()).toBeNull()
    expect(await seriousViolations(container)).toHaveLength(0)
  })

  it('populated: every workspace is a row in the navigation landmark and the first is active', async () => {
    const { container, store } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })

    await waitFor(() =>
      expect(within(sidebar()).getByRole('button', { name: new RegExp(WORKSPACES[0].title) })).toBeTruthy(),
    )
    expect(within(sidebar()).getByRole('button', { name: new RegExp(WORKSPACES[1].title) })).toBeTruthy()
    expect(mockedTree()).toBeTruthy()
    // Commit 3 replaces this store read with `aria-current` on the row.
    expect(store.getState().appShell.activeWorkspaceId).toBe('w1')
    expect(await seriousViolations(container)).toHaveLength(0)
  })

  it('selected: clicking another row makes it the active workspace', async () => {
    const { container, store } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })

    const second = await within(sidebar()).findByRole('button', { name: new RegExp(WORKSPACES[1].title) })
    fireEvent.click(second)

    await waitFor(() => expect(store.getState().appShell.activeWorkspaceId).toBe('w2'))
    expect(mockedTree()).toBeTruthy()
    expect(await seriousViolations(container)).toHaveLength(0)
  })

  it('collapsed: collapse hides the list behind an expand control that restores it', async () => {
    const { container, store } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    await within(sidebar()).findByRole('button', { name: new RegExp(WORKSPACES[0].title) })

    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Collapse sidebar' }))
    // Commit 3 renders the strip conditionally; until then the store is the observable.
    expect(store.getState().appShell.isSidebarCollapsed).toBe(true)
    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Expand sidebar' }))
    expect(store.getState().appShell.isSidebarCollapsed).toBe(false)
    expect(await seriousViolations(container)).toHaveLength(0)
  })

  it('seeded: an unnamed icon button inside the shell turns the scan red', async () => {
    const { container } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    await within(sidebar()).findByRole('button', { name: new RegExp(WORKSPACES[0].title) })

    const rogue = document.createElement('button')
    rogue.innerHTML = '<svg aria-hidden="true" focusable="false" width="16" height="16"></svg>'
    sidebar().appendChild(rogue)

    expect(await seriousViolations(container)).not.toHaveLength(0)
  })
})
