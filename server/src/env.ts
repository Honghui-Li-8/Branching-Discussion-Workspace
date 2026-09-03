import { resolve } from 'node:path'

// Env files are loaded by side effect from several entrypoints. Keep this idempotent and
// tolerant of missing files: callers may run from the repo root or from server/.
export const loadEnvFiles = (): void => {
  const candidates = [
    resolve(process.cwd(), 'server/.env.local'),
    resolve(process.cwd(), 'server/.env'),
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env.local'),
    resolve(process.cwd(), '../.env'),
  ]

  for (const filePath of candidates) {
    try {
      process.loadEnvFile(filePath)
    } catch {
      // Ignore missing files and keep trying other locations.
    }
  }
}
