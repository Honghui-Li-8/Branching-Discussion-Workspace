import { Badge } from '../../ui/badge'
import { ICONS } from '../../../lib/icons'
import { Card, CardGrid, MarkedList } from './CardGrid'
import { CHANGELOG, type ChangelogStatus } from '../../../content/changelog'

// A08 — renders content/changelog.ts. A08b promoted it out of "Where things
// stand" into a block of its own, so the entry version is the block's first
// heading level below the head (h3), not an h4 under a wrapper heading.
//
// One full-width card per entry, in Figma's shape: a meta column carrying the
// version, its label and the status pill, with the summary and what shipped
// beside it. Below md the two columns stack, meta first.

const STATUS_LABEL: Record<ChangelogStatus, string> = {
  shipped: 'Shipped',
  'in-progress': 'In progress',
}

export const Changelog = () => (
  <CardGrid as="ol" columns={1}>
    {CHANGELOG.map((entry) => (
      <Card
        key={entry.version}
        title={entry.version}
        layout="split"
        meta={
          <>
            <p className="m-0 text-caption text-text-muted">{entry.label}</p>
            {/* self-start so the pill is its own width, not the column's. */}
            <Badge status={entry.status === 'shipped' ? 'success' : 'pending'} className="self-start">
              {STATUS_LABEL[entry.status]}
            </Badge>
          </>
        }
      >
        <p className="m-0 text-label text-text-secondary">{entry.summary}</p>
        <MarkedList items={entry.bullets} icon={ICONS.approve} tone="accent" />
      </Card>
    ))}
  </CardGrid>
)
