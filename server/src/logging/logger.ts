const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

export interface AppLogger {
  debug: (message: string, context?: Record<string, unknown>) => void
  info: (message: string, context?: Record<string, unknown>) => void
  warn: (message: string, context?: Record<string, unknown>) => void
  error: (message: string, context?: Record<string, unknown>) => void
}

const DEFAULT_LOG_LEVEL: LogLevel = 'info'
const SERVER_LOG_LEVEL_ENV = 'SERVER_LOG_LEVEL'
const FALLBACK_LOG_LEVEL_ENV = 'LOG_LEVEL'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const normalizeLogLevel = (value: string | undefined): LogLevel => {
  const normalized = value?.trim().toLowerCase()
  switch (normalized) {
    case 'debug':
      return 'debug'
    case 'info':
      return 'info'
    case 'warning':
    case 'warn':
      return 'warn'
    case 'error':
      return 'error'
    default:
      return DEFAULT_LOG_LEVEL
  }
}

export const getServerLogLevel = (): LogLevel =>
  normalizeLogLevel(
    process.env[SERVER_LOG_LEVEL_ENV] ?? process.env[FALLBACK_LOG_LEVEL_ENV],
  )

const shouldLog = (level: LogLevel, configuredLevel: LogLevel): boolean =>
  LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel]

const writeLog = (
  level: LogLevel,
  _scope: string | undefined,
  message: string,
  context?: Record<string, unknown>,
): void => {
  const configuredLevel = getServerLogLevel()
  if (!shouldLog(level, configuredLevel)) {
    return
  }

  if (level === 'error') {
    if (context) {
      console.error(message, context)
      return
    }
    console.error(message)
    return
  }

  if (level === 'warn') {
    if (context) {
      console.warn(message, context)
      return
    }
    console.warn(message)
    return
  }

  if (level === 'debug') {
    if (context) {
      console.debug(message, context)
      return
    }
    console.debug(message)
    return
  }

  if (context) {
    console.info(message, context)
    return
  }
  console.info(message)
}

export const createLogger = (scope?: string): AppLogger => ({
  debug: (message, context) => {
    writeLog('debug', scope, message, context)
  },
  info: (message, context) => {
    writeLog('info', scope, message, context)
  },
  warn: (message, context) => {
    writeLog('warn', scope, message, context)
  },
  error: (message, context) => {
    writeLog('error', scope, message, context)
  },
})
