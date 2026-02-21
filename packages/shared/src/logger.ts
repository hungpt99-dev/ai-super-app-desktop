/** Structured log levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

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

class ConcreteLogger implements ILogger {
  constructor(private readonly context?: string) {}

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
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
