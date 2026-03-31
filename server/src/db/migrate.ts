import { dirname, join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { query, closePool, getClient, type DatabaseTarget, resolveDatabaseTarget } from './client.js'
import { createLogger } from '../logging/logger.js'

const dbDir = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(dbDir, 'migrations')

type MigrationRecord = {
  version: string
  name: string
  applied_at: string
}

const MIGRATION_FILE_ORDER = /^\d+_.*\.sql$/

const command = process.argv[2] ?? 'status'
const databaseTarget = resolveDatabaseTarget(process.argv.includes('--dev') ? 'dev' : undefined)
const logger = createLogger('db-migrate')

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
    logger.info('Applied migration.', { file })
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
    logger.info('No migrations pending.')
    return
  }

  for (const file of pending) {
    await runMigration(file, target)
  }

  logger.info('Applied migrations.', { count: pending.length })
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
      logger.info('Migration status.', { file, status: 'up' })
    } else {
      logger.info('Migration status.', { file, status: 'down' })
    }
  }

  const allApplied = appliedRows.rows.length
  logger.info('Migration status summary.', {
    applied: allApplied,
    total: files.length,
  })
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
    logger.error('Migration command failed.', { error })
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool()
  })
