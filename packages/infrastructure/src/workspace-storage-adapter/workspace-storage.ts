/**
 * WorkspaceStorageAdapter — implements IWorkspaceManagerPort from core.
 *
 * Manages workspace directories under ~/.agenthub/workspaces/{workspaceId}/
 * All execution must resolve workspace context first.
 */

import type { WorkspaceDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IWorkspaceManagerPort = WorkspaceDomain.IWorkspaceManagerPort
type IWorkspaceInfo = WorkspaceDomain.IWorkspaceInfo
type IWorkspaceLayout = WorkspaceDomain.IWorkspaceLayout

const log = logger.child('WorkspaceStorage')

export class WorkspaceStorageAdapter implements IWorkspaceManagerPort {
    private readonly workspaces: Map<string, IWorkspaceInfo> = new Map()
    private readonly basePath: string
    private defaultWorkspaceId: string | null = null

    constructor(basePath: string) {
        this.basePath = basePath
    }

    private generateId(): string {
        return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }

    async create(name: string): Promise<IWorkspaceInfo> {
        const id = this.generateId()
        const now = new Date().toISOString()
        const isFirst = this.workspaces.size === 0

        const info: IWorkspaceInfo = {
            id,
            name,
            createdAt: now,
            updatedAt: now,
            isDefault: isFirst,
        }

        this.workspaces.set(id, info)

        if (isFirst) {
            this.defaultWorkspaceId = id
        }

        log.info('Workspace created', { workspaceId: id, name })
        return info
    }

    async delete(workspaceId: string): Promise<void> {
        this.workspaces.delete(workspaceId)
        if (this.defaultWorkspaceId === workspaceId) {
            const first = this.workspaces.values().next()
            this.defaultWorkspaceId = first.done ? null : first.value.id
        }
        log.info('Workspace deleted', { workspaceId })
    }

    async get(workspaceId: string): Promise<IWorkspaceInfo | null> {
        return this.workspaces.get(workspaceId) ?? null
    }

    async list(): Promise<readonly IWorkspaceInfo[]> {
        return [...this.workspaces.values()]
    }

    async getDefault(): Promise<IWorkspaceInfo> {
        if (this.defaultWorkspaceId) {
            const ws = this.workspaces.get(this.defaultWorkspaceId)
            if (ws) return ws
        }

        const defaultWorkspace = await this.create('Default Workspace')
        this.defaultWorkspaceId = defaultWorkspace.id
        return defaultWorkspace
    }

    async setDefault(workspaceId: string): Promise<void> {
        if (!this.workspaces.has(workspaceId)) {
            throw new Error(`Workspace "${workspaceId}" not found`)
        }

        if (this.defaultWorkspaceId) {
            const prev = this.workspaces.get(this.defaultWorkspaceId)
            if (prev) {
                this.workspaces.set(this.defaultWorkspaceId, { ...prev, isDefault: false })
            }
        }

        const ws = this.workspaces.get(workspaceId)!
        this.workspaces.set(workspaceId, { ...ws, isDefault: true })
        this.defaultWorkspaceId = workspaceId

        log.info('Default workspace set', { workspaceId })
    }

    async getLayout(workspaceId: string): Promise<IWorkspaceLayout> {
        const wsPath = `${this.basePath}/${workspaceId}`

        return {
            workspaceId,
            basePath: wsPath,
            agentsPath: `${wsPath}/agents`,
            skillsPath: `${wsPath}/skills`,
            snapshotsPath: `${wsPath}/snapshots`,
            pluginsPath: `${wsPath}/plugins`,
            testsPath: `${wsPath}/tests`,
        }
    }

    async exists(workspaceId: string): Promise<boolean> {
        return this.workspaces.has(workspaceId)
    }
}
