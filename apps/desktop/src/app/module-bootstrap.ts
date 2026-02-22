import { AgentRuntime, PermissionEngine, ModuleManager } from '@agenthub/core'
// import { StorageSqliteAdapter } from '@agenthub/storage' // Node-only
import { SqliteMemoryStore } from '@agenthub/storage'
import { OpenaiProviderAdapter } from '@agenthub/provider'
import { WorkerManager, GraphScheduler } from '@agenthub/execution'
import { CoreSandboxAdapter } from '@agenthub/sandbox'
import { AgentRuntimeTauriStorage } from '../bridges/tauri-storage.js'
import { TauriVectorStore } from '../bridges/tauri-vector-store.js'
import { TauriMemoryStore } from '../bridges/tauri-memory-store.js'
import { TauriSecretVault } from '../bridges/tauri-secret-vault.js'
import { BUILTIN_MODULES } from './builtin-modules.js'
import { logger } from '@agenthub/shared'

class StubSandboxHandle {
  constructor(private readonly sandbox: any) { }
  async activate() { await this.sandbox.activate?.() }
  async deactivate() { await this.sandbox.deactivate?.() }
  getCtx() { return (this.sandbox as any).ctx || null }
}

const log = logger.child('ModuleBootstrap')

let _runtime: AgentRuntime | null = null
let _workerManager: WorkerManager | null = null
let _scheduler: GraphScheduler | null = null
let _memoryManager: TauriMemoryStore | null = null
let _moduleManager: ModuleManager | null = null

export async function initAgentRuntime(): Promise<AgentRuntime> {
  if (_runtime) return _runtime

  // 1. Foundation
  const storage = new AgentRuntimeTauriStorage('agent-runtime.json')
  const provider = new OpenaiProviderAdapter('dummy-key') // Will be populated from UI vault later
  _memoryManager = new TauriMemoryStore('agent-memory.json') as any
  const vectorStore = new TauriVectorStore('agent-vectors.json')

  // 3. Sandbox
  const sandbox = new CoreSandboxAdapter()
  const permissionEngine = new PermissionEngine()
  _moduleManager = new ModuleManager(permissionEngine as any, '1.0.0', {
    create: () => new StubSandboxHandle(sandbox) as any
  })

  // 2. Engine Core
  _scheduler = new GraphScheduler()
  _workerManager = new WorkerManager()

  _runtime = new AgentRuntime({
    storage,
    provider,
    sandbox,
    permissionEngine,
    moduleManager: _moduleManager,
    secretVault: new TauriSecretVault(),
    vectorStore,
    scheduler: _scheduler
  })

  log.info('AgentRuntime initialized and ready.')
  return _runtime
}

export function getAgentRuntime(): AgentRuntime | null {
  return _runtime
}

export function getMemoryStore(): any | null {
  return _memoryManager
}

export function getModuleManager(): ModuleManager | null {
  return _moduleManager
}

// Temporary shim to support UI module listing until UI is decoupled
export function getActiveModules() {
  return BUILTIN_MODULES
}
