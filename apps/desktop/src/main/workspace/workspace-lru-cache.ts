/**
 * WorkspaceLRUCache — LRU cache for workspaces with automatic unloading.
 *
 * Responsibilities:
 * - Keep only active workspaces in memory
 * - Unload inactive workspaces when limit exceeded
 * - Proper cleanup of workspace resources
 * - Maximum 2 loaded workspaces by default
 */

import { logger } from '@agenthub/shared'

const log = logger.child('WorkspaceLRUCache')

// ─── Constants ────────────────────────────────────────────────────────────────────

const MAX_LOADED_WORKSPACES = 2

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface IWorkspaceContext {
    readonly workspaceId: string
    readonly agents: Map<string, unknown>
    readonly timers: Set<string>
    readonly listeners: Set<() => void>
    readonly caches: Map<string, unknown>
}

export interface IDisposable {
    dispose(): void | Promise<void>
}

// ─── Workspace Context ─────────────────────────────────────────────────────────

export class WorkspaceContext implements IWorkspaceContext, IDisposable {
    readonly workspaceId: string
    readonly agents = new Map<string, unknown>()
    readonly timers = new Set<string>()
    readonly listeners = new Set<() => void>()
    readonly caches = new Map<string, unknown>()
    private disposed = false

    constructor(workspaceId: string) {
        this.workspaceId = workspaceId
    }

    registerAgent(agentId: string, agent: unknown): void {
        this.agents.set(agentId, agent)
    }

    unregisterAgent(agentId: string): void {
        this.agents.delete(agentId)
    }

    registerTimer(timerId: string): void {
        this.timers.add(timerId)
    }

    unregisterTimer(timerId: string): void {
        this.timers.delete(timerId)
    }

    registerListener(cleanup: () => void): void {
        this.listeners.add(cleanup)
    }

    registerCache(key: string, value: unknown): void {
        this.caches.set(key, value)
    }

    async dispose(): Promise<void> {
        if (this.disposed) return
        this.disposed = true

        // Clean up agents
        for (const agent of this.agents.values()) {
            if (typeof (agent as IDisposable)?.dispose === 'function') {
                await (agent as IDisposable).dispose()
            }
        }
        this.agents.clear()

        // Clean up timers
        for (const timerId of this.timers) {
            // Clear timer through timer manager
        }
        this.timers.clear()

        // Clean up listeners
        for (const cleanup of this.listeners) {
            try {
                cleanup()
            } catch (err) {
                log.warn('Error cleaning up listener', { workspaceId: this.workspaceId, error: String(err) })
            }
        }
        this.listeners.clear()

        // Clean up caches
        this.caches.clear()

        log.info('Disposed workspace context', { workspaceId: this.workspaceId })
    }
}

// ─── LRU Cache Implementation ─────────────────────────────────────────────────

class GlobalWorkspaceLRUCache {
    private static instance: GlobalWorkspaceLRUCache | null = null
    private readonly cache = new Map<string, WorkspaceContext>() // workspaceId -> context
    private readonly accessOrder: string[] = [] // Track access order for LRU
    private maxSize: number = MAX_LOADED_WORKSPACES

    static getInstance(): GlobalWorkspaceLRUCache {
        if (GlobalWorkspaceLRUCache.instance === null) {
            GlobalWorkspaceLRUCache.instance = new GlobalWorkspaceLRUCache()
        }
        return GlobalWorkspaceLRUCache.instance
    }

    static resetForTesting(): void {
        GlobalWorkspaceLRUCache.instance = null
    }

    setMaxSize(size: number): void {
        this.maxSize = size
        this.evictIfNeeded()
    }

    /**
     * Get or create a workspace context
     */
    get(workspaceId: string): WorkspaceContext {
        let context = this.cache.get(workspaceId)

        if (context === undefined) {
            context = new WorkspaceContext(workspaceId)
            this.cache.set(workspaceId, context)
            this.accessOrder.push(workspaceId)
            this.evictIfNeeded()
        } else {
            // Update access order (move to end for LRU)
            const index = this.accessOrder.indexOf(workspaceId)
            if (index >= 0) {
                this.accessOrder.splice(index, 1)
            }
            this.accessOrder.push(workspaceId)
        }

        log.debug('Workspace context retrieved', { workspaceId })
        return context
    }

    /**
     * Check if workspace is loaded
     */
    has(workspaceId: string): boolean {
        return this.cache.has(workspaceId)
    }

    /**
     * Unload a workspace explicitly
     */
    async unload(workspaceId: string): Promise<void> {
        const context = this.cache.get(workspaceId)
        
        if (context !== undefined) {
            await context.dispose()
            this.cache.delete(workspaceId)
            
            const index = this.accessOrder.indexOf(workspaceId)
            if (index >= 0) {
                this.accessOrder.splice(index, 1)
            }
            
            log.info('Unloaded workspace', { workspaceId })
        }
    }

    /**
     * Get all loaded workspace IDs
     */
    getLoadedWorkspaces(): string[] {
        return Array.from(this.cache.keys())
    }

    /**
     * Get stats
     */
    getStats(): { loadedCount: number; maxSize: number } {
        return {
            loadedCount: this.cache.size,
            maxSize: this.maxSize,
        }
    }

    /**
     * Clear all workspaces
     */
    async clearAll(): Promise<void> {
        for (const context of this.cache.values()) {
            await context.dispose()
        }
        this.cache.clear()
        this.accessOrder.length = 0
        
        log.info('Cleared all workspace contexts')
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    private evictIfNeeded(): void {
        while (this.cache.size > this.maxSize && this.accessOrder.length > 0) {
            // Evict least recently used (first in access order)
            const lruId = this.accessOrder.shift()!
            const context = this.cache.get(lruId)
            
            if (context !== undefined && lruId !== this.getActiveWorkspaceId()) {
                // Don't evict the active workspace
                this.cache.delete(lruId)
                // CRITICAL FIX: Properly handle async dispose
                context.dispose().catch(err => {
                    log.warn('Error disposing evicted workspace', { workspaceId: lruId, error: String(err) })
                })
                
                log.info('Evicted workspace from LRU cache', { workspaceId: lruId })
            }
        }
    }

    private getActiveWorkspaceId(): string | null {
        // In this would come a real implementation, from the active workspace
        return this.accessOrder[this.accessOrder.length - 1] ?? null
    }
}

export const workspaceLRUCache = GlobalWorkspaceLRUCache.getInstance()

// ─── Convenience Functions ──────────────────────────────────────────────────────

export function getWorkspaceContext(workspaceId: string): WorkspaceContext {
    return workspaceLRUCache.get(workspaceId)
}

export function unloadWorkspace(workspaceId: string): Promise<void> {
    return workspaceLRUCache.unload(workspaceId)
}

export function isWorkspaceLoaded(workspaceId: string): boolean {
    return workspaceLRUCache.has(workspaceId)
}
