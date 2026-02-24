/**
 * IAgentRuntime — Dependency-Injected Runtime Engine.
 *
 * Core never instantiates any adapter directly. All infrastructure is injected
 * at construction time by the app-level bootstrap layer.
 *
 * IMPORTANT: Core (Layer 2) must NOT import from infrastructure packages
 * (Layer 4: storage, provider, network). Instead, adapter types are defined
 * here as pure interfaces that infrastructure packages implement.
 *
 * See: docs/technical-design.md §3.1
 * See: docs/codebase.md Layer Rules
 */

import type { MemoryScope } from '@agenthub/shared'

// ─── Runtime Configuration ──────────────────────────────────────────────────

/**
 * Abstract storage adapter type for core.
 * Implemented by infrastructure — core never imports that package directly.
 */
export interface ICoreStorageAdapter {
    get<T>(key: string): Promise<T | null>
    set<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
    has(key: string): Promise<boolean>
}

/**
 * Abstract permission engine for core.
 * Implemented by PermissionEngine.
 */
export interface IPermissionEngine {
    check(moduleId: string, permission: string): void
    hasPermission(moduleId: string, permission: string): boolean
}

/**
 * Abstract LLM provider type for core.
 * Implemented by infrastructure — core never imports that package directly.
 *
 * Matches: docs/technical-design.md §3.2 Provider Abstraction Layer
 */
export interface ICoreLLMRequest {
    readonly model: string
    readonly systemPrompt: string
    readonly messages: readonly { readonly role: string; readonly content: string }[]
    readonly temperature: number
    readonly maxTokens: number
    readonly tools?: readonly { readonly name: string; readonly inputSchema: Record<string, unknown> }[]
}

export interface ICoreLLMResponse {
    readonly content?: string
    readonly toolCalls?: readonly { readonly id: string; readonly name: string; readonly arguments: Record<string, unknown> }[]
    readonly usage: {
        readonly promptTokens: number
        readonly completionTokens: number
    }
    readonly rawResponse: unknown
}

export interface ICoreLLMProvider {
    generate(request: ICoreLLMRequest): Promise<ICoreLLMResponse>
    generateStream(request: ICoreLLMRequest): AsyncIterable<{ readonly content?: string; readonly done: boolean }>
    embed?(text: string): Promise<number[]>
}

/**
 * Abstract vector store type for core.
 * Implemented by infrastructure — core never imports that package directly.
 */
export interface ICoreVectorStore {
    upsert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void>
    search(vector: number[], topK: number): Promise<{ readonly id: string; readonly score: number }[]>
}

/**
 * Abstract sandbox factory type for core.
 * Implemented by infrastructure — core never imports that package directly.
 */
export interface ICoreSandbox {
    execute(code: string, context: Record<string, unknown>): Promise<unknown>
    destroy(): Promise<void>
}

/**
 * Abstract transport type for core.
 * Implemented by infrastructure — core never imports that package directly.
 */
export interface ICoreTransport {
    connect(url: string): Promise<void>
    disconnect(): Promise<void>
    send(message: unknown): Promise<void>
}

/**
 * Dependency Injection config for AgentRuntime.
 *
 * Matches: docs/codebase.md §Dependency Injection Rule
 * ```
 * new AgentRuntime({ storage, provider, vectorStore, transport, sandbox })
 * ```
 */
export interface IAgentRuntimeConfig {
    /** Persistent storage adapter (e.g. SQLite for desktop, Postgres for server). */
    readonly storage: ICoreStorageAdapter
    /** LLM provider abstraction (OpenAI, Anthropic, Gemini, etc.). */
    readonly provider: ICoreLLMProvider
    /** Vector store for semantic memory search. */
    readonly vectorStore?: ICoreVectorStore
    /** Network transport for remote control (WebSocket, HTTP). */
    readonly transport?: ICoreTransport
    /** Sandbox for isolated code execution. */
    readonly sandbox: ICoreSandbox
    /** Permission engine for enforcement. */
    readonly permissionEngine: IPermissionEngine
    /** Module manager for graph resolution. */
    readonly moduleManager: any
    /** Secret vault for API keys. */
    readonly secretVault?: any
    /** Graph scheduler for executing the directed acyclic graph. */
    readonly scheduler: any // Using any to avoid circular dependency
}

// ─── Execution Context ──────────────────────────────────────────────────────

/**
 * Per-execution state maintained by the runtime engine.
 * Matches: docs/technical-design.md §3.1 Execution Context
 */
export interface IExecutionContext {
    readonly executionId: string
    readonly agentId: string
    readonly sessionId: string
    readonly graphId: string
    currentNodeId: string
    variables: Record<string, unknown>
    callStack: IAgentCallFrame[]
    /** Memory access scope for this execution. See §5.1 */
    memoryScope: MemoryScope
    tokenUsage: ITokenUsage
    budgetRemaining: number
}

export interface IAgentCallFrame {
    readonly agentId: string
    readonly graphId: string
    readonly nodeId: string
    readonly depth: number
}

export interface ITokenUsage {
    promptTokens: number
    completionTokens: number
    estimatedCost: number
}

// ─── Budget Policy ──────────────────────────────────────────────────────────

export type BudgetScope = 'agent' | 'session' | 'workspace'

export interface IBudgetPolicy {
    readonly scope: BudgetScope
    readonly maxTokens: number
    readonly maxCostUsd: number
}

// ─── Agent Runtime Interface ────────────────────────────────────────────────

export interface IAgentRuntime {
    /** Start executing an agent graph. */
    execute(agentId: string, input: Record<string, unknown>): Promise<IExecutionContext>
    /** Resume a paused execution from a snapshot. */
    resume(executionId: string): Promise<IExecutionContext>
    /** Abort a running execution. */
    abort(executionId: string): Promise<void>
}

// ─── Module System Port Interfaces ──────────────────────────────────────────
// These replace direct imports from @agenthub/sdk.
// Core defines the contracts; SDK provides the concrete types.

export interface IModuleManifestPort {
    readonly name: string
    readonly version: string
    readonly minCoreVersion: string
    readonly maxCoreVersion: string
    readonly permissions: readonly string[]
    readonly description?: string
    readonly author?: string
    readonly icon?: string
    readonly category?: string
    readonly tags?: readonly string[]
    readonly homepage?: string
    readonly graph?: any
}

export interface IModuleContextPort {
    readonly moduleId: string
    readonly ai: unknown
    readonly storage: unknown
    readonly ui: unknown
    readonly events: unknown
}

export interface IToolPort {
    readonly name: string
    readonly description: string
    readonly inputSchema?: Record<string, unknown>
    run(input: Record<string, unknown>, ctx: IModuleContextPort): Promise<unknown>
}

export interface IModuleDefinitionPort {
    manifest: IModuleManifestPort
    tools: IToolPort[]
    onActivate(ctx: IModuleContextPort): void | Promise<void>
    onDeactivate?(ctx: IModuleContextPort): void | Promise<void>
}

export interface IAppPackagePort {
    manifest: IModuleManifestPort
    checksum: string
    signature: string
    entryPath: string
}

export interface IModuleManagerPort {
    install(pkg: IAppPackagePort): Promise<void>
    activate(moduleId: string): Promise<void>
    deactivate(moduleId: string): Promise<void>
    uninstall(moduleId: string): Promise<void>
    getActive(): ReadonlyMap<string, IModuleDefinitionPort>
}

export interface IPermissionEnginePort {
    grant(moduleId: string, permissions: readonly string[]): void
    revoke(moduleId: string): void
    check(moduleId: string, permission: string): void
    hasPermission(moduleId: string, permission: string): boolean
}

// ─── Sandbox Factory Port ───────────────────────────────────────────────────

export interface IModuleSandboxHandlePort {
    activate(): Promise<void>
    deactivate(): Promise<void>
    getCtx(): IModuleContextPort | null
}

export interface ISandboxFactoryPort {
    create(moduleId: string, definition: IModuleDefinitionPort): IModuleSandboxHandlePort
}
