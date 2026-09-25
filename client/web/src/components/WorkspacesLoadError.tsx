import { Button } from './ui/button'
import { useRetryWorkspaces } from './useRetryWorkspaces'

type WorkspacesLoadErrorProps = {
  /** `main` is the workspace region's full state; `sidebar` is the short note in the list. */
  placement: 'main' | 'sidebar'
}

/**
 * A failed workspace-list load (A10 error handling): the shell stays, the
 * failure is named, and the retry sits beside it — never the empty state,
 * which would invite creating a workspace the user may already have.
 * Only the main region announces it; the sidebar note repeats it quietly.
 */
export const WorkspacesLoadError = ({ placement }: WorkspacesLoadErrorProps) => {
  const { retry, isRetrying } = useRetryWorkspaces()

  if (placement === 'sidebar') {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border-default px-3 py-2.5">
        <p className="m-0 text-caption text-text-muted">Couldn&rsquo;t load your workspaces.</p>
        <Button variant="secondary" size="sm" pending={isRetrying} onClick={() => void retry()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <section
      aria-labelledby="workspaces-load-error-heading"
      className="flex min-h-96 flex-1 flex-col items-center justify-center gap-3 bg-bg-default px-6 py-8 text-center"
    >
      <h1 id="workspaces-load-error-heading" className="m-0 text-title font-medium text-text-default">
        Your workspaces didn&rsquo;t load
      </h1>
      <p role="alert" className="m-0 max-w-prose text-label text-text-secondary">
        Trellis couldn&rsquo;t reach the server. Check your connection, then try again.
      </p>
      <Button variant="primary" size="md" pending={isRetrying} onClick={() => void retry()}>
        Try again
      </Button>
    </section>
  )
}
