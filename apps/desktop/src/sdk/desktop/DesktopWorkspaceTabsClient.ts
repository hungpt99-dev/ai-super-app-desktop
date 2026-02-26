/**
 * DesktopWorkspaceTabsClient — SDK client for workspace tabs functionality.
 *
 * Provides typed interface for workspace tab operations:
 * - Create/close/switch tabs
 * - Rename tabs
 * - List tabs
 * - Get current tab
 * - Add/remove agents from workspace
 * - Get agents in workspace
 *
 * All runtime access via IPC (no direct runtime access in renderer).
 */

import type { IWorkspaceTab, IWorkspaceTabsState, IWorkspaceTabAgentsResult } from '../../main/ipc/workspace-tabs.ipc.js'

// ─── IPC Invoke Helpers ─────────────────────────────────────────────────────────

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
    return tauriInvoke<T>(cmd, args)
}

// ─── Client Interface ────────────────────────────────────────────────────────────

export interface IDesktopWorkspaceTabsClient {
    /**
     * Initialize workspace tabs system. Creates default workspace if none exists.
     */
    initialize(): Promise<IWorkspaceTabsState>

    /**
     * Create a new workspace tab.
     */
    create(name: string): Promise<IWorkspaceTab>

    /**
     * Close a workspace tab (hides it, does not delete data).
     */
    close(tabId: string): Promise<void>

    /**
     * Switch to a different workspace tab.
     */
    switch(tabId: string): Promise<IWorkspaceTab>

    /**
     * Rename a workspace tab.
     */
    rename(tabId: string, newName: string): Promise<IWorkspaceTab>

    /**
     * List all open workspace tabs.
     */
    list(): Promise<{ tabs: readonly IWorkspaceTab[] }>

    /**
     * Get the current active workspace tab.
     */
    getCurrent(): Promise<IWorkspaceTab | null>

    /**
     * Add an agent to a workspace.
     */
    addAgent(tabId: string, agentId: string): Promise<void>

    /**
     * Remove an agent from a workspace.
     */
    removeAgent(tabId: string, agentId: string): Promise<void>

    /**
     * Get all agent IDs in a workspace.
     */
    getAgents(tabId: string): Promise<IWorkspaceTabAgentsResult>
}

// ─── Client Implementation ─────────────────────────────────────────────────────

export const DesktopWorkspaceTabsClient: IDesktopWorkspaceTabsClient = {
    async initialize(): Promise<IWorkspaceTabsState> {
        return invoke<IWorkspaceTabsState>('workspaceTabs:initialize')
    },

    async create(name: string): Promise<IWorkspaceTab> {
        const result = await invoke<{ tab: IWorkspaceTab }>('workspaceTabs:create', { name })
        return result.tab
    },

    async close(tabId: string): Promise<void> {
        await invoke<void>('workspaceTabs:close', { tabId })
    },

    async switch(tabId: string): Promise<IWorkspaceTab> {
        return invoke<IWorkspaceTab>('workspaceTabs:switch', { tabId })
    },

    async rename(tabId: string, newName: string): Promise<IWorkspaceTab> {
        return invoke<IWorkspaceTab>('workspaceTabs:rename', { tabId, newName })
    },

    async list(): Promise<{ tabs: readonly IWorkspaceTab[] }> {
        return invoke<{ tabs: readonly IWorkspaceTab[] }>('workspaceTabs:list')
    },

    async getCurrent(): Promise<IWorkspaceTab | null> {
        return invoke<IWorkspaceTab | null>('workspaceTabs:getCurrent')
    },

    async addAgent(tabId: string, agentId: string): Promise<void> {
        await invoke<void>('workspaceTabs:addAgent', { tabId, agentId })
    },

    async removeAgent(tabId: string, agentId: string): Promise<void> {
        await invoke<void>('workspaceTabs:removeAgent', { tabId, agentId })
    },

    async getAgents(tabId: string): Promise<IWorkspaceTabAgentsResult> {
        return invoke<IWorkspaceTabAgentsResult>('workspaceTabs:getAgents', { tabId })
    },
}
