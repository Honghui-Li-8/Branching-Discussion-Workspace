# Architecture Decision Records

Short records of decisions that are hard to reverse, surprising without context, and the
result of a real trade-off. One decision per file, numbered in the order they were written.
Format follows the `domain-modeling` skill: a title and one to three sentences, with
optional sections only where they add something.

**Why this directory sits at the repo root rather than `docs/adr/`.** `docs/` is
gitignored in this repository on purpose — it holds planning docs, tickets and a progress
log that live in a separate private repo. Anything a reader of the public repo must be able
to resolve therefore has to live outside it. Source comments cite these files as
`ADR-NNNN`; the ticket ids they sometimes also carry (`A-T3b`, `A05a`) point into the
private tree and are there for the maintainer's traceability, not for the reader.

| ADR | Decision |
|---|---|
| [0001](./0001-type-scale-as-semantic-roles.md) | Type scale: semantic roles over Tailwind's steps, built to standard; measure tokens in `ch` |
| [0002](./0002-no-spacing-tokens.md) | No spacing token layer — Figma's 19 values already resolve on Tailwind's 4px grid |
| [0003](./0003-stepped-sizing-and-lint-ratchet.md) | Stepped sizing, no pixel pins, container queries deferred; enforced by a lint ratchet |
| [0004](./0004-reflow-contract-and-harness-split.md) | Reflow contract, and accessibility verification split by what each runtime can see |
| [0005](./0005-focus-and-link-colour-roles.md) | Focus colour as its own role; link text moved to the 4.5:1 accent step |
