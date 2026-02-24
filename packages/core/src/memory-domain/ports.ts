import type { IMemoryItem, IMemoryResult, MemoryType, IAgentMessage } from './types.js'

export interface IMemoryStorage {
    upsert(item: IMemoryItem): Promise<IMemoryItem>
    get(id: string): Promise<IMemoryItem | null>
    delete(id: string): Promise<void>
    list(agentId: string, options?: { type?: MemoryType; limit?: number }): Promise<IMemoryItem[]>
}

export interface IVectorStorePort {
    upsert(id: string, vector: readonly number[], metadata: Readonly<Record<string, unknown>>): Promise<void>
    search(vector: readonly number[], topK: number): Promise<IMemoryResult[]>
    delete(id: string): Promise<void>
}

export interface IEmbeddingStrategy {
    embed(text: string): Promise<readonly number[]>
    embedBatch(texts: readonly string[]): Promise<ReadonlyArray<readonly number[]>>
    readonly dimensions: number
}

export interface IRetrievalStrategy {
    retrieve(agentId: string, query: string, topK?: number): Promise<IMemoryItem[]>
}

export interface IWorkingMemory {
    getConversationHistory(): IAgentMessage[]
    appendMessage(msg: IAgentMessage): void
    compact(maxTokens: number): Promise<void>
}

export interface ISessionMemory {
    readonly sessionId: string
    readonly agentId: string
    get(key: string): unknown
    set(key: string, value: unknown): void
    clear(): void
}

export interface ILongTermMemoryManager {
    store(item: IMemoryItem): Promise<IMemoryItem>
    searchSemantic(agentId: string, query: string, topK?: number): Promise<IMemoryItem[]>
    prune(agentId: string, thresholdImportance?: number): Promise<number>
}
