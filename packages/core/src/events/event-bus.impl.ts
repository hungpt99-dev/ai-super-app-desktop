/**
 * InternalEventBus — concrete implementation.
 *
 * Features:
 * - Typed listeners per event type
 * - onAny() wildcard subscriptions
 * - Error isolation (one handler crash doesn't kill others)
 * - maxListeners guard to detect subscription leaks
 * - clear() for testability and shutdown
 */

import type { EventType, IEventPayload, EventListener, IInternalEventBus } from './event-bus.js'
import { logger } from '@agenthub/shared'

const log = logger.child('InternalEventBus')

const DEFAULT_MAX_LISTENERS = 100

export class InternalEventBus implements IInternalEventBus {
    private readonly listeners = new Map<EventType, Set<EventListener>>()
    private readonly wildcardListeners = new Set<EventListener>()
    private readonly maxListeners: number

    constructor(options?: { maxListeners?: number }) {
        this.maxListeners = options?.maxListeners ?? DEFAULT_MAX_LISTENERS
    }

    emit(event: IEventPayload): void {
        // Type-specific listeners
        const typeListeners = this.listeners.get(event.type)
        if (typeListeners) {
            for (const listener of typeListeners) {
                this.safeCall(listener, event)
            }
        }
        // Wildcard listeners
        for (const listener of this.wildcardListeners) {
            this.safeCall(listener, event)
        }
    }

    on(type: EventType, listener: EventListener): () => void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set())
        }
        const set = this.listeners.get(type)!
        this.checkMaxListeners(set.size, `event:${type}`)
        set.add(listener)

        // Return unsubscribe function
        return () => {
            set.delete(listener)
            if (set.size === 0) this.listeners.delete(type)
        }
    }

    onAny(listener: EventListener): () => void {
        this.checkMaxListeners(this.wildcardListeners.size, 'wildcard')
        this.wildcardListeners.add(listener)
        return () => {
            this.wildcardListeners.delete(listener)
        }
    }

    clear(): void {
        this.listeners.clear()
        this.wildcardListeners.clear()
    }

    /** Total number of registered listeners across all event types + wildcards. */
    get listenerCount(): number {
        let count = this.wildcardListeners.size
        for (const set of this.listeners.values()) {
            count += set.size
        }
        return count
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    /** Error isolation: one bad handler must never crash the bus. */
    private safeCall(listener: EventListener, event: IEventPayload): void {
        try {
            listener(event)
        } catch (err) {
            log.error('Event listener threw', {
                eventType: event.type,
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }

    private checkMaxListeners(currentSize: number, context: string): void {
        if (currentSize >= this.maxListeners) {
            log.warn('Possible listener leak detected', {
                context,
                listenerCount: currentSize,
                maxListeners: this.maxListeners,
            })
        }
    }
}
