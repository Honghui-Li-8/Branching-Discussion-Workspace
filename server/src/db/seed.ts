import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { query, closePool, resolveDatabaseTarget, type DatabaseTarget } from './client.js'
import { createLogger } from '../logging/logger.js'

const seedsDir = dirname(fileURLToPath(import.meta.url))
const seedFile = `${seedsDir}/seeds/seed.sql`
const logger = createLogger('db-seed')

export const runSeed = async (target: DatabaseTarget = 'app'): Promise<void> => {
  const sql = await readFile(seedFile, 'utf8')
  await query(sql, [], target)
  logger.info('Seed completed.', { target })
}

const getTarget = (): DatabaseTarget =>
  resolveDatabaseTarget(process.argv.includes('--dev') || process.env.DB_ENV === 'dev' ? 'dev' : undefined)

if (process.argv[1]?.endsWith('/seed.ts')) {
  const target = getTarget()
  if (target !== 'dev') {
    logger.error(
      'Refusing to run seed on non-dev database. Re-run with --dev or DB_ENV=dev.',
    )
    process.exitCode = 1
  } else {
    runSeed(target)
      .catch((error) => {
        logger.error('Seed command failed.', { error })
        process.exitCode = 1
      })
      .finally(async () => {
        await closePool()
      })
  }
}
