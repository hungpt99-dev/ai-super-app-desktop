/**
 * sandboxed-logger.ts
 *
 * Structured logger exposed to modules as `ctx.log`.
 *
 * Each call writes a timestamped entry into the desktop Logs tab (via the
 * log-store ring buffer) with `source: 'bot'` and the moduleId prepended to
 * the message for easy filtering.
 *
 * No permission is required — logging is always available to any module.
 */

import type { ILogAPI } from '@agenthub/sdk'
import { addLog } from '../ui/store/log-store.js'

export class SandboxedLogger implements ILogAPI {
  constructor(private readonly moduleId: string) {}

  debug(message: string, data?: Record<string, unknown>): void {
    addLog({
      level: 'debug',
      source: 'bot',
      message: `[${this.moduleId}] ${message}`,
      ...(data !== undefined ? { detail: JSON.stringify(data, null, 2) } : {}),
    })
  }

  info(message: string, data?: Record<string, unknown>): void {
    addLog({
      level: 'info',
      source: 'bot',
      message: `[${this.moduleId}] ${message}`,
      ...(data !== undefined ? { detail: JSON.stringify(data, null, 2) } : {}),
    })
  }

  warn(message: string, data?: Record<string, unknown>): void {
    addLog({
      level: 'warn',
      source: 'bot',
      message: `[${this.moduleId}] ${message}`,
      ...(data !== undefined ? { detail: JSON.stringify(data, null, 2) } : {}),
    })
  }

  error(message: string, data?: Record<string, unknown>): void {
    addLog({
      level: 'error',
      source: 'bot',
      message: `[${this.moduleId}] ${message}`,
      ...(data !== undefined ? { detail: JSON.stringify(data, null, 2) } : {}),
    })
  }
}
