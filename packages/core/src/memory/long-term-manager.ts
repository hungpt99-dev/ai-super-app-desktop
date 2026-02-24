/**
 * LongTermMemoryManager port — domain interface only.
 *
 * Implementation lives in @agenthub/infrastructure (memory-manager-adapter).
 * Core never contains concrete implementations.
 *
 * See: docs/technical-design.md §5 LONG-TERM MEMORY SYSTEM
 */

import type { IMemoryItem } from './types.js'

export interface ILongTermMemoryManager {
    store(item: Omit<IMemoryItem, 'id' | 'createdAt' | 'embedding'>): Promise<IMemoryItem>
    searchSemantic(agentId: string, query: string, topK?: number): Promise<IMemoryItem[]>
    prune(agentId: string, thresholdImportance?: number): Promise<number>
}
