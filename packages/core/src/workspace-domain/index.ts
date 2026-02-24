/**
 * WorkspaceDomain — core ports for workspace isolation.
 *
 * All execution, storage, and plugin operations are scoped to a workspace.
 * Workspace context must be resolved before any operation.
 */

// ─── Workspace Types ────────────────────────────────────────────────────────

export interface IWorkspaceInfo {
    readonly id: string
    readonly name: string
    readonly createdAt: string
    readonly updatedAt: string
    readonly isDefault: boolean
}

export interface IWorkspaceLayout {
    readonly workspaceId: string
    readonly basePath: string
    readonly agentsPath: string
    readonly skillsPath: string
    readonly snapshotsPath: string
    readonly pluginsPath: string
    readonly testsPath: string
}

// ─── Workspace Manager Port ─────────────────────────────────────────────────

export interface IWorkspaceManagerPort {
    create(name: string): Promise<IWorkspaceInfo>
    delete(workspaceId: string): Promise<void>
    get(workspaceId: string): Promise<IWorkspaceInfo | null>
    list(): Promise<readonly IWorkspaceInfo[]>
    getDefault(): Promise<IWorkspaceInfo>
    setDefault(workspaceId: string): Promise<void>
    getLayout(workspaceId: string): Promise<IWorkspaceLayout>
    exists(workspaceId: string): Promise<boolean>
}
