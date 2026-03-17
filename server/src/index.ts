import cors from 'cors'
import express from 'express'
import { createExpressMiddleware } from '@trpc/server/adapters/express'

import { appRouter } from './router.js'
import type { Request, Response } from 'express'
import { closePool, testConnection } from './db/client.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
)

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext() {
      return {}
    },
  }),
)

app.get('/health', async (_req: Request, res: Response) => {
  const dbConnected = await testConnection()
  res.json({ status: 'ok', service: 'server', dbConnected })
})

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Hello from Node backend' })
})

const server = app.listen(PORT, async () => {
  const dbConnected = await testConnection()
  if (!dbConnected) {
    console.error('Database not reachable. Make sure DATABASE_URL is set and migrations are applied.')
    process.exit(1)
  }
  console.log(`Server running on http://localhost:${PORT}`)
})

const shutdown = async (signal: string): Promise<void> => {
  console.log(`${signal} received. Shutting down...`)
  server.close(async () => {
    await closePool()
    process.exit(0)
  })
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM')
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
})

process.on('SIGINT', () => {
  shutdown('SIGINT')
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
})
