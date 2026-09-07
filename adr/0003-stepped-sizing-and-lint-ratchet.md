---
status: accepted
---

# Stepped sizing, no pixel pins, container queries deferred — enforced by a lint ratchet

Components size in **steps**, not fluidly (`clamp()` is reserved for display type and must
keep a `rem` term so text still scales with the user's font-size setting), and a component
does **not pin its own width or height in pixels**. Fluid scaling was rejected because it
would turn owner-approved discrete Figma values into formulas that no longer match their own
spec; container queries were deferred as premature for a UI with few genuinely cross-context
components — but the no-pin rule exists precisely so that adopting `@container` later is a
cheap additive change rather than a removal pass. Decided 2026-08-19.

## Consequences

- An ESLint `no-restricted-syntax` rule flags `w-[…px]` / `h-[…px]` in class strings.
  `min-*` and `max-*` are constraints, not pins, and are not matched; hairlines under 10px
  are excluded, as px is the correct unit there.
- The rule ships at **`warn`**: a ratchet on new code, not a gate, because three genuine
  pins remain and are owned by ticket A11a. It graduates to `error` when those clear.
- Narrowing the rule dropped its coverage of `min-*` overflow; that risk is caught by the
  reflow harness instead (ADR-0004).
- `check:sizing-rule` lints a fixture with one pin and one fluid width and fails unless
  exactly the pin is flagged, so the rule cannot be deleted or switched off silently.
- Inline `style` pins are structurally invisible to the rule and are handled as ordinary
  rework, not by extending it.
