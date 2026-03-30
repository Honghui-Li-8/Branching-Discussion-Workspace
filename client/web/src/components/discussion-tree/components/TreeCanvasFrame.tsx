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
      className="relative flex-1 overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 1px 1px, rgba(125, 172, 195, 0.18) 1px, transparent 0) 0 0 / 22px 22px, linear-gradient(180deg, #f8fdff 0%, #fffefb 100%)',
        zIndex: zIndex.canvasBase,
      }}
    >
      {children}
    </div>
  )
}
