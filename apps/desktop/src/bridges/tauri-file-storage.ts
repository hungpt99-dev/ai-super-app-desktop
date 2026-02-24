/**
 * TauriFileStorageAdapter — WebView-safe filesystem storage using tauri-plugin-store.
 *
 * Implements IFileStoragePort without any Node built-in modules.
 * Data is persisted via Tauri's key-value store (plugin-store) using
 * composite keys: "{subdir}/{filename}".
 *
 * Falls back to an in-memory Map when running outside a Tauri WebView
 * (browser dev mode).
 */

import type { IFileStoragePort } from '@agenthub/contracts'

const STORE_NAME = 'agenthub-files.json'

async function getStore(): Promise<IKVStore> {
    try {
        const { load } = await import('@tauri-apps/plugin-store')
        return new TauriStoreHandle(await load(STORE_NAME))
    } catch {
        return InMemoryStoreHandle.instance()
    }
}

interface IKVStore {
    get<T>(key: string): Promise<T | undefined>
    set(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<boolean>
    keys(): Promise<string[]>
    save(): Promise<void>
}

class TauriStoreHandle implements IKVStore {
    constructor(private readonly store: IKVStore) {}
    get<T>(key: string) { return this.store.get<T>(key) }
    set(key: string, value: unknown) { return this.store.set(key, value) }
    delete(key: string) { return this.store.delete(key) }
    keys() { return this.store.keys() }
    save() { return this.store.save() }
}

class InMemoryStoreHandle implements IKVStore {
    private static _instance: InMemoryStoreHandle | null = null
    private readonly data = new Map<string, unknown>()
    // Required by interface but unused in memory implementation
    public readonly store: IKVStore | null = null

    static instance(): InMemoryStoreHandle {
        if (!this._instance) this._instance = new InMemoryStoreHandle()
        return this._instance
    }

    get<T>(key: string): Promise<T | undefined> {
        return Promise.resolve(this.data.get(key) as T | undefined)
    }
    set(key: string, value: unknown): Promise<void> {
        this.data.set(key, value)
        return Promise.resolve()
    }
    delete(key: string): Promise<boolean> {
        return Promise.resolve(this.data.delete(key))
    }
    keys(): Promise<string[]> {
        return Promise.resolve(Array.from(this.data.keys()))
    }
    save(): Promise<void> {
        return Promise.resolve()
    }
}

function compositeKey(subdir: string, filename: string): string {
    return `${subdir}/${filename}`
}

export class TauriFileStorageAdapter implements IFileStoragePort {
    ensureDir(_subdir: string): Promise<string> {
        return Promise.resolve(_subdir)
    }

    async writeJson<T>(subdir: string, filename: string, data: T): Promise<void> {
        const store = await getStore()
        await store.set(compositeKey(subdir, filename), data)
        await store.save()
    }

    async readJson<T>(subdir: string, filename: string): Promise<T | null> {
        const store = await getStore()
        const val = await store.get<T>(compositeKey(subdir, filename))
        return val ?? null
    }

    async deleteFile(subdir: string, filename: string): Promise<void> {
        const store = await getStore()
        await store.delete(compositeKey(subdir, filename))
        await store.save()
    }

    async listFiles(subdir: string): Promise<string[]> {
        const store = await getStore()
        const allKeys = await store.keys()
        const prefix = `${subdir}/`
        return allKeys
            .filter(k => k.startsWith(prefix))
            .map(k => k.slice(prefix.length))
            .filter(k => k.endsWith('.json'))
    }

    async readAllJson<T>(subdir: string): Promise<T[]> {
        const files = await this.listFiles(subdir)
        const results: T[] = []
        for (const file of files) {
            const data = await this.readJson<T>(subdir, file)
            if (data !== null) results.push(data)
        }
        return results
    }

    async copyToVersionDir(subdir: string, filename: string, version: string): Promise<void> {
        const data = await this.readJson<unknown>(subdir, filename)
        if (data === null) return
        const base = filename.replace(/\.json$/, '')
        const versionDir = `${subdir}/versions`
        await this.writeJson(versionDir, `${base}_v${version}.json`, data)
    }
}
