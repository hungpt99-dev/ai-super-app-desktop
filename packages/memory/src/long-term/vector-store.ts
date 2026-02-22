import type { IVectorStore, IMemoryResult } from '../index.js'

export class CosineVectorStore implements IVectorStore {
    private items: Array<{ id: string, vector: number[], metadata: Record<string, unknown> }> = []

    async upsert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void> {
        const existingIndex = this.items.findIndex(i => i.id === id)
        if (existingIndex >= 0) {
            this.items[existingIndex] = { id, vector, metadata }
        } else {
            this.items.push({ id, vector, metadata })
        }
    }

    async delete(id: string): Promise<void> {
        this.items = this.items.filter(i => i.id !== id)
    }

    async search(queryVector: number[], topK: number): Promise<IMemoryResult[]> {
        const sorted = this.items
            .map(item => ({
                item: {
                    id: item.id,
                    agentId: String(item.metadata.agentId || ''),
                    scope: String(item.metadata.scope || 'long-term'),
                    type: String(item.metadata.type || 'semantic') as any,
                    importance: Number(item.metadata.importance || 0),
                    embedding: item.vector,
                    content: String(item.metadata.content || ''),
                    createdAt: String(item.metadata.createdAt || new Date().toISOString())
                },
                score: this.cosineSimilarity(queryVector, item.vector)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.max(1, topK))

        return sorted
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        let dotProduct = 0
        let normA = 0
        let normB = 0
        for (let i = 0; i < a.length; i++) {
            const valA = a[i] ?? 0
            const valB = b[i] ?? 0
            dotProduct += valA * valB
            normA += valA * valA
            normB += valB * valB
        }
        if (normA === 0 || normB === 0) return 0
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
    }
}
