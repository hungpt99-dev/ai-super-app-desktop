# Architecture — Clean Architecture v4.1 (Iteration 2)

## Layers

| Layer | Package(s) | Responsibility |
|---|---|---|
| **Shared** | `@agenthub/shared` | Cross-cutting types, logger, DTOs, schemas |
| **Contracts** | `@agenthub/contracts` | IPC messages, execution events, cross-boundary DTOs |
| **Core (Domain)** | `@agenthub/core` | Pure domain logic, port interfaces, state machines |
| **Execution** | `@agenthub/execution` | Scheduler, worker pool, lifecycle events |
| **Infrastructure** | `@agenthub/infrastructure` | Unified adapter layer — all port implementations |
| **Standalone Adapters** | `provider`, `tools`, `storage`, `network`, `sandbox` | Concrete implementations, re-exported by infrastructure |
| **Security** | `@agenthub/security` | Signature verification, key management, integrity |
| **Platform** | `@agenthub/platform` | Composition root — wires adapters, creates runtime |
| **SDK** | `@agenthub/sdk` | Public API for module authors and app developers |
| **Apps** | `apps/desktop` | Desktop host with main/renderer split |

## Core Domain Subdomains

```
packages/core/src/
  agent-domain/       Agent registry, orchestrator, multi-agent protocol
  graph-domain/       DAG node types, edges, graph engine ports
  policy-domain/      Budget policies, policy engine evaluation
  memory-domain/      Memory storage, vector store, embedding, retrieval ports
  identity-domain/    Agent identity, identity resolver
  capability-domain/  Capability scope, registry, verifier ports
  event-domain/       30 domain event types, event bus port
  runtime-domain/     Lifecycle state machine, 20+ infrastructure ports
```

## Infrastructure Adapters (Unified Layer)

```
packages/infrastructure/src/
  ── Domain Adapters ──
  provider-adapter/         ILLMProviderPort → multi-provider registry
  storage-adapter/          IStoragePort → in-memory Map
  vector-store-adapter/     IVectorStorePort → cosine similarity search
  embedding-adapter/        IEmbeddingStrategy → delegated embedding
  sandbox-adapter/          ISandboxPort → Function-based execution
  transport-adapter/        ITransportPort → WebSocket
  observability-adapter/    IObservabilityPort → metric/trace collector
  snapshot-adapter/         ISnapshotPort → in-memory snapshot store
  event-bus-adapter/        IDomainEventBus → typed event dispatch
  memory-manager-adapter/   ILongTermMemoryManager → store/search/prune

  ── Consolidated (re-exported from standalone packages) ──
  @agenthub/provider   → ProviderRegistry, OpenaiProviderAdapter, ProviderFallback
  @agenthub/tools      → ToolRegistry, StandardToolExecutor, CustomJsToolAdapter
  @agenthub/storage    → StorageSqliteAdapter, SqliteSecretVault, SqliteMemoryStore
  @agenthub/network    → WebSocketTransport, ProtocolHandler
  @agenthub/sandbox    → PermissionEnforcer, WebWorkerSandbox, CoreSandboxAdapter
```

## Contracts Package

```
packages/contracts/src/
  execution-events.ts     Execution lifecycle event types and emitter contract
  agent-dto.ts            Agent, run, device, metrics DTOs
  skill-dto.ts            Skill definition and result DTOs
  snapshot-dto.ts         Snapshot data and replay DTOs
  ipc-messages.ts         IPC channel names, request/response envelopes
```

## Desktop Main/Renderer Split

```
apps/desktop/src/
  main/                    Main process (platform host)
    platform-host.ts       Composition root — wires core + infrastructure
    runtime-host.ts        Runtime lifecycle management
    ipc/
      handler.ts           IPC message router
      index.ts             Barrel export
    index.ts               Main process barrel

  app/                     Shared app logic
    agent-loop.ts          Agent device loop
    builtin-modules.ts     First-party module definitions
    module-bootstrap.ts    Legacy bootstrap (delegates to main/)
    module-sandbox.ts      Module context proxy

  bridges/                 Tauri-specific adapters
  ui/                      Renderer process (React)
```

## Hexagonal Architecture (Ports & Adapters)

```
                     ┌─────────────────────────────┐
                     │    Core (Domain Layer)       │
                     │    Pure interfaces only      │
                     │                              │
                     │  Ports:                      │
                     │  IStoragePort                │
                     │  ILLMProviderPort            │
                     │  ISandboxPort                │
                     │  ITransportPort              │
                     │  ISnapshotPort               │
                     │  IObservabilityPort          │
                     │  IVectorStorePort            │
                     │  IDomainEventBus             │
                     │  ILongTermMemoryManager      │
                     └───────────┬─────────────────┘
                                 │ implements
                     ┌───────────▼─────────────────┐
                     │  Infrastructure Layer        │
                     │  (Unified Adapter Layer)     │
                     │                              │
                     │  Domain adapters (in-pkg)    │
                     │  + Standalone packages       │
                     │    (provider, tools, etc.)   │
                     │  = Single import surface     │
                     └───────────┬─────────────────┘
                                 │ wired by
                     ┌───────────▼─────────────────┐
                     │  Platform (Composition Root) │
                     │  createRuntime()             │
                     └───────────┬─────────────────┘
                                 │ hosted by
                     ┌───────────▼─────────────────┐
                     │  Apps (Desktop)              │
                     │  main/ → PlatformHost        │
                     │  ui/   → Renderer (React)    │
                     │  IPC bridge between them     │
                     └─────────────────────────────┘
```

## Factory Pattern

Apps MUST call `createRuntime()` from `@agenthub/platform`. Direct `new AgentRuntime(...)` is forbidden outside the platform layer.

```typescript
import { createRuntime } from '@agenthub/platform'

const bundle = createRuntime({
  storage: new StorageAdapter(),
  provider: new ProviderAdapter(),
  sandbox: new SandboxAdapter(),
})
```
