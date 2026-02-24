/**
 * DesktopWorkspaceClient — SDK layer for workspace management.
 *
 * Wraps IPC calls to the main process.
 * Must not instantiate runtime.
 * Must not import execution or core.
 *
 * Renderer imports this via @agenthub/sdk.
 */

import type {
    IWorkspaceCreatePayload,
    IWorkspaceResult,
    IWorkspaceListResult,
} from '@agenthub/contracts'

export interface IDesktopWorkspaceClient {
    createWorkspace(payload: IWorkspaceCreatePayload): Promise<IWorkspaceResult>
    deleteWorkspace(workspaceId: string): Promise<void>
    listWorkspaces(): Promise<IWorkspaceListResult>
    getWorkspace(workspaceId: string): Promise<IWorkspaceResult | null>
    switchWorkspace(workspaceId: string): Promise<void>
    getCurrentWorkspace(): Promise<IWorkspaceResult>
}

export class DesktopWorkspaceClient implements IDesktopWorkspaceClient {
    private getBridge(): NonNullable<typeof window.agenthubDesktop> {
        if (!window.agenthubDesktop) {
            throw new Error('Desktop bridge not initialized. Ensure getDesktopExtendedBridge() was called.')
        }
        return window.agenthubDesktop
    }

    async createWorkspace(payload: IWorkspaceCreatePayload): Promise<IWorkspaceResult> {
        return (this.getBridge() as any).workspace.create(payload)
    }

    async deleteWorkspace(workspaceId: string): Promise<void> {
        return (this.getBridge() as any).workspace.delete(workspaceId)
    }

    async listWorkspaces(): Promise<IWorkspaceListResult> {
        return (this.getBridge() as any).workspace.list()
    }

    async getWorkspace(workspaceId: string): Promise<IWorkspaceResult | null> {
        return (this.getBridge() as any).workspace.get(workspaceId)
    }

    async switchWorkspace(workspaceId: string): Promise<void> {
        return (this.getBridge() as any).workspace.switch(workspaceId)
    }

    async getCurrentWorkspace(): Promise<IWorkspaceResult> {
        return (this.getBridge() as any).workspace.getCurrent()
    }
}
