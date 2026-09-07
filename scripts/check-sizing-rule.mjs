#!/usr/bin/env node
/**
 * Guards the fluid-sizing lint rule (ADR-0003) against silent deletion.
 *
 * The rule lives under a single `no-restricted-syntax` key in
 * client/web/eslint.config.js. ESLint flat config replaces rule options
 * wholesale, so any later block that sets the same key removes the convention
 * with no error and no warning. This check lints a fixture that contains one
 * known pin and one known fluid width, and fails unless the rule fires on
 * exactly the pin. Mirrors check-deprecations.mjs: a required task in
 * scripts/test-all.sh, so CI enforces it even though `yarn lint` is not there.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'

const WORKSPACE = 'web'
const FIXTURE = 'eslint-fixtures/sizing-rule.fixture.tsx'
const RULE = 'no-restricted-syntax'
const FLAGGED = '@sizing-fixture:pin'
const ALLOWED = '@sizing-fixture:fluid'

const lineOf = (marker) => {
  const lines = readFileSync(`client/${WORKSPACE}/${FIXTURE}`, 'utf8').split('\n')
  // Last occurrence, so prose in the fixture header can mention a tag safely.
  let idx = -1
  lines.forEach((l, i) => { if (l.includes(marker)) idx = i })
  if (idx < 0) throw new Error(`fixture is missing the "${marker}" tag`)
  return idx + 1
}

let raw = ''
try {
  raw = execFileSync(
    'yarn',
    ['workspace', WORKSPACE, 'exec', 'eslint', FIXTURE, '--no-ignore', '--format', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
} catch (err) {
  raw = err.stdout ?? ''
  if (!raw.trim()) {
    console.error('Sizing rule guard\n=================')
    console.error(`fail: eslint did not run\n${err.stderr ?? err.message}`)
    process.exit(1)
  }
}

const results = JSON.parse(raw)
const fixture = results.find((r) => r.filePath.endsWith(FIXTURE))
const hits = (fixture?.messages ?? []).filter((m) => m.ruleId === RULE)
const flaggedLine = lineOf(FLAGGED)
const allowedLine = lineOf(ALLOWED)
const onFlagged = hits.filter((m) => m.line === flaggedLine).length
const onAllowed = hits.filter((m) => m.line === allowedLine).length

console.log('Sizing rule guard')
console.log('=================')
console.log(`fixture: client/${WORKSPACE}/${FIXTURE}`)
console.log(`  line ${flaggedLine} (pin):   ${onFlagged} ${RULE} message(s) — expected 1`)
console.log(`  line ${allowedLine} (fluid): ${onAllowed} ${RULE} message(s) — expected 0`)
console.log(`  total ${RULE} messages: ${hits.length} — expected 1`)

const ok = onFlagged === 1 && onAllowed === 0 && hits.length === 1
console.log(ok ? 'Summary: pass — the fluid-sizing rule is active and targeted.'
               : 'Summary: FAIL — the fluid-sizing rule is missing, off, or mis-targeted.')
process.exit(ok ? 0 : 1)
