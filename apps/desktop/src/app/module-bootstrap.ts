import { createRuntime, type IRuntimeBundle } from '@agenthub/platform'
import { OpenaiProviderAdapter } from '@agenthub/provider'
import { CoreSandboxAdapter } from '@agenthub/sandbox'
import { AgentRuntimeTauriStorage } from '../bridges/tauri-storage.js'
import { TauriVectorStore } from '../bridges/tauri-vector-store.js'
import { TauriMemoryStore } from '../bridges/tauri-memory-store.js'
import { TauriSecretVault } from '../bridges/tauri-secret-vault.js'
import { BUILTIN_MODULES } from './builtin-modules.js'
import { logger } from '@agenthub/shared'
import type { AgentRuntime, ModuleManager } from '@agenthub/core'

class StubSandboxHandle {
  constructor(private readonly sandbox: any) { }
  async activate() { await this.sandbox.activate?.() }
  async deactivate() { await this.sandbox.deactivate?.() }
  getCtx() { return (this.sandbox as any).ctx || null }
}

const log = logger.child('ModuleBootstrap')

let _bundle: IRuntimeBundle | null = null
let _memoryManager: TauriMemoryStore | null = null

export async function initAgentRuntime(): Promise<AgentRuntime> {
  if (_bundle) return _bundle.runtime

  // 1. Foundation — desktop-specific adapters
  const storage = new AgentRuntimeTauriStorage('agent-runtime.json')
  const provider = new OpenaiProviderAdapter('dummy-key') // Will be populated from UI vault later
  _memoryManager = new TauriMemoryStore('agent-memory.json') as any
  const vectorStore = new TauriVectorStore('agent-vectors.json')

  // 2. Sandbox
  const sandbox = new CoreSandboxAdapter()

  // 3. Create runtime via platform factory (single approved path)
  _bundle = createRuntime({
    storage,
    provider,
    sandbox,
    vectorStore,
    secretVault: new TauriSecretVault(),
    sandboxFactory: {
      create: () => new StubSandboxHandle(sandbox) as any
    },
  })

  log.info('AgentRuntime initialized via platform factory and ready.')
  return _bundle.runtime
}

export function getAgentRuntime(): AgentRuntime | null {
  return _bundle?.runtime ?? null
}

export function getMemoryStore(): any | null {
  return _memoryManager
}

export function getModuleManager(): ModuleManager | null {
  return _bundle?.moduleManager ?? null
}

// Temporary shim to support UI module listing until UI is decoupled
export function getActiveModules() {
  return BUILTIN_MODULES
}
