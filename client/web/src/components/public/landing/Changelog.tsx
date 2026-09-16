import { Badge } from '../../ui/badge'
import { Cluster, Stack } from '../../ui/layout'
import { CHANGELOG, type ChangelogStatus } from '../../../content/changelog'

// A08 — renders content/changelog.ts inside "Where things stand".

const STATUS_LABEL: Record<ChangelogStatus, string> = {
  shipped: 'Shipped',
  'in-progress': 'In progress',
}

export const Changelog = () => (
  <Stack as="ol" gap="4" className="m-0 list-none p-0">
    {CHANGELOG.map((entry) => (
      <li key={entry.version} className="rounded-lg border border-border-default bg-bg-default p-5">
        <Stack gap="3">
          <Cluster justify="between" gap="3">
            <div>
              <h4 className="m-0 text-body font-semibold text-text-default">{entry.version}</h4>
              <p className="m-0 text-caption text-text-muted">{entry.label}</p>
            </div>
            <Badge status={entry.status === 'shipped' ? 'success' : 'pending'}>{STATUS_LABEL[entry.status]}</Badge>
          </Cluster>
          <p className="m-0 text-label text-text-secondary">{entry.summary}</p>
          <ul className="m-0 grid list-disc gap-1 pl-5 text-label text-text-secondary">
            {entry.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </Stack>
      </li>
    ))}
  </Stack>
)
