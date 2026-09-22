import type { ReactNode, RefObject } from 'react'

type TreeCanvasFrameProps = {
  canvasRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

/**
 * Visual host for the tree canvas and, when open, the conversation panel —
 * a flex row, so the two are siblings that share the width instead of the
 * panel floating over the canvas (A10 seam fix). Owns the dot-grid
 * background and the DOM ref the panel-width logic measures.
 */
export const TreeCanvasFrame = ({ canvasRef, children }: TreeCanvasFrameProps) => {
  return (
    <div
      ref={canvasRef}
      className="relative flex min-h-0 flex-1 overflow-hidden bg-bg-subtlest"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, var(--color-border-default) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      {children}
    </div>
  )
}
