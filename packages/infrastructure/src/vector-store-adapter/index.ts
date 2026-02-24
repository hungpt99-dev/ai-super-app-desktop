import type { MemoryDomain } from '@agenthub/core'

type IVectorStorePort = MemoryDomain.IVectorStorePort
type IMemoryResult = MemoryDomain.IMemoryResult
type IMemoryItem = MemoryDomain.IMemoryItem

interface VectorEntry {
    readonly id: string
    readonly vector: readonly number[]
    readonly metadata: Readonly<Record<string, unknown>>
}

export class VectorStoreAdapter implements IVectorStorePort {
    private readonly _entries: Map<string, VectorEntry> = new Map()

    async upsert(
        id: string,
        vector: readonly number[],
        metadata: Readonly<Record<string, unknown>>
    ): Promise<void> {
        this._entries.set(id, { id, vector, metadata })
    }

    async search(queryVector: readonly number[], topK: number): Promise<IMemoryResult[]> {
        const scored: Array<{ id: string; score: number; metadata: Readonly<Record<string, unknown>> }> = []

        for (const entry of this._entries.values()) {
            const score = this._cosineSimilarity(queryVector, entry.vector)
            scored.push({ id: entry.id, score, metadata: entry.metadata })
        }

        scored.sort((a, b) => b.score - a.score)

        return scored.slice(0, topK).map(s => ({
            item: {
                id: s.id,
                agentId: (s.metadata['agentId'] as string) ?? '',
                scope: (s.metadata['scope'] as string) ?? 'long-term',
                type: (s.metadata['type'] as IMemoryItem['type']) ?? 'semantic',
                content: (s.metadata['content'] as string) ?? '',
                importance: (s.metadata['importance'] as number) ?? 0,
                embedding: [],
                createdAt: (s.metadata['createdAt'] as string) ?? new Date().toISOString(),
            },
            score: s.score,
        }))
    }

    async delete(id: string): Promise<void> {
        this._entries.delete(id)
    }

    private _cosineSimilarity(a: readonly number[], b: readonly number[]): number {
        const len = Math.min(a.length, b.length)
        let dot = 0
        let magA = 0
        let magB = 0
        for (let i = 0; i < len; i++) {
            dot += a[i]! * b[i]!
            magA += a[i]! * a[i]!
            magB += b[i]! * b[i]!
        }
        const denom = Math.sqrt(magA) * Math.sqrt(magB)
        if (denom === 0) return 0
        return dot / denom
    }
}
