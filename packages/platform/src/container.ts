/**
 * Dependency container — holds all resolved adapter instances.
 *
 * Platform wires concrete adapters here before passing to createRuntime().
 */

import type {
    ICoreStorageAdapter,
    ICoreLLMProvider,
    ICoreSandbox,
    ICoreVectorStore,
} from '@agenthub/core'

export interface IDependencyContainer {
    /** Storage adapter (SQLite, Tauri, etc.). */
    storage: ICoreStorageAdapter
    /** LLM provider adapter. */
    provider: ICoreLLMProvider
    /** Sandbox adapter for code execution. */
    sandbox: ICoreSandbox
    /** Vector store adapter. */
    vectorStore: ICoreVectorStore
    /** Secret vault for API keys. */
    secretVault?: unknown
}
