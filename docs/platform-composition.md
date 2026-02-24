# Platform Composition

## Role

The Platform package (`@agenthub/platform`) is the **composition root** of the AgentHub system. It is the single place where:

- Concrete infrastructure adapters are instantiated
- Dependencies are wired together
- `AgentRuntime` is created via the factory function

No business logic lives in Platform. It only wires and returns.

## Desktop Main/Renderer Architecture

The desktop app separates concerns between main and renderer processes:

### Main Process (`apps/desktop/src/main/`)

- **PlatformHost** — singleton composition root, owns the `IRuntimeBundle`
- **RuntimeHost** — lifecycle manager, coordinates startup/shutdown/agent loop
- **IPC Handler** — typed message router using `@agenthub/contracts` envelopes

### Renderer Process (`apps/desktop/src/ui/`)

- React components, hooks, stores
- Communicates with main ONLY via IPC bridge
- NEVER imports from `@agenthub/core`, `@agenthub/infrastructure`, or `@agenthub/execution`
- Uses `@agenthub/sdk` for type definitions and `@agenthub/contracts` for IPC types

## createRuntime()

```typescript
import { createRuntime } from '@agenthub/platform'

const bundle = createRuntime({
  storage,          // IStoragePort
  provider,         // ILLMProviderPort
  sandbox,          // ISandboxPort
  vectorStore,      // IVectorStorePort (optional)
  sandboxFactory,   // ISandboxFactoryPort (optional)
  secretVault,      // unknown (optional)
  coreVersion,      // string (optional, defaults to '1.0.0')
})
```

## IRuntimeBundle

```typescript
interface IRuntimeBundle {
  readonly runtime: AgentRuntime
  readonly permissionEngine: PermissionEngine
  readonly moduleManager: ModuleManager
  readonly scheduler: GraphScheduler
  readonly workerManager: WorkerManager
}
```

## Wiring Flow

```
App (desktop main process)
  │
  ├── PlatformHost.initialize()
  │     │
  │     ├── Instantiate Tauri-specific adapters
  │     │     AgentRuntimeTauriStorage
  │     │     TauriVectorStore
  │     │     TauriSecretVault
  │     │     OpenaiProviderAdapter
  │     │     CoreSandboxAdapter
  │     │
  │     ├── Call createRuntime({ ...adapters })
  │     │     ├── Creates PermissionEngine
  │     │     ├── Creates ModuleManager (with sandboxFactory)
  │     │     ├── Creates GraphScheduler
  │     │     ├── Creates WorkerManager
  │     │     └── Creates AgentRuntime (all ports injected)
  │     │
  │     └── Returns IRuntimeBundle
  │
  ├── RuntimeHost.start()
  │     ├── Registers built-in modules
  │     └── Starts agent loop
  │
  └── IPC Handler
        ├── Receives typed IIPCRequest from renderer
        ├── Dispatches to RuntimeHost/PlatformHost
        └── Returns typed IIPCResponse to renderer
```

## Dependencies

Platform depends on:
- `@agenthub/shared` — logger
- `@agenthub/core` — AgentRuntime, PermissionEngine, ModuleManager, port interfaces
- `@agenthub/execution` — GraphScheduler, WorkerManager
- `@agenthub/infrastructure` — unified adapter layer (domain adapters + consolidated packages)
- `@agenthub/security` — signature verification, key management

## Infrastructure Consolidation

The infrastructure package serves as the **unified adapter layer**:

```
@agenthub/infrastructure
  ├── In-package adapters (provider-adapter, storage-adapter, etc.)
  └── Re-exports from standalone packages:
      ├── @agenthub/provider   → ProviderRegistry, OpenaiProviderAdapter
      ├── @agenthub/tools      → ToolRegistry, StandardToolExecutor
      ├── @agenthub/storage    → StorageSqliteAdapter, SqliteSecretVault
      ├── @agenthub/network    → WebSocketTransport, ProtocolHandler
      └── @agenthub/sandbox    → PermissionEnforcer, CoreSandboxAdapter
```

Consumers can import from `@agenthub/infrastructure` for the full adapter surface,
or from individual packages for targeted imports.

## Location

- Factory: `packages/platform/src/factory.ts`
- Container: `packages/platform/src/container.ts`
- Entry: `packages/platform/src/index.ts`
- Desktop Host: `apps/desktop/src/main/platform-host.ts`
- Runtime Host: `apps/desktop/src/main/runtime-host.ts`
- IPC Handler: `apps/desktop/src/main/ipc/handler.ts`
