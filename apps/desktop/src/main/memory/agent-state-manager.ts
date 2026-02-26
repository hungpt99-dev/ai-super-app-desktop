/**
 * AgentStateManager — manages agent run state with TTL and cleanup.
 *
 * Responsibilities:
 * - Track agent runs with TTL
 * - Clean up old runs automatically
 * - Prevent memory accumulation from stale states
 * - Support crash recovery via checkpoints
 *
 * TTL: 24 hours for runs
 */

import { logger } from '@agenthub/shared'

const log = logger.child('AgentStateManager')

// ─── Constants ────────────────────────────────────────────────────────────────────

const RUN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface IAgentRun {
    readonly runId: string
    readonly agentId: string
    readonly workspaceId: string
    readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    readonly goal: string
    readonly steps: number
    readonly tokenUsage: number
    readonly createdAt: number
    readonly updatedAt: number
    readonly checkpointedAt?: number
    readonly metadata?: Record<string, unknown>
}

export interface IAgentState {
    readonly agentId: string
    readonly workspaceId: string
    runs: IAgentRun[]
    tempMemory: Map<string, unknown>
    lastCleanup: number
}

// ─── Agent State Manager ────────────────────────────────────────────────────────

class GlobalAgentStateManager {
    private static instance: GlobalAgentStateManager | null = null
    private readonly states = new Map<string, IAgentState>() // agentId -> state
    // PERFORMANCE IMPROVEMENT: Add index for O(1) run lookups instead of O(n)
    private readonly runIndex = new Map<string, { agentId: string; runId: string }>() // runId -> {agentId, runId}
    private cleanupTimer: ReturnType<typeof setInterval> | null = null

    static getInstance(): GlobalAgentStateManager {
        if (GlobalAgentStateManager.instance === null) {
            GlobalAgentStateManager.instance = new GlobalAgentStateManager()
        }
        return GlobalAgentStateManager.instance
    }

    static resetForTesting(): void {
        if (GlobalAgentStateManager.instance !== null) {
            if (GlobalAgentStateManager.instance.cleanupTimer !== null) {
                clearInterval(GlobalAgentStateManager.instance.cleanupTimer)
            }
        }
        GlobalAgentStateManager.instance = null
    }

    startCleanupTimer(): void {
        if (this.cleanupTimer !== null) return
        
        this.cleanupTimer = setInterval(() => {
            this.cleanup()
        }, CLEANUP_INTERVAL_MS)
        
        log.info('Started agent state cleanup timer')
    }

    stopCleanupTimer(): void {
        if (this.cleanupTimer !== null) {
            clearInterval(this.cleanupTimer)
            this.cleanupTimer = null
        }
    }

    getOrCreateState(agentId: string, workspaceId: string): IAgentState {
        let state = this.states.get(agentId)
        if (state === undefined) {
            state = {
                agentId,
                workspaceId,
                runs: [],
                tempMemory: new Map(),
                lastCleanup: Date.now(),
            }
            this.states.set(agentId, state)
        }
        return state
    }

    addRun(run: Omit<IAgentRun, 'createdAt' | 'updatedAt'>): IAgentRun {
        const state = this.getOrCreateState(run.agentId, run.workspaceId)
        
        const newRun: IAgentRun = {
            ...run,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }
        
        state.runs.push(newRun)
        
        // PERFORMANCE: Update index for O(1) lookup
        this.runIndex.set(run.runId, { agentId: run.agentId, runId: run.runId })
        
        log.debug('Added run', { runId: run.runId, agentId: run.agentId })
        
        return newRun
    }

    updateRun(runId: string, updates: Partial<IAgentRun>): IAgentRun | null {
        // PERFORMANCE: Use index for O(1) lookup instead of iterating all states
        const indexEntry = this.runIndex.get(runId)
        if (indexEntry) {
            const state = this.states.get(indexEntry.agentId)
            if (state) {
                const runIndex = state.runs.findIndex(r => r.runId === runId)
                if (runIndex >= 0) {
                    const run = state.runs[runIndex]
                    const updatedRun: IAgentRun = {
                        ...run,
                        ...updates,
                        updatedAt: Date.now(),
                    }
                    state.runs[runIndex] = updatedRun
                    return updatedRun
                }
            }
        }
        
        // Fallback to old behavior if not in index
        for (const state of this.states.values()) {
            const runIndex = state.runs.findIndex(r => r.runId === runId)
            if (runIndex >= 0) {
                const run = state.runs[runIndex]
                const updatedRun: IAgentRun = {
                    ...run,
                    ...updates,
                    updatedAt: Date.now(),
                }
                state.runs[runIndex] = updatedRun
                return updatedRun
            }
        }
        return null
    }

    getRun(runId: string): IAgentRun | null {
        // PERFORMANCE: Use index for O(1) lookup
        const indexEntry = this.runIndex.get(runId)
        if (indexEntry) {
            const state = this.states.get(indexEntry.agentId)
            if (state) {
                const run = state.runs.find(r => r.runId === runId)
                if (run !== undefined) return run
            }
        }
        
        // Fallback
        for (const state of this.states.values()) {
            const run = state.runs.find(r => r.runId === runId)
            if (run !== undefined) return run
        }
        return null
    }

    getRunsByAgent(agentId: string): IAgentRun[] {
        const state = this.states.get(agentId)
        return state?.runs ?? []
    }

    getActiveRuns(workspaceId: string): IAgentRun[] {
        const activeRuns: IAgentRun[] = []
        
        for (const state of this.states.values()) {
            if (state.workspaceId !== workspaceId) continue
            
            for (const run of state.runs) {
                if (run.status === 'running' || run.status === 'pending') {
                    activeRuns.push(run)
                }
            }
        }
        
        return activeRuns
    }

    checkpointRun(runId: string): IAgentRun | null {
        const run = this.getRun(runId)
        if (run === null) return null
        
        return this.updateRun(runId, { checkpointedAt: Date.now() })
    }

    setTempMemory(agentId: string, key: string, value: unknown): void {
        const state = this.getOrCreateState(agentId, '')
        state.tempMemory.set(key, value)
    }

    getTempMemory<T>(agentId: string, key: string): T | undefined {
        const state = this.states.get(agentId)
        if (state === undefined) return undefined
        return state.tempMemory.get(key) as T | undefined
    }

    clearTempMemory(agentId: string): void {
        const state = this.states.get(agentId)
        if (state !== undefined) {
            state.tempMemory.clear()
        }
    }

    cleanup(): void {
        const now = Date.now()
        let cleanedRuns = 0
        let cleanedAgents = 0

        for (const [agentId, state] of this.states.entries()) {
            const beforeCount = state.runs.length
            
            // Collect run IDs to remove from index
            const runsToRemove: string[] = []
            
            // Remove runs older than TTL
            state.runs = state.runs.filter(run => {
                const age = now - run.updatedAt
                if (age >= RUN_TTL_MS) {
                    runsToRemove.push(run.runId)
                    return false
                }
                return true
            })
            
            // Remove from index
            for (const runId of runsToRemove) {
                this.runIndex.delete(runId)
            }
            
            const removed = beforeCount - state.runs.length
            cleanedRuns += removed

            // Remove empty states with no active runs
            if (state.runs.length === 0 && state.tempMemory.size === 0) {
                this.states.delete(agentId)
                cleanedAgents++
            }
        }

        if (cleanedRuns > 0 || cleanedAgents > 0) {
            log.info('Cleaned agent states', { cleanedRuns, cleanedAgents })
        }
    }

    cleanupWorkspace(workspaceId: string): void {
        for (const [agentId, state] of this.states.entries()) {
            if (state.workspaceId === workspaceId) {
                // Clean up index entries for runs being removed
                for (const run of state.runs) {
                    this.runIndex.delete(run.runId)
                }
                state.runs = []
                state.tempMemory.clear()
                this.states.delete(agentId)
            }
        }
        
        log.info('Cleaned workspace agent states', { workspaceId })
    }

    clearAll(): void {
        for (const state of this.states.values()) {
            state.runs = []
            state.tempMemory.clear()
        }
        this.states.clear()
        this.runIndex.clear() // PERFORMANCE: Clear the index as well
        
        log.info('Cleared all agent states')
    }

    getStats(): { agentCount: number; runCount: number; activeRunCount: number } {
        let runCount = 0
        let activeRunCount = 0

        for (const state of this.states.values()) {
            runCount += state.runs.length
            activeRunCount += state.runs.filter(r => r.status === 'running' || r.status === 'pending').length
        }

        return {
            agentCount: this.states.size,
            runCount,
            activeRunCount,
        }
    }
}

export const agentStateManager = GlobalAgentStateManager.getInstance()

// ─── Checkpoint System ─────────────────────────────────────────────────────────

export interface ICheckpoint {
    readonly runId: string
    readonly agentId: string
    readonly workspaceId: string
    readonly step: number
    readonly tokenUsage: number
    readonly timestamp: number
    readonly snapshot: Record<string, unknown>
}

class CheckpointManager {
    private readonly checkpoints = new Map<string, ICheckpoint>() // runId -> checkpoint

    saveCheckpoint(checkpoint: Omit<ICheckpoint, 'timestamp'>): ICheckpoint {
        const fullCheckpoint: ICheckpoint = {
            ...checkpoint,
            timestamp: Date.now(),
        }
        
        this.checkpoints.set(fullCheckpoint.runId, fullCheckpoint)
        
        log.debug('Saved checkpoint', { runId: fullCheckpoint.runId, step: fullCheckpoint.step })
        
        return fullCheckpoint
    }

    loadCheckpoint(runId: string): ICheckpoint | null {
        const checkpoint = this.checkpoints.get(runId)
        if (checkpoint === undefined) return null
        
        log.debug('Loaded checkpoint', { runId, step: checkpoint.step })
        
        return checkpoint
    }

    deleteCheckpoint(runId: string): void {
        this.checkpoints.delete(runId)
    }

    getAllCheckpoints(workspaceId: string): ICheckpoint[] {
        return Array.from(this.checkpoints.values()).filter(
            cp => cp.workspaceId === workspaceId
        )
    }

    cleanupOldCheckpoints(maxAge: number = RUN_TTL_MS): number {
        const now = Date.now()
        let cleaned = 0

        for (const [runId, checkpoint] of this.checkpoints.entries()) {
            if (now - checkpoint.timestamp > maxAge) {
                this.checkpoints.delete(runId)
                cleaned++
            }
        }

        if (cleaned > 0) {
            log.info('Cleaned old checkpoints', { count: cleaned })
        }

        return cleaned
    }
}

export const checkpointManager = new CheckpointManager()
