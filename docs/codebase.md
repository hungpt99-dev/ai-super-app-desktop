# Codebase Structure — AgentHub

Version: 4.2
Aligned with: Clean Architecture Specification v4.1

---

# I. REPOSITORY OVERVIEW

AgentHub is structured as a strict layered monorepo.

```
agenthub/
│
├── apps/
├── packages/
├── docs/
├── scripts/
├── turbo.json
├── tsconfig.base.json
└── package.json
```

The repository enforces:

* Layer isolation
* Dependency direction control
* Replaceable infrastructure
* Runtime-agnostic core

---

# II. HIGH-LEVEL LAYER MAPPING

| Folder                  | Layer                       |
| ----------------------- | --------------------------- |
| packages/shared         | Layer 1 – Shared            |
| packages/core           | Layer 2 – Core (Agent OS)   |
| packages/execution      | Layer 3 – Runtime Mechanics |
| packages/infrastructure | Layer 4 – Adapters          |
| packages/security       | Layer 5 – Integrity         |
| packages/platform       | Layer 6 – Composition Root  |
| packages/sdk            | Layer 7 – SDK               |
| apps/*                  | Layer 8 – Host Applications |

---

# III. ROOT FILES

## agents.md

Contains:

* Example agent definitions
* Authoring patterns
* Template references

Not used by runtime directly.

---

## package.json

Defines:

* Workspace configuration
* Shared dev dependencies
* Root scripts
* Turbo tasks

Does not contain runtime logic.

---

## tsconfig.base.json

Defines:

* Shared TypeScript configuration
* Path alias rules
* Project references
* Strict compilation settings

Enforces cross-package dependency boundaries.

---

## tsconfig.json

Root project reference file.

Used for:

* Monorepo compilation
* IDE resolution

---

## vitest.config.ts

Global test configuration.

Defines:

* Test environment
* Coverage rules
* Isolation settings

---

# IV. APPS LAYER

```
apps/
  desktop/
  web/
```

Apps are host environments.

They never contain domain logic.

---

## apps/desktop

Responsibilities:

* Host runtime
* Inject adapters
* Bootstrap platform
* Manage UI + Tauri bridge

### Structure

```
desktop/
  src/
    app/
    bridges/
    main/
    ui/
  src-tauri/
```

### Important Rule

Desktop imports:

```
platform
sdk
```

Desktop must NOT import:

```
core
execution
infrastructure
```

---

## apps/web

Responsibilities:

* Snapshot viewer
* Trace inspector
* Graph visualizer

Web must NOT import:

```
execution
sandbox
provider
runtime internals
```

Web is read-only.

---

# V. PACKAGES LAYER

All architecture-critical logic lives here.

---

# 1️⃣ packages/shared

Lowest layer.

Contains:

* Types
* DTO
* Schemas
* Constants
* Shared utilities (pure only)

No side effects.

All layers may depend on shared.

---

# 2️⃣ packages/core — Agent Operating System

Pure domain logic.

Contains:

```
core/
  agent-domain/
  graph-domain/
  runtime-domain/
  memory-domain/
  identity-domain/
  policy-domain/
  capability-domain/
  event-domain/
```

Responsibilities:

* AgentRuntime model
* Orchestrator
* Graph engine
* Memory logic
* Identity system
* Policy enforcement
* Capability validation
* Event modeling

Core must:

* Have zero side-effects
* Not access filesystem
* Not access network
* Not import infrastructure
* Only depend on shared

Core defines ports (interfaces) for:

* Provider
* Storage
* Sandbox
* Observability
* Embedding
* Vector store

---

# 3️⃣ packages/execution — Runtime Mechanics

Mechanical layer.

Contains:

```
execution/
  scheduler/
  worker/
  lifecycle/
```

Responsibilities:

* Scheduling
* Concurrency control
* Timeout handling
* Abort logic
* Deterministic ordering

Execution must NOT:

* Know graph semantics
* Know policy rules
* Know provider implementation
* Know identity model

Execution only runs tasks given by Core.

---

# 4️⃣ packages/infrastructure — Adapters

Implements ports defined by Core.

Contains:

```
infrastructure/
  provider-adapter/
  storage-adapter/
  embedding-adapter/
  sandbox-adapter/
  memory-manager-adapter/
  observability-adapter/
  event-bus-adapter/
  snapshot-adapter/
```

Infrastructure:

* Can access filesystem
* Can access network
* Can use Node APIs
* Can use external libraries

Core never imports infrastructure.

---

# 5️⃣ packages/security

Independent integrity layer.

Contains:

```
security/
  signature/
  verification/
  key-management/
```

Responsibilities:

* Signature validation
* Hash verification
* Agent authenticity
* Capability token validation

Security is reusable and environment-agnostic.

---

# 6️⃣ packages/platform — Composition Root

Only place allowed to wire system.

Contains:

```
platform/
  bootstrap/
  container/
  factories/
```

Responsibilities:

* Instantiate adapters
* Bind ports to implementations
* Read environment config
* Create runtime instance
* Connect core + execution

Example:

```
createRuntime({
  providerAdapter,
  storageAdapter,
  vectorStoreAdapter,
  embeddingAdapter,
  sandboxAdapter,
  observabilityAdapter
})
```

Apps must not instantiate runtime manually.

---

# 7️⃣ packages/sdk

Two parts:

```
sdk/
  authoring/
  client/
```

---

## Authoring SDK

Used by developers to define agents.

Example:

```
defineAgent({
  name,
  tools,
  memory,
  policy
})
```

Produces:

```
AgentDefinition
```

Does NOT run runtime.

---

## Client SDK

Used to:

* Invoke runtime
* Stream execution
* Inject memory
* Approve checkpoints
* Inspect traces

Contains no domain logic.

---

# VI. DATA FLOW MODEL

Standard execution flow:

```
App
  → Platform
    → Core (decides WHAT)
      → Execution (runs HOW)
        → Infrastructure (adapter)
          → Sandbox
            → Tool
```

Memory flow:

```
Core (memory strategy)
  → VectorStoreAdapter
  → EmbeddingAdapter
  → StorageAdapter
```

Security validation:

```
Platform
  → Security
    → Core
```

---

# VII. STRICT DEPENDENCY ENFORCEMENT

## Allowed

```
apps → sdk
apps → platform

platform → core
platform → execution
platform → infrastructure
platform → security

execution → shared
infrastructure → shared
core → shared
security → shared
sdk → shared
```

## Forbidden

```
core → infrastructure
core → execution
core → sdk
core → apps
core → platform

execution → infrastructure
web → runtime internals
```

---

# VIII. REPLACEMENT CAPABILITY

Each layer is independently replaceable:

* Replace provider → only infrastructure changes
* Replace storage → only storage adapter changes
* Replace sandbox → only sandbox adapter changes
* Replace execution engine → only execution layer changes
* Replace host (desktop/web) → no core changes

---

# IX. DESIGN PRINCIPLES ENFORCED

* Deterministic execution
* Capability-based isolation
* Policy-first runtime
* Environment independence
* Replaceable infrastructure
* Clean dependency direction
* Multi-agent scalability

---

# X. MENTAL MODEL

Core = Agent Operating System
Execution = Runtime Engine
Infrastructure = Hardware Drivers
Security = Integrity Layer
Platform = System Bootloader
SDK = Programming Interface
Apps = Host Machines
