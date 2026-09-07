/**
 * Fixture for `check:sizing-rule` — NOT application code. Do not "fix" it.
 *
 * `scripts/check-sizing-rule.mjs` lints this file with `--no-ignore` and asserts
 * the A-T3b fluid-sizing rule fires on exactly one of the two tagged JSX lines
 * below (the pinned px width) and stays silent on the other (a fluid width).
 * If the rule is ever removed, switched off, or its selector broken, that
 * check goes red. The tags are the trailing `@sizing-fixture` comments; the
 * script finds the LAST line carrying each tag, so this header may describe
 * them without being mistaken for them.
 *
 * This directory is in `globalIgnores`, so `yarn lint` never reports it.
 */
export const SizingRuleFixture = () => (
  <>
    <div className="w-[250px]" /> {/* @sizing-fixture:pin */}
    <div className="w-[min(28rem,calc(100vw-2rem))]" /> {/* @sizing-fixture:fluid */}
  </>
)
