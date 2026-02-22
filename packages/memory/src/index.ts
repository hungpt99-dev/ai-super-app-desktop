/**
 * Memory Package — short-term, long-term, and embedding memory layers.
 *
 * Memory package must NOT import provider or storage implementation directly.
 * Only accept interfaces.
 *
 * See: docs/technical-design.md §5 LONG-TERM MEMORY SYSTEM
 * See: docs/codebase.md Memory Rule
 */

// ─── Memory Types ───────────────────────────────────────────────────────────

export type MemoryType = 'episodic' | 'semantic' | 'procedural'

export type MemoryScope = 'working' | 'session' | 'long-term'

// ─── Memory Item ────────────────────────────────────────────────────────────

export interface IMemoryItem {
    readonly id: string
    readonly agentId: string
    readonly scope: string
    readonly type: MemoryType
    readonly importance: number
    readonly embedding: number[]
    readonly content: string
    readonly createdAt: string
    readonly updatedAt?: string
}

// ─── Memory Result ──────────────────────────────────────────────────────────

export interface IMemoryResult {
    readonly item: IMemoryItem
    readonly score: number
}

// ─── Memory Store ───────────────────────────────────────────────────────────

export interface IMemoryStore {
    /** Store or update a memory item. */
    upsert(item: Omit<IMemoryItem, 'id' | 'createdAt'>): Promise<IMemoryItem>
    /** Retrieve a specific memory by ID. */
    get(id: string): Promise<IMemoryItem | null>
    /** Delete a memory item. */
    delete(id: string): Promise<void>
    /** List memories by agent, optionally filtered by type. */
    list(agentId: string, options?: { type?: MemoryType; limit?: number }): Promise<IMemoryItem[]>
}

// ─── Vector Store ───────────────────────────────────────────────────────────

/**
 * VectorStore interface matching the technical design §5.3.
 * Implementations: in-memory, SQLite FTS, external vector DB.
 */
export interface IVectorStore {
    upsert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void>
    search(vector: number[], topK: number): Promise<IMemoryResult[]>
    delete(id: string): Promise<void>
}

// ─── Embedding Service ──────────────────────────────────────────────────────

export interface IEmbeddingService {
    /** Generate an embedding vector for the given text. */
    embed(text: string): Promise<number[]>
    /** Generate embeddings for multiple texts in a single batch. */
    embedBatch(texts: string[]): Promise<number[][]>
    /** Dimensionality of the embedding vectors produced. */
    readonly dimensions: number
}

// ─── Memory Pruning ─────────────────────────────────────────────────────────

export type PruningStrategy = 'importance_decay' | 'time_ttl' | 'auto_summarize' | 'manual'

export interface IPruningConfig {
    readonly strategy: PruningStrategy
    /** TTL in seconds (for time_ttl strategy). */
    readonly ttlSeconds?: number
    /** Minimum importance threshold below which memories are pruned. */
    readonly minImportance?: number
}

export * from './embedding/index.js'
export * from './long-term/vector-store.js'
export * from './long-term/index.js'
