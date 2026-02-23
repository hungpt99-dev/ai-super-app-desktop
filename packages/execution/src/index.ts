/**
 * Execution Package — scheduler, worker, concurrency, and lifecycle.
 *
 * DOES NOT import provider or storage implementations directly.
 * Uses locally defined port interfaces. Platform wires real adapters.
 *
 * See: docs/technical-design.md §9 EXECUTION ENGINE
 */

import type { AgentLifecycleState } from '@agenthub/shared'

// ─── Scheduler ──────────────────────────────────────────────────────────────

export interface IScheduler {
    /** Enqueue a graph for execution. */
    enqueue(executionId: string, graphId: string): void
    /** Step through the next node in the graph. */
    step(executionId: string): Promise<void>
    /** Cancel a running execution. */
    cancel(executionId: string): void
}

// ─── Worker ─────────────────────────────────────────────────────────────────

export interface IWorker {
    readonly id: string
    readonly status: AgentLifecycleState
    /** Execute one unit of work. */
    execute(payload: Record<string, unknown>): Promise<unknown>
    /** Terminate the worker. */
    terminate(): void
}

export interface IWorkerManager {
    /** Dispatch a job to an available worker. */
    dispatch(executionId: string, payload: Record<string, unknown>): Promise<unknown>
    /** Terminate a specific worker. */
    terminateWorker(executionId: string): void
    /** Get all active worker IDs. */
    activeWorkers(): string[]
}

// ─── Lifecycle Manager ──────────────────────────────────────────────────────

export interface ILifecycleManager {
    /** Create a new execution lifecycle. */
    create(executionId: string): void
    /** Get the current state of an execution. */
    getState(executionId: string): AgentLifecycleState | null
    /** Transition an execution to a new state. */
    transition(executionId: string, state: AgentLifecycleState): void
}

// ─── Retry Policy ───────────────────────────────────────────────────────────

export interface IRetryPolicy {
    readonly maxAttempts: number
    readonly delayMs: number
    shouldRetry(error: Error, attempt: number): boolean
}

export const DEFAULT_RETRY_POLICY: IRetryPolicy = {
    maxAttempts: 3,
    delayMs: 1000,
    shouldRetry: (_error: Error, attempt: number) => attempt < 3,
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

export { GraphScheduler } from './scheduler/index.js'
export { WorkerManager } from './worker/index.js'
export * from './lifecycle/index.js'
