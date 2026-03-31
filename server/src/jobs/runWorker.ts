import { closePool } from '../db/client.js'
import { startConversationPostprocessWorker } from './worker.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger('jobs-runner')

startConversationPostprocessWorker()
  .catch((error) => {
    logger.error('[jobs] worker crashed.', { error })
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool()
  })
