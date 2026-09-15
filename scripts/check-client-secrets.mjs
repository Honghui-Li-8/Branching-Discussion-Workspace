#!/usr/bin/env node
/**
 * Makes A00b's "no secret in the client bundle or repository diff" criterion executable.
 *
 * A00a could only satisfy that criterion by hand -- after finding a real leak. This turns it into
 * a required task in scripts/test-all.sh, so every CI run enforces it.
 *
 * Three surfaces:
 *   A  tracked repository files (`git ls-files`) -- exactly what a clone contains.
 *   B  the built client bundle (client/web/dist), when it exists. Missing is not a failure, so
 *      `yarn test` does not require a build; the skip is printed rather than silent.
 *   C  every **.env.example. These are not skipped -- they are the most likely place for a real
 *      secret to be pasted by accident -- so they get the stricter rule below.
 *
 * Design note (why matching on name-plus-length was rejected): a `NAME [:=] \S{8,}` rule was red
 * on the clean tree, matching 12 committed sentinels (`OPENAI_API_KEY = 'test-openai-key'`) and one
 * ternary (`VITE_DEV_AUTH_TOKEN : undefined`). A scanner that is red on a clean tree gets disabled
 * within a week. What separates a sentinel from a credential here is the placeholder vocabulary
 * below, not a length threshold. It is deliberately generous: a false negative costs one missed
 * placeholder-looking secret, a false positive costs the check's credibility.
 *
 * No finding ever prints the matched value -- only the file, line, and finding name.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const BUNDLE_DIR = 'client/web/dist'
const SELF = 'scripts/check-client-secrets.mjs'

// Test files never ship, and sentinel credentials are their normal content. yarn.lock is
// high-entropy integrity hashes with no credential shape.
const EXCLUDED_PATHS = new Set(['yarn.lock', SELF])
const isTestFile = (file) => /\.test\.tsx?$/.test(file)

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.svgz',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.mp4', '.webm', '.wasm',
])

// ---------------------------------------------------------------------------
// Placeholder vocabulary -- the single definition every rule below shares.
// ---------------------------------------------------------------------------

const PLACEHOLDER_SUBSTRINGS = [
  'test-', 'local-', 'example', 'dev-token', 'placeholder', 'changeme', 'your-', 'dummy', 'fake',
]
const PLACEHOLDER_EXACT = new Set(['undefined', 'null', "''", '""', ''])
const PLACEHOLDER_PREFIXES = ['process.env.', 'import.meta.env.', '${', '<', '$(']
const LOOPBACK_URL = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^@/]*@)?(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?#]|$)/i

const isPlaceholder = (raw) => {
  const value = String(raw ?? '').trim()
  const lower = value.toLowerCase()
  if (PLACEHOLDER_EXACT.has(value)) return true
  if (PLACEHOLDER_SUBSTRINGS.some((token) => lower.includes(token))) return true
  if (PLACEHOLDER_PREFIXES.some((prefix) => value.startsWith(prefix))) return true
  if (LOOPBACK_URL.test(value)) return true
  return false
}

// Surface C only. The .env.example rule judges *every* assigned value, including names that are
// not credentials at all (`APP_ENV=development`, `DB_ENV=dev`, `DEV_AUTH_ENABLED=true`,
// `SERVER_LOG_LEVEL=info`). Those are plain lowercase words: no digits, no punctuation, short.
// No real credential has that shape, and treating them as findings would make the strict rule red
// on the clean tree. Deliberately NOT part of the shared vocabulary above, so a value like
// `SUPABASE_SERVICE_ROLE_KEY=supersecret` still trips the credential-assignment rule.
const isLowEntropyLiteral = (value) => /^[A-Za-z]{1,19}$/.test(value.trim())

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const CREDENTIAL_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DEV_AUTH_TOKEN',
  'VITE_DEV_AUTH_TOKEN',
  'FLY_API_TOKEN',
  'OPENAI_API_KEY',
]
// SUPABASE_URL is deliberately absent: it is the public project URL, not a secret. DATABASE_URL is
// likewise not matched by name -- a database URL is a finding only when it carries credentials,
// which the connection-string rule handles precisely.
const CREDENTIAL_ASSIGNMENT = new RegExp(
  `(?:${CREDENTIAL_NAMES.join('|')})[^\\S\\n]*[:=][^\\S\\n]*['"]?([^\\s'",;)]+)`,
  'g',
)

// A database URL that carries a password, to a host that is not loopback.
const CREDENTIALED_CONNECTION_STRING = /postgres(?:ql)?:\/\/[^\s'"]+:([^\s'"@]+)@([^\s'"/]+)/g

const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i

// A real Supabase service-role key is a JWT, so these catch it inlined with no variable name at
// all -- the case the assignment rule cannot see.
const SIMPLE_PATTERNS = [
  ['service-role JWT claim', /"role"\s*:\s*"service_role"/],
  ['JWT body', /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\./],
  ['Google OAuth client secret', /GOCSPX-[A-Za-z0-9_-]{10,}/],
  // Length-anchored: a bare `sk-` prefix collides with ordinary identifiers and minified names.
  ['OpenAI API key', /sk-[A-Za-z0-9]{32,}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
]

const findings = []
const report = (file, line, name) => findings.push({ file, line, name })

const scanLine = (file, lineNumber, line) => {
  for (const [name, pattern] of SIMPLE_PATTERNS) {
    if (pattern.test(line)) report(file, lineNumber, name)
  }

  CREDENTIAL_ASSIGNMENT.lastIndex = 0
  for (const match of line.matchAll(CREDENTIAL_ASSIGNMENT)) {
    if (!isPlaceholder(match[1])) report(file, lineNumber, 'credential assignment')
  }

  CREDENTIALED_CONNECTION_STRING.lastIndex = 0
  for (const match of line.matchAll(CREDENTIALED_CONNECTION_STRING)) {
    const [, password, host] = match
    if (!LOOPBACK_HOST.test(host) && !isPlaceholder(password)) {
      report(file, lineNumber, 'credentialed connection string')
    }
  }
}

// Surface C: every assigned value must be placeholder-shaped (or a plain literal word), whether or
// not its name is on the credential list.
const ENV_ASSIGNMENT = /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)$/

const scanEnvExampleLine = (file, lineNumber, line) => {
  if (/^\s*(?:#|$)/.test(line)) return
  const match = ENV_ASSIGNMENT.exec(line)
  if (!match) return

  const rest = match[1].trim()
  const quoted = /^(['"])(.*?)\1/.exec(rest)
  const value = quoted ? quoted[2] : (rest.split(/\s/)[0] ?? '')

  if (!isPlaceholder(value) && !isLowEntropyLiteral(value)) {
    report(file, lineNumber, 'non-placeholder value in an .env.example')
  }
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

const looksBinary = (file) => {
  if (BINARY_EXTENSIONS.has(path.extname(file).toLowerCase())) return true
  try {
    const head = readFileSync(file).subarray(0, 8192)
    return head.includes(0)
  } catch {
    return true
  }
}

const trackedFiles = () =>
  execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean)

const walk = (dir) => {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const scanFile = (file, lineScanner) => {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => lineScanner(file, index + 1, line))
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log('Client secret scan')
console.log('==================')

const tracked = trackedFiles()
const surfaceA = tracked.filter(
  (file) => !EXCLUDED_PATHS.has(file) && !isTestFile(file) && existsSync(file) && !looksBinary(file),
)
surfaceA.forEach((file) => scanFile(file, scanLine))
console.log(`surface A  tracked repository files: ${surfaceA.length} scanned ` +
  `(${tracked.length} tracked; test files, yarn.lock and binaries excluded)`)

if (existsSync(BUNDLE_DIR)) {
  const surfaceB = walk(BUNDLE_DIR).filter((file) => !looksBinary(file))
  surfaceB.forEach((file) => scanFile(file, scanLine))
  console.log(`surface B  built client bundle ${BUNDLE_DIR}: ${surfaceB.length} scanned`)
} else {
  console.log(`surface B  bundle not built — repo scan only (${BUNDLE_DIR} does not exist)`)
}

const surfaceC = surfaceA.filter((file) => path.basename(file) === '.env.example')
surfaceC.forEach((file) => scanFile(file, scanEnvExampleLine))
console.log(`surface C  .env.example files: ${surfaceC.length} scanned` +
  (surfaceC.length > 0 ? ` (${surfaceC.join(', ')})` : ''))

if (findings.length === 0) {
  console.log('Summary: pass — no credential-shaped value found.')
  process.exit(0)
}

console.log('')
for (const { file, line, name } of findings) {
  console.log(`  ${file}:${line} — ${name}`)
}
console.log(`Summary: FAIL — ${findings.length} finding(s). Values are withheld deliberately.`)
process.exit(1)
