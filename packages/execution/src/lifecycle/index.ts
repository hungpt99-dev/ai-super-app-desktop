/**
 * Execution lifecycle — state machine for agent execution.
 *
 * Execution defines its own port interfaces (matching core's contracts)
 * so it depends only on @agenthub/shared, NOT on @agenthub/core.
 *
 * See: docs/technical-design.md §9 EXECUTION ENGINE
 */

// ─── Execution State ────────────────────────────────────────────────────────

export type ExecutionState =
    | 'idle'
    | 'running'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'aborted'

// ─── Execution Port Interfaces ──────────────────────────────────────────────
// Locally defined — execution does NOT import from @agenthub/core.

export interface IExecStoragePort {
    get<T>(key: string): Promise<T | null>
    set<T>(key: string, value: T): Promise<void>
}

export interface IExecProviderPort {
    generate(request: unknown): Promise<unknown>
    generateStream(request: unknown): AsyncIterable<unknown>
}

export interface IExecSandboxPort {
    execute(code: string, context: Record<string, unknown>): Promise<unknown>
}

export interface IExecPermissionPort {
    check(moduleId: string, permission: string): void
    hasPermission(moduleId: string, permission: string): boolean
}

// ─── Execution Environment ──────────────────────────────────────────────────

export interface IExecutionEnvironment {
    storage: IExecStoragePort
    provider: IExecProviderPort
    sandbox: IExecSandboxPort
    permissionEngine: IExecPermissionPort
}

// ─── Execution Lifecycle ────────────────────────────────────────────────────

/**
 * IExecutionLifecycle — state machine for one agent run.
 * The platform layer maps core adapters to these execution ports.
 */
export interface IExecutionLifecycle {
    readonly executionId: string
    readonly state: ExecutionState
    readonly signal: AbortSignal
    readonly env: IExecutionEnvironment

    transition(to: ExecutionState): void
    snapshot(): Promise<void>
}
