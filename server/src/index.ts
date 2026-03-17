import cors from 'cors'
import express from 'express'
import { createExpressMiddleware } from '@trpc/server/adapters/express'

import { appRouter } from './router.js'
import type { Request, Response } from 'express'

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

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'server' })
})

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Hello from Node backend' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
