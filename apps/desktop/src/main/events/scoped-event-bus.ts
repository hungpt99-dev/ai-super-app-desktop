/**
 * ScopedEventBus — workspace-scoped event bus to prevent handler leaks.
 *
 * Responsibilities:
 * - Isolate events by workspace
 * - Auto-cleanup handlers on workspace dispose
 * - No global event bus
 */

import { logger } from '@agenthub/shared'

const log = logger.child('ScopedEventBus')

// ─── Types ────────────────────────────────────────────────────────────────────────

type EventHandler<T = unknown> = (payload: T) => void

interface IEventRegistration {
    readonly unsubscribe: () => void
    readonly workspaceId: string
    readonly event: string
}

// ─── Scoped Event Bus ────────────────────────────────────────────────────────────

class WorkspaceEventBus {
    private readonly handlers = new Map<string, Set<EventHandler>>() // event -> handlers

    publish<T>(event: string, payload: T): void {
        const handlers = this.handlers.get(event)
        if (handlers === undefined) return

        for (const handler of handlers) {
            try {
                handler(payload)
            } catch (err) {
                log.error('Event handler error', { event, error: String(err) })
            }
        }
    }

    subscribe<T>(event: string, handler: EventHandler<T>): () => void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set())
        }

        const handlers = this.handlers.get(event)!
        const wrappedHandler: EventHandler = (payload) => handler(payload as T)
        handlers.add(wrappedHandler)

        return () => {
            handlers.delete(wrappedHandler)
            if (handlers.size === 0) {
                this.handlers.delete(event)
            }
        }
    }

    clear(): void {
        this.handlers.clear()
    }

    getHandlerCount(event?: string): number {
        if (event !== undefined) {
            return this.handlers.get(event)?.size ?? 0
        }
        
        let total = 0
        for (const handlers of this.handlers.values()) {
            total += handlers.size
        }
        return total
    }
}

// ─── Global Scoped Event Bus Manager ────────────────────────────────────────────

class GlobalScopedEventBusManager {
    private static instance: GlobalScopedEventBusManager | null = null
    private readonly workspaceBuses = new Map<string, WorkspaceEventBus>()

    static getInstance(): GlobalScopedEventBusManager {
        if (GlobalScopedEventBusManager.instance === null) {
            GlobalScopedEventBusManager.instance = new GlobalScopedEventBusManager()
        }
        return GlobalScopedEventBusManager.instance
    }

    static resetForTesting(): void {
        GlobalScopedEventBusManager.instance = null
    }

    /**
     * Get or create a workspace-scoped event bus
     */
    getWorkspaceBus(workspaceId: string): WorkspaceEventBus {
        let bus = this.workspaceBuses.get(workspaceId)
        
        if (bus === undefined) {
            bus = new WorkspaceEventBus()
            this.workspaceBuses.set(workspaceId, bus)
        }
        
        return bus
    }

    /**
     * Dispose a workspace's event bus
     */
    disposeWorkspace(workspaceId: string): void {
        const bus = this.workspaceBuses.get(workspaceId)
        if (bus !== undefined) {
            bus.clear()
            this.workspaceBuses.delete(workspaceId)
            log.info('Disposed workspace event bus', { workspaceId })
        }
    }

    /**
     * Get stats
     */
    getStats(): { workspaceCount: number; totalHandlers: number } {
        let totalHandlers = 0
        
        for (const bus of this.workspaceBuses.values()) {
            totalHandlers += bus.getHandlerCount()
        }

        return {
            workspaceCount: this.workspaceBuses.size,
            totalHandlers,
        }
    }
}

export const scopedEventBusManager = GlobalScopedEventBusManager.getInstance()

// ─── Scoped Event Bus API ───────────────────────────────────────────────────────

export function createScopedEventBus(workspaceId: string): IEventBus {
    const bus = scopedEventBusManager.getWorkspaceBus(workspaceId)
    
    return {
        publish<T>(event: string, payload: T): void {
            bus.publish(event, payload)
        },
        
        subscribe<T>(event: string, handler: EventHandler<T>): () => void {
            return bus.subscribe(event, handler)
        },
    }
}

export function disposeWorkspaceEvents(workspaceId: string): void {
    scopedEventBusManager.disposeWorkspace(workspaceId)
}

// ─── Event Bus Interface ────────────────────────────────────────────────────────

export interface IEventBus {
    publish<T>(event: string, payload: T): void
    subscribe<T>(event: string, handler: EventHandler<T>): () => void
}
