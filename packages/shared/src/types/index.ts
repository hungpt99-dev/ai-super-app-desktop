/**
 * Shared domain types used across all packages.
 *
 * See: docs/technical-design.md for the full type catalog.
 */

// ─── Disposable ─────────────────────────────────────────────────────────────

/** Standard cleanup interface for resources that need explicit release. */
export interface IDisposable {
    dispose(): void | Promise<void>
}

/** Helper: cleanup multiple disposables in reverse order. */
export async function disposeAll(disposables: IDisposable[]): Promise<void> {
    for (let i = disposables.length - 1; i >= 0; i--) {
        await disposables[i]!.dispose()
    }
}

// ─── Health Check ───────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface IHealthCheck {
    /** Unique service name, e.g. 'storage', 'provider:openai'. */
    readonly name: string
    /** Check service health. */
    check(): Promise<IHealthResult>
}

export interface IHealthResult {
    readonly status: HealthStatus
    readonly message?: string
    readonly latencyMs?: number
    readonly timestamp: string
}

// ─── Agent Lifecycle ────────────────────────────────────────────────────────

export type AgentLifecycleState =
    | 'idle'
    | 'initializing'
    | 'running'
    | 'waiting_approval'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'aborted'

// ─── Marketplace Manifest ───────────────────────────────────────────────────

export interface IAgentPackageManifest {
    readonly name: string
    readonly version: string
    readonly engineVersion: string
    readonly author: string
    readonly description: string
    readonly permissions: readonly string[]
    readonly signature: string
}

// ─── Snapshot ───────────────────────────────────────────────────────────────

export interface ISnapshotContent {
    readonly executionId: string
    readonly graphId: string
    readonly nodePointer: string
    readonly variables: Readonly<Record<string, unknown>>
    readonly callStack: readonly string[]
    readonly timestamp: string
}

// ─── Cost Tracking ──────────────────────────────────────────────────────────

export interface ITokenTrackingRecord {
    readonly executionId: string
    readonly agentId: string
    readonly model: string
    readonly promptTokens: number
    readonly completionTokens: number
    readonly estimatedCostUsd: number
    readonly timestamp: string
}

/**
 * All permission types used in the system.
 * Must stay in sync with SDK Permission enum.
 *
 * See: docs/technical-design.md §10.1 Permission Model
 */
export type PermissionType =
    | 'ai.generate'
    | 'ai.stream'
    | 'storage.read'
    | 'storage.write'
    | 'network.fetch'
    | 'memory.read'
    | 'memory.write'
    | 'computer.screenshot'
    | 'computer.input'
    | 'computer.clipboard'
    | 'computer.shell'
    | 'computer.files'
    | 'tool.execute'
    | 'agent.call'
    | 'filesystem'

// ─── Memory Scope (shared so core Layer 2 can use it) ───────────────────────

/**
 * Memory scope for execution context.
 * See: docs/technical-design.md §5.1 Memory Layers
 */
export type MemoryScope = 'working' | 'session' | 'long-term'

// ─── UI Bridge ──────────────────────────────────────────────────────────────

/**
 * UI Bridge API — sandboxed iframe communication.
 * See: docs/technical-design.md §13.1 UI Bundle
 */
export interface IUIBridgeAPI {
    /** Trigger a named action in the module's UI. */
    invokeAction(actionName: string, payload?: Record<string, unknown>): void
    /** Subscribe to state changes from the module's execution context. */
    subscribeState(handler: (state: Record<string, unknown>) => void): () => void
    /** Forward user input to the module for processing. */
    sendUserInput(input: string): void
}
