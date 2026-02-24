/**
 * PlatformHost — composition root for the desktop main process.
 *
 * This is the ONLY file that wires together core, execution, infrastructure,
 * and platform. The renderer process NEVER imports from these packages directly.
 *
 * Dependency flow:
 *   PlatformHost → createRuntime() → AgentRuntime
 *                → infrastructure adapters (storage, provider, sandbox)
 *                → module system
 *
 * See: docs/technical-design.md §14 IPC ARCHITECTURE
 */

import { createRuntime, type IRuntimeBundle } from '@agenthub/platform'
import { OpenaiProviderAdapter, CoreSandboxAdapter } from '@agenthub/infrastructure'
import { logger } from '@agenthub/shared'
import type { AgentRuntime, ModuleManager, PermissionEngine } from '@agenthub/core'

const log = logger.child('PlatformHost')

export class PlatformHost {
    private bundle: IRuntimeBundle | null = null

    get runtime(): AgentRuntime | null {
        return this.bundle?.runtime ?? null
    }

    get moduleManager(): ModuleManager | null {
        return this.bundle?.moduleManager ?? null
    }

    get permissionEngine(): PermissionEngine | null {
        return this.bundle?.permissionEngine ?? null
    }

    get isInitialized(): boolean {
        return this.bundle !== null
    }

    async initialize(config: {
        storage: unknown
        providerApiKey: string
        vectorStore?: unknown
        secretVault?: unknown
    }): Promise<AgentRuntime> {
        if (this.bundle) {
            log.warn('PlatformHost already initialized, returning existing runtime')
            return this.bundle.runtime
        }

        const provider = new OpenaiProviderAdapter(config.providerApiKey)
        const sandbox = new CoreSandboxAdapter()

        class StubSandboxHandle {
            constructor(private readonly sandbox: unknown) { }
            async activate() { await (this.sandbox as any).activate?.() }
            async deactivate() { await (this.sandbox as any).deactivate?.() }
            getCtx() { return (this.sandbox as any).ctx || null }
        }

        this.bundle = createRuntime({
            storage: config.storage as any,
            provider,
            sandbox,
            vectorStore: config.vectorStore as any,
            secretVault: config.secretVault,
            sandboxFactory: {
                create: () => new StubSandboxHandle(sandbox) as any,
            },
        })

        log.info('PlatformHost initialized successfully')
        return this.bundle.runtime
    }

    async shutdown(): Promise<void> {
        log.info('PlatformHost shutting down')
        this.bundle = null
    }
}

/** Singleton PlatformHost instance for the desktop main process. */
export const platformHost = new PlatformHost()
