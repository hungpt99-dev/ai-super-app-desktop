/**
 * PluginLoader — loads plugins from the filesystem.
 *
 * Default plugin path: ~/.agenthub/plugins/
 * Each plugin must have a manifest.json and an entry point.
 */

import type { PluginDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'
import { PluginRegistry } from './plugin-registry.js'

type IPluginManifest = PluginDomain.IPluginManifest
type IAgentHubPlugin = PluginDomain.IAgentHubPlugin

const log = logger.child('PluginLoader')

export interface IPluginLoaderConfig {
    readonly pluginsDir: string
    readonly registry: PluginRegistry
}

export class PluginLoader {
    private readonly pluginsDir: string
    private readonly registry: PluginRegistry

    constructor(config: IPluginLoaderConfig) {
        this.pluginsDir = config.pluginsDir
        this.registry = config.registry
    }

    async loadAll(manifests: readonly IPluginManifest[]): Promise<void> {
        log.info('Loading plugins', { count: manifests.length, dir: this.pluginsDir })

        for (const manifest of manifests) {
            try {
                await this.loadPlugin(manifest)
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                log.error('Failed to load plugin', { pluginId: manifest.id, error: message })
            }
        }
    }

    async loadPlugin(manifest: IPluginManifest): Promise<void> {
        const entryPath = `${this.pluginsDir}/${manifest.id}/${manifest.entryPoint}`

        await this.registry.install(manifest, entryPath)
        log.info('Plugin loaded', { pluginId: manifest.id })
    }

    async activatePlugin(pluginId: string, plugin: IAgentHubPlugin): Promise<void> {
        const context: PluginDomain.IPluginContext = {
            registerTool: (tool) => {
                this.registry.registerToolForPlugin(pluginId, tool)
                log.info('Plugin tool registered', { pluginId, toolName: tool.name })
            },
            registerSkill: (skill) => {
                this.registry.registerSkillForPlugin(pluginId, skill)
                log.info('Plugin skill registered', { pluginId, skillName: skill.name })
            },
            registerModelProvider: (provider) => {
                this.registry.registerProviderForPlugin(pluginId, provider)
                log.info('Plugin model provider registered', { pluginId, providerId: provider.id })
            },
            registerMiddleware: (middleware) => {
                this.registry.registerMiddlewareForPlugin(pluginId, middleware)
                log.info('Plugin middleware registered', { pluginId, middlewareId: middleware.id })
            },
        }

        plugin.register(context)
        await this.registry.activate(pluginId)
        log.info('Plugin activated', { pluginId })
    }
}
