import type { TreeNode, TreeStatus } from '../types/tree'
import { liveOutline } from './outlineFilter'

const node = (id: string, status: TreeStatus, children: TreeNode[] = []): TreeNode => ({
  id,
  title: id,
  status,
  depth: 0,
  children,
})

const ids = (tree: TreeNode): string[] => [tree.id, ...(tree.children ?? []).flatMap(ids)]

// root ─┬─ exploring ── open-leaf
//       ├─ pending
//       ├─ merged ── live-under-merged
//       └─ approved
const TREE = node('root', 'Approved', [
  node('exploring', 'Exploring', [node('open-leaf', 'Open')]),
  node('pending', 'Needs Approval'),
  node('merged', 'Merged', [node('live-under-merged', 'Exploring')]),
  node('approved', 'Approved'),
])

describe('liveOutline', () => {
  it('keeps the root and its live descendants, pending included', () => {
    const view = liveOutline(TREE, null)
    expect(ids(view.tree)).toEqual(['root', 'exploring', 'open-leaf', 'pending'])
    expect(view).toMatchObject({ shown: 4, total: 7 })
  })

  it('leaves a live node out with its resolved parent', () => {
    expect(ids(liveOutline(TREE, null).tree)).not.toContain('live-under-merged')
  })

  it('always shows the open node and the path to it, whatever their status', () => {
    const view = liveOutline(TREE, 'live-under-merged')
    expect(ids(view.tree)).toEqual(['root', 'exploring', 'open-leaf', 'pending', 'merged', 'live-under-merged'])
    expect(view.shown).toBe(6)
  })

  it('ignores an open node id that is not in the tree', () => {
    expect(liveOutline(TREE, 'elsewhere').shown).toBe(4)
  })
})
