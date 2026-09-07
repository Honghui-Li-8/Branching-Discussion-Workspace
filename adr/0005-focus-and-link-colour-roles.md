---
status: accepted
---

# Focus colour as its own role; link text moved to the 4.5:1 accent step

The design source defines `color/focus`, but the colour port never carried it, so components
reached for `accent-default` directly. We named `--color-focus` as a role — currently
aliased to `accent-default` — so the focus colour can move without touching the brand
accent; at #008ca8 it is 3.95:1 on white, above WCAG 1.4.11's 3:1 bar for non-text UI, which
is the requirement that governs a focus indicator. The same 3.95:1 **fails** WCAG 1.4.3's
4.5:1 for body-size text, so `--color-text-link` was repointed to `accent-hover` (#007e97,
4.74:1) — a repoint, not a new value.

## Consequences

- The focus ring recipe is `focus-visible:ring-2 focus-visible:ring-offset-2`. The offset is
  mandatory: several components set `outline-none`, so the ring is the only indicator, and
  without the offset it vanishes against accent and destructive fills.
- `--color-focus` has no consumers yet; rings still name `ring-accent-default`. Repointing
  them (ideally through one shared utility) is deferred by owner decision, together with the
  other not-yet-leveraged tokens.
- Two different elements share the 3.95:1 number and are easy to confuse: teal text on
  white (fixed here) and white text on the teal primary Button (open, owned by A13).
