---
status: accepted
---

# Type scale: semantic roles over Tailwind's steps, built to standard

The colour system (A05a) closed with typography still open and the design source held no
type scale at all, while the UI carried 41 escapes to `text-[11px]`/`text-[13px]`. We
defined six semantic roles — `display`, `title`, `heading`, `body`, `label`, `caption` — as
`var()` aliases over Tailwind's **untouched** default steps, built to the standard scale
rather than derived from those escapes, because the escapes are symptoms of an
unsystematised UI that is due for rebuild and encoding them would bake today's ad-hoc
choices into the foundation. Decided 2026-08-19.

## Consequences

- Each role must alias **both** `--text-<role>` and `--text-<role>--line-height`. Tailwind
  emits them as a pair, so a role that aliases only the size silently loses its leading. A
  unit test (`client/web/src/index.test.ts`) enforces the pairing.
- Roles are one-to-one with steps today. The seam's value is realised when a role is
  repointed; nothing forces consumers through it yet.
- Line-length caps are expressed in `ch` (`--container-prose: 65ch`,
  `--container-narrow: 45ch`) so they track the font rather than a pixel guess. They are
  **additive only** — swapping an existing `max-w-[…px]` for a measure changes rendered width,
  so that belongs to each surface's own rebuild.
