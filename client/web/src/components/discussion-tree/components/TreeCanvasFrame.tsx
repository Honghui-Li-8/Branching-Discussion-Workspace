import type { ReactNode, RefObject } from 'react'

type TreeCanvasFrameProps = {
  canvasRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

/**
 * Visual host for the tree canvas and, when open, the conversation panel —
 * a flex row, so the two are siblings that share the width instead of the
 * panel floating over the canvas (A10 seam fix). Owns the line-grid
 * background and the DOM ref the panel-width logic measures.
 */
export const TreeCanvasFrame = ({ canvasRef, children }: TreeCanvasFrameProps) => {
  return (
    <div
      ref={canvasRef}
      className="relative flex min-h-0 flex-1 overflow-hidden bg-bg-subtlest"
      style={{
        // A03 frame 302:445: a square line grid, one line per 96px.
        backgroundImage:
          'linear-gradient(to right, var(--color-border-subtle) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-subtle) 1px, transparent 1px)',
        backgroundSize: '96px 96px',
      }}
    >
      {children}
    </div>
  )
}
