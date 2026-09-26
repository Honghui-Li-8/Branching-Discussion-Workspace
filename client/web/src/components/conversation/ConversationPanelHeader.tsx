import { Button } from '../ui/button'
import { FULLSCREEN_TOGGLE_ICONS, ICONS } from '../../lib/icons'

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
  const FullscreenIcon = isFullscreen
    ? FULLSCREEN_TOGGLE_ICONS.default.shrink
    : FULLSCREEN_TOGGLE_ICONS.default.expand

  return (
    <header className="relative shrink-0 border-b border-border-default bg-bg-default px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        {/* The title keeps its natural width first; the conclusion shrinks three
            times as readily, so a long conclusion never squeezes the topic. */}
        <div className="flex min-w-0 grow items-start gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="mt-0.5 shrink-0 px-2"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={onToggleFullScreen}
            aria-label="Toggle fullscreen conversation panel"
            aria-pressed={isFullscreen}
          >
            <FullscreenIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <p className="m-0 text-caption font-medium uppercase tracking-wide text-text-muted">Topic</p>
            <h2
              className="mt-0.5 text-title font-medium text-text-default"
              style={{ overflowWrap: 'anywhere' }}
            >
              {topic}
            </h2>
          </div>
        </div>
        {/* Supplementary: hidden below md so the topic never wraps per character.
            It is an excerpt of the last assistant message, which the message
            list below renders in full at every width, so hiding it loses
            nothing. The title attribute only restores clamped text at md+. */}
        <p
          className="m-0 hidden min-w-0 max-w-narrow shrink-[3] text-right text-caption text-text-muted md:line-clamp-3"
          title={conclusion}
        >
          {conclusion}
        </p>
        <div className="flex items-center gap-2">
          {showMergeButton && !isProposalPending ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onInitiateMerge}
              pending={isMergeInitiating}
              aria-label="Merge branch back to parent"
            >
              <ICONS.merge className="h-4 w-4" aria-hidden="true" />
              Merge
            </Button>
          ) : null}
          {isProposalPending ? (
            <Button variant="ghost" size="sm" onClick={onCancelMerge} aria-label="Cancel merge proposal">
              Cancel merge
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close conversation">
            Close
          </Button>
        </div>
      </div>
    </header>
  )
}
