/**
 * Internal Event Bus — pub/sub system for agent messaging, logging,
 * UI updates, and remote sync.
 *
 * See: docs/technical-design.md §14 EVENT BUS
 */

export type EventType =
    | 'agent_message'
    | 'execution_start'
    | 'execution_step'
    | 'execution_end'
    | 'execution_error'
    | 'tool_call'
    | 'tool_result'
    | 'memory_read'
    | 'memory_write'
    | 'snapshot_saved'
    | 'budget_warning'
    | 'budget_exceeded'
    | 'execution_stream'

export interface IEventPayload {
    readonly type: EventType
    readonly executionId?: string
    readonly agentId?: string
    readonly data: Record<string, unknown>
    readonly timestamp: string
}

export type EventListener = (event: IEventPayload) => void

/**
 * Internal event bus used by the runtime engine.
 * Not the same as the module-facing IEventBus in @agenthub/sdk.
 */
export interface IInternalEventBus {
    emit(event: IEventPayload): void
    on(type: EventType, listener: EventListener): () => void
    /** Subscribe to all events (for logging / remote sync). */
    onAny(listener: EventListener): () => void
    /** Remove all listeners. */
    clear(): void
}
