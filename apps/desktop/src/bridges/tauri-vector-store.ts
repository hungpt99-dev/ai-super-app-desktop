import type { ICoreVectorStore } from '@agenthub/core'

/**
 * TauriVectorStore
 * 
 * Implements ICoreVectorStore using tauri-plugin-store for persistence
 * and a simple linear scan for search (suitable for small-scale agent memory).
 */
export class TauriVectorStore implements ICoreVectorStore {
    private readonly storeName: string

    constructor(storeName: string = 'agent-vectors.json') {
        this.storeName = storeName
    }

    async upsert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void> {
        try {
            const { load } = await import('@tauri-apps/plugin-store')
            const store = await load(this.storeName)
            await store.set(id, { vector, metadata })
            await store.save()
        } catch (err) {
            console.error('Failed to upsert vector', { id, err })
        }
    }

    async search(vector: number[], topK: number): Promise<{ readonly id: string; readonly score: number }[]> {
        try {
            const { load } = await import('@tauri-apps/plugin-store')
            const store = await load(this.storeName)
            const allEntries = await store.entries() as [string, { vector: number[], metadata: Record<string, unknown> }][]

            const results = allEntries.map(([id, data]) => ({
                id,
                score: this.cosineSimilarity(vector, data.vector)
            }))

            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, topK)
        } catch (err) {
            console.error('Failed to search vectors', err)
            return []
        }
    }

    private cosineSimilarity(v1: number[], v2: number[]): number {
        let dotProduct = 0
        let mag1 = 0
        let mag2 = 0
        for (let i = 0; i < v1.length; i++) {
            dotProduct += v1[i]! * v2[i]!
            mag1 += v1[i]! * v1[i]!
            mag2 += v2[i]! * v2[i]!
        }
        return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2))
    }
}
