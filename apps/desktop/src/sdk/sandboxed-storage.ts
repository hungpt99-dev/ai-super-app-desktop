import type { IStorageAPI } from '@agenthub/sdk'
import { Permission } from '@agenthub/sdk'
import type { PermissionEngine } from '../core/permission-engine.js'
import { logger } from '@agenthub/shared'

const log = logger.child('SandboxedStorage')

/**
 * SandboxedStorage — Proxy Pattern + Namespace Isolation.
 *
 * Each module gets its own namespaced storage so modules cannot
 * read each other's data. Keys are automatically prefixed with moduleId.
 */
export class SandboxedStorage implements IStorageAPI {
  /** In-memory store for MVP. Production: use electron-store with encryption. */
  private readonly store = new Map<string, unknown>()

  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
  ) {}

  get<T>(key: string): Promise<T | null> {
    this.permissionEngine.check(this.moduleId, Permission.StorageRead)
    const value = this.store.get(this.ns(key))
    log.debug('storage.get', { moduleId: this.moduleId, key })
    return Promise.resolve((value as T | undefined) ?? null)
  }

  set<T>(key: string, value: T): Promise<void> {
    this.permissionEngine.check(this.moduleId, Permission.StorageWrite)
    this.store.set(this.ns(key), value)
    log.debug('storage.set', { moduleId: this.moduleId, key })
    return Promise.resolve()
  }

  delete(key: string): Promise<void> {
    this.permissionEngine.check(this.moduleId, Permission.StorageWrite)
    this.store.delete(this.ns(key))
    return Promise.resolve()
  }

  clear(): Promise<void> {
    this.permissionEngine.check(this.moduleId, Permission.StorageWrite)
    for (const k of this.store.keys()) {
      if (k.startsWith(`${this.moduleId}:`)) {
        this.store.delete(k)
      }
    }
    return Promise.resolve()
  }

  keys(): Promise<string[]> {
    this.permissionEngine.check(this.moduleId, Permission.StorageRead)
    const prefix = `${this.moduleId}:`
    return Promise.resolve(
      Array.from(this.store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length))
    )
  }

  /** Namespace key to prevent cross-module data access */
  private ns(key: string): string {
    return `${this.moduleId}:${key}`
  }
}
