# Memory Model

## Architecture

Memory in AgentHub follows a three-tier architecture with all interfaces defined as ports in the core domain layer.

```
┌─────────────────────────────────────────┐
│           Working Memory                │
│  (current execution context, variables) │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│           Session Memory                │
│  (conversation history per session)     │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          Long-Term Memory               │
│  (persistent facts, embeddings, search) │
└─────────────────────────────────────────┘
```

## Memory Types

| Type | Description |
|---|---|
| `fact` | Factual information stored for recall |
| `preference` | User preferences and settings |
| `instruction` | Standing instructions for agent behavior |
| `episode` | Episodic memory of past interactions |
| `summary` | Compressed summaries of conversations |
| `workflow` | Stored workflows and procedures |

## Memory Scopes

| Scope | Visibility |
|---|---|
| `private` | Visible only to the owning agent |
| `shared` | Visible to all agents in the workspace |
| `session` | Visible within the current session only |

## Pruning Strategies

| Strategy | Behavior |
|---|---|
| `lru` | Least recently used eviction |
| `fifo` | First in, first out |
| `relevance` | Score-based pruning using embeddings |
| `none` | No automatic pruning |

## Core Ports

### IMemoryStorage

```typescript
interface IMemoryStorage {
  upsert(item: IMemoryItem): Promise<void>
  get(id: string): Promise<IMemoryItem | null>
  delete(id: string): Promise<void>
  list(scope?: string): Promise<readonly IMemoryItem[]>
}
```

### IVectorStorePort

```typescript
interface IVectorStorePort {
  upsert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void>
  search(vector: number[], topK: number): Promise<readonly IMemoryResult[]>
  delete(id: string): Promise<void>
}
```

### IEmbeddingStrategy

```typescript
interface IEmbeddingStrategy {
  embed(text: string): Promise<number[]>
  embedBatch(texts: readonly string[]): Promise<readonly number[][]>
  readonly dimensions: number
}
```

### IRetrievalStrategy

```typescript
interface IRetrievalStrategy {
  retrieve(query: string, topK: number): Promise<readonly IMemoryResult[]>
}
```

### IWorkingMemory

```typescript
interface IWorkingMemory {
  get(key: string): unknown
  set(key: string, value: unknown): void
  clear(): void
  snapshot(): Readonly<Record<string, unknown>>
}
```

### ISessionMemory

```typescript
interface ISessionMemory {
  append(message: IAgentMessage): void
  getHistory(limit?: number): readonly IAgentMessage[]
  clear(): void
  readonly sessionId: string
}
```

## Infrastructure Adapters

| Adapter | Port | Location |
|---|---|---|
| `VectorStoreAdapter` | `IVectorStorePort` | `packages/infrastructure/src/vector-store-adapter/` |
| `EmbeddingAdapter` | `IEmbeddingStrategy` | `packages/infrastructure/src/embedding-adapter/` |

## Location

All memory domain types and ports are in `packages/core/src/memory-domain/`.
