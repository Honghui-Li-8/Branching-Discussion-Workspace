---
status: accepted
---

# Reflow contract, and accessibility verification split by runtime

**The contract.** Breakpoints are Tailwind's default set — `sm` 640, `md` 768, `lg` 1024,
`xl` 1280 — with `lg` as the product's canonical boundary and 1440 as the design canvas.
200% zoom on a 1440 window leaves 720 CSS px, below `lg`; that narrow state exists whether or
not it is designed, so it is in scope. There is **no page-level horizontal scrolling** at any
supported width. **The verification.** No single runtime can check the whole contract:
jsdom has no layout engine. So `jest-axe` runs in the unit suite for structure (accessible
names, ARIA validity, landmarks, heading order) at a **serious/critical** threshold, and a
Playwright harness measures overflow at the five breakpoint widths, at 390 — a
**verification width** added 2026-09-22 by A10, not a breakpoint token; the Tailwind set
above is unchanged — and at the 720 zoom equivalent. Contrast and target size remain manual.

## Consequences

- Every harness ships with seeded violations that assert it can go red. A check that has
  never failed is not evidence — this repository was handed convincing false green twice
  before that rule was written.
- Playwright was originally kept out of CI (the jsdom gate ran there "at no cost", a browser
  on every push was judged a tax). **Reversed 2026-09-06**: five e2e specs sat broken on
  `main` unnoticed and masked a shipped product bug. Both harnesses now run as required
  tasks of `yarn test`.
- The reflow harness originally navigated only the unauthenticated route, so the signed-in
  workspace shell was measured at zero widths. A06 retargeted it (a route table shared with the
  router, authentication by request interception); A10 added the populated signed-in state and
  the 390 verification width, so both shell states are measured at seven widths.
