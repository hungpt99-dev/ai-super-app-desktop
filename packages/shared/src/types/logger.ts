/** Structured log levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Numeric priority used for level filtering. Lower = more verbose. */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export interface ILogEntry {
  level: LogLevel
  message: string
  context?: string
  timestamp: string
  data?: Record<string, unknown>
}

export interface ILogger {
  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
  child(context: string): ILogger
}

/**
 * Resolve the minimum log level from environment or global config.
 *
 * Priority:
 * 1. LOG_LEVEL env var (Node.js: process.env, Vite: import.meta.env)
 * 2. Runtime override via setLogLevel()
 * 3. Default: 'info' in production, 'debug' otherwise
 */
let globalLogLevel: LogLevel = resolveDefaultLevel()

function resolveDefaultLevel(): LogLevel {
  try {
    // Node.js / Tauri main process
    if (typeof process !== 'undefined' && process.env?.['LOG_LEVEL']) {
      return normalizeLevel(process.env['LOG_LEVEL'])
    }
  } catch {
    // Swallow — not in Node context
  }
  // Default: 'debug' for development ease, override to 'info'/'warn' in production
  return 'debug'
}

function normalizeLevel(raw: string): LogLevel {
  const lower = raw.toLowerCase()
  if (lower in LEVEL_PRIORITY) return lower as LogLevel
  return 'info'
}

/** Change the global log level at runtime. */
export function setLogLevel(level: LogLevel): void {
  globalLogLevel = level
}

/** Get the current global log level. */
export function getLogLevel(): LogLevel {
  return globalLogLevel
}

class ConcreteLogger implements ILogger {
  constructor(private readonly context?: string) { }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    // Fast path: skip if level is below the global threshold
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[globalLogLevel]) return

    const entry: ILogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(this.context !== undefined && { context: this.context }),
      ...(data !== undefined && { data }),
    }
    // Use console so this works in both Node.js and the browser/WebView.
    const output = JSON.stringify(entry)
    if (level === 'error') {
      console.error(output)
    } else if (level === 'warn') {
      console.warn(output)
    } else if (level === 'debug') {
      console.debug(output)
    } else {
      console.info(output)
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data)
  }

  child(context: string): ILogger {
    return new ConcreteLogger(context)
  }
}

/** Singleton root logger. Use `.child(context)` for scoped loggers. */
export const logger: ILogger = new ConcreteLogger()
