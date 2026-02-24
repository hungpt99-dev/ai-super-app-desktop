/**
 * Node-only infrastructure adapters.
 *
 * These adapters depend on native Node modules (better-sqlite3, crypto, fs, etc.)
 * and MUST NOT be imported in a browser / WebView context.
 *
 * Usage:
 *   import { StorageSqliteAdapter } from '@agenthub/infrastructure/node'
 */
export { StorageSqliteAdapter } from './storage-adapter/sqlite/index.js'
export { SqliteSecretVault } from './storage-adapter/secret/index.js'
export { SqliteMemoryStore } from './storage-adapter/sqlite/memory-store.js'

// Filesystem-based adapters (depend on node:fs)
export { LocalFileStorageAdapter } from './local-storage-adapter/index.js'
export { LocalSnapshotStorageAdapter } from './snapshot-storage-adapter/index.js'
export { FileMetricsStore } from './observability-adapter/FileMetricsStore.js'
