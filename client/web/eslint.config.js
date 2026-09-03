import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // A-T3b — fluid sizing convention, enforced.
    //
    // Flags arbitrary pixel values on the six inline/block SIZING properties
    // (w, h, min-w, max-w, min-h, max-h). A component that pins its own size
    // in px cannot adapt to the space it is given — and, the reason this is a
    // rule rather than a note, it must have that pin removed before container
    // queries can ever apply to it. Not hardcoding sizes is precisely what
    // keeps `@container` a cheap additive upgrade later.
    //
    // Deliberately scoped to sizing only. px is the CORRECT unit inside
    // composite values, and flagging those would turn this into noise that
    // gets switched off: shadow-[0_14px_30px_...], backdrop-blur-[10px],
    // h-[2px] hairlines and ring/border widths are legitimate and are not
    // matched by these selectors.
    //
    // 23 pre-existing violations were audited and deliberately left in place
    // rather than bulk-fixed — they belong to the surfaces that own them
    // (A-T3c, then the A06–A11b rebuilds). So this is a ratchet on new code:
    // set to 'warn' so it does not fail a build that already carries the
    // debt, to be raised to 'error' once A-T3c clears it.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            'Literal[value=/(^|\\s)([a-z0-9-]+:)*!?(w|h)-\\[[0-9.]{2,}px\\]/]',
          message:
            'Fluid sizing (A-T3b): do not pin width or height in px — it blocks container-query adoption. Minimums and maximums are constraints, not pins, and are not matched, nor are hairlines under 10px where px is the correct unit; page-level overflow risk from a large min-* is covered by the A-T3e no-horizontal-overflow rule and its reflow harness. Use a spacing-scale step (w-64, p-4), a relative unit (w-full, min-w-0), or a semantic max-width. px remains correct inside shadows, blurs and hairlines.',
        },
        {
          selector:
            'TemplateElement[value.raw=/(^|\\s)([a-z0-9-]+:)*!?(w|h)-\\[[0-9.]{2,}px\\]/]',
          message:
            'Fluid sizing (A-T3b): do not pin width or height in px — it blocks container-query adoption. Minimums and maximums are constraints, not pins, and are not matched, nor are hairlines under 10px where px is the correct unit; page-level overflow risk from a large min-* is covered by the A-T3e no-horizontal-overflow rule and its reflow harness. Use a spacing-scale step (w-64, p-4), a relative unit (w-full, min-w-0), or a semantic max-width. px remains correct inside shadows, blurs and hairlines.',
        },
      ],
    },
  },
  {
    // Design-system layer (A05a). These files legitimately export things
    // alongside components — Radix re-exports (`export const Dialog =
    // DialogPrimitive.Root`), shared types (`Elevation`, `BadgeStatus`), and
    // token maps (`ALERT_TONE_STYLES`). react-refresh/only-export-components
    // can't tell that a re-assigned import IS a component, so it flags each
    // one as an HMR hazard: 29 errors, all false positives, verified by
    // reading every flagged line. shadcn's own generated components trip this
    // identically, which is why scoping the rule off for this directory is
    // the conventional fix rather than restructuring every file.
    //
    // Deliberately narrow: this directory only, that one rule only. Real HMR
    // violations in app components still error, and the pre-existing
    // react-refresh error outside ui/ is untouched.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
