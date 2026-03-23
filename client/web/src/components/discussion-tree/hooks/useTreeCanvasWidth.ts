import { useEffect, useState, type RefObject } from 'react'

export const useTreeCanvasWidth = (canvasRef: RefObject<HTMLDivElement | null>) => {
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const canvasElement = canvasRef.current
    if (!canvasElement) {
      return
    }

    const updateContainerWidth = () => {
      setContainerWidth(canvasElement.clientWidth)
    }

    updateContainerWidth()

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(updateContainerWidth)
      resizeObserver.observe(canvasElement)
      return () => {
        resizeObserver.disconnect()
      }
    }

    window.addEventListener('resize', updateContainerWidth)
    return () => {
      window.removeEventListener('resize', updateContainerWidth)
    }
  }, [canvasRef])

  return containerWidth
}
