import type { ReactNode } from 'react'

type TreeCanvasScrollAreaProps = {
  hasConversationPanel: boolean
  conversationPanelFullscreen: boolean
  conversationPanelWidth: number
  children: ReactNode
}

export const TreeCanvasScrollArea = ({
  hasConversationPanel,
  conversationPanelFullscreen,
  conversationPanelWidth,
  children,
}: TreeCanvasScrollAreaProps) => {
  return (
    <div
      className="h-full overflow-auto"
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
