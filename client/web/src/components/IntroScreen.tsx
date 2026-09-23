import { Button } from './ui/button'
import { Cluster, Container, Stack } from './ui/layout'
import { useCreateWorkspaceActions } from './useCreateWorkspaceActions'

/**
 * The first-run slot (A10): the no-workspaces state of the main region. It
 * carries the same create actions as the sidebar, through the same hook, so
 * the screen never tells the user to do something it does not let them do.
 * A09 fills this region with guidance; the heading is the reflow harness's
 * anchor for the empty signed-in state and stays as it is.
 */
export const IntroScreen = () => {
  const { examples, createBlank, createFromExample, pendingKey, error, isAvailable } =
    useCreateWorkspaceActions()
  const otherPending = (key: string) => pendingKey !== null && pendingKey !== key

  return (
    <section
      aria-labelledby="intro-heading"
      className="flex min-h-96 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-bg-default px-6 py-8 text-center"
    >
      <Container width="prose">
        <Stack gap="4" align="center">
          <p className="m-0 text-caption font-medium uppercase tracking-wide text-text-muted">Trellis</p>
          <h1 id="intro-heading" className="m-0 text-display font-medium text-text-default">
            Start by opening or creating a workspace
          </h1>
          <p className="m-0 text-body text-text-muted">
            Pick a workspace in the sidebar, start a blank one, or open a guided example.
          </p>
          <Cluster gap="2" justify="center">
            <Button
              onClick={createBlank}
              pending={pendingKey === 'blank'}
              disabled={!isAvailable || otherPending('blank')}
            >
              New blank workspace
            </Button>
            {/* No title attribute: the visible label is the accessible name. The
                descriptions live in the sidebar popover. */}
            {examples.map(({ key, title }) => (
              <Button
                key={key}
                variant="secondary"
                onClick={() => createFromExample(key)}
                pending={pendingKey === key}
                disabled={!isAvailable || otherPending(key)}
              >
                {title}
              </Button>
            ))}
          </Cluster>
          {error ? (
            <p role="alert" className="m-0 text-caption text-error-default">
              {error}
            </p>
          ) : null}
        </Stack>
      </Container>
    </section>
  )
}
