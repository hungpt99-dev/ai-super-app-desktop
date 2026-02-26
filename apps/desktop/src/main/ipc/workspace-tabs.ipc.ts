/**
 * WorkspaceTabs IPC Handler — handles workspaceTabs:* channels for tab-based multi-workspace support.
 *
 * Channels:
 * - workspaceTabs:create
 * - workspaceTabs:close
 * - workspaceTabs:switch
 * - workspaceTabs:rename
 * - workspaceTabs:list
 * - workspaceTabs:getCurrent
 * - workspaceTabs:addAgent
 * - workspaceTabs:removeAgent
 * - workspaceTabs:getAgents
 *
 * Main process only.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

// ─── Types ─────────────────────────────────────────────────────────────────────────

export interface IWorkspaceTab {
    readonly id: string
    readonly name: string
    readonly isDefault: boolean
    readonly createdAt: number
    readonly closedAt: number | null
}

export interface IWorkspaceTabWithAgents extends IWorkspaceTab {
    readonly agentIds: readonly string[]
}

export interface IWorkspaceTabCreateResult {
    readonly tab: IWorkspaceTab
}

export interface IWorkspaceTabListResult {
    readonly tabs: readonly IWorkspaceTab[]
}

export interface IWorkspaceTabsState {
    readonly tabs: readonly IWorkspaceTab[]
    readonly currentTabId: string | null
}

export interface IWorkspaceTabsSwitchPayload {
    readonly tabId: string
}

export interface IWorkspaceTabsRenamePayload {
    readonly tabId: string
    readonly newName: string
}

export interface IWorkspaceTabsClosePayload {
    readonly tabId: string
}

export interface IWorkspaceTabsAddAgentPayload {
    readonly tabId: string
    readonly agentId: string
}

export interface IWorkspaceTabsRemoveAgentPayload {
    readonly tabId: string
    readonly agentId: string
}

export interface IWorkspaceTabAgentsResult {
    readonly agentIds: readonly string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────────

const AGENTHUB_DIR = path.join(process.env.HOME || '', '.agenthub')
const TABS_STATE_FILE = path.join(AGENTHUB_DIR, 'workspace-tabs.json')
const WORKSPACES_DIR = path.join(AGENTHUB_DIR, 'workspaces')
const DEFAULT_WORKSPACE = 'Main Workspace'

// ─── Helper Functions ─────────────────────────────────────────────────────────────

function generateId(): string {
    return crypto.randomUUID()
}

async function ensureDir(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true })
    } catch {
        // Directory already exists
    }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        const content = await fs.readFile(filePath, 'utf-8')
        return JSON.parse(content) as T
    } catch {
        return null
    }
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    const dir = path.dirname(filePath)
    await ensureDir(dir)
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function getWorkspacePath(workspaceId: string): string {
    return path.join(WORKSPACES_DIR, workspaceId)
}

function getWorkspaceAgentsPath(workspaceId: string): string {
    return path.join(getWorkspacePath(workspaceId), 'agents.json')
}

// ─── Tabs State Manager ─────────────────────────────────────────────────────────

class WorkspaceTabsManager {
    private tabs: Map<string, IWorkspaceTabWithAgents> = new Map()
    private currentTabId: string | null = null

    async initialize(): Promise<IWorkspaceTabsState> {
        await ensureDir(AGENTHUB_DIR)
        await ensureDir(WORKSPACES_DIR)

        const state = await this.loadState()

        if (state && state.tabs.length > 0) {
            // Restore existing tabs
            for (const tab of state.tabs) {
                const agents = await this.loadWorkspaceAgents(tab.id)
                this.tabs.set(tab.id, {
                    ...tab,
                    agentIds: agents,
                })
            }
            this.currentTabId = state.currentTabId

            // Find an open tab if current is closed
            const currentTab = this.currentTabId ? this.tabs.get(this.currentTabId) : null
            if (currentTab && currentTab.closedAt) {
                const openTab = Array.from(this.tabs.values()).find(t => !t.closedAt)
                if (openTab) {
                    this.currentTabId = openTab.id
                }
            }
        } else {
            // Create default workspace
            await this.createTab(DEFAULT_WORKSPACE)
            const tabIds = Array.from(this.tabs.keys())
            this.currentTabId = tabIds[0]
        }

        await this.saveState()

        return this.getState()
    }

    private async loadState(): Promise<IWorkspaceTabsState | null> {
        return readJsonFile<IWorkspaceTabsState>(TABS_STATE_FILE)
    }

    private async saveState(): Promise<void> {
        const tabs = Array.from(this.tabs.values()).map(tab => ({
            id: tab.id,
            name: tab.name,
            isDefault: tab.isDefault,
            createdAt: tab.createdAt,
            closedAt: tab.closedAt,
        }))
        await writeJsonFile(TABS_STATE_FILE, {
            tabs,
            currentTabId: this.currentTabId,
        })
    }

    private async loadWorkspaceAgents(workspaceId: string): Promise<string[]> {
        const agentsPath = getWorkspaceAgentsPath(workspaceId)
        const data = await readJsonFile<{ agentIds: string[] }>(agentsPath)
        return data?.agentIds ?? []
    }

    private async saveWorkspaceAgents(workspaceId: string, agentIds: string[]): Promise<void> {
        const agentsPath = getWorkspaceAgentsPath(workspaceId)
        await writeJsonFile(agentsPath, { agentIds })
    }

    getState(): IWorkspaceTabsState {
        const tabs = Array.from(this.tabs.values())
            .filter(t => !t.closedAt)
            .map(tab => ({
                id: tab.id,
                name: tab.name,
                isDefault: tab.isDefault,
                createdAt: tab.createdAt,
                closedAt: tab.closedAt,
            }))
        return {
            tabs,
            currentTabId: this.currentTabId,
        }
    }

    async createTab(name: string): Promise<IWorkspaceTab> {
        const id = generateId()
        const now = Date.now()

        const workspacePath = getWorkspacePath(id)
        await ensureDir(workspacePath)
        await ensureDir(path.join(workspacePath, 'agents'))
        await ensureDir(path.join(workspacePath, 'skills'))
        await ensureDir(path.join(workspacePath, 'executions'))
        await ensureDir(path.join(workspacePath, 'metrics'))
        await ensureDir(path.join(workspacePath, 'snapshots'))
        await ensureDir(path.join(workspacePath, 'memory'))

        const isDefault = this.tabs.size === 0
        const tab: IWorkspaceTabWithAgents = {
            id,
            name,
            isDefault,
            createdAt: now,
            closedAt: null,
            agentIds: [],
        }

        this.tabs.set(id, tab)
        await this.saveWorkspaceAgents(id, [])

        return {
            id: tab.id,
            name: tab.name,
            isDefault: tab.isDefault,
            createdAt: tab.createdAt,
            closedAt: tab.closedAt,
        }
    }

    async closeTab(tabId: string): Promise<void> {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            throw new Error('Tab not found')
        }

        if (tab.isDefault) {
            throw new Error('Cannot close default workspace')
        }

        // Close the tab (hide it, don't delete)
        const updatedTab: IWorkspaceTabWithAgents = {
            ...tab,
            closedAt: Date.now(),
        }
        this.tabs.set(tabId, updatedTab)

        // Switch to another tab if closing current
        if (this.currentTabId === tabId) {
            const openTab = Array.from(this.tabs.values()).find(t => !t.closedAt && t.id !== tabId)
            this.currentTabId = openTab ? openTab.id : null
        }

        await this.saveState()
    }

    async switchTab(tabId: string): Promise<IWorkspaceTab> {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            throw new Error('Tab not found')
        }

        if (tab.closedAt) {
            throw new Error('Cannot switch to closed tab')
        }

        this.currentTabId = tabId
        await this.saveState()

        return {
            id: tab.id,
            name: tab.name,
            isDefault: tab.isDefault,
            createdAt: tab.createdAt,
            closedAt: tab.closedAt,
        }
    }

    async renameTab(tabId: string, newName: string): Promise<IWorkspaceTab> {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            throw new Error('Tab not found')
        }

        const updatedTab: IWorkspaceTabWithAgents = {
            ...tab,
            name: newName,
        }
        this.tabs.set(tabId, updatedTab)
        await this.saveState()

        return {
            id: updatedTab.id,
            name: updatedTab.name,
            isDefault: updatedTab.isDefault,
            createdAt: updatedTab.createdAt,
            closedAt: updatedTab.closedAt,
        }
    }

    getCurrentTab(): IWorkspaceTab | null {
        if (!this.currentTabId) {
            return null
        }
        const tab = this.tabs.get(this.currentTabId)
        if (!tab || tab.closedAt) {
            return null
        }
        return {
            id: tab.id,
            name: tab.name,
            isDefault: tab.isDefault,
            createdAt: tab.createdAt,
            closedAt: tab.closedAt,
        }
    }

    async addAgent(tabId: string, agentId: string): Promise<void> {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            throw new Error('Tab not found')
        }

        if (!tab.agentIds.includes(agentId)) {
            const newAgentIds = [...tab.agentIds, agentId]
            const updatedTab: IWorkspaceTabWithAgents = {
                ...tab,
                agentIds: newAgentIds,
            }
            this.tabs.set(tabId, updatedTab)
            await this.saveWorkspaceAgents(tabId, newAgentIds)
        }
    }

    async removeAgent(tabId: string, agentId: string): Promise<void> {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            throw new Error('Tab not found')
        }

        const updatedAgentIds = tab.agentIds.filter(id => id !== agentId)
        if (updatedAgentIds.length !== tab.agentIds.length) {
            const updatedTab: IWorkspaceTabWithAgents = {
                ...tab,
                agentIds: updatedAgentIds,
            }
            this.tabs.set(tabId, updatedTab)
            await this.saveWorkspaceAgents(tabId, updatedAgentIds)
        }
    }

    getAgents(tabId: string): readonly string[] {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            throw new Error('Tab not found')
        }
        return tab.agentIds
    }

    getCurrentTabId(): string | null {
        return this.currentTabId
    }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────────

let workspaceTabsManagerInstance: WorkspaceTabsManager | null = null

export function getWorkspaceTabsManager(): WorkspaceTabsManager {
    if (!workspaceTabsManagerInstance) {
        workspaceTabsManagerInstance = new WorkspaceTabsManager()
    }
    return workspaceTabsManagerInstance
}

// ─── IPC Handler ─────────────────────────────────────────────────────────────────

export const workspaceTabsIPC = {
    async initialize(): Promise<IWorkspaceTabsState> {
        const manager = getWorkspaceTabsManager()
        return manager.initialize()
    },

    async create(name: string): Promise<IWorkspaceTabCreateResult> {
        const manager = getWorkspaceTabsManager()
        const tab = await manager.createTab(name)
        return { tab }
    },

    list(): IWorkspaceTabListResult {
        const manager = getWorkspaceTabsManager()
        const state = manager.getState()
        return { tabs: state.tabs }
    },

    async switch(payload: IWorkspaceTabsSwitchPayload): Promise<IWorkspaceTab> {
        const manager = getWorkspaceTabsManager()
        return manager.switchTab(payload.tabId)
    },

    async close(payload: IWorkspaceTabsClosePayload): Promise<void> {
        const manager = getWorkspaceTabsManager()
        await manager.closeTab(payload.tabId)
    },

    async rename(payload: IWorkspaceTabsRenamePayload): Promise<IWorkspaceTab> {
        const manager = getWorkspaceTabsManager()
        return manager.renameTab(payload.tabId, payload.newName)
    },

    getCurrent(): IWorkspaceTab | null {
        const manager = getWorkspaceTabsManager()
        return manager.getCurrentTab()
    },

    async addAgent(payload: IWorkspaceTabsAddAgentPayload): Promise<void> {
        const manager = getWorkspaceTabsManager()
        await manager.addAgent(payload.tabId, payload.agentId)
    },

    async removeAgent(payload: IWorkspaceTabsRemoveAgentPayload): Promise<void> {
        const manager = getWorkspaceTabsManager()
        await manager.removeAgent(payload.tabId, payload.agentId)
    },

    getAgents(payload: { tabId: string }): IWorkspaceTabAgentsResult {
        const manager = getWorkspaceTabsManager()
        const agentIds = manager.getAgents(payload.tabId)
        return { agentIds }
    },

    getManager(): WorkspaceTabsManager {
        return getWorkspaceTabsManager()
    },
}
