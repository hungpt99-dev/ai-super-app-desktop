/**
 * Core memory module — ports, types, and interfaces only.
 *
 * Implementations (LongTermMemoryManager, CosineVectorStore, OpenAiEmbeddingService)
 * live in @agenthub/infrastructure.
 *
 * Clean Architecture: core defines contracts, infrastructure implements them.
 */

export * from './types.js'
export * from './ports.js'
export * from './long-term-manager.js'
export * from './working-memory.js'
