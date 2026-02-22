/**
 * lifecycle/index.ts
 *
 * Manages the lifecycle of an agent execution:
 * - State transitions (pending -> running -> completed/failed/paused)
 * - Cancellation via AbortController
 * - Timeout enforcement
 */

import type { ICoreLLMProvider, ICoreSandbox, IPermissionEngine, ICoreStorageAdapter } from '@agenthub/core'

export type ExecutionState = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface IExecutionLifecycle {
    readonly executionId: string
    readonly state: ExecutionState
    readonly abortSignal: AbortSignal

    /** Execution environment dependencies. */
    readonly env: {
        readonly provider: ICoreLLMProvider
        readonly sandbox: ICoreSandbox
        readonly permissionEngine: IPermissionEngine
        readonly storage?: ICoreStorageAdapter
        readonly vectorStore?: any
    }

    /** Start or resume the execution. Transitions state to 'running'. */
    start(): void
    /** Pause execution. Save state and transition to 'paused'. */
    pause(): void
    /** Abort execution immediately. Triggers abortSignal and transitions to 'cancelled'. */
    cancel(reason?: string): void
    /** Mark execution as successfully completed. Transition to 'completed'. */
    complete(): void
    /** Mark execution as failed with an error. Transition to 'failed'. */
    fail(error?: unknown): void
}

/** Configuration for execution timeouts and limits. */
export interface ILifecycleConfig {
    /** Global timeout for the entire execution (ms). */
    maxDurationMs?: number
    /** Maximum number of node transitions allowed (cycle protection). */
    maxSteps?: number
}
