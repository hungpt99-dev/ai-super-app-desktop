/**
 * Workspace Store — manages workspace state for the renderer.
 *
 * Responsibilities:
 * - Track active workspace
 * - List all workspaces
 * - Handle workspace switching
 * - Persist workspace selection
 */

import { create } from 'zustand'
import { getDesktopBridge } from '../lib/bridge'

// ─── Types ─────────────────────────────────────────────────────────────────────────

export interface Workspace {
    readonly id: string
    readonly name: string
    readonly createdAt: number
    readonly lastOpened: number
}

interface WorkspaceState {
    activeWorkspace: Workspace | null
    workspaces: readonly Workspace[]
    loading: boolean
    error: string | null

    // Actions
    initialize(): Promise<void>
    fetchWorkspaces(): Promise<void>
    createWorkspace(name: string): Promise<Workspace>
    deleteWorkspace(workspaceId: string): Promise<void>
    renameWorkspace(workspaceId: string, newName: string): Promise<void>
    switchWorkspace(workspaceId: string): Promise<void>
    duplicateWorkspace(sourceWorkspaceId: string, newName: string): Promise<Workspace>
    clearError(): void
}

// ─── Store ────────────────────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    activeWorkspace: null,
    workspaces: [],
    loading: false,
    error: null,

    initialize: async () => {
        set({ loading: true, error: null })
        try {
            const bridge = getDesktopBridge()
            const result = await bridge.workspace.initialize() as Workspace
            await get().fetchWorkspaces()
            set({ activeWorkspace: result, loading: false })
        } catch (error) {
            set({ 
                error: error instanceof Error ? error.message : 'Failed to initialize workspace',
                loading: false 
            })
        }
    },

    fetchWorkspaces: async () => {
        try {
            const bridge = getDesktopBridge()
            const result = await bridge.workspace.list() as { workspaces: Workspace[] }
            set({ workspaces: result.workspaces })
            
            // Update active workspace if not set
            const { activeWorkspace } = get()
            if (!activeWorkspace && result.workspaces.length > 0) {
                set({ activeWorkspace: result.workspaces[0] })
            }
        } catch (error) {
            set({ 
                error: error instanceof Error ? error.message : 'Failed to fetch workspaces'
            })
        }
    },

    createWorkspace: async (name: string) => {
        set({ loading: true, error: null })
        try {
            const bridge = getDesktopBridge()
            const result = await bridge.workspace.create({ name }) as Workspace
            await get().fetchWorkspaces()
            set({ loading: false })
            return result
        } catch (error) {
            set({ 
                error: error instanceof Error ? error.message : 'Failed to create workspace',
                loading: false 
            })
            throw error
        }
    },

    deleteWorkspace: async (workspaceId: string) => {
        set({ loading: true, error: null })
        try {
            const bridge = getDesktopBridge()
            await bridge.workspace.delete({ workspaceId })
            await get().fetchWorkspaces()
            set({ loading: false })
        } catch (error) {
            set({ 
                error: error instanceof Error ? error.message : 'Failed to delete workspace',
                loading: false 
            })
            throw error
        }
    },

    renameWorkspace: async (workspaceId: string, newName: string) => {
        set({ loading: true, error: null })
        try {
            const bridge = getDesktopBridge()
            await bridge.workspace.rename({ workspaceId, newName })
            await get().fetchWorkspaces()
            set({ loading: false })
        } catch (error) {
            set({ 
                error: error instanceof Error ? error.message : 'Failed to rename workspace',
                loading: false 
            })
            throw error
        }
    },

    switchWorkspace: async (workspaceId: string) => {
        set({ loading: true, error: null })
        try {
            const bridge = getDesktopBridge()
            const result = await bridge.workspace.switch({ workspaceId }) as Workspace
            set({ activeWorkspace: result, loading: false })
            await get().fetchWorkspaces()
        } catch (error) {
            set({ 
                error: error instanceof Error ? error.message : 'Failed to switch workspace',
                loading: false 
            })
            throw error
        }
    },

    duplicateWorkspace: async (sourceWorkspaceId: string, newName: string) => {
        set({ loading: true, error: null })
        try {
            const bridge = getDesktopBridge()
            const result = await bridge.workspace.duplicate({ sourceWorkspaceId, newName }) as Workspace
            await get().fetchWorkspaces()
            set({ loading: false })
            return result
        } catch (error) {
            set({ 
                error: error instanceof Error ? error.message : 'Failed to duplicate workspace',
                loading: false 
            })
            throw error
        }
    },

    clearError: () => set({ error: null }),
}))
