import type { IExecutionContext, ISnapshotContent, IPlugin, PluginType, ExecutionLifecycleState } from './types.js'

export interface IStoragePort {
    get<T>(key: string): Promise<T | null>
    set<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
    has(key: string): Promise<boolean>
}

export interface ILLMProviderPort {
    generate(request: ILLMRequest): Promise<ILLMResponse>
    generateStream(request: ILLMRequest): AsyncIterable<ILLMStreamChunk>
}

export interface ILLMRequest {
    readonly model: string
    readonly systemPrompt: string
    readonly messages: readonly ILLMMessage[]
    readonly temperature: number
    readonly maxTokens: number
    readonly tools?: readonly IToolSchema[]
}

export interface ILLMMessage {
    readonly role: 'system' | 'user' | 'assistant' | 'tool'
    readonly content: string
    readonly name?: string
    readonly toolCallId?: string
}

export interface ILLMResponse {
    readonly content?: string
    readonly toolCalls?: readonly IToolCallResult[]
    readonly usage: { readonly promptTokens: number; readonly completionTokens: number }
    readonly rawResponse: unknown
}

export interface ILLMStreamChunk {
    readonly content?: string
    readonly toolCalls?: readonly IToolCallResult[]
    readonly done: boolean
}

export interface IToolCallResult {
    readonly id: string
    readonly name: string
    readonly arguments: Record<string, unknown>
}

export interface IToolSchema {
    readonly name: string
    readonly description: string
    readonly inputSchema: Readonly<Record<string, unknown>>
}

export interface ISandboxPort {
    execute(code: string, context: Readonly<Record<string, unknown>>): Promise<unknown>
    destroy(): Promise<void>
}

export interface ITransportPort {
    connect(url: string): Promise<void>
    disconnect(): Promise<void>
    send(message: Readonly<Record<string, unknown>>): Promise<void>
}

export interface ISnapshotPort {
    save(snapshot: ISnapshotContent): Promise<void>
    load(executionId: string): Promise<ISnapshotContent | null>
    list(agentId: string): Promise<readonly ISnapshotContent[]>
    delete(executionId: string): Promise<void>
}

export interface IReplayPort {
    loadExecution(executionId: string): Promise<readonly ISnapshotContent[]>
    getResponse(nodePointer: string): Promise<Readonly<Record<string, unknown>> | null>
}

export interface IObservabilityPort {
    recordMetric(name: string, value: number, tags?: Readonly<Record<string, string>>): void
    recordTrace(executionId: string, nodeId: string, durationMs: number): void
}

export interface IPermissionPort {
    grant(moduleId: string, permissions: readonly string[]): void
    revoke(moduleId: string): void
    check(moduleId: string, permission: string): void
    hasPermission(moduleId: string, permission: string): boolean
}

export interface IModuleManifestPort {
    readonly name: string
    readonly version: string
    readonly minCoreVersion: string
    readonly maxCoreVersion: string
    readonly permissions: readonly string[]
    readonly description?: string
    readonly author?: string
}

export interface IToolPort {
    readonly name: string
    readonly description: string
    readonly inputSchema?: Readonly<Record<string, unknown>>
    run(input: Readonly<Record<string, unknown>>, ctx: unknown): Promise<unknown>
}

export interface IModuleDefinitionPort {
    manifest: IModuleManifestPort
    tools: IToolPort[]
    onActivate(ctx: unknown): void | Promise<void>
    onDeactivate?(ctx: unknown): void | Promise<void>
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

export interface ISandboxFactoryPort {
    create(moduleId: string, definition: IModuleDefinitionPort): IModuleSandboxHandlePort
}

export interface IModuleSandboxHandlePort {
    activate(): Promise<void>
    deactivate(): Promise<void>
    getCtx(): unknown
}

export interface IPluginRegistry {
    register(plugin: IPlugin): void
    unregister(name: string): void
    get(name: string): IPlugin | null
    list(type?: PluginType): IPlugin[]
}

export interface IAgentRuntime {
    execute(agentId: string, input: Readonly<Record<string, unknown>>): Promise<IExecutionContext>
    resume(executionId: string): Promise<IExecutionContext>
    abort(executionId: string): Promise<void>
}

export interface ILifecycleStateMachine {
    readonly currentState: ExecutionLifecycleState
    transition(to: ExecutionLifecycleState): void
    canTransition(to: ExecutionLifecycleState): boolean
}

export interface IAgentRuntimeConfig {
    readonly storage: IStoragePort
    readonly provider: ILLMProviderPort
    readonly vectorStore?: unknown
    readonly transport?: ITransportPort
    readonly sandbox: ISandboxPort
    readonly permissionEngine: IPermissionPort
    readonly moduleManager: IModuleManagerPort
    readonly secretVault?: unknown
    readonly scheduler: unknown
    readonly snapshotStore?: ISnapshotPort
    readonly observability?: IObservabilityPort
}
