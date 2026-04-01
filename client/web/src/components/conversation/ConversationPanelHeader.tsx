import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'

type ConversationPanelHeaderProps = {
  topic: string
  conclusion: string
  isFullscreen: boolean
  onToggleFullScreen: () => void
  onClose: () => void
}

export const ConversationPanelHeader = ({
  topic,
  conclusion,
  isFullscreen,
  onToggleFullScreen,
  onClose,
}: ConversationPanelHeaderProps) => {
  return (
    <header className="relative shrink-0 border-b border-[#c2dfef] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2">
          <button
            type="button"
            className="mt-1 inline-flex items-center justify-center text-[#2b6382] hover:text-[#1a4f69]"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={onToggleFullScreen}
            aria-label="Toggle fullscreen conversation panel"
          >
            <span className="sr-only">
              {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            </span>
            {isFullscreen ? (
              <CloseFullscreenIcon fontSize="inherit" className="-scale-x-100" />
            ) : (
              <OpenInFullIcon fontSize="inherit" className="-scale-x-100" />
            )}
          </button>
          <div className="min-w-0">
            <p className="m-0 text-[11px] uppercase tracking-[0.1em] text-[#2f6f8e]">Topic</p>
            <h2
              className="mt-0.5 text-base font-medium leading-tight text-[#12384c]"
              style={{ overflowWrap: 'anywhere' }}
            >
              {topic}
            </h2>
          </div>
        </div>
        <p
          className="m-0 min-w-0 max-w-[220px] overflow-hidden text-right text-[11px] leading-tight text-[#2f6f8e]"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
          title={conclusion}
        >
          {conclusion}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-[#b8d9ee] px-2 py-1 text-xs text-[#2b6382] hover:bg-[#eef9ff]"
            onClick={onClose}
            aria-label="Close conversation"
          >
            Close
          </button>
        </div>
      </div>
    </header>
  )
}
