import type { IEventBus, EventHandler } from '@agenthub/sdk'
import { Permission } from '@agenthub/sdk'
import type { PermissionEngine } from '@agenthub/core'
import { logger } from '@agenthub/shared'

const log = logger.child('SandboxedEventBus')

const MAX_LISTENERS_PER_EVENT = 100

type HandlerMap = Map<string, Set<EventHandler>>

/**
 * SandboxedEventBus — Observer Pattern + Proxy Pattern.
 *
 * Shared singleton bus with per-module permission enforcement.
 * Modules cannot subscribe/publish without declared permissions.
 *
 * Improvements:
 * - maxListeners guard per event to detect subscription leaks
 * - clear() for test cleanup
 * - removeAllForModule() for proper cleanup on module deactivation
 */
class GlobalEventBus {
  private static instance: GlobalEventBus | null = null
  private readonly handlers: HandlerMap = new Map()
  /** moduleId → Set of unsubscribe functions, for bulk cleanup on deactivation. */
  private readonly moduleSubscriptions = new Map<string, Set<() => void>>()

  static getInstance(): GlobalEventBus {
    if (!GlobalEventBus.instance) {
      GlobalEventBus.instance = new GlobalEventBus()
    }
    return GlobalEventBus.instance
  }

  /** Reset singleton — needed for test isolation. */
  static resetForTesting(): void {
    GlobalEventBus.instance = null
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

  subscribe<T>(event: string, handler: EventHandler<T>, moduleId?: string): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    const handlers = this.handlers.get(event)!

    // Leak detection
    if (handlers.size >= MAX_LISTENERS_PER_EVENT) {
      log.warn('Possible subscription leak', { event, count: handlers.size })
    }

    handlers.add(handler as EventHandler)

    const unsub = () => {
      this.handlers.get(event)?.delete(handler as EventHandler)
    }

    // Track per module for bulk cleanup
    if (moduleId) {
      if (!this.moduleSubscriptions.has(moduleId)) {
        this.moduleSubscriptions.set(moduleId, new Set())
      }
      this.moduleSubscriptions.get(moduleId)!.add(unsub)
    }

    return unsub
  }

  /** Remove all subscriptions belonging to a module (called on deactivate). */
  removeAllForModule(moduleId: string): void {
    const subs = this.moduleSubscriptions.get(moduleId)
    if (subs) {
      for (const unsub of subs) unsub()
      this.moduleSubscriptions.delete(moduleId)
    }
  }

  /** Clear all handlers. Call in tests or on app shutdown. */
  clear(): void {
    this.handlers.clear()
    this.moduleSubscriptions.clear()
  }
}

/** Per-module proxy that enforces permissions on publish/subscribe. */
export class SandboxedEventBus implements IEventBus {
  private readonly bus = GlobalEventBus.getInstance()

  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
  ) { }

  publish<T>(event: string, payload: T): void {
    this.permissionEngine.check(this.moduleId, Permission.EventsPublish)
    log.debug('events.publish', { moduleId: this.moduleId, event })
    this.bus.publish(event, payload)
  }

  subscribe<T>(event: string, handler: EventHandler<T>): () => void {
    this.permissionEngine.check(this.moduleId, Permission.EventsSubscribe)
    log.debug('events.subscribe', { moduleId: this.moduleId, event })
    return this.bus.subscribe(event, handler, this.moduleId)
  }
}
