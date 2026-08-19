import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { Button } from './ui/button'
import { ICONS } from '../lib/icons'

type Props = {
  workspaceTitle: string
  onRename: () => void
  onDelete: () => void
  isDeletePending: boolean
  children: ReactNode
}

export const WorkspaceContextMenu = ({
  workspaceTitle,
  onRename,
  onDelete,
  isDeletePending,
  children,
}: Props) => {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onRename}>
            <ICONS.rename className="h-4 w-4" aria-hidden="true" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem disabled>
            <ICONS.duplicate className="h-4 w-4" aria-hidden="true" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem destructive onSelect={() => setConfirmOpen(true)}>
            <ICONS.delete className="h-4 w-4" aria-hidden="true" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete &ldquo;{workspaceTitle}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button variant="secondary" size="sm">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" size="sm" pending={isDeletePending} onClick={onDelete}>
                Delete
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
