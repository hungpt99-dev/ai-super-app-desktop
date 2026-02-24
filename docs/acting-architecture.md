# Acting Architecture

## Overview

Tool-oriented execution engine with capability enforcement, structured event emission, and full execution result tracking.

## Core Components

### ActingEngine

```typescript
class ActingEngine {
    executeStep(step: SkeletonStep, agentCapabilities: string[]): Promise<ExecutionResult>
    executeMicro(actions: string[], agentId: string, agentCapabilities: string[]): Promise<ExecutionResult>
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
    executionId: string
    agent: string
    toolCalls: ToolCallRecord[]
    memoryChanges: MemoryDelta[]
    capabilityChecks: CapabilityCheck[]
    status: 'completed' | 'failed'
}
```

### ToolExecutor

Validates capability → executes tool → emits structured event.

### ToolRegistry

Singleton registry. `registerTool(tool)`, `getTool(name)`, `listTools()`.

## Built-in Tools

| Tool | Capability | Description |
|------|-----------|-------------|
| `file.read` | `filesystem` | Read file from local FS |
| `file.write` | `filesystem` | Write file to local FS |
| `browser.open` | `browser` | Open URL in default browser |
| `http.fetch` | `network` | HTTP request |
| `os.exec` | `os` | Execute shell command |

## Transport Layer

```typescript
interface AgentTransport {
    send(message: AgentMessage): Promise<AgentMessage>
}
```

**LocalTransport** — default in-process implementation.
**RemoteTransport** — future WebSocket/P2P (no refactor needed).

## Data Flow

```
Renderer → IPC (acting:executeStep) → ActingEngine.executeStep() → ExecutionResult
Renderer → IPC (acting:executeMicro) → ActingEngine.executeMicro() → ExecutionResult
```

## Files

| File | Purpose |
|------|---------|
| `ActingTypes.ts` | Domain types |
| `CapabilityGuard.ts` | Capability enforcement |
| `ToolRegistry.ts` | Tool registration singleton |
| `ToolExecutor.ts` | Capability-validated tool execution |
| `ActingEngine.ts` | Step and micro execution |
| `tools/builtin-tools.ts` | 5 real-world tool stubs |
| `transport/LocalTransport.ts` | In-process transport |

## Security

- All tools main-process-only
- Not accessible from renderer
- Capability enforcement mandatory
- All tool executions logged
