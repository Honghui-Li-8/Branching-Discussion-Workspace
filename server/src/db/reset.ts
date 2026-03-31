import { query, closePool } from './client.js'
import { runMigrations } from './migrate.js'
import { runSeed } from './seed.js'
import { resolveDatabaseTarget, type DatabaseTarget } from './client.js'
import { createLogger } from '../logging/logger.js'

const getTarget = (): DatabaseTarget =>
  resolveDatabaseTarget(process.argv.includes('--dev') || process.env.DB_ENV === 'dev' ? 'dev' : undefined)
const logger = createLogger('db-reset')

const main = async (): Promise<void> => {
  const target = getTarget()
  if (target !== 'dev') {
    throw new Error('Refusing to run reset on non-dev database. Re-run with --dev or DB_ENV=dev.')
  }

  await query('DROP SCHEMA IF EXISTS public CASCADE', [], target)
  await query('CREATE SCHEMA public', [], target)
  await runMigrations(target)
  await runSeed(target)
  logger.info('Reset completed.', { target })
}

main()
  .catch((error) => {
    logger.error('Reset command failed.', { error })
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool()
  })
