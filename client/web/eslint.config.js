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
