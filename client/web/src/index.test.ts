/**
 * Type-role pairing invariant.
 *
 * Every semantic type role in index.css must alias BOTH custom properties:
 *
 *   --text-<role>:              var(--text-<step>);
 *   --text-<role>--line-height: var(--text-<step>--line-height);
 *
 * Tailwind v4 pairs a font-size token with its `--line-height` companion when
 * it emits `text-<role>`. A role that declares only the size compiles cleanly
 * and renders with the browser's default leading — no type error, no test
 * failure, just text that looks slightly wrong on a surface nobody traces back
 * to the token. This is the one rule in the type system that fails silently
 * and visually, so it is asserted here against the source rather than left to
 * a code comment.
 *
 * Reads the CSS source directly: the invariant is that the pair is *declared*,
 * so the source is the right place to check and no build step is needed.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(__dirname, 'index.css'), 'utf8')

// Matches `--text-<name>:` at the start of a declaration, capturing <name>.
// The `(?!.*--line-height)` on the name keeps the companion declarations out
// of the role list so they are checked against, not as, roles.
const roleDeclaration = /^\s*--text-([a-z][a-z0-9-]*?):/gm
const lineHeightSuffix = '--line-height'

const declaredRoles = [...css.matchAll(roleDeclaration)]
  .map((m) => m[1])
  .filter((name) => !name.endsWith(lineHeightSuffix))

const declaresLineHeight = (role: string) =>
  new RegExp(`^\\s*--text-${role}${lineHeightSuffix}:`, 'm').test(css)

describe('type roles — size and line-height are declared as a pair', () => {
  it('finds the semantic roles in index.css', () => {
    // If this drops to zero the regex no longer matches the file and every
    // assertion below would pass vacuously. Six is today's count; a seventh
    // role should raise it, not break it.
    expect(declaredRoles.length).toBeGreaterThanOrEqual(6)
    expect(declaredRoles).toEqual(
      expect.arrayContaining(['display', 'title', 'heading', 'body', 'label', 'caption']),
    )
  })

  it.each(declaredRoles)('--text-%s declares --text-%s--line-height', (role) => {
    expect(declaresLineHeight(role)).toBe(true)
  })

  it('no role is missing its line-height pair', () => {
    const missing = declaredRoles.filter((role) => !declaresLineHeight(role))
    expect(missing).toEqual([])
  })
})
