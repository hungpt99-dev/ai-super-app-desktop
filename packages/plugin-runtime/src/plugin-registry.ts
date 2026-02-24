/**
 * PluginRegistry — manages plugin lifecycle and registrations.
 *
 * Implements IPluginRegistryPort from core.
 */

import type { PluginDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IPluginRegistryPort = PluginDomain.IPluginRegistryPort
type IPluginManifest = PluginDomain.IPluginManifest
type IPluginInfo = PluginDomain.IPluginInfo
type PluginStatus = PluginDomain.PluginStatus
type IPluginToolRegistration = PluginDomain.IPluginToolRegistration
type IPluginSkillRegistration = PluginDomain.IPluginSkillRegistration
type IPluginModelProviderRegistration = PluginDomain.IPluginModelProviderRegistration
type IPluginMiddlewareRegistration = PluginDomain.IPluginMiddlewareRegistration
type MiddlewarePhase = PluginDomain.MiddlewarePhase

const log = logger.child('PluginRegistry')

interface PluginRecord {
    info: IPluginInfo
    entryPath: string
    tools: IPluginToolRegistration[]
    skills: IPluginSkillRegistration[]
    providers: IPluginModelProviderRegistration[]
    middleware: IPluginMiddlewareRegistration[]
}

export class PluginRegistry implements IPluginRegistryPort {
    private readonly plugins: Map<string, PluginRecord> = new Map()

    async install(manifest: IPluginManifest, entryPath: string): Promise<void> {
        if (this.plugins.has(manifest.id)) {
            log.warn('Plugin already installed, updating', { pluginId: manifest.id })
        }

        const info: IPluginInfo = {
            manifest,
            status: 'installed',
            installedAt: new Date().toISOString(),
        }

        this.plugins.set(manifest.id, {
            info,
            entryPath,
            tools: [],
            skills: [],
            providers: [],
            middleware: [],
        })

        log.info('Plugin installed', { pluginId: manifest.id, version: manifest.version })
    }

    async uninstall(pluginId: string): Promise<void> {
        const record = this.plugins.get(pluginId)
        if (!record) {
            log.warn('Plugin not found for uninstall', { pluginId })
            return
        }

        this.plugins.delete(pluginId)
        log.info('Plugin uninstalled', { pluginId })
    }

    async activate(pluginId: string): Promise<void> {
        const record = this.plugins.get(pluginId)
        if (!record) {
            throw new Error(`Plugin "${pluginId}" not found`)
        }

        record.info = {
            ...record.info,
            status: 'active',
            activatedAt: new Date().toISOString(),
        }

        log.info('Plugin activated', { pluginId })
    }

    async deactivate(pluginId: string): Promise<void> {
        const record = this.plugins.get(pluginId)
        if (!record) {
            throw new Error(`Plugin "${pluginId}" not found`)
        }

        record.info = {
            ...record.info,
            status: 'inactive',
        }

        record.tools = []
        record.skills = []
        record.providers = []
        record.middleware = []

        log.info('Plugin deactivated', { pluginId })
    }

    async getPlugin(pluginId: string): Promise<IPluginInfo | null> {
        return this.plugins.get(pluginId)?.info ?? null
    }

    async listPlugins(): Promise<readonly IPluginInfo[]> {
        return [...this.plugins.values()].map(r => r.info)
    }

    getRegisteredTools(pluginId: string): readonly IPluginToolRegistration[] {
        return this.plugins.get(pluginId)?.tools ?? []
    }

    getRegisteredSkills(pluginId: string): readonly IPluginSkillRegistration[] {
        return this.plugins.get(pluginId)?.skills ?? []
    }

    getRegisteredProviders(pluginId: string): readonly IPluginModelProviderRegistration[] {
        return this.plugins.get(pluginId)?.providers ?? []
    }

    getRegisteredMiddleware(pluginId: string): readonly IPluginMiddlewareRegistration[] {
        return this.plugins.get(pluginId)?.middleware ?? []
    }

    getAllMiddleware(phase: MiddlewarePhase): readonly IPluginMiddlewareRegistration[] {
        const result: IPluginMiddlewareRegistration[] = []
        for (const record of this.plugins.values()) {
            if (record.info.status === 'active') {
                result.push(...record.middleware.filter(m => m.phase === phase))
            }
        }
        return result.sort((a, b) => a.priority - b.priority)
    }

    registerToolForPlugin(pluginId: string, tool: IPluginToolRegistration): void {
        const record = this.plugins.get(pluginId)
        if (record) {
            record.tools.push(tool)
        }
    }

    registerSkillForPlugin(pluginId: string, skill: IPluginSkillRegistration): void {
        const record = this.plugins.get(pluginId)
        if (record) {
            record.skills.push(skill)
        }
    }

    registerProviderForPlugin(pluginId: string, provider: IPluginModelProviderRegistration): void {
        const record = this.plugins.get(pluginId)
        if (record) {
            record.providers.push(provider)
        }
    }

    registerMiddlewareForPlugin(pluginId: string, middleware: IPluginMiddlewareRegistration): void {
        const record = this.plugins.get(pluginId)
        if (record) {
            record.middleware.push(middleware)
        }
    }
}
