import { dirname } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { query, closePool, getClient, type DatabaseTarget, resolveDatabaseTarget } from './client.js'

const migrationsDir = dirname(fileURLToPath(import.meta.url))

type MigrationRecord = {
  version: string
  name: string
  applied_at: string
}

const MIGRATION_FILE_ORDER = /^\d+_.*\.sql$/

const command = process.argv[2] ?? 'status'
const databaseTarget = resolveDatabaseTarget(process.argv.includes('--dev') ? 'dev' : undefined)

const ensureMetadataTable = async (target: DatabaseTarget): Promise<void> => {
  await query(
    `
    CREATE TABLE IF NOT EXISTS public._schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
    [],
    target,
  )
}

const getAppliedMigrations = async (target: DatabaseTarget): Promise<Set<string>> => {
  const result = await query<{ version: string }>(
    'SELECT version FROM public._schema_migrations',
    [],
    target,
  )
  return new Set(result.rows.map((row) => row.version))
}

export const getMigrationFiles = async (): Promise<string[]> => {
  const files = await readdir(migrationsDir)
  return files
    .filter((file) => MIGRATION_FILE_ORDER.test(file))
    .sort((a, b) => a.localeCompare(b))
}

const runMigration = async (file: string, target: DatabaseTarget): Promise<void> => {
  const filePath = `${migrationsDir}/${file}`
  const sql = await readFile(filePath, 'utf8')
  const client = await getClient(target)

  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(
      'INSERT INTO public._schema_migrations (version, name) VALUES ($1, $2)',
      [file, file],
    )
    await client.query('COMMIT')
    console.log(`Applied migration: ${file}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const runMigrations = async (target: DatabaseTarget = 'app'): Promise<void> => {
  await ensureMetadataTable(target)
  const [applied, files] = await Promise.all([
    getAppliedMigrations(target),
    getMigrationFiles(),
  ])
  const pending = files.filter((file) => !applied.has(file))

  if (pending.length === 0) {
    console.log('No migrations pending')
    return
  }

  for (const file of pending) {
    await runMigration(file, target)
  }

  console.log(`Applied ${pending.length} migration(s).`)
}

export const showStatus = async (target: DatabaseTarget = 'app'): Promise<void> => {
  await ensureMetadataTable(target)
  const [files, appliedRows] = await Promise.all([
    getMigrationFiles(),
    query<MigrationRecord>(
      'SELECT version, name, applied_at FROM public._schema_migrations ORDER BY version ASC',
      [],
      target,
    ),
  ])

  const appliedVersions = new Map<string, string>(
    appliedRows.rows.map((row) => [row.version, row.applied_at]),
  )

  for (const file of files) {
    if (appliedVersions.has(file)) {
      console.log(`up\t${file}`)
    } else {
      console.log(`down\t${file}`)
    }
  }

  const allApplied = appliedRows.rows.length
  console.log(`\n${allApplied}/${files.length} migrations applied.`)
}

const main = async (): Promise<void> => {
  if (command === 'up') {
    await runMigrations(databaseTarget)
    return
  }

  await showStatus(databaseTarget)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool()
  })
