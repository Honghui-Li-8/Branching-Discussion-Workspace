import cors from 'cors'
import express from 'express'
import rateLimit, { type Options as RateLimitOptions } from 'express-rate-limit'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import type { Request, Response, RequestHandler } from 'express'
import { appRouter } from './router.js'
import { registerAuthRoutes } from './auth/routes.js'
import { startSessionCleanup } from './auth/sessionStore.js'
import { closePool, testConnection } from './db/client.js'
import { createAppRouterContext } from './trpcContext.js'
import { registerConversationStreamRoutes } from './chat/stream/routes.js'
import { createLogger, getServerLogLevel } from './logging/logger.js'
import { assertSafeHostedAuthConfig } from './auth/constants.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001
const logger = createLogger('server')

try {
  assertSafeHostedAuthConfig()
} catch (error) {
  logger.error('Refusing to start: unsafe development-auth configuration detected.', { error })
  process.exit(1)
}

process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code !== 'EPIPE') {
    throw error
  }
})

process.stderr.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code !== 'EPIPE') {
    throw error
  }
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception; shutting down.', { error })
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection; shutting down.', { reason })
  process.exit(1)
})

const jsonRateLimitHandler: RateLimitOptions['handler'] = (_req, res) => {
  res.status(429).json({ error: 'RATE_LIMITED' })
}

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
})

const authLogoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
})

const trpcLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
})

export const streamLimiter: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
})

const defaultAllowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
])

const configuredAllowedOrigins = new Set(
  (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

const isAllowedCorsOrigin = (origin: string): boolean => {
  if (configuredAllowedOrigins.size > 0) {
    return configuredAllowedOrigins.has(origin)
  }

  return defaultAllowedOrigins.has(origin) || /^http:\/\/localhost:51\d{2}$/.test(origin)
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedCorsOrigin(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`CORS origin not allowed: ${origin}`))
    },
    credentials: true,
  }),
)
app.use(express.json())
app.post('/auth/login', authLoginLimiter)
app.post('/auth/logout', authLogoutLimiter)
app.use('/trpc', trpcLimiter)
app.use((req, res, next) => {
  const startedAt = Date.now()
  logger.info('[http] request started.', {
    method: req.method,
    path: req.originalUrl,
  })

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    const context = {
      method: req.method,
      path: req.originalUrl,
      status_code: res.statusCode,
      duration_ms: durationMs,
    }
    if (res.statusCode >= 500) {
      logger.error('[http] request completed.', context)
      return
    }
    if (res.statusCode >= 400) {
      logger.warn('[http] request completed.', context)
      return
    }
    logger.info('[http] request completed.', context)
  })

  next()
})
registerAuthRoutes(app)
registerConversationStreamRoutes(app, streamLimiter)

const sessionCleanupTimer = startSessionCleanup()

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req }) => createAppRouterContext(req),
    onError: ({ error, path, type, input, req }) => {
      logger.error('[trpc] request failed.', {
        path: path ?? null,
        procedure_type: type,
        method: req.method,
        url: req.url,
        input,
        error,
      })
      logger.debug('[trpc] request debug error details.', {
        path: path ?? null,
        procedure_type: type,
        method: req.method,
        url: req.url,
        input,
        error,
      })
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
    logger.error('Database not reachable. Make sure DATABASE_URL is set and migrations are applied.')
    process.exit(1)
  }
  logger.info('Server started.', {
    port: PORT,
    log_level: getServerLogLevel(),
    url: `http://localhost:${PORT}`,
  })
})

const shutdown = async (signal: string): Promise<void> => {
  logger.info('Shutdown signal received.', { signal })
  clearInterval(sessionCleanupTimer)
  server.close(async () => {
    await closePool()
    process.exit(0)
  })
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM')
    .catch((error) => {
      logger.error('Failed during SIGTERM shutdown.', { error })
      process.exit(1)
    })
})

process.on('SIGINT', () => {
  shutdown('SIGINT')
    .catch((error) => {
      logger.error('Failed during SIGINT shutdown.', { error })
      process.exit(1)
    })
})
