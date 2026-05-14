import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'

type ConversationPanelHeaderProps = {
  topic: string
  conclusion: string
  isFullscreen: boolean
  onToggleFullScreen: () => void
  onClose: () => void
  showMergeButton?: boolean
  isMergeInitiating?: boolean
  isProposalPending?: boolean
  onInitiateMerge?: () => void
  onCancelMerge?: () => void
}

export const ConversationPanelHeader = ({
  topic,
  conclusion,
  isFullscreen,
  onToggleFullScreen,
  onClose,
  showMergeButton = false,
  isMergeInitiating = false,
  isProposalPending = false,
  onInitiateMerge,
  onCancelMerge,
}: ConversationPanelHeaderProps) => {
  return (
    <header className="relative shrink-0 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2">
          <button
            type="button"
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
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
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Topic</p>
            <h2
              className="mt-0.5 text-base font-semibold leading-tight text-slate-950"
              style={{ overflowWrap: 'anywhere' }}
            >
              {topic}
            </h2>
          </div>
        </div>
        <p
          className="m-0 min-w-0 max-w-[180px] overflow-hidden text-right text-[11px] leading-tight text-slate-500 lg:max-w-[220px]"
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
          {showMergeButton && !isProposalPending ? (
            <button
              type="button"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors duration-150 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onInitiateMerge}
              disabled={isMergeInitiating}
              aria-label="Merge branch back to parent"
            >
              {isMergeInitiating ? 'Merging…' : '↩ Merge'}
            </button>
          ) : null}
          {isProposalPending ? (
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              onClick={onCancelMerge}
              aria-label="Cancel merge proposal"
            >
              Cancel merge
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
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
