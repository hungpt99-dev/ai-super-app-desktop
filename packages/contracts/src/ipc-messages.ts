/**
 * IPC Messages — typed message envelopes for main ↔ renderer communication.
 *
 * All IPC calls between the Tauri main process and the renderer UI
 * MUST use these typed envelopes. The renderer never imports core
 * or infrastructure directly — it uses the SDK or IPC bridge.
 *
 * See: docs/technical-design.md §14 IPC ARCHITECTURE
 */

// ─── IPC Channel Names ─────────────────────────────────────────────────────

export type IPCChannel =
    | 'runtime:init'
    | 'runtime:status'
    | 'agent:create'
    | 'agent:start'
    | 'agent:stop'
    | 'agent:status'
    | 'agent:list'
    | 'module:invoke-tool'
    | 'module:list'
    | 'module:activate'
    | 'module:deactivate'
    | 'memory:query'
    | 'memory:store'
    | 'storage:get'
    | 'storage:set'
    | 'execution:progress'
    | 'execution:events'
    | 'permission:request'
    | 'permission:response'

// ─── IPC Request Envelope ───────────────────────────────────────────────────

export interface IIPCRequest<T = unknown> {
    readonly channel: IPCChannel
    readonly requestId: string
    readonly payload: T
    readonly timestamp: string
}

// ─── IPC Response Envelope ──────────────────────────────────────────────────

export interface IIPCResponse<T = unknown> {
    readonly channel: IPCChannel
    readonly requestId: string
    readonly success: boolean
    readonly data?: T
    readonly error?: {
        readonly code: string
        readonly message: string
    }
    readonly timestamp: string
}

// ─── IPC Event (push from main → renderer) ──────────────────────────────────

export interface IIPCEvent<T = unknown> {
    readonly channel: IPCChannel
    readonly eventId: string
    readonly data: T
    readonly timestamp: string
}

// ─── Specific IPC Payloads ──────────────────────────────────────────────────

export interface IModuleInvokePayload {
    readonly moduleId: string
    readonly toolName: string
    readonly input: Record<string, unknown>
}

export interface IPermissionRequestPayload {
    readonly moduleId: string
    readonly permission: string
    readonly reason: string
}

export interface IPermissionResponsePayload {
    readonly moduleId: string
    readonly permission: string
    readonly granted: boolean
}

export interface IRuntimeStatusPayload {
    readonly initialized: boolean
    readonly agentCount: number
    readonly moduleCount: number
    readonly uptime: number
}
