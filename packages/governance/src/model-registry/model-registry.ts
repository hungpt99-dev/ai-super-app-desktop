/**
 * ModelRegistry — maintains allowlist/denylist of models per workspace.
 *
 * Implements IModelRegistryPort from core.
 */

import type { GovernanceDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IModelRegistryPort = GovernanceDomain.IModelRegistryPort
type IModelRegistryEntry = GovernanceDomain.IModelRegistryEntry

const log = logger.child('ModelRegistry')

export class ModelRegistry implements IModelRegistryPort {
    private readonly models: Map<string, IModelRegistryEntry> = new Map()
    private readonly workspaceAllowlists: Map<string, Set<string>> = new Map()
    private readonly workspaceDenylists: Map<string, Set<string>> = new Map()
    private readonly workspaceDefaults: Map<string, string> = new Map()

    async isAllowed(modelId: string, workspaceId: string): Promise<boolean> {
        const denylist = this.workspaceDenylists.get(workspaceId)
        if (denylist?.has(modelId)) {
            return false
        }

        const allowlist = this.workspaceAllowlists.get(workspaceId)
        if (allowlist && allowlist.size > 0) {
            return allowlist.has(modelId)
        }

        const entry = this.models.get(modelId)
        if (entry) {
            return entry.status === 'allowed'
        }

        return true
    }

    async getModel(modelId: string): Promise<IModelRegistryEntry | null> {
        return this.models.get(modelId) ?? null
    }

    async listModels(workspaceId: string): Promise<readonly IModelRegistryEntry[]> {
        const results: IModelRegistryEntry[] = []
        for (const entry of this.models.values()) {
            const allowed = await this.isAllowed(entry.modelId, workspaceId)
            if (allowed) {
                results.push(entry)
            }
        }
        return results
    }

    async allowModel(modelId: string, workspaceId: string): Promise<void> {
        let allowlist = this.workspaceAllowlists.get(workspaceId)
        if (!allowlist) {
            allowlist = new Set()
            this.workspaceAllowlists.set(workspaceId, allowlist)
        }
        allowlist.add(modelId)

        const denylist = this.workspaceDenylists.get(workspaceId)
        denylist?.delete(modelId)

        log.info('Model allowed', { modelId, workspaceId })
    }

    async denyModel(modelId: string, workspaceId: string): Promise<void> {
        let denylist = this.workspaceDenylists.get(workspaceId)
        if (!denylist) {
            denylist = new Set()
            this.workspaceDenylists.set(workspaceId, denylist)
        }
        denylist.add(modelId)

        const allowlist = this.workspaceAllowlists.get(workspaceId)
        allowlist?.delete(modelId)

        log.info('Model denied', { modelId, workspaceId })
    }

    async registerModel(entry: IModelRegistryEntry): Promise<void> {
        this.models.set(entry.modelId, entry)
        log.info('Model registered', { modelId: entry.modelId, provider: entry.provider })
    }

    async getDefaultModel(workspaceId: string): Promise<string | null> {
        return this.workspaceDefaults.get(workspaceId) ?? null
    }

    async setDefaultModel(modelId: string, workspaceId: string): Promise<void> {
        this.workspaceDefaults.set(workspaceId, modelId)
        log.info('Default model set', { modelId, workspaceId })
    }
}
