import { useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { Button } from './ui/button'
import { ICONS, OVERFLOW_ICONS } from '../lib/icons'

type Props = {
  workspaceTitle: string
  onRename: () => void
  onDelete: () => void
  isDeletePending: boolean
  children: ReactNode
}

/**
 * A workspace row's management actions (A10): a visible overflow-menu button
 * beside the row, reachable by mouse, touch and keyboard, plus the original
 * right-click context menu as an optional shortcut. Both drive one delete
 * confirmation. Delete is immediate on the server, and the copy says so.
 *
 * The confirmation is opened from a menu, not an AlertDialogTrigger, so Radix
 * has no trigger to return focus to on close; it returns focus to whichever
 * control opened it instead — the overflow button or the row.
 */
export const WorkspaceItemActions = ({
  workspaceTitle,
  onRename,
  onDelete,
  isDeletePending,
  children,
}: Props) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const rowRef = useRef<HTMLElement>(null)
  const overflowRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const openConfirm = (invoker: RefObject<HTMLElement | null>) => {
    returnFocusRef.current = invoker.current
    setConfirmOpen(true)
  }
  const OverflowIcon = OVERFLOW_ICONS.horizontal

  return (
    <>
      <div className="flex min-w-0 items-stretch gap-1">
        <ContextMenu>
          <ContextMenuTrigger ref={rowRef} asChild>
            {children}
          </ContextMenuTrigger>
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
            <ContextMenuItem destructive onSelect={() => openConfirm(rowRef)}>
              <ICONS.delete className="h-4 w-4" aria-hidden="true" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={overflowRef}
              variant="ghost"
              size="sm"
              className="shrink-0 self-center px-2"
              aria-label={`Actions for ${workspaceTitle}`}
            >
              <OverflowIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRename}>
              <ICONS.rename className="h-4 w-4" aria-hidden="true" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <ICONS.duplicate className="h-4 w-4" aria-hidden="true" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => openConfirm(overflowRef)}>
              <ICONS.delete className="h-4 w-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocusRef.current?.focus()
          }}
        >
          <AlertDialogTitle>Delete &ldquo;{workspaceTitle}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Deletes this workspace and every node and message in it immediately. This cannot be
            undone.
          </AlertDialogDescription>
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
