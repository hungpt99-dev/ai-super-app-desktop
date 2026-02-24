# Desktop Architecture

## Overview

The AgentHub Desktop application is built on a strict Clean Architecture v4.1 pattern with dependency direction flowing inward:

```
shared (L1) → core (L2) → execution (L3) → infrastructure (L4) → platform (L5) → desktop (L6)
```

## Layer Responsibilities

### Core (`packages/core`)
- Domain types, ports (interfaces), and business rules
- Defines `ISnapshotStoragePort`, `IVersioningPort`
- Zero external dependencies
- Organized into domain modules: `agent-domain`, `graph-domain`, `memory-domain`, `runtime-domain`, `snapshot-domain`, `versioning-domain`

### Contracts (`packages/contracts`)
- Serializable DTOs shared between main and renderer processes
- `IAgentDefinitionDTO`, `ISkillDefinitionDTO`, `IValidationResultDTO`
- `DesktopIPCChannel` — 21 typed IPC channel names
- `ExecutionStreamEvent` — 12 discriminated event types
- No business logic. No imports from core/execution/infrastructure.

### Execution (`packages/execution`)
- Scheduler, worker, lifecycle management
- Defines its own mirror interfaces to avoid circular deps with core
- Can import core types

### Infrastructure (`packages/infrastructure`)
- Adapter implementations: `LocalFileStorageAdapter`, `LocalSnapshotStorageAdapter`, `SemanticVersioningAdapter`
- Filesystem persistence at `~/.agenthub/`
- Implements core ports

### Platform (`packages/platform`)
- Composition root: `createRuntime()`, `createDesktopPlatform()`
- Wires adapters to ports
- Can import all lower layers

### Desktop App (`apps/desktop`)
- Tauri v2 main process, React renderer, IPC bridge
- Main process: IPC handlers (`execution.ipc.ts`, `agent.ipc.ts`, `skill.ipc.ts`, `snapshot.ipc.ts`)
- Renderer: UI pages (React + Tailwind), Zustand stores
- Bridge: `desktop-bridge.ts` wraps Tauri invoke for type-safe IPC

## Key Constraints

1. **Renderer isolation**: UI components never import core, execution, or infrastructure
2. **IPC boundary**: All runtime access goes through typed IPC channels
3. **No filesystem in renderer**: All file operations happen in the main process
4. **No business logic in UI**: Pages are purely presentational; validation, versioning, and persistence happen in IPC handlers
5. **ESM everywhere**: All imports use `.js` extensions

## Process Architecture

```
┌─────────────────────┐     IPC      ┌────────────────────────┐
│   Renderer Process  │◄────────────►│    Main Process        │
│                     │              │                        │
│  React UI Pages     │   invoke()   │  IPC Handlers          │
│  Zustand Stores     │──────────────│  LocalFileStorage      │
│  SDK Clients        │   events     │  SnapshotStorage       │
│  Desktop Bridge     │◄─────────────│  SemanticVersioning    │
│                     │              │  AgentRuntime          │
└─────────────────────┘              └────────────────────────┘
```

## SDK Desktop Clients

The `@agenthub/sdk` package provides typed client classes for renderer access:

- `DesktopRuntimeClient` — execution start/stop/replay/state
- `DesktopAgentClient` — agent CRUD + validation
- `DesktopSkillClient` — skill CRUD + validation
- `DesktopSnapshotClient` — snapshot list/load/delete/replay

All clients access `window.agenthubDesktop` which is populated by the bridge preload.
