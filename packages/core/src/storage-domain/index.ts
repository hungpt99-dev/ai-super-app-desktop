/**
 * Storage Package — adapter interface for persistence.
 *
 * Storage MUST NOT expose sqlite logic to core.
 * Core accesses storage only through the StorageAdapter interface.
 *
 * See: docs/technical-design.md §15 STORAGE LAYER
 * See: docs/codebase.md Storage Rule
 */

// ─── Storage Adapter Interface ──────────────────────────────────────────────

/**
 * Abstract storage adapter used by the runtime engine.
 * Implementations:
 * - Local: SQLite + file-based storage
 * - Server: PostgreSQL + external vector DB
 */
export interface IStorageAdapter {
    /** Get a value by key. Returns null if not found. */
    get<T>(key: string): Promise<T | null>
    /** Set a value by key (upsert). */
    set<T>(key: string, value: T): Promise<void>
    /** Delete a value by key. */
    delete(key: string): Promise<void>
    /** Check if a key exists. */
    has(key: string): Promise<boolean>
    /** List all keys matching an optional prefix. */
    keys(prefix?: string): Promise<string[]>
    /** Clear all stored data. Use with caution. */
    clear(): Promise<void>
}

// ─── Relational Store ───────────────────────────────────────────────────────

export interface IRelationalStore {
    /** Execute a raw SQL query (for SQLite / Postgres adapters). */
    query<T>(sql: string, params?: unknown[]): Promise<T[]>
    /** Execute a write operation (INSERT, UPDATE, DELETE). */
    execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>
}

// ─── Blob Store ─────────────────────────────────────────────────────────────

export interface IBlobStore {
    /** Store a binary blob. */
    put(key: string, data: Uint8Array, contentType?: string): Promise<void>
    /** Retrieve a binary blob. Returns null if not found. */
    get(key: string): Promise<Uint8Array | null>
    /** Delete a blob. */
    delete(key: string): Promise<void>
    /** List all blob keys. */
    keys(): Promise<string[]>
}

// ─── Snapshot Store ─────────────────────────────────────────────────────────

/**
 * Snapshot data structure for execution persistence & replay.
 * See: docs/technical-design.md §8 SNAPSHOT & REPLAY SYSTEM
 */
export interface ISnapshotData {
    readonly executionId: string
    readonly nodePointer: string
    readonly variables: Record<string, unknown>
    readonly memoryReference: string[]
    readonly providerRawResponse: Record<string, unknown>
    readonly timestamp: string
}

export interface ISnapshotStore {
    save(snapshot: ISnapshotData): Promise<void>
    load(executionId: string): Promise<ISnapshotData | null>
    list(agentId: string): Promise<ISnapshotData[]>
    delete(executionId: string): Promise<void>
}

// ─── Secret Vault ───────────────────────────────────────────────────────────

/**
 * Encrypted secret storage. API keys are injected at runtime.
 * Agents NEVER access raw keys — only opaque references.
 *
 * See: docs/technical-design.md §10.2 Secret Vault
 */
export interface ISecretVault {
    /** Store a secret under the given name. Value is encrypted at rest. */
    put(name: string, value: string): Promise<void>
    /** Retrieve a decrypted secret by name. Returns null if not found. */
    get(name: string): Promise<string | null>
    /** Delete a secret by name. */
    delete(name: string): Promise<void>
    /** List all secret names (values are NOT returned). */
    list(): Promise<string[]>
    /** Check if a secret exists without reading it. */
    has(name: string): Promise<boolean>
}

// ─── Replay Provider ────────────────────────────────────────────────────────

/**
 * Replay mode: provider is replaced by a mock that returns stored rawResponse.
 * Used for deterministic replay of past executions.
 *
 * See: docs/technical-design.md §8.2 Replay Mode
 */
export interface IReplayProvider {
    /** Load snapshots for a given execution to use during replay. */
    loadExecution(executionId: string): Promise<ISnapshotData[]>
    /**
     * Return the stored rawResponse for the given node pointer.
     * Replaces the real LLM provider during replay.
     */
    getResponse(nodePointer: string): Promise<Record<string, unknown> | null>
}

// ─── Concrete Implementations ───────────────────────────────────────────────

// Moved to infrastructure
