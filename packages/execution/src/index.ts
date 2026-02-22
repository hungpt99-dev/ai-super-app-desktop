/**
 * Execution Package — scheduler, worker management, and lifecycle.
 *
 * See: docs/technical-design.md §3.1 (execution model)
 * See: docs/codebase.md Layer 3 — execution
 */

// ─── Scheduler ──────────────────────────────────────────────────────────────

export interface IScheduler {
    /** Enqueue an execution for processing. */
    enqueue(executionId: string, priority?: number): void
    /** Dequeue the next execution to process. Returns null if empty. */
    dequeue(): string | null
    /** Cancel a queued execution. */
    cancel(executionId: string): boolean
    /** Number of pending executions. */
    readonly size: number
}

// ─── Worker ─────────────────────────────────────────────────────────────────

export type WorkerStatus = 'idle' | 'busy' | 'error' | 'shutdown'

export interface IWorker {
    readonly id: string
    readonly status: WorkerStatus
    /** Execute a single graph run. */
    execute(executionId: string): Promise<void>
    /** Gracefully stop the worker after current execution completes. */
    shutdown(): Promise<void>
}

// ─── Lifecycle Manager ──────────────────────────────────────────────────────

export interface ILifecycleManager {
    /** Start the execution engine with the given number of workers. */
    start(workerCount?: number): Promise<void>
    /** Gracefully stop all workers. */
    stop(): Promise<void>
    /** Abort a specific execution. */
    abort(executionId: string): Promise<void>
    /** Get the status of all workers. */
    getWorkerStatuses(): ReadonlyMap<string, WorkerStatus>
}

// ─── Retry Policy ───────────────────────────────────────────────────────────

export interface IRetryPolicy {
    /** Maximum number of retry attempts. */
    readonly maxRetries: number
    /** Base delay between retries in milliseconds. */
    readonly baseDelayMs: number
    /** Whether to use exponential backoff. */
    readonly exponentialBackoff: boolean
}

export const DEFAULT_RETRY_POLICY: IRetryPolicy = {
    maxRetries: 3,
    baseDelayMs: 1000,
    exponentialBackoff: true,
}

export * from './scheduler/index.js'
export * from './worker/index.js'
export * from './lifecycle/index.js'
