// ─── Core Package ─────────────────────────────────────────────────────────────
// Pure runtime engine — NO UI, NO Tauri, NO direct DB, NO direct provider.
// Core only uses interfaces; adapters are injected at app bootstrap.
// Core does NOT depend on @agenthub/sdk — it defines its own port interfaces.

export { PermissionEngine } from './runtime/permission-engine.js'
export { ModuleManager } from './runtime/module-manager.js'
export type { IModuleSandboxHandle } from './runtime/module-manager.js'
export { AgentRuntime } from './runtime/agent-runtime.js'
export type { ISandboxFactory } from './runtime/types.js'
export * from './runtime/interfaces.js'
export * from './graph/interfaces.js'
export * from './orchestrator/interfaces.js'
export * from './events/event-bus.js'
export { InternalEventBus } from './events/event-bus.impl.js'
export * from './agents/interfaces.js'

// ─── Memory Domain ──────────────────────────────────────────────────────────
export * from './memory/index.js'

// ─── Identity Domain ────────────────────────────────────────────────────────
export * from './identity/index.js'

// ─── Capability Domain ──────────────────────────────────────────────────────
export * from './capability/index.js'

// ─── Policy Domain ──────────────────────────────────────────────────────────
export * from './policy/index.js'

// ─── Plugin System (§18 EXTENSIBILITY) ──────────────────────────────────────

export type PluginType = 'tool' | 'provider' | 'memory_backend' | 'ui_component'

export interface IPlugin {
    readonly name: string
    readonly type: PluginType
    readonly version: string
}

export interface IPluginRegistry {
    register(plugin: IPlugin): void
    unregister(name: string): void
    get(name: string): IPlugin | null
    list(type?: PluginType): IPlugin[]
}
