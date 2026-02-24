# Real-World Agent Model

## Core Principle

Agents are NOT chatbots. Agents are deterministic planners + tool executors that interact with the real world.

## Agent Capabilities

Agents can:

- **Plan** — decompose goals into skeleton steps and micro actions
- **Execute** — invoke tools to perform real-world operations
- **Call tools** — filesystem, browser, HTTP, OS automation
- **Interact with real world** — read/write files, open URLs, execute commands
- **Inject memory** — persist execution state via MemoryDelta
- **Emit events** — structured execution/tool events
- **Persist execution snapshots** — full ExecutionResult tracking
- **Respect capability constraints** — CapabilityGuard enforcement
- **Operate under cost budget** — PlanningBudget token/step limits

## Architecture Layers

```
┌─────────────────────────┐
│       Renderer          │ ← UI only, IPC bridge
├─────────────────────────┤
│    SDK / Hooks          │ ← DesktopPlanningClient, useActing
├─────────────────────────┤
│      IPC Bridge         │ ← planning:create, acting:executeStep
├─────────────────────────┤
│     Main Process        │
│  ┌───────────────────┐  │
│  │  PlanningEngine   │  │ ← Deterministic planning
│  ├───────────────────┤  │
│  │  ActingEngine     │  │ ← Tool-oriented execution
│  ├───────────────────┤  │
│  │  ToolExecutor     │  │ ← Capability-gated tool calls
│  ├───────────────────┤  │
│  │  CapabilityGuard  │  │ ← Security enforcement
│  ├───────────────────┤  │
│  │  ToolRegistry     │  │ ← Tool registration
│  ├───────────────────┤  │
│  │  Transport Layer  │  │ ← Local (future: Remote)
│  └───────────────────┘  │
└─────────────────────────┘
```

## Security Boundaries

| Boundary | Rule |
|----------|------|
| Renderer → Core | BLOCKED — IPC only |
| Renderer → Filesystem | BLOCKED — IPC only |
| Renderer → Tools | BLOCKED — IPC only |
| Tool → Tool | Capability-gated |
| Agent → Tool | Capability-gated |
| Planning depth | Max 1 |
| Token budget | Hard limit per operation |

## Transport Expansion

Current: `LocalTransport` (in-process)
Future: `RemoteTransport` (WebSocket / P2P)

The `AgentTransport` interface abstracts transport:

```typescript
interface AgentTransport {
    send(message: AgentMessage): Promise<AgentMessage>
}
```

No refactoring required to add remote transport — implement `AgentTransport` and swap at initialization.

## IPC Contracts

| Channel | Direction | Payload → Result |
|---------|-----------|------------------|
| `planning:create` | Renderer → Main | `IPlanningCreatePayload` → `IPlanningCreateResult` |
| `planning:micro` | Renderer → Main | `IPlanningMicroPayload` → `IPlanningMicroResult` |
| `acting:executeStep` | Renderer → Main | `IActingExecuteStepPayload` → `IActingExecuteStepResult` |
| `acting:executeMicro` | Renderer → Main | `IActingExecuteMicroPayload` → `IActingExecuteMicroResult` |
