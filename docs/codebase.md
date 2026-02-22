# AgentHub Codebase Structure & Rules

---

## Directory Structure

```
agenthub/
│
├── apps/
│   ├── desktop/                 # Tauri app
│   │   ├── src/
│   │   │   ├── ui/              # React UI
│   │   │   ├── app/             # App wiring / bootstrap
│   │   │   ├── bridges/         # Tauri bridge adapters
│   │   │   └── main.tsx
│   │   ├── src-tauri/           # Rust (if used)
│   │   └── package.json
│   │
│   └── web/                     # Viewer only
│       ├── src/
│       │   ├── ui/
│       │   ├── viewer/
│       │   ├── parser/
│       │   └── main.tsx
│       └── package.json
│
├── packages/
│   ├── core/                    # Pure runtime engine (NO UI, NO tauri)
│   │   ├── runtime/
│   │   ├── graph/
│   │   ├── orchestrator/
│   │   ├── agents/
│   │   ├── events/
│   │   └── index.ts
│   │
│   ├── execution/
│   │   ├── scheduler/
│   │   ├── worker/
│   │   └── lifecycle/
│   │
│   ├── memory/
│   │   ├── short-term/
│   │   ├── long-term/
│   │   ├── embedding/
│   │   └── index.ts
│   │
│   ├── storage/
│   │   ├── interface.ts
│   │   ├── sqlite/              # Desktop impl
│   │   └── index.ts
│   │
│   ├── provider/
│   │   ├── interface.ts
│   │   ├── openai/
│   │   └── index.ts
│   │
│   ├── tools/
│   │   ├── interface.ts
│   │   ├── http/
│   │   ├── file/
│   │   └── custom-js/
│   │
│   ├── sandbox/
│   │   ├── worker-sandbox/
│   │   └── permission/
│   │
│   ├── network/
│   │   ├── transport/
│   │   └── protocol/
│   │
│   ├── marketplace/
│   │   ├── package-spec/
│   │   ├── validator/
│   │   └── installer/
│   │
│   └── shared/
│       ├── types/
│       ├── dto/
│       └── schemas/
│
├── tsconfig.base.json
├── turbo.json (optional)
└── package.json
```

---

## Import Rules (Critical)

- Dependency direction must be:
  - apps → packages
  - packages/* → shared
  - core → (must not import from apps)
  - web → must not import core runtime

---

## Forbidden Patterns

### 1. core MUST NOT:
- import React
- import tauri
- import fs
- import window
- import sqlite directly
- import openai directly

Core only uses interfaces.

### 2. web MUST NOT:
- import runtime engine
- import execution
- import provider
- import sandbox

Web may only import:
- shared/
- dto/
- schemas/

### 3. storage MUST NOT:
- Expose sqlite logic to core

Must use:
```tsx
StorageAdapter interface
```

---

## Layer Rules

### Layer 1 — shared
- Types, DTO, Zod schema, constants
- No business logic

### Layer 2 — core
- Runtime, orchestration, graph execution, event system
- No environment side-effects

### Layer 3 — execution
- Scheduler, worker management, abort controller, timeout
- No UI

### Layer 4 — infrastructure packages
- storage, provider, tools, sandbox, network
- These are adapters

### Layer 5 — apps
- UI, bootstrapping, wiring dependencies

---

## Dependency Injection Rule

Runtime is initialized as:
```tsx
new AgentRuntime({
  storage,
  provider,
  vectorStore,
  transport,
  sandbox
})
```
Core never instantiates any adapter directly.

---

## Package Isolation Rules

- Each package has its own tsconfig
- No circular dependencies
- No relative path imports across packages
- Only import via package name

Example:
```tsx
import { AgentRuntime } from "@agenthub/core"
```
NOT:
```tsx
import "../../../core/runtime"
```

---

## File Organization Rules

Within each module:
```
module/
  index.ts        ← public exports only
  internal/
  types.ts
  service.ts
```
Do not export entire folders.
Only export public API via `index.ts`.

---

## Sandbox Rule

- Tool execution always goes through sandbox layer
- Never call tool directly from runtime
- All custom JS must be isolated

---

## Memory Rule

- Memory package must not import provider or storage implementation directly
- Only accept interfaces

---

## Network Rule

- Network layer does not know runtime logic
- Only transmits messages
- No business logic

---

## Desktop App Rule

apps/desktop:
- Responsible for injecting SQLite storage, OpenAI provider, Worker sandbox, WebSocket transport
- No business logic here

---

## Web App Rule

apps/web:
- Only parses snapshot JSON, validates via schema, renders UI
- No provider, runtime, or execution engine

---

## Anti-Patterns to Avoid

❌ Runtime logic in React component
❌ Hardcoded provider in core
❌ Direct DB call in runtime
❌ Tool directly calls fs
❌ Agent calls agent via function call

---

## Naming Convention

- Interface: `XxxAdapter`
- Implementation: `XxxSqliteAdapter`
- Service: `XxxService`
- DTO: `XxxDTO`
- Schema: `XxxSchema`

---

## Build Rule

- core builds to ESM
- No Node-only API
- No dynamic require
- No process.env in core

---

## Final Checklist

Desktop includes:
- runtime
- execution
- memory
- provider
- tools
- sandbox
- network
- storage

Web includes:
- shared types
- schema
- viewer

Core does not know web exists.
Web does not know runtime exists.

---
