/**
 * DesktopPlatformExtension — extends the base platform with desktop-specific adapters.
 *
 * Wires LocalSnapshotStorageAdapter, SemanticVersioningAdapter, and
 * LocalFileStorageAdapter into the platform composition root.
 *
 * Also wires Platform v2 services: Governance, Plugin Runtime, Workspace Manager,
 * Observability, Model Router, and Security adapters.
 *
 * This is the ONLY place where desktop infrastructure adapters are instantiated
 * at the platform level.
 */

import type {
    SnapshotDomain,
    VersioningDomain,
    GovernanceDomain,
    PluginDomain,
    WorkspaceDomain,
    ObservabilityDomain,
    ModelDomain,
    SecurityDomain,
} from '@agenthub/core'
import type { IRuntimeBundle } from './factory.js'

export interface IDesktopPlatformConfig {
    readonly snapshotStorage: SnapshotDomain.ISnapshotStoragePort
    readonly versioning: VersioningDomain.IVersioningPort
    readonly agentStoragePath: string
    readonly skillStoragePath: string
    // Platform v2 — optional to maintain backward compat
    readonly governance?: {
        readonly policyEngine: GovernanceDomain.IPolicyEnginePort
        readonly budgetManager: GovernanceDomain.IBudgetManagerPort
        readonly rateLimiter: GovernanceDomain.IRateLimiterPort
        readonly modelRegistry: GovernanceDomain.IModelRegistryPort
    }
    readonly pluginRegistry?: PluginDomain.IPluginRegistryPort
    readonly workspaceManager?: WorkspaceDomain.IWorkspaceManagerPort
    readonly observability?: {
        readonly tracing: ObservabilityDomain.ITracingPort
        readonly metrics: ObservabilityDomain.IMetricsPort
        readonly logStream: ObservabilityDomain.IStructuredLogStream
    }
    readonly modelRouter?: ModelDomain.IModelRouter
    readonly costCalculator?: ModelDomain.ICostCalculator
    readonly security?: {
        readonly secretVault: SecurityDomain.ISecretVaultPort
        readonly encryptedStorage: SecurityDomain.IEncryptedStoragePort
        readonly ipcValidator: SecurityDomain.IIPCSchemaValidatorPort
        readonly toolSandbox: SecurityDomain.IToolSandboxEnforcerPort
    }
}

export interface IDesktopPlatformBundle {
    readonly runtime: IRuntimeBundle
    readonly snapshotStorage: SnapshotDomain.ISnapshotStoragePort
    readonly versioning: VersioningDomain.IVersioningPort
    readonly agentStoragePath: string
    readonly skillStoragePath: string
    // Platform v2
    readonly governance?: IDesktopPlatformConfig['governance']
    readonly pluginRegistry?: PluginDomain.IPluginRegistryPort
    readonly workspaceManager?: WorkspaceDomain.IWorkspaceManagerPort
    readonly observability?: IDesktopPlatformConfig['observability']
    readonly modelRouter?: ModelDomain.IModelRouter
    readonly costCalculator?: ModelDomain.ICostCalculator
    readonly security?: IDesktopPlatformConfig['security']
}

export function createDesktopPlatform(
    runtime: IRuntimeBundle,
    config: IDesktopPlatformConfig,
): IDesktopPlatformBundle {
    return {
        runtime,
        snapshotStorage: config.snapshotStorage,
        versioning: config.versioning,
        agentStoragePath: config.agentStoragePath,
        skillStoragePath: config.skillStoragePath,
        governance: config.governance,
        pluginRegistry: config.pluginRegistry,
        workspaceManager: config.workspaceManager,
        observability: config.observability,
        modelRouter: config.modelRouter,
        costCalculator: config.costCalculator,
        security: config.security,
    }
}
