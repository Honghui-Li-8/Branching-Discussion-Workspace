import { useEffect, useRef, useState } from 'react'
import type { ExampleWorkspaceKey } from '@branching/shared/router/schemas/core'
import { useAppDispatch } from '../store/hooks'
import { setActiveWorkspaceId } from '../store/slices/appShellSlice'
import { trpc } from '../trpc'

const EXAMPLES: { key: ExampleWorkspaceKey; title: string; description: string }[] = [
  {
    key: 'project-decision',
    title: 'Project Decision',
    description: 'Should I build this project now?',
  },
  {
    key: 'database-selection',
    title: 'Choose a Database',
    description: 'PostgreSQL vs MongoDB vs DynamoDB for a new service.',
  },
  {
    key: 'interview-prep',
    title: 'Interview Walkthrough Prep',
    description: 'Structure a 60-minute technical session with branched deep-dives.',
  },
]

type Props = {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onCreateBlank: () => void
  onClose: () => void
}

export const CreateWorkspacePopover = ({ anchorRef, onCreateBlank, onClose }: Props) => {
  const dispatch = useAppDispatch()
  const utils = trpc.useUtils()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [creatingKey, setCreatingKey] = useState<ExampleWorkspaceKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createFromExample = trpc.workspaceCreateFromExample.useMutation({
    onSuccess: async (workspace) => {
      await utils.workspacesList.invalidate()
      dispatch(setActiveWorkspaceId(workspace.id))
      onClose()
    },
    onError: () => {
      setError('Something went wrong. Please try again.')
      setCreatingKey(null)
    },
  })

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose()
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, anchorRef])

  const anchorRect = anchorRef.current?.getBoundingClientRect()
  const top = anchorRect ? anchorRect.bottom + 6 : 0
  const left = anchorRect ? anchorRect.left : 0

  const handleExample = (key: ExampleWorkspaceKey) => {
    if (creatingKey) return
    setError(null)
    setCreatingKey(key)
    createFromExample.mutate({ key })
  }

  const handleBlank = () => {
    onCreateBlank()
    onClose()
  }

  return (
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top, left, zIndex: 9000 }}
      className="min-w-[210px] rounded-xl border border-[#b8dced] bg-white py-1.5 shadow-[0_4px_20px_rgba(0,40,80,0.12)]"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#12384c] transition-colors duration-100 hover:bg-[#f0f9ff] disabled:opacity-50"
        onClick={handleBlank}
        disabled={!!creatingKey}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md border border-[#b8dced] text-[14px] font-light leading-none text-[#40718a]">
          +
        </span>
        New blank workspace
      </button>

      <div className="mx-3 my-1.5 border-t border-[#e5f3fb]" />

      <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.1em] text-[#7ab3cc]">
        Start from example
      </p>

      {EXAMPLES.map(({ key, title, description }) => {
        const isLoading = creatingKey === key
        const isDisabled = !!creatingKey

        return (
          <button
            key={key}
            type="button"
            className="flex w-full flex-col px-3 py-1.5 text-left transition-colors duration-100 hover:bg-[#f0f9ff] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => handleExample(key)}
            disabled={isDisabled}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#12384c]">
              {title}
              {isLoading && (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[#b8dced] border-t-[#1f607d]" />
              )}
            </span>
            <span className="text-[11px] text-[#40718a]">{description}</span>
          </button>
        )
      })}

      {error && (
        <p className="px-3 pt-1 pb-0.5 text-[11px] text-[#b93b2a]">{error}</p>
      )}
    </div>
  )
}
