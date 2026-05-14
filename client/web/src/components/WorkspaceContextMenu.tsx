import { useEffect, useRef, useState } from 'react'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

type Props = {
  workspaceTitle: string
  x: number
  y: number
  onRename: () => void
  onDelete: () => void
  onClose: () => void
  isDeletePending: boolean
}

export const WorkspaceContextMenu = ({
  workspaceTitle,
  x,
  y,
  onRename,
  onDelete,
  onClose,
  isDeletePending,
}: Props) => {
  const [phase, setPhase] = useState<'menu' | 'confirm'>('menu')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
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
  }, [onClose])

  const menuX = Math.min(x, window.innerWidth - 196)
  const menuY = Math.min(y, window.innerHeight - 168)

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: menuX, top: menuY, zIndex: 9000 }}
      className="min-w-[180px] rounded-xl border border-[#b8dced] bg-white py-1 shadow-[0_4px_20px_rgba(0,40,80,0.12)]"
    >
      {phase === 'menu' ? (
        <>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#12384c] transition-colors duration-100 hover:bg-[#f0f9ff]"
            onClick={() => { onRename(); onClose() }}
          >
            <DriveFileRenameOutlineIcon sx={{ fontSize: 15, color: '#40718a' }} />
            Rename
          </button>

          <button
            type="button"
            className="flex w-full cursor-not-allowed items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#12384c] opacity-35"
            disabled
          >
            <ContentCopyIcon sx={{ fontSize: 15, color: '#40718a' }} />
            Duplicate
          </button>

          <div className="my-1 border-t border-[#e5f3fb]" />

          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#b93b2a] transition-colors duration-100 hover:bg-[#fff5f3]"
            onClick={() => setPhase('confirm')}
          >
            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
            Delete
          </button>
        </>
      ) : (
        <div className="px-3 py-2.5">
          <p className="m-0 mb-1 text-[12px] font-semibold text-[#12384c]">
            Delete &ldquo;{workspaceTitle}&rdquo;?
          </p>
          <p className="m-0 mb-3 text-[11px] text-[#40718a]">This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 cursor-pointer rounded-lg border border-[#b8dced] bg-white py-1 text-[11px] font-semibold text-[#40718a] transition-colors duration-100 hover:bg-[#f0f9ff]"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex-1 cursor-pointer rounded-lg border border-[#b93b2a] bg-[#b93b2a] py-1 text-[11px] font-semibold text-white transition-colors duration-100 hover:bg-[#a03020] disabled:opacity-60"
              onClick={onDelete}
              disabled={isDeletePending}
            >
              {isDeletePending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
