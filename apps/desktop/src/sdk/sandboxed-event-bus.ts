import type { IEventBus, EventHandler } from '@agenthub/sdk'
import { Permission } from '@agenthub/sdk'
import type { PermissionEngine } from '../core/permission-engine.js'
import { logger } from '@agenthub/shared'

const log = logger.child('SandboxedEventBus')

type HandlerMap = Map<string, Set<EventHandler>>

/**
 * SandboxedEventBus — Observer Pattern + Proxy Pattern.
 *
 * Shared singleton bus with per-module permission enforcement.
 * Modules cannot subscribe/publish without declared permissions.
 */
class GlobalEventBus {
  private static instance: GlobalEventBus | null = null
  private readonly handlers: HandlerMap = new Map()

  static getInstance(): GlobalEventBus {
    if (!GlobalEventBus.instance) {
      GlobalEventBus.instance = new GlobalEventBus()
    }
    return GlobalEventBus.instance
  }

  publish<T>(event: string, payload: T): void {
    const handlers = this.handlers.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      try {
        handler(payload)
      } catch (e) {
        log.error('EventBus handler threw', {
          event,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  subscribe<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    const handlers = this.handlers.get(event)
    if (handlers) handlers.add(handler as EventHandler)
    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler)
    }
  }
}

/** Per-module proxy that enforces permissions on publish/subscribe. */
export class SandboxedEventBus implements IEventBus {
  private readonly bus = GlobalEventBus.getInstance()

  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
  ) {}

  publish<T>(event: string, payload: T): void {
    this.permissionEngine.check(this.moduleId, Permission.EventsPublish)
    log.debug('events.publish', { moduleId: this.moduleId, event })
    this.bus.publish(event, payload)
  }

  subscribe<T>(event: string, handler: EventHandler<T>): () => void {
    this.permissionEngine.check(this.moduleId, Permission.EventsSubscribe)
    log.debug('events.subscribe', { moduleId: this.moduleId, event })
    return this.bus.subscribe(event, handler)
  }
}
