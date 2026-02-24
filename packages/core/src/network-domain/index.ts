/**
 * Network Package — transport and protocol for remote control.
 *
 * Network layer does not know runtime logic. Only transmits messages.
 * No business logic.
 *
 * See: docs/technical-design.md §11 REMOTE CONTROL ARCHITECTURE
 * See: docs/codebase.md Network Rule
 */

// ─── Transport ──────────────────────────────────────────────────────────────

export type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ITransport {
    readonly status: TransportStatus
    /** Connect to the remote endpoint. */
    connect(url: string): Promise<void>
    /** Disconnect from the remote endpoint. */
    disconnect(): Promise<void>
    /** Send a message to the remote endpoint. */
    send(message: IProtocolMessage): Promise<void>
    /** Subscribe to incoming messages. Returns an unsubscribe function. */
    onMessage(handler: (message: IProtocolMessage) => void): () => void
    /** Subscribe to connection status changes. */
    onStatusChange(handler: (status: TransportStatus) => void): () => void
}

// ─── Protocol ───────────────────────────────────────────────────────────────

export type ProtocolAction =
    | 'start_execution'
    | 'subscribe_events'
    | 'inject_memory'
    | 'approve_checkpoint'
    | 'abort_execution'
    | 'heartbeat'

export interface IProtocolMessage {
    readonly action: ProtocolAction
    readonly executionId?: string
    readonly payload: Record<string, unknown>
    readonly timestamp: string
}

// ─── Protocol Handler ───────────────────────────────────────────────────────

export interface IProtocolHandler {
    /** Handle an incoming protocol message. */
    handle(message: IProtocolMessage): Promise<IProtocolMessage | null>
}

// Adapters moved to infrastructure
