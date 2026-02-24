/**
 * Execution lifecycle events — typed contracts for the execution engine.
 *
 * These event types flow between execution, platform, and UI layers.
 * They are serializable for IPC transport.
 *
 * See: docs/technical-design.md §9 EXECUTION ENGINE
 */

// ─── Lifecycle Event Types ──────────────────────────────────────────────────

export type ExecutionLifecycleEvent =
    | 'execution.created'
    | 'execution.validated'
    | 'execution.governance_checked'
    | 'execution.rejected'
    | 'execution.planned'
    | 'execution.scheduled'
    | 'execution.running'
    | 'execution.tool_execution'
    | 'execution.memory_injection'
    | 'execution.completed'
    | 'execution.snapshot_persisted'
    | 'execution.failed'
    | 'execution.aborted'

// ─── Execution Event ────────────────────────────────────────────────────────

export interface IExecutionEvent {
    readonly type: ExecutionLifecycleEvent
    readonly executionId: string
    readonly timestamp: string
    readonly data?: Readonly<Record<string, unknown>>
}

// ─── Execution State ────────────────────────────────────────────────────────

export type ExecutionState =
    | 'idle'
    | 'running'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'aborted'

// ─── Execution Summary ──────────────────────────────────────────────────────

export interface IExecutionSummaryDTO {
    readonly executionId: string
    readonly agentId: string
    readonly state: ExecutionState
    readonly startedAt: string
    readonly completedAt?: string
    readonly stepCount: number
    readonly tokenUsage: {
        readonly promptTokens: number
        readonly completionTokens: number
    }
    readonly error?: string
}

// ─── Execution Progress ─────────────────────────────────────────────────────

export interface IExecutionProgressDTO {
    readonly executionId: string
    readonly currentStep: number
    readonly totalSteps: number
    readonly currentNodeId: string
    readonly status: string
    readonly timestamp: string
}

// ─── Event Emitter Contract ─────────────────────────────────────────────────

export interface IExecutionEventEmitter {
    emit(event: IExecutionEvent): void
    on(type: ExecutionLifecycleEvent, listener: (event: IExecutionEvent) => void): () => void
}
