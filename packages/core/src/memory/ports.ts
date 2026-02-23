/**
 * Memory port interfaces — core defines these, infrastructure implements them.
 *
 * Core never imports storage/provider implementations directly.
 * These ports are injected at runtime by the platform layer.
 *
 * See: docs/technical-design.md §5.3 Storage Architecture
 */

import type { IMemoryItem, IMemoryResult, MemoryType } from './types.js'

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
