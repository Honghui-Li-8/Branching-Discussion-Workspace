import { ICONS } from '../../../lib/icons'
import { Card, CardGrid, MarkedList } from './CardGrid'

// A07 — the "Where things stand" section (anchor id `roadmap`): what the
// product does today and what it does not, stated plainly (A02's Claims
// decision). The five limitations are the owner-approved list from the
// 2026-09-15 decisions. A08b moved the changelog out into its own block, so
// this is the two lists and nothing else.
//
// A08b made them two cards with marked items. The check and the caution are
// aria-hidden reinforcement: the card titles are what say which list is which,
// so neither colour nor icon is ever the only signal.

const WORKS_NOW = [
  'Branch a side conversation from any assistant message.',
  'Keep several branches open at once; each stays attached to where it started.',
  'Approve and bring back a conclusion, with edit and reject on the way.',
  'Merged branches stay in the tree as read-only history.',
  'Sign in with Google; starting examples are available after sign-in.',
] as const

const LIMITATIONS = [
  'Workspaces are private to the account that created them. There is no sharing or collaboration.',
  'There is no automated deletion or retention. Data stays until it is removed by hand.',
  'Safari is not supported for sign-in on the hosted review environment, because it blocks the cross-site session cookie; use Chrome or Firefox there.',
  'A deploy of the hosted API signs everyone out.',
  'Hosted data is disposable review data, not durable storage.',
] as const

export const WhereThingsStand = () => (
  <CardGrid columns={2}>
    <Card title="What works now">
      <MarkedList items={WORKS_NOW} icon={ICONS.approve} tone="success" />
    </Card>
    <Card title="Limitations">
      <MarkedList items={LIMITATIONS} icon={ICONS.warning} tone="warning" />
    </Card>
  </CardGrid>
)
