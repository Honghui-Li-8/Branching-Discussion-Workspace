import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, test } from '@jest/globals'

const serverSrcDir = resolve(process.cwd(), 'server/src')

const collectTypeScriptFiles = (dir: string): string[] => {
  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...collectTypeScriptFiles(fullPath))
      continue
    }

    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) {
      continue
    }

    files.push(fullPath)
  }

  return files
}

describe('ownership import boundaries', () => {
  test('request-path modules do not directly import unscoped resource query modules', () => {
    const requestPathFiles = [
      resolve(serverSrcDir, 'trpcContext.ts'),
      resolve(serverSrcDir, 'index.ts'),
      resolve(serverSrcDir, 'router.ts'),
    ]

    const forbiddenImport = /from ['"].*db\/queries\/(workspace|node|message)\.js['"]/
    const offenders = requestPathFiles
      .map((filePath) => ({
        filePath,
        source: readFileSync(filePath, 'utf8'),
      }))
      .filter(({ source }) => forbiddenImport.test(source))
      .map(({ filePath }) => relative(serverSrcDir, filePath))

    expect(offenders).toEqual([])
  })

  test('internal query barrel is only imported from allowlisted runtime modules', () => {
    const allowlist = new Set([
      'trpcContext.ts',
      join('utils', 'workspace', 'importExport.ts'),
    ])

    const offenders = collectTypeScriptFiles(serverSrcDir)
      .map((filePath) => ({
        relativePath: relative(serverSrcDir, filePath),
        source: readFileSync(filePath, 'utf8'),
      }))
      .filter(
        ({ relativePath, source }) =>
          source.includes("from './db/queries/internal.js'") ||
          source.includes("from '../../db/queries/internal.js'") ||
          source.includes("from '../db/queries/internal.js'") ||
          source.includes("from '../../../db/queries/internal.js'") ||
          source.includes("from '../../../../db/queries/internal.js'"),
      )
      .map(({ relativePath }) => relativePath)
      .filter((relativePath) => !allowlist.has(relativePath))

    expect(offenders).toEqual([])
  })
})
