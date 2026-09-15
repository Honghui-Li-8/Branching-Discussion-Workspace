import { mkdtempSync, symlinkSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isEntrypoint } from './entrypoint'

// Windows path separators cannot be exercised here: `realpathSync` is host-bound.
// That case is covered by construction — both operands go through the same OS
// call — not by a test. Symlink creation needs a privilege on Windows, so that
// one case skips rather than failing the whole suite when it is unavailable.
const dir = mkdtempSync(join(tmpdir(), 'entrypoint-'))
const modulePath = join(dir, 'migrate.ts')
const otherPath = join(dir, 'reset.ts')
const linkPath = join(dir, 'migrate-cli.ts')
writeFileSync(modulePath, '')
writeFileSync(otherPath, '')

let symlinkOk = true
try {
  symlinkSync(modulePath, linkPath)
} catch {
  symlinkOk = false
}
const symlinkTest = symlinkOk ? test : test.skip

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

const moduleUrl = pathToFileURL(modulePath).href

describe('isEntrypoint', () => {
  test('true when argv[1] is the module itself', () => {
    expect(isEntrypoint(moduleUrl, modulePath)).toBe(true)
  })

  symlinkTest('true when argv[1] reaches the module through a symlink', () => {
    expect(isEntrypoint(moduleUrl, linkPath)).toBe(true)
  })

  test('false when another file in the same directory is the entrypoint', () => {
    expect(isEntrypoint(moduleUrl, otherPath)).toBe(false)
  })

  test('false when the process has no script argument', () => {
    expect(isEntrypoint(moduleUrl, undefined)).toBe(false)
  })

  test('false, not a throw, when argv[1] does not exist', () => {
    expect(isEntrypoint(moduleUrl, join(dir, 'missing.ts'))).toBe(false)
  })

  test('false for a suffix-only match under a different directory', () => {
    const elsewhere = mkdtempSync(join(tmpdir(), 'entrypoint-other-'))
    const decoy = join(elsewhere, 'migrate.ts')
    writeFileSync(decoy, '')
    try {
      expect(isEntrypoint(moduleUrl, decoy)).toBe(false)
    } finally {
      rmSync(elsewhere, { recursive: true, force: true })
    }
  })

  test('defaults argv[1] to the real process argument (the jest binary here)', () => {
    expect(isEntrypoint(moduleUrl)).toBe(false)
  })
})
