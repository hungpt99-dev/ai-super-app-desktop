/**
 * RuntimeHost — manages the agent runtime lifecycle for the desktop main process.
 *
 * Coordinates initialization, module registration, agent loop management,
 * and graceful shutdown. Delegates to PlatformHost for the composition root
 * and to the IPC bridge for renderer communication.
 *
 * See: docs/technical-design.md §14 IPC ARCHITECTURE
 */

import { platformHost } from './platform-host.js'
import { AgentRuntimeTauriStorage } from '../bridges/tauri-storage.js'
import { TauriVectorStore } from '../bridges/tauri-vector-store.js'
import { TauriSecretVault } from '../bridges/tauri-secret-vault.js'
import { BUILTIN_MODULES } from '../app/builtin-modules.js'
import { startAgentLoop, stopAgentLoop } from '../app/agent-loop.js'
import { logger } from '@agenthub/shared'
import type { AgentRuntime } from '@agenthub/core'

const log = logger.child('RuntimeHost')

export class RuntimeHost {
    private initialized = false

    async start(): Promise<AgentRuntime> {
        if (this.initialized) {
            log.warn('RuntimeHost already started')
            return platformHost.runtime!
        }

        log.info('Starting RuntimeHost')

        const storage = new AgentRuntimeTauriStorage('agent-runtime.json')
        const vectorStore = new TauriVectorStore('agent-vectors.json')
        const secretVault = new TauriSecretVault()

        const runtime = await platformHost.initialize({
            storage,
            providerApiKey: 'dummy-key',
            vectorStore,
            secretVault,
        })

        this.initialized = true
        log.info('RuntimeHost started successfully')
        return runtime
    }

    getBuiltinModules() {
        return BUILTIN_MODULES
    }

    async startAgentLoop(): Promise<void> {
        await startAgentLoop()
    }

    stopAgentLoop(): void {
        stopAgentLoop()
    }

    async shutdown(): Promise<void> {
        log.info('RuntimeHost shutting down')
        stopAgentLoop()
        await platformHost.shutdown()
        this.initialized = false
    }
}

/** Singleton RuntimeHost instance. */
export const runtimeHost = new RuntimeHost()
