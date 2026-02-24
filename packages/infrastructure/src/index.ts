// ── Domain Adapters (infrastructure layer) ──────────────────────────────────
export { ProviderAdapter } from './provider-adapter/index.js'
export { StorageAdapter } from './storage-adapter/index.js'
export { VectorStoreAdapter } from './vector-store-adapter/index.js'
export { EmbeddingAdapter } from './embedding-adapter/index.js'
export { SandboxAdapter } from './sandbox-adapter/index.js'
export { TransportAdapter } from './transport-adapter/index.js'
export { ObservabilityAdapter } from './observability-adapter/index.js'
export { SnapshotAdapter } from './snapshot-adapter/index.js'
export { EventBusAdapter } from './event-bus-adapter/index.js'
export { LongTermMemoryManager } from './memory-manager-adapter/index.js'

// ── Desktop-specific adapters ───────────────────────────────────────────────
// NOTE: LocalFileStorageAdapter and LocalSnapshotStorageAdapter use node:fs
// and are exported from the "./node" entry point instead (see node.ts).
export { SemanticVersioningAdapter } from './versioning-adapter/index.js'

// ── Consolidated adapters (re-exported from standalone packages) ─────────────
// Provider adapters
export { ProviderRegistry, OpenaiProviderAdapter, ProviderFallback, OpenAiEmbeddingService } from './provider-adapter/index.js'
export type {
    ILLMProvider, ILLMRequest, ILLMResponse, ILLMChunk, IToolCall, IToolSchema,
    IChatMessage, ChatMessageRole, IProviderRegistry, IProviderFallback,
} from '@agenthub/core'

// Tool adapters
export { ToolRegistry, StandardToolExecutor } from '@agenthub/graph-tools'
export { CustomJsToolAdapter } from '@agenthub/graph-tools'
export { FileReaderToolAdapter, FileWriterToolAdapter } from '@agenthub/graph-tools'
export { HttpFetchToolAdapter } from '@agenthub/graph-tools'
export type { IToolDefinition, IToolResult, IToolRegistry, IToolExecutor, ToolAdapter } from '@agenthub/graph-tools'

// Storage adapters (browser-safe in-memory adapter only; Node-only sqlite
// adapters live in the "./node" entry point — see node.ts)
export type {
    IStorageAdapter, IRelationalStore, IBlobStore, ISnapshotData, ISnapshotStore,
    ISecretVault, IReplayProvider,
} from '@agenthub/core'

// Network adapters
export { WebSocketTransport } from './network-adapter/index.js'
export { ProtocolHandler } from './network-adapter/index.js'
export type { ITransport, IProtocolMessage, IProtocolHandler, TransportStatus, ProtocolAction } from '@agenthub/core'

// Sandbox adapters
export { PermissionEnforcer, WebWorkerSandbox, CoreSandboxAdapter } from './sandbox-adapter/index.js'
export type { IPermissionGuard, ISandbox, ISandboxResourceLimits, SandboxStatus } from '@agenthub/core'
export type { IWorkerSandbox, ISandboxConfig, ISandboxResult, ICoreSandboxPort } from '@agenthub/core'
export { CosineVectorStore } from './memory-adapter/index.js'

// ── Platform v2 Adapters ────────────────────────────────────────────────────
// Model routing and cost calculation
export { ModelRouter } from './model-router-adapter/index.js'
export { CostCalculator } from './cost-calculator-adapter/index.js'

// Security adapters
export { EncryptedStorageAdapter } from './encrypted-storage-adapter/index.js'
export { SecretVaultAdapter } from './secret-vault-adapter/index.js'
export { IPCSchemaValidator } from './ipc-validator-adapter/index.js'
export { ToolSandboxEnforcer } from './tool-sandbox-adapter/index.js'

// Workspace adapter
export { WorkspaceStorageAdapter } from './workspace-storage-adapter/index.js'

// Plugin loader adapter
export { PluginLoaderAdapter } from './plugin-loader-adapter/index.js'


