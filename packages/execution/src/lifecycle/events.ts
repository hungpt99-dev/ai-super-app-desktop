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

export interface IExecutionEvent {
    readonly type: ExecutionLifecycleEvent
    readonly executionId: string
    readonly timestamp: string
    readonly data?: Readonly<Record<string, unknown>>
}

export interface IExecutionEventEmitter {
    emit(event: IExecutionEvent): void
    on(type: ExecutionLifecycleEvent, listener: (event: IExecutionEvent) => void): () => void
}
