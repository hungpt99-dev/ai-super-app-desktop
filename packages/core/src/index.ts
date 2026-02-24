// ── Runtime implementations ─────────────────────────────────────────────────
export { PermissionEngine } from './runtime/permission-engine.js'
export { ModuleManager } from './runtime/module-manager.js'
export type { IModuleSandboxHandle } from './runtime/module-manager.js'
export { AgentRuntime } from './runtime/agent-runtime.js'
export type { ISandboxFactory } from './runtime/types.js'
export * from './runtime/interfaces.js'

// ── Legacy re-exports (backward-compat) ─────────────────────────────────────
export * from './graph/interfaces.js'
export * from './orchestrator/interfaces.js'
export * from './events/event-bus.js'
export { InternalEventBus } from './events/event-bus.impl.js'
export * from './agents/interfaces.js'
export * from './memory/index.js'
export * from './identity/index.js'
export * from './capability/index.js'
export * from './policy/index.js'

// ── Domain Subdomains (Clean Architecture v4.1) ─────────────────────────────
// Exported as namespaces to avoid name collisions with legacy types.
// Usage: import { AgentDomain, GraphDomain } from '@agenthub/core'
export * as AgentDomain from './agent-domain/index.js'
export * as GraphDomain from './graph-domain/index.js'
export * as PolicyDomain from './policy-domain/index.js'
export * as MemoryDomain from './memory-domain/index.js'
export * as IdentityDomain from './identity-domain/index.js'
export * as CapabilityDomain from './capability-domain/index.js'
export * as EventDomain from './event-domain/index.js'
export * as RuntimeDomain from './runtime-domain/index.js'
export * from './provider-domain/index.js'
export * from './sandbox-domain/index.js'
export * from './storage-domain/index.js'
export * from './network-domain/index.js'

// ── New domain ports (Clean Architecture v4.1) ──────────────────────────────
export * as SnapshotDomain from './snapshot-domain/index.js'
export * as VersioningDomain from './versioning-domain/index.js'

// ── Extended domain ports (Platform v2) ─────────────────────────────────────
export * as GovernanceDomain from './governance-domain/index.js'
export * as PluginDomain from './plugin-domain/index.js'
export * as WorkspaceDomain from './workspace-domain/index.js'
export * as ObservabilityDomain from './observability-domain/index.js'
export * as ModelDomain from './model-domain/index.js'
export * as SecurityDomain from './security-domain/index.js'
