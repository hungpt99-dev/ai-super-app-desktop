# Execution Desktop Flow

## Overview

This document describes the end-to-end execution flow for running an agent in the AgentHub Desktop application.

## Sequence

```
Renderer                    Main Process                 Infrastructure
   │                            │                            │
   │  execution:start           │                            │
   │──────────────────────────► │                            │
   │                            │  validate agent            │
   │                            │──────────────────────────► │
   │                            │  load agent definition     │
   │                            │◄────────────────────────── │
   │                            │                            │
   │  ◄─ ExecutionCreated       │  create execution context  │
   │  ◄─ ExecutionValidated     │                            │
   │  ◄─ ExecutionPlanned       │  plan DAG graph            │
   │  ◄─ ExecutionScheduled     │  schedule nodes            │
   │                            │                            │
   │  ◄─ NodeStarted           │  execute node              │
   │  ◄─ ToolCalled            │  invoke tool               │
   │  ◄─ MemoryInjected        │  inject memory             │
   │  ◄─ CapabilityChecked     │  check permissions         │
   │  ◄─ NodeCompleted         │                            │
   │                            │  ... repeat per node       │
   │                            │                            │
   │  ◄─ ExecutionCompleted    │  persist snapshot           │
   │  ◄─ SnapshotPersisted     │──────────────────────────► │
   │                            │                            │
   │  IExecutionStartResult     │                            │
   │◄────────────────────────── │                            │
```

## Step-by-Step

### 1. User Initiates Execution

The user selects an agent and provides input in the Execution Playground page. The UI calls:

```typescript
const bridge = getDesktopExtendedBridge()
const result = await bridge.execution.start({
  agentId: selectedAgentId,
  input: { prompt: userInput }
})
```

### 2. IPC Handler Receives Request

`execution.ipc.ts` handles the `execution:start` channel:
1. Validates the agent exists
2. Creates an execution context
3. Registers event listeners
4. Starts the runtime execution

### 3. Event Streaming

During execution, the main process emits `ExecutionStreamEvent` objects via Tauri events. The renderer receives them through the bridge's `onEvent()` listener:

```typescript
const cleanup = bridge.execution.onEvent((event) => {
  switch (event.type) {
    case 'NodeStarted':
      // Update DAG visualization
      break
    case 'NodeCompleted':
      // Mark node as done
      break
    case 'ExecutionCompleted':
      // Show result
      break
  }
})
```

### 4. Snapshot Persistence

Upon completion (success or failure), the handler automatically:
1. Captures the full execution state
2. Persists a snapshot via `LocalSnapshotStorageAdapter`
3. Emits a `SnapshotPersisted` event

### 5. Replay

Users can replay from any snapshot:

```typescript
const result = await bridge.snapshot.replay({
  executionId: originalExecutionId,
  deterministic: true
})
```

This loads the snapshot, reconstructs the execution context, and re-runs from the saved state.

## State Machine

```
Created → Validated → Planned → Scheduled → Running → Completed
                                    │                     │
                                    └─── Error ◄──────────┘
                                    │
                                    └─── Stopped (user cancel)
```

## UI Components

| Component | View | Bridge API |
|---|---|---|
| Execution Playground | execution-playground | `bridge.execution.*` |
| Agent Builder | agent-builder | `bridge.agentBuilder.*` |
| Skill Builder | skill-builder | `bridge.skillBuilder.*` |
| Agent Library | agent-library | `bridge.agentBuilder.listLocal/load` |
| Skill Library | skill-library | `bridge.skillBuilder.listLocal/load` |
| Snapshot Manager | snapshot-manager | `bridge.snapshot.*` |

## Error Handling

All IPC calls return typed results. Errors propagate through the IPC envelope:

```typescript
interface IIPCResponse<T> {
  requestId: string
  success: boolean
  data?: T
  error?: string
}
```

The bridge layer throws on `success: false`, which pages catch and display in the UI.

## Token Tracking

The `IExecutionStateResult` includes real-time token usage:

```typescript
interface IExecutionStateResult {
  executionId: string
  state: ExecutionState
  currentNodeId: string | null
  stepCount: number
  tokenUsage: {
    promptTokens: number
    completionTokens: number
  }
}
```

Pages poll this via `bridge.execution.getState(executionId)` to display live metrics.
