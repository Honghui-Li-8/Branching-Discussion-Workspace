import type { ReactNode } from 'react'

type TreeCanvasScrollAreaProps = {
  children: ReactNode
}

/**
 * Scroll container for tree content. Fills whatever width the frame leaves
 * beside the conversation panel; it no longer pads under a docked overlay.
 */
export const TreeCanvasScrollArea = ({ children }: TreeCanvasScrollAreaProps) => {
  return <div className="h-full min-h-0 min-w-0 flex-1 overflow-auto">{children}</div>
}
