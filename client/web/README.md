# Web Client

This package contains the React + Vite frontend for Trellis (a branching discussion workspace).

Its main responsibilities are:

- Workspace sync and app-shell state
- Tree hydration, layout, and navigation
- Node-scoped conversation UI
- Assistant text selection and branch UX
- SSE-driven conversation updates on the client side

For project overview, local setup, and shared architecture notes, see the root `README.md`.

## UI conventions

The UI is built on a two-layer token system in `src/index.css`: palette primitives
(`--color-gray-700`, `--text-sm`) sit underneath semantic roles (`--color-accent-default`,
`--text-label`) that components actually reference. Components name the *role*, so a palette
change lands everywhere at once. Tailwind v4 is configured CSS-first — there is no
`tailwind.config.*`; the tokens live in an `@theme static` block.

### Typography

Six semantic roles, applied as ordinary Tailwind classes (`text-body`, `text-caption`):

| Role | Size | Use |
|---|---|---|
| `display` | 30px | Landing hero — once per page |
| `title` | 20px | Page and panel titles |
| `heading` | 18px | Section headings within a surface |
| `body` | 16px | Prose and message content |
| `label` | 14px | Buttons, menu items, form labels — the workhorse |
| `caption` | 12px | Timestamps, metadata, helper text |

Each role aliases **both** the font size and its paired line height. Tailwind treats those as
one unit, so a role that aliases only the size silently drops its leading. Add both when you
add a role.

`--container-prose` (65ch) and `--container-narrow` (45ch) cap line length for prose.

Spacing has no token layer on purpose: the design source's spacing values all resolve through
Tailwind's default 4px grid, so a parallel set would only duplicate what Tailwind computes.

### Sizing

Do not pin a width or height in px. A pinned dimension stops a component from adapting to its
container, which is what makes container queries expensive to adopt later. Use a spacing-scale
step (`w-64`), a relative unit (`w-full`, `min-w-0`), or a semantic max-width instead.

`min-*` and `max-*` are constraints rather than pins and are allowed. px stays correct inside
shadows, blurs, and hairline borders.

ESLint enforces this at `warn` — a ratchet on new code, not a gate, since the existing
violations are tracked against their own tickets.

### Accessibility

The target is WCAG 2.2 AA. Two harnesses cover different halves of it, and neither covers
everything:

| Harness | Runs | Covers |
|---|---|---|
| `src/components/ui/accessibility.test.tsx` (jest-axe) | `yarn test:unit`, and CI | Accessible names, ARIA validity, landmarks, heading order |
| `e2e/a11y-reflow.e2e.ts` (Playwright) | `yarn test:e2e`, local only | No page-level horizontal overflow at sm/md/lg/xl/1440 and at 720px (the 200%-zoom equivalent) |

jsdom has no layout engine, so **contrast, target size, and reflow cannot be checked in the
unit suite** — they are verified manually or in the Playwright harness. Treat a green unit run
as evidence about structure only.

Both harnesses ship with seeded failing cases that assert the harness itself can fail. Keep
them. They exist because a check that cannot go red is not evidence.

Conventions worth knowing before building a surface:

- One `<main>` per page. A skip link to it, visible on focus. One `<h1>` per page.
- Focus rings are `ring-2 ring-offset-2`. The offset is required — several components set
  `outline-none`, so the ring is the only indicator, and without the offset it disappears
  against accent and destructive fills.
- Icon-only controls take their accessible name from the icon mapping in `src/lib/icons.ts`.
- Errors announce `assertive`; state changes `polite`; streamed tokens stay silent.
- Any motion that is the sole carrier of a state needs a non-animated equivalent.
