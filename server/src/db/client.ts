import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg'
import { resolve } from 'node:path'
import { createLogger } from '../logging/logger.js'

const loadEnvFiles = (): void => {
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

loadEnvFiles()

type DatabaseTarget = 'app' | 'dev'

const pools: Record<DatabaseTarget, Pool | null> = {
  app: null,
  dev: null,
}
const logger = createLogger('db-client')

const getDatabaseUrl = (target: DatabaseTarget): string => {
  const envVar = target === 'dev' ? 'DATABASE_URL_DEV' : 'DATABASE_URL'
  const url = process.env[envVar]
  if (!url) {
    throw new Error(`${envVar} is not defined`)
  }
  return url
}

export const resolveDatabaseTarget = (target?: DatabaseTarget): DatabaseTarget =>
  target === 'dev' ? 'dev' : 'app'

const getPool = (target: DatabaseTarget): Pool => {
  const mode = resolveDatabaseTarget(target)
  const existingPool = pools[mode]
  if (existingPool) {
    return existingPool
  }
  const newPool = new Pool({ connectionString: getDatabaseUrl(mode) })
  pools[mode] = newPool
  return newPool
}

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  databaseTarget: DatabaseTarget = 'app',
): Promise<QueryResult<T>> => {
  try {
    const result = await getPool(databaseTarget).query<T>(text, params)
    return result
  } catch (error) {
    logger.error('[db] query execution failed.', {
      database_target: databaseTarget,
      query_preview: text.slice(0, 160),
      parameter_count: params.length,
      error,
    })
    logger.debug('[db] query execution debug error details.', {
      database_target: databaseTarget,
      query_text: text,
      params,
      error,
    })
    throw error
  }
}

export const getClient = async (databaseTarget: DatabaseTarget = 'app'): Promise<PoolClient> => {
  try {
    return await getPool(databaseTarget).connect()
  } catch (error) {
    logger.error('[db] failed to acquire client connection.', {
      database_target: databaseTarget,
      error,
    })
    logger.debug('[db] client acquisition debug error details.', {
      database_target: databaseTarget,
      error,
    })
    throw error
  }
}

export const testConnection = async (): Promise<boolean> => {
  try {
    await query('SELECT 1')
    return true
  } catch (error) {
    logger.debug('[db] testConnection failed.', { error })
    return false
  }
}

export const closePool = async (databaseTarget?: DatabaseTarget): Promise<void> => {
  if (databaseTarget) {
    const mode = resolveDatabaseTarget(databaseTarget)
    const pool = pools[mode]
    if (!pool) return
    await pool.end()
    pools[mode] = null
    return
  }

  await Promise.all([
    closePool('app'),
    closePool('dev'),
  ])
}

export type { DatabaseTarget }
