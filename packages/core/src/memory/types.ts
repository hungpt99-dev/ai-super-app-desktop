/**
 * Memory domain types — owned by core.
 *
 * See: docs/technical-design.md §5 LONG-TERM MEMORY SYSTEM
 */

export type MemoryType = 'episodic' | 'semantic' | 'procedural'

export type CoreMemoryScope = 'working' | 'session' | 'long-term'

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

// ─── Memory Pruning ─────────────────────────────────────────────────────────

export type PruningStrategy = 'importance_decay' | 'time_ttl' | 'auto_summarize' | 'manual'

export interface IPruningConfig {
    readonly strategy: PruningStrategy
    /** TTL in seconds (for time_ttl strategy). */
    readonly ttlSeconds?: number
    /** Minimum importance threshold below which memories are pruned. */
    readonly minImportance?: number
}
