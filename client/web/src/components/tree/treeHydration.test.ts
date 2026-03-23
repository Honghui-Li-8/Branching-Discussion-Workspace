import { buildTreeFromWorkspaceNodes } from './treeHydration'

type HydrationInputNode = Parameters<typeof buildTreeFromWorkspaceNodes>[0][number]

const makeNode = (overrides: Partial<HydrationInputNode>): HydrationInputNode => ({
  id: overrides.id ?? 'node-id',
  parentNodeId: overrides.parentNodeId ?? 'node-id',
  depth: overrides.depth ?? 0,
  title: overrides.title ?? 'Node',
  status: overrides.status ?? 'open',
  createdAt: overrides.createdAt ?? '2026-03-01T00:00:00.000Z',
})

describe('treeHydration', () => {
  test('returns null for empty node list', () => {
    expect(buildTreeFromWorkspaceNodes([])).toBeNull()
  })

  test('hydrates a root with deterministically sorted children', () => {
    const tree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'root',
        parentNodeId: 'root',
        depth: 0,
        title: 'Root',
        status: 'open',
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
      makeNode({
        id: 'later',
        parentNodeId: 'root',
        depth: 1,
        title: 'Later',
        status: 'exploring',
        createdAt: '2026-03-03T00:00:00.000Z',
      }),
      makeNode({
        id: 'earlier',
        parentNodeId: 'root',
        depth: 1,
        title: 'Earlier',
        status: 'approved',
        createdAt: '2026-03-02T00:00:00.000Z',
      }),
    ])

    expect(tree?.id).toBe('root')
    expect(tree?.status).toBe('Open')
    expect(tree?.children?.map((child) => child.id)).toEqual(['earlier', 'later'])
    expect(tree?.children?.map((child) => child.status)).toEqual(['Approved', 'Exploring'])
  })

  test('reattaches orphan nodes under root to keep them visible', () => {
    const tree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'root',
        parentNodeId: 'root',
        depth: 0,
        title: 'Root',
      }),
      makeNode({
        id: 'orphan',
        parentNodeId: 'missing-parent',
        depth: 2,
        title: 'Orphan node',
      }),
    ])

    expect(tree?.id).toBe('root')
    expect(tree?.children?.map((child) => child.id)).toContain('orphan')
  })

  test('skips cyclic links and keeps cyclic nodes visible under root', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const tree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'root',
        parentNodeId: 'root',
        depth: 0,
        title: 'Root',
      }),
      makeNode({
        id: 'a',
        parentNodeId: 'b',
        depth: 1,
        title: 'Cycle A',
      }),
      makeNode({
        id: 'b',
        parentNodeId: 'a',
        depth: 1,
        title: 'Cycle B',
      }),
    ])

    expect(tree?.id).toBe('root')
    expect(tree?.children?.map((child) => child.id).sort()).toEqual(['a', 'b'])
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test('maps unknown backend status safely to Open', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const tree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'root',
        parentNodeId: 'root',
        depth: 0,
        title: 'Root',
        status: 'unexpected_status' as never,
      }),
    ])

    expect(tree?.status).toBe('Open')
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})

