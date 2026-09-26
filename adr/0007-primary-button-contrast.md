---
status: accepted
---

# Primary button text contrast: repoint one step down the accent ramp

White text on the primary button's `accent-default` fill (#008ca8) is 3.95:1, which clears
WCAG 1.4.11's 3:1 bar for non-text UI but fails 1.4.3's 4.5:1 for text. Every primary button
on the landing, sign-in and workspace surfaces shipped that way. ADR-0005 met the identical
failure for link text by repointing to the next step of the ramp rather than inventing a
value; this decision does the same for the button. The primary variant now fills with
`accent-hover` (#007e97, 4.74:1), hovers on `accent-active` (#00697e, 6.32:1) and presses on
`accent-strong` (#005565, 8.44:1) — a repoint, not a new value, and every step already
existed in the palette.

Two alternatives were rejected. Darkening `teal-default` itself and cascading the ramp would
re-tune a brand colour the owner had already settled, and would move the focus ring and
every other non-text use that is correct at 3.95:1. Accepting the current value under the
large-text allowance fails because primary buttons are `text-label`, not large bold text.

## Consequences

- The accent roles (`--color-accent-*`), `--color-focus` and every non-text use keep the
  brand value. Only the button variant's class recipe changed (`ui/button.tsx`).
- Hover and active are now the ramp's two darkest steps. They remain distinguishable from
  each other and from rest, which is the reason the ramp was not collapsed to two values.
- The public shell's auth CTA shares `buttonVariants`, so the landing and sign-in pages
  changed colour with this decision; that is intended — they carried the same failure.
- ADR-0005's open note ("white text on the teal primary Button — open, owned by A13") is
  closed by this record; A13's Open Item 1 points here.
