import type { ReactNode, RefObject } from 'react'
import { zIndex } from '../../../theme/zIndex'

type TreeCanvasFrameProps = {
  canvasRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

/**
 * Visual host for the tree canvas.
 * Owns the canvas background and the root DOM ref used for width measurement.
 */
export const TreeCanvasFrame = ({ canvasRef, children }: TreeCanvasFrameProps) => {
  return (
    <div
      ref={canvasRef}
      className="relative min-h-0 flex-1 overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 1px 1px, rgba(100, 116, 139, 0.16) 1px, transparent 0) 0 0 / 24px 24px, linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        zIndex: zIndex.canvasBase,
      }}
    >
      {children}
    </div>
  )
}
