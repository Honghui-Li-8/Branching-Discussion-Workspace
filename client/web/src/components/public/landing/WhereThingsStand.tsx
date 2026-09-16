import { Stack } from '../../ui/layout'
import { Changelog } from './Changelog'

// A07 — the "Where things stand" section (anchor id `roadmap`): what the
// product does today and what it does not, stated plainly (A02's Claims
// decision). The five limitations are the owner-approved list from the
// 2026-09-15 decisions. The changelog (A08) follows the two lists.

const WORKS_NOW = [
  'Branch a side conversation from any assistant message.',
  'Explore several branches in parallel; each stays attached to where it started.',
  'Approve and bring back a conclusion, with edit and reject on the way.',
  'Merged branches stay in the tree as read-only history.',
  'Sign in with Google; starting examples are available after sign-in.',
] as const

const LIMITATIONS = [
  'Workspaces are private to the account that created them. There is no sharing or collaboration.',
  'There is no automated deletion or retention. Data stays until it is removed by hand.',
  'On the hosted review environment, Safari cannot sign in because it blocks the cross-site session cookie. Chrome and Firefox work.',
  'A deploy of the hosted API signs everyone out.',
  'Hosted data is disposable review data, not durable storage.',
] as const

const PlainList = ({ items }: { items: readonly string[] }) => (
  <ul className="m-0 grid list-disc gap-2 pl-5 text-label text-text-secondary">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
)

export const WhereThingsStand = () => (
  <Stack gap="8">
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <Stack gap="3">
        <h3 className="m-0 text-body font-semibold text-text-default">What works now</h3>
        <PlainList items={WORKS_NOW} />
      </Stack>
      <Stack gap="3">
        <h3 className="m-0 text-body font-semibold text-text-default">Limitations</h3>
        <PlainList items={LIMITATIONS} />
      </Stack>
    </div>
    <Stack gap="3">
      <h3 className="m-0 text-body font-semibold text-text-default">Changelog</h3>
      <Changelog />
    </Stack>
  </Stack>
)
