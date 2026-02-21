import type { IPermissionEngine, Permission } from '@ai-super-app/sdk'
import { PermissionDeniedError } from '@ai-super-app/shared'
import { logger } from '@ai-super-app/shared'

const log = logger.child('PermissionEngine')

/**
 * PermissionEngine — Strategy Pattern.
 *
 * Maintains a per-module grant list. All SDK operations MUST call
 * `check()` before executing. This is the single enforcement point.
 */
export class PermissionEngine implements IPermissionEngine {
  /** moduleId → Set of granted permissions */
  private readonly grants = new Map<string, Set<Permission>>()

  grant(moduleId: string, permissions: Permission[]): void {
    const existing = this.grants.get(moduleId) ?? new Set<Permission>()
    for (const p of permissions) {
      existing.add(p)
    }
    this.grants.set(moduleId, existing)
    log.info('Permissions granted', { moduleId, permissions })
  }

  revoke(moduleId: string): void {
    this.grants.delete(moduleId)
    log.info('Permissions revoked', { moduleId })
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

  /** Return all current in-memory grants (read-only). Used by the Settings UI. */
  getGrants(): ReadonlyMap<string, ReadonlySet<Permission>> {
    return this.grants as ReadonlyMap<string, ReadonlySet<Permission>>
  }
}
