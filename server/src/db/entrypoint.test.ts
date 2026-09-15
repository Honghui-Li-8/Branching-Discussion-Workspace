import { mkdtempSync, symlinkSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isEntrypoint } from './entrypoint'

describe('isEntrypoint', () => {
  let dir: string
  let modulePath: string
  let otherPath: string
  let linkPath: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'entrypoint-'))
    modulePath = join(dir, 'migrate.ts')
    otherPath = join(dir, 'reset.ts')
    linkPath = join(dir, 'migrate-cli.ts')
    writeFileSync(modulePath, '')
    writeFileSync(otherPath, '')
    symlinkSync(modulePath, linkPath)
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const moduleUrl = () => pathToFileURL(modulePath).href

  test('true when argv[1] is the module itself', () => {
    expect(isEntrypoint(moduleUrl(), modulePath)).toBe(true)
  })

  test('true when argv[1] reaches the module through a symlink', () => {
    expect(isEntrypoint(moduleUrl(), linkPath)).toBe(true)
  })

  test('false when another file in the same directory is the entrypoint', () => {
    expect(isEntrypoint(moduleUrl(), otherPath)).toBe(false)
  })

  test('false when the process has no script argument', () => {
    expect(isEntrypoint(moduleUrl(), undefined)).toBe(false)
  })

  test('false, not a throw, when argv[1] does not exist', () => {
    expect(isEntrypoint(moduleUrl(), join(dir, 'missing.ts'))).toBe(false)
  })

  test('false for a suffix-only match under a different directory', () => {
    const elsewhere = mkdtempSync(join(tmpdir(), 'entrypoint-other-'))
    const decoy = join(elsewhere, 'migrate.ts')
    writeFileSync(decoy, '')
    try {
      expect(isEntrypoint(moduleUrl(), decoy)).toBe(false)
    } finally {
      rmSync(elsewhere, { recursive: true, force: true })
    }
  })
})
