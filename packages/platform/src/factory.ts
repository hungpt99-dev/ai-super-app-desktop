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
    IAgentRuntimeConfig,
} from '@agenthub/core'
import { GraphScheduler, WorkerManager } from '@agenthub/execution'
import { logger } from '@agenthub/shared'

const log = logger.child('Platform')

export interface IRuntimeConfig {
    readonly storage: ICoreStorageAdapter
    readonly provider: ICoreLLMProvider
    readonly sandbox: ICoreSandbox
    readonly vectorStore?: ICoreVectorStore
    readonly sandboxFactory?: ISandboxFactoryPort
    readonly secretVault?: unknown
    readonly coreVersion?: string
}

export interface IRuntimeBundle {
    readonly runtime: AgentRuntime
    readonly permissionEngine: PermissionEngine
    readonly moduleManager: ModuleManager
    readonly scheduler: GraphScheduler
    readonly workerManager: WorkerManager
}

export function createRuntime(config: IRuntimeConfig): IRuntimeBundle {
    log.info('Creating AgentRuntime via platform factory')

    const permissionEngine = new PermissionEngine()
    const coreVersion = config.coreVersion ?? '1.0.0'

    const sandboxFactory: ISandboxFactoryPort = config.sandboxFactory ?? {
        create: () => ({
            activate: async () => {},
            deactivate: async () => {},
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

    const runtimeConfig: Record<string, unknown> = {
        storage: config.storage,
        provider: config.provider,
        sandbox: config.sandbox,
        permissionEngine,
        moduleManager,
        secretVault: config.secretVault,
        scheduler,
    }
    if (config.vectorStore !== undefined) {
        runtimeConfig['vectorStore'] = config.vectorStore
    }

    const runtime = new AgentRuntime(runtimeConfig as any)

    log.info('AgentRuntime created successfully')

    return {
        runtime,
        permissionEngine,
        moduleManager,
        scheduler,
        workerManager,
    }
}
