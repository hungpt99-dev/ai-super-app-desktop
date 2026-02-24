import type { RuntimeDomain } from '@agenthub/core'

type IStoragePort = RuntimeDomain.IStoragePort

export class StorageAdapter implements IStoragePort {
    private readonly _store: Map<string, string> = new Map()

    async get<T>(key: string): Promise<T | null> {
        const raw = this._store.get(key)
        if (raw === undefined) return null
        return JSON.parse(raw) as T
    }

    async set<T>(key: string, value: T): Promise<void> {
        this._store.set(key, JSON.stringify(value))
    }

    async delete(key: string): Promise<void> {
        this._store.delete(key)
    }

    async has(key: string): Promise<boolean> {
        return this._store.has(key)
    }

    async keys(prefix?: string): Promise<string[]> {
        const all = Array.from(this._store.keys())
        if (!prefix) return all
        return all.filter(k => k.startsWith(prefix))
    }

    async clear(): Promise<void> {
        this._store.clear()
    }
}
// Node-only sqlite adapters are NOT re-exported from this barrel.
// Import them from '@agenthub/infrastructure/node' instead.
// export { StorageSqliteAdapter } from './sqlite/index.js'
// export { SqliteSecretVault } from './secret/index.js'
// export { SqliteMemoryStore } from './sqlite/memory-store.js'
