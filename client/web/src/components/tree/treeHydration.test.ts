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

  test('root fallback prefers strict self-parent root', () => {
    const tree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'strict-root',
        parentNodeId: 'strict-root',
        depth: 0,
        createdAt: '2026-03-02T00:00:00.000Z',
      }),
      makeNode({
        id: 'depth-only-root',
        parentNodeId: 'strict-root',
        depth: 0,
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
    ])

    expect(tree?.id).toBe('strict-root')
  })

  test('root fallback uses first depth=0 node when strict root is absent', () => {
    const tree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'depth-root-first',
        parentNodeId: 'missing',
        depth: 0,
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
      makeNode({
        id: 'depth-root-second',
        parentNodeId: 'also-missing',
        depth: 0,
        createdAt: '2026-03-02T00:00:00.000Z',
      }),
    ])

    expect(tree?.id).toBe('depth-root-first')
  })

  test('root fallback uses first sorted node when no depth=0 root exists', () => {
    const tree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'later',
        parentNodeId: 'missing',
        depth: 2,
        createdAt: '2026-03-02T00:00:00.000Z',
      }),
      makeNode({
        id: 'earlier',
        parentNodeId: 'missing',
        depth: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
    ])

    expect(tree?.id).toBe('earlier')
  })

  test('stable sort tie-breakers use depth then id for identical createdAt', () => {
    const tree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'root',
        parentNodeId: 'root',
        depth: 0,
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
      makeNode({
        id: 'depth2-c',
        parentNodeId: 'missing-parent',
        depth: 2,
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
      makeNode({
        id: 'depth1-b',
        parentNodeId: 'missing-parent',
        depth: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
      makeNode({
        id: 'depth1-a',
        parentNodeId: 'missing-parent',
        depth: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
    ])

    expect(tree?.children?.map((child) => child.id)).toEqual(['depth1-a', 'depth1-b', 'depth2-c'])
  })

  test('hydrates node statuses and keeps deterministic child order by createdAt', () => {
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

  test('merged DB status maps to Merged TreeStatus and preserves depth', () => {
    const tree = buildTreeFromWorkspaceNodes([
      makeNode({ id: 'root', parentNodeId: 'root', depth: 0, status: 'open' }),
      makeNode({ id: 'child', parentNodeId: 'root', depth: 1, status: 'merged' }),
    ])

    const child = tree?.children?.[0]
    expect(child?.status).toBe('Merged')
    expect(child?.depth).toBe(1)
  })

  test('unknown status warning is deduped and unknown statuses map to Open', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const firstTree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'root-a',
        parentNodeId: 'root-a',
        depth: 0,
        status: 'unknown-alpha' as never,
      }),
    ])
    const secondTree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'root-b',
        parentNodeId: 'root-b',
        depth: 0,
        status: 'unknown-alpha' as never,
      }),
    ])
    const thirdTree = buildTreeFromWorkspaceNodes([
      makeNode({
        id: 'root-c',
        parentNodeId: 'root-c',
        depth: 0,
        status: 'unknown-beta' as never,
      }),
    ])

    expect(firstTree?.status).toBe('Open')
    expect(secondTree?.status).toBe('Open')
    expect(thirdTree?.status).toBe('Open')
    expect(warnSpy).toHaveBeenCalledTimes(2)

    warnSpy.mockRestore()
  })
})

