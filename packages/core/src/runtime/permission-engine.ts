import type { IPermissionEngine, Permission } from '@agenthub/sdk'
import { PermissionDeniedError, ValidationError } from '@agenthub/shared'
import { logger } from '@agenthub/shared'

const log = logger.child('PermissionEngine')

/**
 * PermissionEngine — Strategy Pattern.
 *
 * Maintains a per-module grant list. All SDK operations MUST call
 * `check()` before executing. This is the single enforcement point.
 *
 * Thread-safety: JS is single-threaded, so Map operations are atomic.
 * The Map is never exposed directly — only read-only views are returned.
 */
export class PermissionEngine implements IPermissionEngine {
    /** moduleId → Set of granted permissions */
    private readonly grants = new Map<string, Set<Permission>>()

    grant(moduleId: string, permissions: readonly Permission[]): void {
        this.validateModuleId(moduleId)
        if (permissions.length === 0) return

        const existing = this.grants.get(moduleId) ?? new Set<Permission>()
        for (const p of permissions) {
            existing.add(p)
        }
        this.grants.set(moduleId, existing)
        log.info('Permissions granted', { moduleId, permissions })
    }

    revoke(moduleId: string): void {
        this.validateModuleId(moduleId)
        this.grants.delete(moduleId)
        log.info('All permissions revoked', { moduleId })
    }

    /**
     * Revoke a single permission from a module without affecting others.
     * No-op if the module doesn't hold the permission.
     */
    revokePermission(moduleId: string, permission: Permission): void {
        this.validateModuleId(moduleId)
        const perms = this.grants.get(moduleId)
        if (perms) {
            perms.delete(permission)
            if (perms.size === 0) this.grants.delete(moduleId)
            log.info('Permission revoked', { moduleId, permission })
        }
    }

    /**
     * Throws PermissionDeniedError if the module does not hold the permission.
     * Called by SDK proxy before EVERY privileged operation.
     */
    check(moduleId: string, permission: Permission): void {
        if (!this.hasPermission(moduleId, permission)) {
            throw new PermissionDeniedError(
                `Module "${moduleId}" lacks permission: ${permission}`,
                { moduleId, permission },
            )
        }
    }

    hasPermission(moduleId: string, permission: Permission): boolean {
        return this.grants.get(moduleId)?.has(permission) ?? false
    }

    /** Return all permissions for a specific module. */
    getModulePermissions(moduleId: string): ReadonlySet<Permission> {
        return this.grants.get(moduleId) ?? new Set<Permission>()
    }

    /** Return all current in-memory grants (read-only). Used by the Settings UI. */
    getGrants(): ReadonlyMap<string, ReadonlySet<Permission>> {
        return this.grants as ReadonlyMap<string, ReadonlySet<Permission>>
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    private validateModuleId(moduleId: string): void {
        if (!moduleId || typeof moduleId !== 'string' || moduleId.trim().length === 0) {
            throw new ValidationError('moduleId must be a non-empty string', { moduleId })
        }
    }
}
