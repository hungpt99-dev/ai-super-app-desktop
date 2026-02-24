/**
 * WorkspaceManager — manages multiple isolated workspaces.
 *
 * Responsibilities:
 * - Create workspace
 * - Delete workspace
 * - Switch workspace
 * - List workspaces
 * - Load workspace
 * - Validate workspace
 * - Duplicate workspace
 *
 * Storage Structure:
 * ~/.agenthub/
 *   config.json (activeWorkspaceId)
 *   workspaces/
 *     workspaceId/
 *       agents/
 *       skills/
 *       executions/
 *       metrics/
 *       snapshots/
 *       memory/
 *       settings.json
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

// ─── Types ─────────────────────────────────────────────────────────────────────────

export interface Workspace {
    readonly id: string
    readonly name: string
    readonly createdAt: number
    readonly lastOpened: number
}

export interface WorkspaceSettings {
    readonly agentIds: readonly string[]
    readonly skillIds: readonly string[]
    readonly config: Record<string, unknown>
}

export interface AgentHubConfig {
    readonly activeWorkspaceId: string
    readonly workspaces: readonly string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────────

const AGENTHUB_DIR = path.join(process.env.HOME || '', '.agenthub')
const CONFIG_FILE = path.join(AGENTHUB_DIR, 'config.json')
const WORKSPACES_DIR = path.join(AGENTHUB_DIR, 'workspaces')
const DEFAULT_WORKSPACE_NAME = 'Default Workspace'

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

function getWorkspaceSettingsPath(workspaceId: string): string {
    return path.join(getWorkspacePath(workspaceId), 'settings.json')
}

// ─── WorkspaceManager Class ─────────────────────────────────────────────────────

export class WorkspaceManager {
    private activeWorkspaceId: string | null = null
    private workspaces: Map<string, Workspace> = new Map()

    async initialize(): Promise<Workspace> {
        await ensureDir(AGENTHUB_DIR)
        await ensureDir(WORKSPACES_DIR)

        const config = await this.loadConfig()

        if (config && config.activeWorkspaceId) {
            this.activeWorkspaceId = config.activeWorkspaceId
            const workspace = await this.loadWorkspace(this.activeWorkspaceId)
            if (workspace) {
                return workspace
            }
        }

        // Create default workspace if none exists
        const defaultWorkspace = await this.createWorkspace(DEFAULT_WORKSPACE_NAME)
        await this.switchWorkspace(defaultWorkspace.id)
        return defaultWorkspace
    }

    private async loadConfig(): Promise<AgentHubConfig | null> {
        return readJsonFile<AgentHubConfig>(CONFIG_FILE)
    }

    private async saveConfig(): Promise<void> {
        const config: AgentHubConfig = {
            activeWorkspaceId: this.activeWorkspaceId || '',
            workspaces: Array.from(this.workspaces.keys()),
        }
        await writeJsonFile(CONFIG_FILE, config)
    }

    async createWorkspace(name: string): Promise<Workspace> {
        const id = generateId()
        const workspacePath = getWorkspacePath(id)
        const now = Date.now()

        const workspace: Workspace = {
            id,
            name,
            createdAt: now,
            lastOpened: now,
        }

        // Create workspace directory structure
        await ensureDir(workspacePath)
        await ensureDir(path.join(workspacePath, 'agents'))
        await ensureDir(path.join(workspacePath, 'skills'))
        await ensureDir(path.join(workspacePath, 'executions'))
        await ensureDir(path.join(workspacePath, 'metrics'))
        await ensureDir(path.join(workspacePath, 'snapshots'))
        await ensureDir(path.join(workspacePath, 'memory'))

        // Create settings file
        const settings: WorkspaceSettings = {
            agentIds: [],
            skillIds: [],
            config: {},
        }
        await writeJsonFile(getWorkspaceSettingsPath(id), settings)

        this.workspaces.set(id, workspace)
        await this.saveConfig()

        return workspace
    }

    async deleteWorkspace(workspaceId: string): Promise<void> {
        if (this.activeWorkspaceId === workspaceId) {
            throw new Error('Cannot delete active workspace. Switch to another workspace first.')
        }

        const workspacePath = getWorkspacePath(workspaceId)
        
        // Remove from memory
        this.workspaces.delete(workspaceId)

        // Remove from config
        await this.saveConfig()

        // Delete directory
        await fs.rm(workspacePath, { recursive: true, force: true })
    }

    async renameWorkspace(workspaceId: string, newName: string): Promise<Workspace> {
        const workspace = this.workspaces.get(workspaceId)
        if (!workspace) {
            throw new Error('Workspace not found')
        }

        const updatedWorkspace: Workspace = {
            ...workspace,
            name: newName,
        }

        this.workspaces.set(workspaceId, updatedWorkspace)

        // Update settings
        const settingsPath = getWorkspaceSettingsPath(workspaceId)
        const settings = await readJsonFile<WorkspaceSettings>(settingsPath) || {
            agentIds: [],
            skillIds: [],
            config: {},
        }
        await writeJsonFile(settingsPath, settings)

        return updatedWorkspace
    }

    async switchWorkspace(workspaceId: string): Promise<Workspace> {
        const workspace = await this.loadWorkspace(workspaceId)
        if (!workspace) {
            throw new Error('Workspace not found')
        }

        this.activeWorkspaceId = workspaceId

        // Update last opened
        const updatedWorkspace: Workspace = {
            ...workspace,
            lastOpened: Date.now(),
        }
        this.workspaces.set(workspaceId, updatedWorkspace)

        await this.saveConfig()

        return updatedWorkspace
    }

    async listWorkspaces(): Promise<readonly Workspace[]> {
        const config = await this.loadConfig()
        
        if (!config || config.workspaces.length === 0) {
            return []
        }

        const workspaces: Workspace[] = []
        for (const id of config.workspaces) {
            const workspace = await this.loadWorkspace(id)
            if (workspace) {
                workspaces.push(workspace)
            }
        }

        return workspaces.sort((a, b) => b.lastOpened - a.lastOpened)
    }

    async loadWorkspace(workspaceId: string): Promise<Workspace | null> {
        const workspacePath = getWorkspacePath(workspaceId)
        
        try {
            await fs.access(workspacePath)
        } catch {
            return null
        }

        const settingsPath = getWorkspaceSettingsPath(workspaceId)
        const settings = await readJsonFile<WorkspaceSettings>(settingsPath)

        // If we have it in memory, return it
        const cached = this.workspaces.get(workspaceId)
        if (cached) {
            return cached
        }

        // Return workspace from path (createdAt from directory)
        const stats = await fs.stat(workspacePath)
        
        const workspace: Workspace = {
            id: workspaceId,
            name: settings?.config?.name as string || workspaceId,
            createdAt: stats.birthtimeMs,
            lastOpened: Date.now(),
        }

        this.workspaces.set(workspaceId, workspace)
        return workspace
    }

    async getActiveWorkspace(): Promise<Workspace | null> {
        if (!this.activeWorkspaceId) {
            return null
        }
        return this.loadWorkspace(this.activeWorkspaceId)
    }

    async duplicateWorkspace(sourceWorkspaceId: string, newName: string): Promise<Workspace> {
        const sourcePath = getWorkspacePath(sourceWorkspaceId)
        const newWorkspace = await this.createWorkspace(newName)
        const newPath = getWorkspacePath(newWorkspace.id)

        // Copy directories
        const dirs = ['agents', 'skills', 'executions', 'metrics', 'snapshots', 'memory']
        
        for (const dir of dirs) {
            const srcDir = path.join(sourcePath, dir)
            const destDir = path.join(newPath, dir)
            
            try {
                await fs.cp(srcDir, destDir, { recursive: true })
            } catch {
                // Source directory might not exist
            }
        }

        // Copy settings
        const srcSettings = await readJsonFile<WorkspaceSettings>(getWorkspaceSettingsPath(sourceWorkspaceId))
        if (srcSettings) {
            await writeJsonFile(getWorkspaceSettingsPath(newWorkspace.id), srcSettings)
        }

        return newWorkspace
    }

    getActiveWorkspaceId(): string | null {
        return this.activeWorkspaceId
    }

    getWorkspaceStoragePath(workspaceId: string, type: 'agents' | 'skills' | 'executions' | 'metrics' | 'snapshots' | 'memory'): string {
        return path.join(getWorkspacePath(workspaceId), type)
    }
}

// ─── Singleton Instance ────────────────────────────────────────────────────────────

let workspaceManagerInstance: WorkspaceManager | null = null

export function getWorkspaceManager(): WorkspaceManager {
    if (!workspaceManagerInstance) {
        workspaceManagerInstance = new WorkspaceManager()
    }
    return workspaceManagerInstance
}
