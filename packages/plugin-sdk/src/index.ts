/**
 * @agenthub/plugin-sdk — public API for plugin authors.
 *
 * Plugin authors import from this package to define their plugins.
 * No direct access to core internals.
 */

import type { PluginDomain } from '@agenthub/core'

// Re-export plugin types for plugin authors
export type {
    IPluginManifest,
    IPluginContext,
    IAgentHubPlugin,
    IPluginToolRegistration,
    IPluginSkillRegistration,
    IPluginModelProviderRegistration,
    IPluginMiddlewareRegistration,
    MiddlewarePhase,
} from '@agenthub/core'
// Note: These are re-exported from PluginDomain. We use full path to not expose core directly.

export type PluginManifest = PluginDomain.IPluginManifest
export type PluginContext = PluginDomain.IPluginContext
export type AgentHubPlugin = PluginDomain.IAgentHubPlugin
export type PluginToolRegistration = PluginDomain.IPluginToolRegistration
export type PluginSkillRegistration = PluginDomain.IPluginSkillRegistration
export type PluginModelProviderRegistration = PluginDomain.IPluginModelProviderRegistration
export type PluginMiddlewareRegistration = PluginDomain.IPluginMiddlewareRegistration

/**
 * Factory function for plugin authors to define a plugin.
 */
export function definePlugin(config: {
    readonly id: string
    readonly version: string
    readonly register: (context: PluginDomain.IPluginContext) => void
}): PluginDomain.IAgentHubPlugin {
    return {
        id: config.id,
        version: config.version,
        register: config.register,
    }
}

/**
 * Create a plugin manifest.
 */
export function createManifest(config: {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
    readonly author?: string
    readonly entryPoint: string
    readonly permissions?: readonly string[]
    readonly minCoreVersion?: string
    readonly maxCoreVersion?: string
}): PluginDomain.IPluginManifest {
    return {
        id: config.id,
        name: config.name,
        version: config.version,
        description: config.description,
        author: config.author,
        entryPoint: config.entryPoint,
        permissions: config.permissions ?? [],
        minCoreVersion: config.minCoreVersion ?? '1.0.0',
        maxCoreVersion: config.maxCoreVersion ?? '99.0.0',
    }
}
