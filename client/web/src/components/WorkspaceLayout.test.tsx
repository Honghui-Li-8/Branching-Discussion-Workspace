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
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

import { WorkspaceLayout } from './WorkspaceLayout'
import { TEST_USER, pendingFetch, renderWithProviders } from '../testing/renderWithProviders'

expect.extend(toHaveNoViolations)

// Every case here renders the full provider stack and runs an axe scan, which
// takes seconds on a CI runner. A case that times out leaves its render behind
// and every later query finds two sidebars, so the budget is suite-wide and the
// cleanup is explicit rather than left to the auto-cleanup hook.
jest.setTimeout(30_000)
afterEach(() => {
  cleanup()
})

// Floating-ui positions every Radix menu, popover and tooltip. Under jsdom
// there is no layout to position against, and its top-layer probes run
// pseudo-selectors that jsdom's selector engine handles pathologically slowly
// (about ten seconds per opened layer, measured by CPU profile). Position is
// not what these tests assert, so the two entry points are stubbed.
jest.mock('@floating-ui/dom', () => ({
  ...jest.requireActual<typeof import('@floating-ui/dom')>('@floating-ui/dom'),
  computePosition: async () => ({ x: 0, y: 0, placement: 'bottom', strategy: 'fixed', middlewareData: {} }),
  autoUpdate: () => () => {},
}))

// The real tree view renders the empty state itself when no workspace is
// active; the stand-in keeps that branch real and mocks only the canvas.
jest.mock('./DiscussionTreeView', () => {
  const { IntroScreen } = jest.requireActual<typeof import('./IntroScreen')>('./IntroScreen')
  const { WorkspacesLoadError } = jest.requireActual<typeof import('./WorkspacesLoadError')>('./WorkspacesLoadError')
  const { useAppSelector } = jest.requireActual<typeof import('../store/hooks')>('../store/hooks')
  const { selectActiveWorkspace, selectWorkspacesLoadFailed } =
    jest.requireActual<typeof import('../store/slices/appShellSlice')>('../store/slices/appShellSlice')
  // Mirrors the real view's branches; only the canvas itself is stubbed.
  const DiscussionTreeView = () => {
    const activeWorkspace = useAppSelector(selectActiveWorkspace)
    const isLoadFailed = useAppSelector(selectWorkspacesLoadFailed)
    if (activeWorkspace) return <section aria-label="Discussion tree (mocked)">tree</section>
    return isLoadFailed ? <WorkspacesLoadError placement="main" /> : <IntroScreen />
  }
  return { DiscussionTreeView }
})

const SERIOUS = new Set(['serious', 'critical'])
// Colour contrast is manual by ADR-0004 (jsdom has no computed colour) and is
// axe's most expensive rule by far, so it is off here; structure rules stay.
const seriousViolations = async (container: Element) => {
  const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
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
      try {
        return { result: { data: handler ? handler(inputValue) : [] } }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return {
          error: { message, code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path: procedure } },
        }
      }
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

/** Holds one procedure's requests in flight forever, for asserting pending states. */
const neverSettling =
  (procedure: string, base: typeof fetch): typeof fetch =>
  (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return url.split('/trpc/')[1]?.split('?')[0].split(',').includes(procedure)
      ? new Promise<Response>(() => {})
      : base(input, init)
  }

const WORKSPACES = [
  { id: 'w1', title: 'MVP Branching Decisions', summary: 'Should we branch?' },
  { id: 'w2', title: 'Choose a Database', summary: null },
]

/** A row's accessible name starts with its title; the actions button starts with "Actions for". */
const rowName = (workspace: { title: string }) => new RegExp(`^${workspace.title}`)

const sidebar = () => screen.getByRole('complementary', { name: 'Workspace navigation' })
const mockedTree = () => screen.queryByRole('region', { name: 'Discussion tree (mocked)' })

describe('signed-in shell layout (A10)', () => {
  beforeAll(() => {
    // Radix menus position through Popper, which observes size; jsdom has no
    // ResizeObserver and no layout, so an inert stand-in is enough.
    class InertResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, 'ResizeObserver', { value: InertResizeObserver, configurable: true })
  })

  it('bootstrap: account row reports the check and create is disabled', async () => {
    const { container } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'unknown',
      fetchImpl: pendingFetch,
    })

    expect(within(sidebar()).getByRole('button', { name: 'Create workspace' })).toHaveProperty('disabled', true)
    expect(within(sidebar()).getByRole('button', { name: 'Account menu' })).toHaveProperty('disabled', true)
    expect(within(sidebar()).getByText(/checking/i)).toBeTruthy()
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
      expect(within(sidebar()).getByRole('button', { name: rowName(WORKSPACES[0]) })).toBeTruthy(),
    )
    expect(within(sidebar()).getByRole('button', { name: rowName(WORKSPACES[1]) })).toBeTruthy()
    expect(mockedTree()).toBeTruthy()
    const first = within(sidebar()).getByRole('button', { name: rowName(WORKSPACES[0]) })
    expect(first.getAttribute('aria-current')).toBe('true')
    expect(within(sidebar()).getByRole('button', { name: rowName(WORKSPACES[1]) }).getAttribute('aria-current')).toBeNull()
    expect(within(sidebar()).getByRole('navigation', { name: 'Workspaces' })).toBeTruthy()
    expect(store.getState().appShell.activeWorkspaceId).toBe('w1')
    expect(await seriousViolations(container)).toHaveLength(0)
  })

  it('selected: clicking another row makes it the active workspace', async () => {
    const { store } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })

    const second = await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[1]) })
    fireEvent.click(second)

    await waitFor(() => expect(second.getAttribute('aria-current')).toBe('true'))
    expect(store.getState().appShell.activeWorkspaceId).toBe('w2')
    expect(mockedTree()).toBeTruthy()
  })

  it('collapsed: collapse hides the list behind an expand control that restores it', async () => {
    const { container, store } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    expect(within(sidebar()).queryByRole('button', { name: 'Expand sidebar' })).toBeNull()
    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Collapse sidebar' }))
    expect(store.getState().appShell.isSidebarCollapsed).toBe(true)
    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Expand sidebar' }))
    expect(store.getState().appShell.isSidebarCollapsed).toBe(false)
    expect(within(sidebar()).queryByRole('button', { name: 'Expand sidebar' })).toBeNull()
    expect(await seriousViolations(container)).toHaveLength(0)
  })

  it('row actions: a visible menu offers Rename and Delete, and Delete confirms as immediate', async () => {
    const { container } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    const trigger = await within(sidebar()).findByRole('button', { name: `Actions for ${WORKSPACES[0].title}` })

    fireEvent.keyDown(trigger, { key: 'Enter' })
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /rename/i })).toBeTruthy()
    fireEvent.click(within(menu).getByRole('menuitem', { name: /delete/i }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toMatch(/immediately/)
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeTruthy()
    // axe over an open modal (portal + aria-hidden siblings) takes several
    // seconds under jsdom; the budget is for the scan, nothing here is slow.
    expect(await seriousViolations(container)).toHaveLength(0)
  })

  it('rows: a one-line title over the summary and when it was updated; no summary, no line', async () => {
    const updatedAt = new Date(Date.now() - 2 * 86_400_000).toISOString()
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES.map((w) => ({ ...w, updatedAt })) }),
    })
    const first = await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })
    const second = within(sidebar()).getByRole('button', { name: rowName(WORKSPACES[1]) })

    // Owner pick W3 (2026-09-25): the summary is in the row, not a tooltip.
    expect(first.textContent).toMatch(/should we branch/i)
    expect(first.textContent).toMatch(/updated 2 days ago/i)
    expect(second.textContent).not.toMatch(/no summary/i)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('row actions: right-clicking a row still opens its context menu', async () => {
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    const row = await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    fireEvent.contextMenu(row)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /rename/i })).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { name: /delete/i })).toBeTruthy()
  })

  it('row actions: cancelling the delete confirm returns focus to whichever control opened it', async () => {
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    const trigger = await within(sidebar()).findByRole('button', { name: `Actions for ${WORKSPACES[0].title}` })
    const row = within(sidebar()).getByRole('button', { name: rowName(WORKSPACES[0]) })

    // From the overflow menu: the dialog has no trigger of its own to go back to.
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: /delete/i }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))

    // From the right-click menu: back to the row itself.
    fireEvent.contextMenu(row)
    fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: /delete/i }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(row))
  })

  it('account menu: identity, Privacy, Terms and Logout live behind the avatar; no standalone legal links', async () => {
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      // TEST_USER's 100 credits are under one turn; give this one a few.
      user: { ...TEST_USER, creditBalance: 4000 },
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    // Owner decision 2026-09-22: no Privacy/Terms links under the account row.
    expect(within(sidebar()).queryByRole('link', { name: 'Privacy' })).toBeNull()
    expect(within(sidebar()).queryByRole('button', { name: 'Logout' })).toBeNull()
    expect(within(sidebar()).getByRole('link', { name: 'Trellis' }).getAttribute('href')).toBe('/')
    expect(within(sidebar()).getByText(/turns remaining/)).toBeTruthy()

    const trigger = within(sidebar()).getByRole('button', { name: 'Account menu' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText(TEST_USER.displayName as string)).toBeTruthy()
    expect(within(menu).getByText(TEST_USER.email as string)).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
    expect(within(menu).getByRole('menuitem', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    expect(within(menu).getByRole('menuitem', { name: 'Logout' })).toBeTruthy()
  })

  it('collapsed: a failed logout is reported in the account menu, which stays open', async () => {
    const base = trpcFetch({ workspacesList: () => WORKSPACES })
    const fetchImpl: typeof fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!url.includes('/auth/logout')) return base(input, init)
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)
    }
    const { store } = renderWithProviders(<WorkspaceLayout />, { authStatus: 'authenticated', fetchImpl })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })
    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Collapse sidebar' }))
    expect(store.getState().appShell.isSidebarCollapsed).toBe(true)

    // The collapsed strip comes first; the expanded subtree is hidden by CSS jsdom does not apply.
    const [collapsedTrigger] = within(sidebar()).getAllByRole('button', { name: 'Account menu' })
    fireEvent.keyDown(collapsedTrigger, { key: 'Enter' })
    const menu = await screen.findByRole('menu')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Logout' }))

    expect((await within(menu).findByRole('alert')).textContent).toMatch(/unable to sign out/i)
    expect(screen.getByRole('menu')).toBe(menu)
  })

  it('zero credit: the credit line says sending will fail', async () => {
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      user: { ...TEST_USER, creditBalance: 0 },
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    expect(within(sidebar()).getByRole('status').textContent).toMatch(/no credit left/i)
  })

  it('low credit: a positive balance under one turn does not claim sending will fail', async () => {
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      user: { ...TEST_USER, creditBalance: 100 },
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    expect(within(sidebar()).getByText(/less than one turn remaining/i)).toBeTruthy()
    expect(within(sidebar()).queryByText(/no credit left/i)).toBeNull()
  })

  it('create: the popover opens from New, Escape closes it and focus returns to the trigger', async () => {
    const { container } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })
    const trigger = within(sidebar()).getByRole('button', { name: 'Create workspace' })

    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Create workspace' })
    expect(within(dialog).getByRole('button', { name: /new blank workspace/i })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: /choose a database/i })).toBeTruthy()
    expect(await seriousViolations(container)).toHaveLength(0)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create workspace' })).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('create: a blank workspace is created through the hook, listed and selected', async () => {
    const list = [...WORKSPACES]
    const calls: string[] = []
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch(
        {
          workspacesList: () => list,
          workspaceCreate: (input) => {
            const created = { id: 'w3', title: (input as { title: string }).title, summary: null }
            list.push(created)
            return created
          },
        },
        calls,
      ),
    })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Create workspace' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create workspace' })
    fireEvent.click(within(dialog).getByRole('button', { name: /new blank workspace/i }))

    const created = await within(sidebar()).findByRole('button', { name: /^New Workspace 3/ }, { timeout: 4000 })
    await waitFor(() => expect(created.getAttribute('aria-current')).toBe('true'))
    expect(calls).toContain('workspaceCreate')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create workspace' })).toBeNull())
  })

  it('create: a failing example create reports the error and leaves the list and selection intact', async () => {
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({
        workspacesList: () => WORKSPACES,
        workspaceCreateFromExample: () => {
          throw new Error('example import failed')
        },
      }),
    })
    const first = await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Create workspace' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create workspace' })
    fireEvent.click(within(dialog).getByRole('button', { name: /choose a database/i }))

    expect((await within(dialog).findByRole('alert', {}, { timeout: 4000 })).textContent).toMatch(/went wrong/i)
    expect(within(sidebar()).getAllByRole('button', { name: /^(MVP|Choose)/ })).toHaveLength(2)
    expect(first.getAttribute('aria-current')).toBe('true')
  })

  it('no workspaces: the empty state offers the create actions and blank creates', async () => {
    const list: typeof WORKSPACES = []
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({
        workspacesList: () => list,
        workspaceCreate: (input) => {
          const created = { id: 'w9', title: (input as { title: string }).title, summary: null }
          list.push(created)
          return created
        },
      }),
    })
    await waitFor(() => expect(within(sidebar()).getByText(/no workspaces yet/i)).toBeTruthy())
    const main = screen.getByRole('main', { name: 'Workspace' })
    expect(within(main).getByRole('button', { name: /project decision/i })).toBeTruthy()

    fireEvent.click(within(main).getByRole('button', { name: /new blank workspace/i }))

    const created = await within(sidebar()).findByRole('button', { name: /^New Workspace 1/ }, { timeout: 4000 })
    await waitFor(() => expect(created.getAttribute('aria-current')).toBe('true'))
    expect(mockedTree()).toBeTruthy()
  })

  it('create: a committed create is listed and selected even when the list refresh fails', async () => {
    let createdAlready = false
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({
        workspacesList: () => {
          if (createdAlready) throw new Error('list refresh failed')
          return WORKSPACES
        },
        workspaceCreate: (input) => {
          createdAlready = true
          return { id: 'w3', title: (input as { title: string }).title, summary: null }
        },
      }),
    })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Create workspace' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create workspace' })
    fireEvent.click(within(dialog).getByRole('button', { name: /new blank workspace/i }))

    const created = await within(sidebar()).findByRole('button', { name: /^New Workspace 3/ }, { timeout: 4000 })
    await waitFor(() => expect(created.getAttribute('aria-current')).toBe('true'))
    expect(within(sidebar()).getAllByRole('button', { name: /^(MVP|Choose|New Workspace)/ })).toHaveLength(3)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create workspace' })).toBeNull())
    expect(screen.queryByText(/went wrong/i)).toBeNull()
  })

  it('create: the popover stays open while its own create is in flight', async () => {
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: neverSettling('workspaceCreate', trpcFetch({ workspacesList: () => WORKSPACES })),
    })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Create workspace' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create workspace' })
    fireEvent.click(within(dialog).getByRole('button', { name: /new blank workspace/i }))
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /new blank workspace/i }).getAttribute('aria-busy')).toBe('true'),
    )

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Create workspace' })).toBeTruthy()
  })

  it('create: a pending create from the empty state holds the sidebar popover to it too', async () => {
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: neverSettling('workspaceCreate', trpcFetch({ workspacesList: () => [] })),
    })
    await waitFor(() => expect(within(sidebar()).getByText(/no workspaces yet/i)).toBeTruthy())
    const main = screen.getByRole('main', { name: 'Workspace' })

    fireEvent.click(within(main).getByRole('button', { name: /new blank workspace/i }))
    await waitFor(() =>
      expect(within(main).getByRole('button', { name: /new blank workspace/i }).getAttribute('aria-busy')).toBe('true'),
    )

    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Create workspace' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create workspace' })
    expect(within(dialog).getByRole('button', { name: /new blank workspace/i })).toHaveProperty('disabled', true)
    expect(within(dialog).getByRole('button', { name: /choose a database/i })).toHaveProperty('disabled', true)
  })

  it('outline: the Outline tab lists the live nodes and opens one', async () => {
    const { container, store } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({
        workspacesList: () => WORKSPACES,
        nodesByWorkspace: () => [
          { id: 'n1', parentNodeId: null, depth: 0, title: 'Root decision', status: 'open', createdAt: '2026-01-01T00:00:00Z' },
          { id: 'n2', parentNodeId: 'n1', depth: 1, title: 'Child branch', status: 'exploring', createdAt: '2026-01-02T00:00:00Z' },
          { id: 'n3', parentNodeId: 'n1', depth: 1, title: 'Merged branch', status: 'merged', createdAt: '2026-01-03T00:00:00Z' },
        ],
      }),
    })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    const outlineTab = within(sidebar()).getByRole('tab', { name: 'Outline' })
    fireEvent.mouseDown(outlineTab, { button: 0 })
    fireEvent.click(outlineTab)

    const child = await within(sidebar()).findByRole('button', { name: /Child branch/ })
    expect(within(sidebar()).getByRole('button', { name: /Root decision/ })).toBeTruthy()
    // Owner pick A2 (2026-09-25): resolved nodes stay out of the outline.
    expect(within(sidebar()).queryByRole('button', { name: /Merged branch/ })).toBeNull()
    expect(within(sidebar()).getByText(/2 of 3 nodes/)).toBeTruthy()
    expect(child.getAttribute('aria-current')).toBeNull()

    fireEvent.click(child)
    await waitFor(() => expect(child.getAttribute('aria-current')).toBe('true'))
    expect(store.getState().appShell.openNodeId).toBe('n2')
    expect(await seriousViolations(container)).toHaveLength(0)

    // Switching workspaces closes the open node.
    fireEvent.mouseDown(within(sidebar()).getByRole('tab', { name: 'Workspaces' }), { button: 0 })
    fireEvent.click(within(sidebar()).getByRole('button', { name: rowName(WORKSPACES[1]) }))
    await waitFor(() => expect(store.getState().appShell.openNodeId).toBeNull())
  })

  it('load failed: the shell stays, names the failure instead of the empty state, and retries', async () => {
    let failing = true
    const { container } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({
        workspacesList: () => {
          if (failing) throw new Error('Connection reset')
          return WORKSPACES
        },
      }),
    })

    const main = screen.getByRole('main', { name: 'Workspace' })
    expect((await within(main).findByRole('alert')).textContent).toMatch(/couldn.t reach the server/i)
    expect(within(main).getByRole('heading', { level: 1 }).textContent).toMatch(/didn.t load/i)
    expect(within(sidebar()).getByText(/couldn.t load your workspaces/i)).toBeTruthy()
    // Never the empty state: that would invite creating a workspace the user may already have.
    expect(within(sidebar()).queryByText(/no workspaces yet/i)).toBeNull()
    expect(within(main).queryByRole('button', { name: /new blank workspace/i })).toBeNull()
    expect(await seriousViolations(container)).toHaveLength(0)

    failing = false
    fireEvent.click(within(main).getByRole('button', { name: 'Try again' }))
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })
    expect(within(main).queryByRole('alert')).toBeNull()
    expect(mockedTree()).toBeTruthy()
  })

  it('outline: the tab is disabled when no workspace is open', async () => {
    renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => [] }),
    })
    await waitFor(() => expect(within(sidebar()).getByText(/no workspaces yet/i)).toBeTruthy())
    expect(within(sidebar()).getByRole('tab', { name: 'Outline' })).toHaveProperty('disabled', true)
  })

  it('seeded: an unnamed icon button inside the shell turns the scan red', async () => {
    const { container } = renderWithProviders(<WorkspaceLayout />, {
      authStatus: 'authenticated',
      fetchImpl: trpcFetch({ workspacesList: () => WORKSPACES }),
    })
    await within(sidebar()).findByRole('button', { name: rowName(WORKSPACES[0]) })

    const rogue = document.createElement('button')
    rogue.innerHTML = '<svg aria-hidden="true" focusable="false" width="16" height="16"></svg>'
    sidebar().appendChild(rogue)

    expect(await seriousViolations(container)).not.toHaveLength(0)
  })
})
