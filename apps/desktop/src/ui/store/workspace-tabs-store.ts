/**
 * Workspace Tabs Store — manages workspace tabs state for the renderer.
 *
 * Responsibilities:
 * - Track open tabs
 * - Track current tab
 * - Handle tab operations (create, close, switch, rename, reorder)
 * - Handle agent membership (add, remove, list)
 * - Persist state to storage
 *
 * Renderer must NOT access runtime directly — all via IPC.
 */

import { create } from 'zustand'
import { getDesktopBridge } from '../lib/bridge'

// ─── Types ─────────────────────────────────────────────────────────────────────────

export interface IWorkspaceTab {
    readonly id: string
    readonly name: string
    readonly isDefault: boolean
    readonly createdAt: number
    readonly closedAt: number | null
}

export interface IWorkspaceAgent {
    readonly id: string
    readonly name: string
}

export interface IWorkspaceTabsState {
    readonly tabs: readonly IWorkspaceTab[]
    readonly currentTabId: string
    readonly workspaceAgents: Readonly<Record<string, readonly IWorkspaceAgent[]>>
    readonly loading: boolean
    readonly error: string | null
    readonly initialized: boolean
}

interface IWorkspaceTabsActions {
    // Getters
    getActiveWorkspace: () => IWorkspaceTab
    getCurrentAgents: () => readonly IWorkspaceAgent[]
    getWorkspaceAgents: (tabId: string) => readonly IWorkspaceAgent[]

    // Actions
    initialize: () => Promise<void>
    createTab: (name: string) => Promise<IWorkspaceTab>
    closeTab: (tabId: string) => Promise<void>
    switchTab: (tabId: string) => Promise<void>
    renameTab: (tabId: string, newName: string) => Promise<void>
    reorderTabs: (fromIndex: number, toIndex: number) => void
    addAgent: (tabId: string, agent: IWorkspaceAgent) => Promise<void>
    removeAgent: (tabId: string, agentId: string) => Promise<void>
    getAgents: (tabId: string) => Promise<readonly IWorkspaceAgent[]>
    clearError: () => void
}

type WorkspaceTabsStore = IWorkspaceTabsState & IWorkspaceTabsActions

// ─── Constants ───────────────────────────────────────────────────────────────────

const DEFAULT_WORKSPACE_NAME = 'Main Workspace'

// ─── Helper Functions ─────────────────────────────────────────────────────────────

function generateWorkspaceId(): string {
    return crypto.randomUUID()
}

// Create a default workspace tab
function createDefaultTab(): IWorkspaceTab {
    return {
        id: generateWorkspaceId(),
        name: DEFAULT_WORKSPACE_NAME,
        isDefault: true,
        createdAt: Date.now(),
        closedAt: null,
    }
}

// ─── Store ────────────────────────────────────────────────────────────────────────

// Mutex to prevent concurrent initialization
let initResolve: (() => void) | null = null
let initPromise: Promise<void> | null = null

export const useWorkspaceTabsStore = create<WorkspaceTabsStore>((set, get) => {
    // Initial state - will be replaced by initialization
    const defaultTab = createDefaultTab()

    return {
        // Initial state
        tabs: [defaultTab],
        currentTabId: defaultTab.id,
        workspaceAgents: {},
        loading: false,
        error: null,
        initialized: false,

        // Getters
        getActiveWorkspace: () => {
            const { tabs, currentTabId } = get()
            const workspace = tabs.find(t => t.id === currentTabId)
            // Always return a valid workspace - fallback to first tab if current not found
            return workspace || tabs[0] || defaultTab
        },

        getCurrentAgents: () => {
            const { currentTabId, workspaceAgents } = get()
            return workspaceAgents[currentTabId] ?? []
        },

        getWorkspaceAgents: (tabId: string) => {
            const { workspaceAgents } = get()
            return workspaceAgents[tabId] ?? []
        },

        // Actions
        initialize: async () => {
            // If initialization is in progress, wait for it
            if (initPromise !== null) {
                return initPromise
            }

            const state = get()
            // Prevent re-initialization if already done
            if (state.initialized) {
                return
            }

            // Create promise for mutex
            initPromise = new Promise<void>((resolve) => {
                initResolve = resolve
            })

            set({ loading: true, error: null })
            try {
                const bridge = getDesktopBridge()
                const result = await bridge.workspaceTabs.initialize() as {
                    tabs: IWorkspaceTab[]
                    currentTabId: string
                }

                // Validate the result
                const resultTabs = result.tabs
                if (!resultTabs || resultTabs.length === 0) {
                    // Create default workspace if none exist
                    const newDefaultTab = createDefaultTab()
                    set({
                        tabs: [newDefaultTab],
                        currentTabId: newDefaultTab.id,
                        workspaceAgents: { [newDefaultTab.id]: [] },
                        loading: false,
                        initialized: true,
                    })
                    // Clear mutex before returning
                    initPromise = null
                    initResolve()
                    initResolve = null
                    return
                }

                // Find the current tab or fall back to first tab
                const foundTab = resultTabs.find(t => t.id === result.currentTabId)
                const currentTab = foundTab || resultTabs[0]

                // Load agents for each tab
                const agentsMap: Record<string, readonly IWorkspaceAgent[]> = {}
                for (const tab of resultTabs) {
                    try {
                        const agentsResult = await bridge.workspaceTabs.getAgents(tab.id) as { agentIds: string[] }
                        // Map agent IDs to agent objects (name will be loaded from agents-store)
                        agentsMap[tab.id] = agentsResult.agentIds.map(id => ({ id, name: id }))
                    } catch {
                        agentsMap[tab.id] = []
                    }
                }

                set({
                    tabs: resultTabs,
                    currentTabId: currentTab.id,
                    workspaceAgents: agentsMap,
                    loading: false,
                    initialized: true,
                })
                // Clear mutex
                initPromise = null
                initResolve()
                initResolve = null
            } catch (error) {
                // On error, ensure we have at least a default workspace
                const errorDefaultTab = createDefaultTab()
                set({
                    tabs: [errorDefaultTab],
                    currentTabId: errorDefaultTab.id,
                    workspaceAgents: { [errorDefaultTab.id]: [] },
                    error: error instanceof Error ? error.message : 'Failed to initialize workspace tabs',
                    loading: false,
                    initialized: true, // Mark as initialized to prevent retry loops
                })
                // Clear mutex
                initPromise = null
                initResolve()
                initResolve = null
            }
        },

        createTab: async (name: string) => {
            set({ loading: true, error: null })
            try {
                const bridge = getDesktopBridge()
                if (!bridge?.workspaceTabs) {
                    throw new Error('Workspace tabs bridge is not available')
                }
                
                const result = await bridge.workspaceTabs.create(name) as { tab: IWorkspaceTab }
                const { tab } = result
                if (!tab) {
                    throw new Error('Failed to create tab')
                }

                // Add empty agent list for new workspace
                set(state => ({
                    tabs: [...state.tabs, tab],
                    currentTabId: tab.id,
                    workspaceAgents: { ...state.workspaceAgents, [tab.id]: [] },
                    loading: false,
                }))

                return tab
            } catch (error) {
                set({
                    error: error instanceof Error ? error.message : 'Failed to create workspace tab',
                    loading: false,
                })
                throw error
            }
        },

        closeTab: async (tabId: string) => {
            const state = get()
            const tab = state.tabs.find(t => t.id === tabId)

            if (!tab) {
                set({ error: 'Tab not found' })
                return
            }

            if (tab.isDefault) {
                set({ error: 'Cannot close default workspace' })
                return
            }

            set({ loading: true, error: null })
            try {
                const bridge = getDesktopBridge()
                await bridge.workspaceTabs.close(tabId)

                // Update local state
                set(state => {
                    const newTabs = state.tabs.filter(t => t.id !== tabId)
                    // Switch to another tab if closing current
                    let newCurrentId = state.currentTabId
                    if (state.currentTabId === tabId) {
                        // Find another open tab, prefer default or first
                        const defaultTabInNew = newTabs.find(t => t.isDefault)
                        if (defaultTabInNew) {
                            newCurrentId = defaultTabInNew.id
                        } else if (newTabs.length > 0) {
                            newCurrentId = newTabs[0].id
                        } else {
                            newCurrentId = state.tabs[0].id
                        }
                    }

                    // Remove agents for closed workspace
                    const newAgents: Record<string, readonly IWorkspaceAgent[]> = {}
                    for (const [key, value] of Object.entries(state.workspaceAgents)) {
                        if (key !== tabId) {
                            newAgents[key] = value
                        }
                    }

                    return {
                        tabs: newTabs,
                        currentTabId: newCurrentId,
                        workspaceAgents: newAgents,
                        loading: false,
                    }
                })
            } catch (error) {
                set({
                    error: error instanceof Error ? error.message : 'Failed to close workspace tab',
                    loading: false,
                })
                throw error
            }
        },

        switchTab: async (tabId: string) => {
            const state = get()
            const tab = state.tabs.find(t => t.id === tabId)

            if (!tab) {
                set({ error: 'Tab not found' })
                return
            }

            // Store previous tab ID for potential rollback
            const previousTabId = state.currentTabId
            
            // Optimistic update - update UI immediately
            set({ currentTabId: tabId, error: null })
            
            try {
                const bridge = getDesktopBridge()
                await bridge.workspaceTabs.switch(tabId)
            } catch (error) {
                // Revert to previous tab on error
                set({ currentTabId: previousTabId })
                set({
                    error: error instanceof Error ? error.message : 'Failed to switch workspace tab',
                })
            }
        },

        renameTab: async (tabId: string, newName: string) => {
            set({ error: null })
            try {
                const bridge = getDesktopBridge()
                await bridge.workspaceTabs.rename(tabId, newName)

                set(state => ({
                    tabs: state.tabs.map(t =>
                        t.id === tabId ? { ...t, name: newName } : t
                    ),
                }))
            } catch (error) {
                set({
                    error: error instanceof Error ? error.message : 'Failed to rename workspace tab',
                })
                throw error
            }
        },

        reorderTabs: (fromIndex: number, toIndex: number) => {
            set(state => {
                const newTabs = [...state.tabs]
                const [removed] = newTabs.splice(fromIndex, 1)
                newTabs.splice(toIndex, 0, removed)
                return { tabs: newTabs }
            })
        },

        addAgent: async (tabId: string, agent: IWorkspaceAgent) => {
            const state = get()
            const currentAgents = state.workspaceAgents[tabId] ?? []

            // Check for duplicates
            if (currentAgents.some(a => a.id === agent.id)) {
                return // Already in workspace
            }

            // Optimistic update
            set(state => ({
                workspaceAgents: {
                    ...state.workspaceAgents,
                    [tabId]: [...currentAgents, agent],
                }
            }))

            try {
                const bridge = getDesktopBridge()
                await bridge.workspaceTabs.addAgent(tabId, agent.id)
            } catch (error) {
                // Rollback on error
                set(state => ({
                    workspaceAgents: {
                        ...state.workspaceAgents,
                        [tabId]: (state.workspaceAgents[tabId] ?? []).filter(a => a.id !== agent.id),
                    },
                    error: error instanceof Error ? error.message : 'Failed to add agent to workspace',
                }))
            }
        },

        removeAgent: async (tabId: string, agentId: string) => {
            const state = get()
            const previousAgents = state.workspaceAgents[tabId] ?? []

            // Optimistic update
            set(state => ({
                workspaceAgents: {
                    ...state.workspaceAgents,
                    [tabId]: (state.workspaceAgents[tabId] ?? []).filter(a => a.id !== agentId),
                }
            }))

            try {
                const bridge = getDesktopBridge()
                await bridge.workspaceTabs.removeAgent(tabId, agentId)
            } catch (error) {
                // Rollback on error
                set({
                    workspaceAgents: {
                        ...get().workspaceAgents,
                        [tabId]: previousAgents,
                    },
                    error: error instanceof Error ? error.message : 'Failed to remove agent from workspace',
                })
            }
        },

        getAgents: async (tabId: string) => {
            try {
                const bridge = getDesktopBridge()
                const result = await bridge.workspaceTabs.getAgents(tabId) as { agentIds: string[] }
                return result.agentIds.map(id => ({ id, name: id }))
            } catch {
                return []
            }
        },

        clearError: () => {
            set({ error: null })
        },
    }
})

// Export typed hooks for use in components
export const useActiveWorkspace = () => useWorkspaceTabsStore(state => state.getActiveWorkspace())
export const useCurrentWorkspaceId = () => useWorkspaceTabsStore(state => state.currentTabId)
export const useCurrentWorkspaceAgents = () => useWorkspaceTabsStore(state => state.getCurrentAgents())
