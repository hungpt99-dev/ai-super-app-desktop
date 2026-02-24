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
 *
 * See: docs/technical-design.md §10.1 Permission Model
 */
export enum Permission {
  AiGenerate = 'ai.generate',
  AiStream = 'ai.stream',
  StorageLocal = 'storage.local',
  StorageRead = 'storage.read',
  StorageWrite = 'storage.write',
  UiNotify = 'ui.notify',
  UiDashboard = 'ui.dashboard',
  EventsPublish = 'events.publish',
  EventsSubscribe = 'events.subscribe',
  // ── Computer-use permissions ──────────────────────────────────────────────
  /** Capture screenshots (requires Screen Recording on macOS). */
  ComputerScreenshot = 'computer.screenshot',
  /** Control mouse and keyboard (requires Accessibility on macOS). */
  ComputerInput = 'computer.input',
  /** Read/write the system clipboard. */
  ComputerClipboard = 'computer.clipboard',
  /** Launch OS applications and run shell commands. HIGH RISK — user approval required. */
  ComputerShell = 'computer.shell',
  /** Read and write local files. HIGH RISK — user approval required. */
  ComputerFiles = 'computer.files',
  // ── Memory permissions ────────────────────────────────────────────────────
  /** Read from the local persistent memory store. */
  MemoryRead = 'memory.read',
  /** Write to (and delete from) the local persistent memory store. */
  MemoryWrite = 'memory.write',
  /**
   * Write to the workspace-level shared knowledge base (`scope = "workspace:shared"`).
   * Read is always allowed with `MemoryRead`. Without this permission, a module
   * can only write to its own private scope (`agent:{moduleId}`).
   */
  MemorySharedWrite = 'memory.shared-write',
  /**
   * Make outbound HTTP/HTTPS requests to any URL.
   * Covers `ctx.http.get/post/put/patch/delete/request`.
   */
  NetworkFetch = 'network.fetch',
  // ── Agent permissions (§10 Security Architecture) ──────────────────────────
  /** Call another agent (AGENT_CALL_NODE). Enforced by orchestrator. */
  AgentCall = 'agent.call',
  /** Execute a registered tool. Enforced by sandbox. */
  ToolExecute = 'tool.execute',
  /** Access the local filesystem. HIGH RISK — user approval required. */
  Filesystem = 'filesystem',
}

export type PermissionType = Permission

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
