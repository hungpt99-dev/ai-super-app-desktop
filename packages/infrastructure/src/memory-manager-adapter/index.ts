/**
 * LongTermMemoryManager — infrastructure implementation.
 *
 * Moved from core to enforce Clean Architecture dependency rule:
 * core must not contain concrete implementations.
 *
 * See: docs/technical-design.md §5 LONG-TERM MEMORY SYSTEM
 */

import type { MemoryDomain } from '@agenthub/core'

type IMemoryItem = MemoryDomain.IMemoryItem
type IMemoryStore = MemoryDomain.IMemoryStorage
type IVectorStore = MemoryDomain.IVectorStorePort
type IEmbeddingService = MemoryDomain.IEmbeddingStrategy
type ILongTermMemoryManager = MemoryDomain.ILongTermMemoryManager

export class LongTermMemoryManager implements ILongTermMemoryManager {
    constructor(
        private readonly memoryStore: IMemoryStore,
        private readonly vectorStore: IVectorStore,
        private readonly embeddingService: IEmbeddingService
    ) { }

    async store(item: IMemoryItem): Promise<IMemoryItem> {
        const embedding = await this.embeddingService.embed(item.content)
        const storedItem = await this.memoryStore.upsert({ ...item, embedding: [...embedding] })

        await this.vectorStore.upsert(storedItem.id, [...embedding], {
            agentId: storedItem.agentId,
            scope: storedItem.scope,
            type: storedItem.type,
            importance: storedItem.importance,
            content: storedItem.content,
            createdAt: storedItem.createdAt
        })

        return { ...storedItem, embedding: [...embedding] }
    }

    async searchSemantic(agentId: string, query: string, topK: number = 5): Promise<IMemoryItem[]> {
        const queryVector = await this.embeddingService.embed(query)
        const results = await this.vectorStore.search([...queryVector], topK)

        return results
            .filter((r: MemoryDomain.IMemoryResult) => r.item.agentId === agentId)
            .map((r: MemoryDomain.IMemoryResult) => r.item)
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
