/**
 * Memory Package — infrastructure adapters only.
 *
 * Domain logic (types, interfaces, LongTermMemoryManager) lives in @agenthub/core.
 * This package provides concrete adapter implementations.
 *
 * See: docs/technical-design.md §5 LONG-TERM MEMORY SYSTEM
 */

// Re-export domain types from @agenthub/core for convenience
export type {
    MemoryType,
    CoreMemoryScope,
    IMemoryItem,
    IMemoryResult,
    PruningStrategy,
    IPruningConfig,
    IMemoryStore,
    IVectorStore,
    IEmbeddingService,
    ILongTermMemoryManager,
    IWorkingMemory,
    ISessionMemory,
} from '@agenthub/core'

// Re-export LTM for backward compat
export { LongTermMemoryManager } from '../memory-manager-adapter/index.js'

// Export concrete infrastructure adapters
export { CosineVectorStore } from './long-term/vector-store.js'
