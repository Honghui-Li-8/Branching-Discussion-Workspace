import { closePool } from '../db/client.js'
import { startConversationPostprocessWorker } from './worker.js'

startConversationPostprocessWorker()
  .catch((error) => {
    console.error('[jobs] worker crashed.', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool()
  })
