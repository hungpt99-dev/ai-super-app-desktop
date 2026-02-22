import type { IMemoryStore, IMemoryItem, MemoryType } from '@agenthub/memory'

/**
 * TauriMemoryStore
 * 
 * Implements IMemoryStore using tauri-plugin-store.
 * This provides the high-level memory management expected by agents.
 */
export class TauriMemoryStore implements IMemoryStore {
    private readonly storeName: string

    constructor(storeName: string = 'agent-memory.json') {
        this.storeName = storeName
    }

    async upsert(item: Omit<IMemoryItem, 'id' | 'createdAt'>): Promise<IMemoryItem> {
        const { load } = await import('@tauri-apps/plugin-store')
        const store = await load(this.storeName)

        const id = crypto.randomUUID()
        const memory: IMemoryItem = {
            ...item,
            id,
            createdAt: new Date().toISOString()
        }

        await store.set(id, memory)
        await store.save()
        return memory
    }

    async get(id: string): Promise<IMemoryItem | null> {
        const { load } = await import('@tauri-apps/plugin-store')
        const store = await load(this.storeName)
        return await store.get<IMemoryItem>(id) ?? null
    }

    async delete(id: string): Promise<void> {
        const { load } = await import('@tauri-apps/plugin-store')
        const store = await load(this.storeName)
        await store.delete(id)
        await store.save()
    }

    async list(agentId: string, options?: { type?: MemoryType; limit?: number }): Promise<IMemoryItem[]> {
        const { load } = await import('@tauri-apps/plugin-store')
        const store = await load(this.storeName)
        const all = await store.values() as IMemoryItem[]

        let filtered = all.filter(m => m.agentId === agentId)
        if (options?.type) {
            filtered = filtered.filter(m => m.type === options.type)
        }

        return filtered.slice(0, options?.limit ?? 100)
    }
}
