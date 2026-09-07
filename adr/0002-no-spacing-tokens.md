---
status: accepted
---

# No spacing token layer

A05a recorded spacing as an open gap, but the gap was in the repo's transcription, not the
design source: Figma's locked collection defines 19 `space/*` values and every one lands
exactly on Tailwind's default `--spacing: 0.25rem` (4px) grid, which Tailwind 4 already
computes on demand (`p-0.5` … `p-24`). Declaring `--spacing-*` tokens would create a second
way to express values Tailwind already produces — the duplication the colour system was
careful to avoid — so the spacing block in `index.css` is deliberately empty and says so.
Verified by compiling each step and reading the built CSS: 19 present, zero mismatches.
