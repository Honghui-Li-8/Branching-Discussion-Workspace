import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Button } from './ui/button'
import { Separator } from './ui/separator'
import { ICONS } from '../lib/icons'
import { useCreateWorkspaceActions } from './useCreateWorkspaceActions'

/**
 * The sidebar's create entry (A10): the "New" trigger and its popover on the
 * popover primitive — Escape, outside click and focus return come from Radix.
 * Blank first, then the guided examples; one action at a time while pending.
 */
export const CreateWorkspacePopover = () => {
  const [open, setOpen] = useState(false)
  // Closes on a successful create; a failure keeps it open to show the message.
  const { examples, createBlank, createFromExample, pendingKey, isRequesting, error, clearError, isAvailable } =
    useCreateWorkspaceActions({ onCreated: () => setOpen(false) })

  const otherPending = (key: string) => pendingKey !== null && pendingKey !== key

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // The popover is the only surface for this request's outcome: while
        // its own create is in flight, Escape and outside clicks do not close
        // it, so a failure is never reported to a closed popover.
        if (!next && isRequesting) return
        setOpen(next)
        if (!next) clearError()
      }}
    >
      <PopoverTrigger asChild>
        <Button className="w-full" aria-label="Create workspace" disabled={!isAvailable}>
          <ICONS.create className="h-4 w-4" aria-hidden="true" />
          New workspace
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Create workspace" className="w-64 p-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={createBlank}
          pending={pendingKey === 'blank'}
          disabled={otherPending('blank')}
        >
          <ICONS.create className="h-4 w-4" aria-hidden="true" />
          New blank workspace
        </Button>
        <Separator className="my-1" />
        <p className="m-0 px-2 pt-1 pb-1 text-caption font-medium uppercase tracking-wide text-text-muted">
          Start from example
        </p>
        {examples.map(({ key, title, description }) => (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-start py-1.5 text-left"
            onClick={() => createFromExample(key)}
            pending={pendingKey === key}
            disabled={otherPending(key)}
          >
            {/* One child: the Button lays its children out as a row. */}
            <span className="flex min-w-0 flex-col items-start">
              <span className="text-label font-medium">{title}</span>
              <span className="text-caption font-normal text-text-muted">{description}</span>
            </span>
          </Button>
        ))}
        {error ? (
          <p role="alert" className="m-0 px-2 pt-1 pb-0.5 text-caption text-error-default">
            {error}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
