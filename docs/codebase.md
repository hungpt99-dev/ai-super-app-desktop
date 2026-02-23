# Clean Architecture Specification v4.1

---

# I. ARCHITECTURAL PHILOSOPHY

AgentHub được thiết kế dựa trên:

- Clean Architecture
- Dependency Inversion
- Hexagonal Architecture
- Adapter Pattern
- Capability-Based Security
- Deterministic Execution
- Strict Layer Isolation
- Runtime-Agnostic Core
- Multi-Environment Support

Mục tiêu:

Xây dựng một Agent Operating System có thể chạy ở nhiều môi trường khác nhau mà không thay đổi domain logic.

---

# II. SYSTEM LAYER MODEL

```
Layer 1  → shared
Layer 2  → core (domain OS)
Layer 3  → execution (runtime mechanics)
Layer 4  → infrastructure (adapters)
Layer 5  → security
Layer 6  → platform (composition root)
Layer 7  → sdk (authoring + client)
Layer 8  → apps (desktop, web, other hosts)
```

---

# III. DEPENDENCY RULES

Allowed:

```
apps → sdk
apps → platform

sdk → core
sdk → shared

platform → core
platform → execution
platform → infrastructure
platform → security

execution → shared
infrastructure → shared
core → shared
```

Forbidden:

```
core → infrastructure
core → execution
core → sdk
core → apps
core → platform

execution → infrastructure
web → runtime internals
```

Core là trung tâm, không phụ thuộc implementation.

---

# IV. DIRECTORY STRUCTURE

```
agenthub/
│
├── apps/
│   ├── desktop/
│   └── web/
│
├── packages/
│
│   ├── shared/
│   │   ├── types/
│   │   ├── dto/
│   │   ├── schemas/
│   │   ├── constants/
│   │   └── index.ts
│
│   ├── core/
│   │   ├── runtime/
│   │   ├── orchestrator/
│   │   ├── graph/
│   │   ├── agents/
│   │   ├── memory/
│   │   ├── identity/
│   │   ├── policy/
│   │   ├── capability/
│   │   ├── events/
│   │   └── index.ts
│
│   ├── execution/
│   │   ├── scheduler/
│   │   ├── worker/
│   │   ├── concurrency/
│   │   ├── lifecycle/
│   │   └── index.ts
│
│   ├── infrastructure/
│   │   ├── provider/
│   │   ├── storage/
│   │   ├── vector-store/
│   │   ├── embedding/
│   │   ├── tools/
│   │   ├── sandbox/
│   │   ├── network/
│   │   └── observability/
│
│   ├── security/
│   │   ├── signature/
│   │   ├── key-management/
│   │   ├── verification/
│   │   └── index.ts
│
│   ├── platform/
│   │   ├── bootstrap/
│   │   ├── container/
│   │   ├── factories/
│   │   └── index.ts
│
│   ├── sdk/
│   │   ├── authoring/
│   │   ├── client/
│   │   └── index.ts
│
├── turbo.json
├── tsconfig.base.json
└── package.json
```

---

# V. CORE (Agent Operating System)

Core chứa domain logic thuần:

- AgentRuntime
- Graph Engine
- Orchestrator
- Memory domain logic
- Identity model
- Capability enforcement
- Policy engine
- Event system

Core:

- Không side-effect
- Không environment access
- Không file system
- Không network
- Không provider implementation
- Không biết đang chạy ở desktop hay cloud

Core chỉ làm việc thông qua **Ports (interfaces)**.

---

# VI. MEMORY (Domain Layer)

Memory là business capability, thuộc core.

Bao gồm:

- Retrieval strategy
- Injection logic
- Importance scoring
- Scope resolution
- Memory lifecycle
- Pruning strategy

Infrastructure cung cấp:

- Vector store adapter
- Embedding adapter
- Storage adapter

Core định nghĩa interface, không implement chi tiết kỹ thuật.

---

# VII. EXECUTION LAYER

Execution xử lý cơ chế runtime:

- Scheduler
- Worker management
- Timeout
- Abort handling
- Concurrency control

Execution:

- Không biết graph semantics
- Không biết policy logic
- Không biết identity
- Không biết provider

Core quyết định “WHAT”.
Execution quyết định “HOW”.

---

# VIII. INFRASTRUCTURE (Adapters)

Chỉ implement các ports từ core:

- ProviderAdapter
- StorageAdapter
- VectorStoreAdapter
- EmbeddingAdapter
- SandboxAdapter
- TransportAdapter
- ObservabilityAdapter

Infrastructure có thể dùng Node APIs hoặc external libs.

Core không import implementation cụ thể.

---

# IX. SECURITY

Security tách riêng:

- Signature verification
- Hash validation
- Key management
- Integrity checking

Security không chứa marketplace logic.

Marketplace consume security.

---

# X. PLATFORM (Composition Root)

Platform là nơi duy nhất:

- Instantiate adapters
- Đọc environment
- Cấu hình DI container
- Wire execution + core

Ví dụ:

```
createRuntime({
  providerAdapter,
  storageAdapter,
  vectorStoreAdapter,
  sandboxAdapter,
  observabilityAdapter
})
```

Apps không tự new runtime thủ công.

---

# XI. SDK

## 1️⃣ Authoring SDK

Dành cho developer xây agent.

Ví dụ:

```
defineAgent({
  name,
  tools,
  memory,
  policy
})
```

Tạo AgentDefinition object.

Không chạy runtime.

---

## 2️⃣ Client SDK

Dùng để:

- Invoke runtime từ bên ngoài
- Stream execution
- Inject memory
- Approve checkpoint

Client SDK không chứa runtime logic.

---

# XII. APPS

## Desktop

- Host runtime
- Inject adapters qua platform
- Single-user mode

## Web

- Snapshot viewer
- Trace inspector
- Graph visualizer

Web không import:

- execution
- provider
- sandbox
- runtime internals

---

# XIII. SANDBOX RULE

Tất cả tool execution đi qua sandbox:

```
core → execution → sandbox → tool
```

Không bao giờ:

```
core → tool trực tiếp
```

Sandbox enforce:

- CPU limit
- Memory limit
- Timeout
- Network restriction

---

# XIV. ISOLATION GUARANTEE

Core:

- Không biết môi trường chạy
- Không biết provider cụ thể
- Không biết storage cụ thể

Execution:

- Không biết business logic

Web:

- Không biết runtime tồn tại

Mỗi layer độc lập, thay thế được.

---

# XV. ARCHITECTURAL GUARANTEES

✔ Deterministic execution

✔ Policy-driven runtime

✔ Capability-based security

✔ Provider-agnostic

✔ Environment-agnostic

✔ Clean dependency direction

✔ Replaceable infrastructure

✔ Multi-agent ready

---

# FINAL SYSTEM MODEL

Core = Agent Operating System

Execution = Runtime Engine

Infrastructure = Hardware Drivers

Platform = Composition Layer

SDK = Agent Programming Interface

Security = Integrity Layer

Apps = Host Environment
