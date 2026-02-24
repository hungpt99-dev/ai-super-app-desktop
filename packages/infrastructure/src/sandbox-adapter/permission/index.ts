/**
 * permission/index.ts
 *
 * Runtime permission evaluation and enforcement.
 * Blocks forbidden capabilities per agent manifest at execution time.
 */

export type AccessLevel = 'granted' | 'denied' | 'prompt'

export interface IPermissionRequest {
    agentId: string
    permission: string // e.g. 'network.fetch'
    context?: Record<string, unknown> // e.g. { url: 'https://example.com' }
}

export interface IPermissionEnforcer {
    hasPermission(agentId: string, permission: string): Promise<boolean>
    requestAccess(req: IPermissionRequest): Promise<AccessLevel>
    grantPermission(agentId: string, permission: string): Promise<void>
    revokePermission(agentId: string, permission: string): Promise<void>
}

import { logger } from '@agenthub/shared'

const log = logger.child('PermissionEnforcer')

export class PermissionEnforcer implements IPermissionEnforcer {
    private granted = new Map<string, Set<string>>()

    async hasPermission(agentId: string, permission: string): Promise<boolean> {
        return this.granted.get(agentId)?.has(permission) ?? false
    }

    async requestAccess(req: IPermissionRequest): Promise<AccessLevel> {
        if (await this.hasPermission(req.agentId, req.permission)) {
            return 'granted'
        }
        return 'prompt'
    }

    async grantPermission(agentId: string, permission: string): Promise<void> {
        log.info(`Granting permission ${permission} to agent ${agentId}`)
        if (!this.granted.has(agentId)) {
            this.granted.set(agentId, new Set())
        }
        this.granted.get(agentId)!.add(permission)
    }

    async revokePermission(agentId: string, permission: string): Promise<void> {
        log.info(`Revoking permission ${permission} from agent ${agentId}`)
        this.granted.get(agentId)?.delete(permission)
    }
}
