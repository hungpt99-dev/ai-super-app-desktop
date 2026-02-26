/**
 * TimerManager — central timer management to prevent timer leaks.
 *
 * Responsibilities:
 * - Track all timers per workspace
 * - Clear all timers on workspace unload
 * - Prevent timer accumulation
 */

import { logger } from '@agenthub/shared'

const log = logger.child('TimerManager')

// ─── Types ────────────────────────────────────────────────────────────────────────

interface TimerEntry {
    readonly id: string
    readonly workspaceId: string
    readonly type: 'timeout' | 'interval'
    readonly callback: () => void
    readonly createdAt: number
}

// ─── TimerManager ───────────────────────────────────────────────────────────────

class GlobalTimerManager {
    private static instance: GlobalTimerManager | null = null
    private readonly timers = new Map<string, TimerEntry>()
    private readonly workspaceTimers = new Map<string, Set<string>>()
    private timerIdCounter = 0

    static getInstance(): GlobalTimerManager {
        if (GlobalTimerManager.instance === null) {
            GlobalTimerManager.instance = new GlobalTimerManager()
        }
        return GlobalTimerManager.instance
    }

    static resetForTesting(): void {
        if (GlobalTimerManager.instance !== null) {
            for (const entry of GlobalTimerManager.instance.timers.values()) {
                if (entry.type === 'timeout') {
                    clearTimeout(parseInt(entry.id.replace('timeout_', '')))
                } else {
                    clearInterval(parseInt(entry.id.replace('interval_', '')))
                }
            }
        }
        GlobalTimerManager.instance = null
    }

    setTimeout(workspaceId: string, callback: () => void, delay: number): string {
        const id = `timeout_${this.timerIdCounter++}`
        
        const wrappedCallback = () => {
            callback()
            this.remove(id)
        }

        const nativeId = window.setTimeout(wrappedCallback, delay)
        
        const entry: TimerEntry = {
            id: `timeout_${nativeId}`,
            workspaceId,
            type: 'timeout',
            callback: wrappedCallback,
            createdAt: Date.now(),
        }
        
        this.timers.set(entry.id, entry)
        this.addToWorkspaceMap(workspaceId, entry.id)
        
        log.debug('Created timeout', { id: entry.id, workspaceId, delay })
        return entry.id
    }

    setInterval(workspaceId: string, callback: () => void, delay: number): string {
        const nativeId = window.setInterval(callback, delay)
        const id = `interval_${nativeId}`
        
        const entry: TimerEntry = {
            id,
            workspaceId,
            type: 'interval',
            callback,
            createdAt: Date.now(),
        }
        
        this.timers.set(id, entry)
        this.addToWorkspaceMap(workspaceId, id)
        
        log.debug('Created interval', { id, workspaceId, delay })
        return id
    }

    clear(timerId: string): void {
        const entry = this.timers.get(timerId)
        if (entry === undefined) return

        if (entry.type === 'timeout') {
            const nativeId = parseInt(entry.id.replace('timeout_', ''))
            clearTimeout(nativeId)
        } else {
            const nativeId = parseInt(entry.id.replace('interval_', ''))
            clearInterval(nativeId)
        }

        this.remove(timerId)
        log.debug('Cleared timer', { id: timerId })
    }

    clearWorkspace(workspaceId: string): void {
        const timerIds = this.workspaceTimers.get(workspaceId)
        if (timerIds === undefined) return

        for (const timerId of timerIds) {
            const entry = this.timers.get(timerId)
            if (entry !== undefined) {
                if (entry.type === 'timeout') {
                    const nativeId = parseInt(entry.id.replace('timeout_', ''))
                    clearTimeout(nativeId)
                } else {
                    const nativeId = parseInt(entry.id.replace('interval_', ''))
                    clearInterval(nativeId)
                }
            }
        }

        this.workspaceTimers.delete(workspaceId)
        log.info('Cleared all timers for workspace', { workspaceId, count: timerIds.size })
    }

    clearAll(): void {
        for (const entry of this.timers.values()) {
            if (entry.type === 'timeout') {
                const nativeId = parseInt(entry.id.replace('timeout_', ''))
                clearTimeout(nativeId)
            } else {
                const nativeId = parseInt(entry.id.replace('interval_', ''))
                clearInterval(nativeId)
            }
        }

        this.timers.clear()
        this.workspaceTimers.clear()
        log.info('Cleared all timers')
    }

    getStats(): { totalTimers: number; workspaceCount: number } {
        return {
            totalTimers: this.timers.size,
            workspaceCount: this.workspaceTimers.size,
        }
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    private remove(id: string): void {
        const entry = this.timers.get(id)
        if (entry !== undefined) {
            this.timers.delete(id)
            const workspaceTimers = this.workspaceTimers.get(entry.workspaceId)
            if (workspaceTimers !== undefined) {
                workspaceTimers.delete(id)
                if (workspaceTimers.size === 0) {
                    this.workspaceTimers.delete(entry.workspaceId)
                }
            }
        }
    }

    private addToWorkspaceMap(workspaceId: string, timerId: string): void {
        let timerIds = this.workspaceTimers.get(workspaceId)
        if (timerIds === undefined) {
            timerIds = new Set()
            this.workspaceTimers.set(workspaceId, timerIds)
        }
        timerIds.add(timerId)
    }
}

export const timerManager = GlobalTimerManager.getInstance()

// ─── Convenience functions ────────────────────────────────────────────────────

export function createWorkspaceTimeout(
    workspaceId: string,
    callback: () => void,
    delay: number,
): string {
    return timerManager.setTimeout(workspaceId, callback, delay)
}

export function createWorkspaceInterval(
    workspaceId: string,
    callback: () => void,
    delay: number,
): string {
    return timerManager.setInterval(workspaceId, callback, delay)
}

export function clearWorkspaceTimers(workspaceId: string): void {
    timerManager.clearWorkspace(workspaceId)
}
