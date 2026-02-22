import type { ICoreStorageAdapter } from '@agenthub/core'

/**
 * AgentRuntimeTauriStorage
 * 
 * Implements IStorageAdapter using tauri-plugin-store.
 * This allows the browser-based renderer to persist data through 
 * the Tauri IPC bridge.
 */
export class AgentRuntimeTauriStorage implements ICoreStorageAdapter {
    private readonly storeName: string

    constructor(storeName: string = 'agent-runtime.json') {
        this.storeName = storeName
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const { load } = await import('@tauri-apps/plugin-store')
            const store = await load(this.storeName)
            const val = await store.get<T>(key)
            return val ?? null
        } catch {
            return null
        }
    }

    async set<T>(key: string, value: T): Promise<void> {
        try {
            const { load } = await import('@tauri-apps/plugin-store')
            const store = await load(this.storeName)
            await store.set(key, value)
            await store.save()
        } catch (err) {
            console.error('Failed to set storage key', { key, err })
        }
    }

    async has(key: string): Promise<boolean> {
        try {
            const { load } = await import('@tauri-apps/plugin-store')
            const store = await load(this.storeName)
            return await store.has(key)
        } catch {
            return false
        }
    }

    async delete(key: string): Promise<void> {
        try {
            const { load } = await import('@tauri-apps/plugin-store')
            const store = await load(this.storeName)
            await store.delete(key)
            await store.save()
        } catch { /* ignore */ }
    }

    async keys(prefix?: string): Promise<string[]> {
        try {
            const { load } = await import('@tauri-apps/plugin-store')
            const store = await load(this.storeName)
            const allKeys = await store.keys()
            if (prefix) return allKeys.filter(k => k.startsWith(prefix))
            return allKeys
        } catch {
            return []
        }
    }

    async clear(): Promise<void> {
        try {
            const { load } = await import('@tauri-apps/plugin-store')
            const store = await load(this.storeName)
            await store.clear()
            await store.save()
        } catch { /* ignore */ }
    }
}
