import { useAppDispatch, useAppSelector } from '../store/hooks'
import { selectActiveWorkspace, selectOpenNodeId, setOpenNodeId } from '../store/slices/appShellSlice'
import { useWorkspaceTreeData } from './discussion-tree/hooks/useWorkspaceTreeData'
import type { TreeNode, TreeStatus } from '../types/tree'
import { cn } from '../lib/utils'

/** Never fold in the outline: it is the complete map of the workspace. */
const NO_FOLDS: Record<string, boolean> = {}

const STATUS_DOT: Record<TreeStatus, string> = {
  Open: 'bg-neutral-default',
  Exploring: 'bg-accent-default',
  'Needs Approval': 'bg-warning-default',
  Approved: 'bg-success-default',
  Deferred: 'bg-neutral-default',
  Closed: 'bg-neutral-default',
  Merged: 'bg-merged-default',
}

type RowProps = {
  node: TreeNode
  depth: number
  openNodeId: string | null
  onOpen: (nodeId: string) => void
}

const OutlineRow = ({ node, depth, openNodeId, onOpen }: RowProps) => {
  const isOpen = node.id === openNodeId
  return (
    <li className="m-0 p-0">
      <button
        type="button"
        aria-current={isOpen ? 'true' : undefined}
        onClick={() => onOpen(node.id)}
        className={cn(
          'flex h-8 w-full min-w-0 items-center gap-2 rounded-md border-l-2 px-2 text-left text-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2',
          isOpen
            ? 'border-accent-default bg-accent-tint font-medium text-accent-strong'
            : 'border-transparent text-text-default hover:bg-bg-subtle',
          depth === 0 && 'font-semibold',
        )}
      >
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[node.status])} />
        <span className="truncate">{node.title}</span>
        <span className="sr-only">, {node.status}</span>
      </button>
      {node.children && node.children.length > 0 ? (
        <ul className="m-0 ml-3 list-none border-l border-border-default p-0 pl-1">
          {node.children.map((child) => (
            <OutlineRow key={child.id} node={child} depth={depth + 1} openNodeId={openNodeId} onOpen={onOpen} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

const OutlineTree = ({ workspaceId }: { workspaceId: string }) => {
  const dispatch = useAppDispatch()
  const openNodeId = useAppSelector(selectOpenNodeId)
  const { tree, isLoading, error } = useWorkspaceTreeData({ workspaceId, foldedNodeIds: NO_FOLDS })

  if (isLoading && !tree) {
    return (
      <p role="status" className="m-0 px-3 py-2 text-caption text-text-muted">
        Loading outline…
      </p>
    )
  }
  if (error && !tree) {
    return (
      <p role="alert" className="m-0 px-3 py-2 text-caption text-error-default">
        Could not load the outline: {error.message}
      </p>
    )
  }
  if (!tree) {
    return <p className="m-0 px-3 py-2 text-caption text-text-muted">No nodes in this workspace yet.</p>
  }

  return (
    <ul className="m-0 list-none p-0 px-2">
      <OutlineRow node={tree} depth={0} openNodeId={openNodeId} onOpen={(id) => dispatch(setOpenNodeId(id))} />
    </ul>
  )
}

/**
 * The sidebar's Outline view (A10b, A03 frame 302:682): the open workspace's
 * node tree as a folder-path list with a status dot per node, indentation
 * guide lines, and the stripe-and-tint highlight on the node whose
 * conversation is open. Selecting a row opens that node's conversation.
 */
export const WorkspaceOutline = () => {
  const workspace = useAppSelector(selectActiveWorkspace)
  if (!workspace) {
    return <p className="m-0 px-3 py-2 text-caption text-text-muted">Open a workspace to see its outline.</p>
  }
  return <OutlineTree key={workspace.id} workspaceId={workspace.id} />
}
