/**
 * DesktopPluginClient — SDK layer for plugin management.
 *
 * Wraps IPC calls to the main process.
 * Must not instantiate runtime.
 * Must not import execution or core.
 *
 * Renderer imports this via @agenthub/sdk.
 */

import type {
    IPluginInstallPayload,
    IPluginActionPayload,
    IPluginListResult,
    IPluginDetailResult,
} from '@agenthub/contracts'

export interface IDesktopPluginClient {
    installPlugin(payload: IPluginInstallPayload): Promise<void>
    uninstallPlugin(pluginId: string): Promise<void>
    activatePlugin(pluginId: string): Promise<void>
    deactivatePlugin(pluginId: string): Promise<void>
    listPlugins(): Promise<IPluginListResult>
    getPlugin(pluginId: string): Promise<IPluginDetailResult | null>
}

export class DesktopPluginClient implements IDesktopPluginClient {
    private getBridge(): NonNullable<typeof window.agenthubDesktop> {
        if (!window.agenthubDesktop) {
            throw new Error('Desktop bridge not initialized. Ensure getDesktopExtendedBridge() was called.')
        }
        return window.agenthubDesktop
    }

    async installPlugin(payload: IPluginInstallPayload): Promise<void> {
        return (this.getBridge() as any).plugin.install(payload)
    }

    async uninstallPlugin(pluginId: string): Promise<void> {
        return (this.getBridge() as any).plugin.uninstall(pluginId)
    }

    async activatePlugin(pluginId: string): Promise<void> {
        return (this.getBridge() as any).plugin.activate(pluginId)
    }

    async deactivatePlugin(pluginId: string): Promise<void> {
        return (this.getBridge() as any).plugin.deactivate(pluginId)
    }

    async listPlugins(): Promise<IPluginListResult> {
        return (this.getBridge() as any).plugin.list()
    }

    async getPlugin(pluginId: string): Promise<IPluginDetailResult | null> {
        return (this.getBridge() as any).plugin.get(pluginId)
    }
}
