import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg'

type DatabaseTarget = 'app' | 'dev'

const pools: Record<DatabaseTarget, Pool | null> = {
  app: null,
  dev: null,
}

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
  const result = await getPool(databaseTarget).query<T>(text, params)
  return result
}

export const getClient = async (databaseTarget: DatabaseTarget = 'app'): Promise<PoolClient> =>
  getPool(databaseTarget).connect()

export const testConnection = async (): Promise<boolean> => {
  try {
    await query('SELECT 1')
    return true
  } catch (_error) {
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
