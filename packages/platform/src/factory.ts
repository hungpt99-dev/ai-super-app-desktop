/**
 * Runtime factory — the single place where AgentRuntime is instantiated.
 *
 * Apps MUST use createRuntime() instead of `new AgentRuntime(...)`.
 * This enforces that all wiring goes through the platform layer.
 */

import {
    AgentRuntime,
    PermissionEngine,
    ModuleManager,
} from '@agenthub/core'
import type {
    ICoreStorageAdapter,
    ICoreLLMProvider,
    ICoreSandbox,
    ICoreVectorStore,
    ISandboxFactoryPort,
    IPermissionEnginePort,
    IModuleManagerPort,
    IAgentRuntimeConfig,
} from '@agenthub/core'
import { GraphScheduler, WorkerManager } from '@agenthub/execution'
import { logger } from '@agenthub/shared'

const log = logger.child('Platform')

// ─── Runtime Config ─────────────────────────────────────────────────────────

export interface IRuntimeConfig {
    /** Storage adapter (SQLite, Tauri, etc.). */
    storage: ICoreStorageAdapter
    /** LLM provider adapter. */
    provider: ICoreLLMProvider
    /** Sandbox adapter for code execution. */
    sandbox: ICoreSandbox
    /** Vector store adapter. */
    vectorStore: ICoreVectorStore
    /** Secret vault for API keys. */
    secretVault?: any
    /** Sandbox factory for creating module sandboxes. */
    sandboxFactory?: ISandboxFactoryPort
    /** Core version string. Defaults to '1.0.0'. */
    coreVersion?: string
}

// ─── Factory Function ───────────────────────────────────────────────────────

export interface IRuntimeBundle {
    runtime: AgentRuntime
    permissionEngine: PermissionEngine
    moduleManager: ModuleManager
    scheduler: GraphScheduler
    workerManager: WorkerManager
}

/**
 * Create a fully wired AgentRuntime.
 *
 * This is the ONLY approved way to instantiate the runtime.
 * All adapters are injected here — no `new AgentRuntime()` elsewhere.
 */
export function createRuntime(config: IRuntimeConfig): IRuntimeBundle {
    log.info('Creating AgentRuntime via platform factory')

    const permissionEngine = new PermissionEngine()
    const coreVersion = config.coreVersion ?? '1.0.0'

    const sandboxFactory: ISandboxFactoryPort = config.sandboxFactory ?? {
        create: () => ({
            activate: async () => { },
            deactivate: async () => { },
            getCtx: () => null,
        }),
    }

    const moduleManager = new ModuleManager(
        permissionEngine,
        coreVersion,
        sandboxFactory,
    )

    const scheduler = new GraphScheduler()
    const workerManager = new WorkerManager()

    const runtime = new AgentRuntime({
        storage: config.storage,
        provider: config.provider,
        sandbox: config.sandbox,
        permissionEngine,
        moduleManager,
        secretVault: config.secretVault,
        vectorStore: config.vectorStore,
        scheduler,
    })

    log.info('AgentRuntime created successfully')

    return {
        runtime,
        permissionEngine,
        moduleManager,
        scheduler,
        workerManager,
    }
}
