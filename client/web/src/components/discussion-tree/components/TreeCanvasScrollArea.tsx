import type { ReactNode } from 'react'

type TreeCanvasScrollAreaProps = {
  hasConversationPanel: boolean
  conversationPanelFullscreen: boolean
  conversationPanelWidth: number
  children: ReactNode
}

/**
 * Scroll container for tree content.
 * Applies right padding so the canvas does not render under a docked conversation panel.
 */
export const TreeCanvasScrollArea = ({
  hasConversationPanel,
  conversationPanelFullscreen,
  conversationPanelWidth,
  children,
}: TreeCanvasScrollAreaProps) => {
  return (
    <div
      className="h-full min-h-0 overflow-auto"
      style={{
        paddingRight:
          hasConversationPanel && !conversationPanelFullscreen
            ? `${conversationPanelWidth}px`
            : undefined,
      }}
    >
      {children}
    </div>
  )
}
