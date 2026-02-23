/**
 * LongTermMemoryManager — domain logic for storing, retrieving, and pruning
 * long-term semantic memories.
 *
 * See: docs/technical-design.md §5 LONG-TERM MEMORY SYSTEM
 */

import type { IMemoryItem } from './types.js'
import type { IMemoryStore, IVectorStore, IEmbeddingService } from './ports.js'

export interface ILongTermMemoryManager {
    store(item: Omit<IMemoryItem, 'id' | 'createdAt' | 'embedding'>): Promise<IMemoryItem>
    searchSemantic(agentId: string, query: string, topK?: number): Promise<IMemoryItem[]>
    prune(agentId: string, thresholdImportance?: number): Promise<number>
}

export class LongTermMemoryManager implements ILongTermMemoryManager {
    constructor(
        private readonly memoryStore: IMemoryStore,
        private readonly vectorStore: IVectorStore,
        private readonly embeddingService: IEmbeddingService
    ) { }

    async store(item: Omit<IMemoryItem, 'id' | 'createdAt' | 'embedding'>): Promise<IMemoryItem> {
        // 1. Generate embedding
        const embedding = await this.embeddingService.embed(item.content)

        // 2. Save to Memory Store (Relational/Episodic)
        const storedItem = await this.memoryStore.upsert({ ...item, embedding })

        // 3. Save to Vector Store (Semantic)
        await this.vectorStore.upsert(storedItem.id, embedding, {
            agentId: storedItem.agentId,
            scope: storedItem.scope,
            type: storedItem.type,
            importance: storedItem.importance,
            content: storedItem.content,
            createdAt: storedItem.createdAt
        })

        // Return combined item
        return { ...storedItem, embedding }
    }

    async searchSemantic(agentId: string, query: string, topK: number = 5): Promise<IMemoryItem[]> {
        const queryVector = await this.embeddingService.embed(query)
        const results = await this.vectorStore.search(queryVector, topK)

        // Filter by agentId
        return results
            .filter(r => r.item.agentId === agentId)
            .map(r => r.item)
    }

    async prune(agentId: string, thresholdImportance: number = 0.2): Promise<number> {
        const allMemories = await this.memoryStore.list(agentId)

        let prunedCount = 0
        for (const memory of allMemories) {
            if (memory.importance < thresholdImportance) {
                await this.vectorStore.delete(memory.id)
                await this.memoryStore.delete(memory.id)
                prunedCount++
            }
        }
        return prunedCount
    }
}
