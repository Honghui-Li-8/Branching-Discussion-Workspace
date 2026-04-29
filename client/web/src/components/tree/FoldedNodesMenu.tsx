import { useEffect, useRef } from 'react'
import { zIndex } from '../../theme/zIndex'
import type { FoldedNodeSummary } from '../../types/tree'

type FoldedNodesMenuProps = {
  isOpen: boolean
  nodes: FoldedNodeSummary[]
  onOpenNode: (nodeId: string) => void
  onClose: () => void
}

export const FoldedNodesMenu = ({
  isOpen,
  nodes,
  onOpenNode,
  onClose,
}: FoldedNodesMenuProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return
      }

      onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className="absolute left-8 top-1/2 h-[170px] w-[250px] -translate-y-1/2 resize overflow-auto rounded-xl border border-[#7eb9d5] bg-white p-2.5 shadow-[0_10px_24px_rgba(36,89,114,0.2)]"
      style={{
        minWidth: '200px',
        minHeight: '130px',
        zIndex: zIndex.popoverMenu,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2e6883]">
          Folded Nodes
        </p>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-lg border border-[#efb6aa] bg-[#fff3ef] text-xs font-semibold text-[#bf6454] hover:bg-[#ffe8e1] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b8a8]/50"
          aria-label="Close folded nodes menu"
          onClick={onClose}
        >
          x
        </button>
      </div>

      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {nodes.map((foldedNode) => (
          <li key={foldedNode.id}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-[#6ea9c7] bg-white px-2 py-1 text-left text-[#1f607d] hover:bg-[#eef9ff] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5da8d2]/50"
              onClick={() => onOpenNode(foldedNode.id)}
            >
              <span className="block flex-1 truncate text-xs text-[#1d516a]">
                {foldedNode.title}
              </span>
              <span className="shrink-0 rounded border border-[#8ab8cd] px-1 text-[10px] text-[#2e6883]">
                Open
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
