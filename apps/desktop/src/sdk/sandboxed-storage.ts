import type { IStorageAPI } from '@ai-super-app/sdk'
import { Permission } from '@ai-super-app/sdk'
import type { PermissionEngine } from '../core/permission-engine.js'
import { logger } from '@ai-super-app/shared'

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

  async get<T>(key: string): Promise<T | null> {
    this.permissionEngine.check(this.moduleId, Permission.StorageRead)
    const value = this.store.get(this.ns(key))
    log.debug('storage.get', { moduleId: this.moduleId, key })
    return (value as T | undefined) ?? null
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.permissionEngine.check(this.moduleId, Permission.StorageWrite)
    this.store.set(this.ns(key), value)
    log.debug('storage.set', { moduleId: this.moduleId, key })
  }

  async delete(key: string): Promise<void> {
    this.permissionEngine.check(this.moduleId, Permission.StorageWrite)
    this.store.delete(this.ns(key))
  }

  async clear(): Promise<void> {
    this.permissionEngine.check(this.moduleId, Permission.StorageWrite)
    for (const k of this.store.keys()) {
      if (k.startsWith(`${this.moduleId}:`)) {
        this.store.delete(k)
      }
    }
  }

  async keys(): Promise<string[]> {
    this.permissionEngine.check(this.moduleId, Permission.StorageRead)
    const prefix = `${this.moduleId}:`
    return Array.from(this.store.keys())
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length))
  }

  /** Namespace key to prevent cross-module data access */
  private ns(key: string): string {
    return `${this.moduleId}:${key}`
  }
}
