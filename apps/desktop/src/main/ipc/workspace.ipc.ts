/**
 * Workspace IPC Handler — handles workspace:* channels for multi-workspace support.
 *
 * Channels:
 * - workspace:create
 * - workspace:delete
 * - workspace:rename
 * - workspace:list
 * - workspace:switch
 * - workspace:getActive
 * - workspace:duplicate
 * - workspace:initialize
 *
 * Main process only.
 */

import { getWorkspaceManager, Workspace, WorkspaceManager } from '../workspace/WorkspaceManager.js'

// ─── Payload Types ────────────────────────────────────────────────────────────────

export interface IWorkspaceCreatePayload {
    readonly name: string
}

export interface IWorkspaceDeletePayload {
    readonly workspaceId: string
}

export interface IWorkspaceRenamePayload {
    readonly workspaceId: string
    readonly newName: string
}

export interface IWorkspaceSwitchPayload {
    readonly workspaceId: string
}

export interface IWorkspaceDuplicatePayload {
    readonly sourceWorkspaceId: string
    readonly newName: string
}

export interface IWorkspaceResult {
    readonly id: string
    readonly name: string
    readonly createdAt: number
    readonly lastOpened: number
}

export interface IWorkspaceListResult {
    readonly workspaces: readonly IWorkspaceResult[]
}

// ─── Helper Functions ────────────────────────────────────────────────────────────────

function toResult(workspace: Workspace): IWorkspaceResult {
    return {
        id: workspace.id,
        name: workspace.name,
        createdAt: workspace.createdAt,
        lastOpened: workspace.lastOpened,
    }
}

// ─── IPC Handler ─────────────────────────────────────────────────────────────────

export const workspaceIPC = {
    async initialize(): Promise<IWorkspaceResult> {
        const manager = getWorkspaceManager()
        const workspace = await manager.initialize()
        return toResult(workspace)
    },

    async create(payload: IWorkspaceCreatePayload): Promise<IWorkspaceResult> {
        const manager = getWorkspaceManager()
        const workspace = await manager.createWorkspace(payload.name)
        return toResult(workspace)
    },

    async delete(payload: IWorkspaceDeletePayload): Promise<void> {
        const manager = getWorkspaceManager()
        await manager.deleteWorkspace(payload.workspaceId)
    },

    async rename(payload: IWorkspaceRenamePayload): Promise<IWorkspaceResult> {
        const manager = getWorkspaceManager()
        const workspace = await manager.renameWorkspace(payload.workspaceId, payload.newName)
        return toResult(workspace)
    },

    async switch(payload: IWorkspaceSwitchPayload): Promise<IWorkspaceResult> {
        const manager = getWorkspaceManager()
        const workspace = await manager.switchWorkspace(payload.workspaceId)
        return toResult(workspace)
    },

    async list(): Promise<IWorkspaceListResult> {
        const manager = getWorkspaceManager()
        const workspaces = await manager.listWorkspaces()
        return {
            workspaces: workspaces.map(toResult),
        }
    },

    async getActive(): Promise<IWorkspaceResult | null> {
        const manager = getWorkspaceManager()
        const workspace = await manager.getActiveWorkspace()
        return workspace ? toResult(workspace) : null
    },

    async duplicate(payload: IWorkspaceDuplicatePayload): Promise<IWorkspaceResult> {
        const manager = getWorkspaceManager()
        const workspace = await manager.duplicateWorkspace(payload.sourceWorkspaceId, payload.newName)
        return toResult(workspace)
    },

    getManager(): WorkspaceManager {
        return getWorkspaceManager()
    },
}
