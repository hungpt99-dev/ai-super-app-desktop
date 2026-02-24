# Dependency Rules

## Allowed Dependencies

```
shared           → (none)
contracts        → (none)
core             → shared
execution        → shared
provider         → shared, core
tools            → shared, sandbox
storage          → shared
network          → shared
sandbox          → shared, sdk
memory           → shared, core, infrastructure
infrastructure   → shared, core, sdk, provider, tools, storage, network, sandbox
security         → shared
platform         → shared, core, execution, infrastructure, security
sdk              → shared, core
apps/desktop     → shared, contracts, sdk, core, platform, provider, sandbox, storage
```

## Forbidden Dependencies

| From | Cannot Import |
|---|---|
| `core` | infrastructure, execution, sdk, apps, platform, contracts |
| `execution` | infrastructure, core, sdk, apps, platform |
| `infrastructure` | execution, apps, platform, security |
| `security` | core, infrastructure, execution, sdk, apps, platform |
| `sdk` | infrastructure, execution, apps, platform, security |
| `contracts` | any runtime package |
| `apps/renderer` | core, infrastructure, execution (use SDK or IPC bridge only) |

## Key Rules

1. **Core exports interfaces only** — no concrete implementations in `@agenthub/core`.
   `LongTermMemoryManager` class lives in `@agenthub/infrastructure`.
   Core exports only `ILongTermMemoryManager` interface.

2. **Infrastructure is the unified adapter layer** — all implementations flow through `@agenthub/infrastructure`.
   Standalone packages (provider, tools, storage, network, sandbox) are re-exported from infrastructure.

3. **Contracts package has zero dependencies** — pure types for cross-boundary communication (IPC, DTOs, events).

4. **Renderer uses SDK or IPC** — the renderer process NEVER imports from core, infrastructure, or execution directly.
   It communicates with the main process via typed IPC messages defined in `@agenthub/contracts`.

5. **Desktop main/renderer boundary** — `apps/desktop/src/main/` owns the PlatformHost and RuntimeHost.
   `apps/desktop/src/ui/` is the renderer — it uses React stores and IPC bridges.

## Package References (tsconfig)

Each package declares `references` in its `tsconfig.json` matching the allowed dependencies above. TypeScript project references enforce compile-time layer isolation.

## Rationale

- **Shared** provides cross-cutting utilities with no domain knowledge.
- **Contracts** defines serializable data shapes for system boundaries.
- **Core** defines ports (interfaces) only. It never knows about concrete implementations.
- **Infrastructure** implements those ports. It depends on core to see the interfaces.
  It consolidates all standalone adapter packages under one import surface.
- **Platform** is the composition root. It wires infrastructure adapters into core ports and creates the runtime.
- **SDK** provides the public API surface. Module authors use `defineModule()` and `defineAgent()`.
- **Apps** host the runtime. The main process calls `createRuntime()` from platform; the renderer uses IPC.
- **Security** is isolated. It provides signature/integrity verification without depending on domain logic.

## Import Validation

Run `npx madge --circular --extensions ts packages/` to detect circular dependencies.
