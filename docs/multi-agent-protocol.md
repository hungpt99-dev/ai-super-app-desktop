# Multi-Agent Protocol

## Overview

AgentHub supports multi-agent orchestration where agents can invoke other agents through a controlled protocol with capability propagation and isolation guarantees.

## Agent-to-Agent Message

```typescript
interface IAgentToAgentMessage {
  readonly messageId: string
  readonly senderId: string
  readonly targetId: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly timestamp: string
  readonly replyTo?: string
}
```

## Message Contract

```typescript
interface IAgentMessageContract {
  readonly senderId: string
  readonly targetId: string
  readonly allowedPayloadKeys: readonly string[]
  readonly maxPayloadSizeBytes: number
}
```

## Capability Propagation

When agent A calls agent B, the propagation rule determines what capabilities B inherits.

| Rule | Behavior |
|---|---|
| `none` | Called agent gets no capabilities from caller |
| `subset` | Called agent inherits a filtered subset of caller's capabilities |
| `full` | Called agent inherits all of caller's capabilities |

## Isolation Guarantees

```typescript
interface IIsolationGuarantee {
  readonly memoryIsolated: boolean        // Each agent gets its own memory scope
  readonly tokenBudgetIsolated: boolean   // Each agent tracks its own token usage
  readonly maxCallDepth: number           // Default: 5
}
```

## Call Depth Limit

The maximum agent call depth is defined as `MAX_AGENT_CALL_DEPTH = 5`. This prevents infinite recursion in agent-to-agent calls. Each call pushes an `IAgentCallFrame` onto the execution context's call stack.

```typescript
interface IAgentCallFrame {
  readonly agentId: string
  readonly graphId: string
  readonly nodeId: string
  readonly depth: number
}
```

## Agent Protocol Config

```typescript
interface IAgentProtocolConfig {
  readonly propagationRule: CapabilityPropagationRule
  readonly isolation: IIsolationGuarantee
  readonly messageContract?: IAgentMessageContract
}
```

## Agent Event Bus

```typescript
interface IAgentEventBusPort {
  send(message: IAgentToAgentMessage): Promise<void>
  onMessage(agentId: string, handler: (message: IAgentToAgentMessage) => void): () => void
  broadcast(senderId: string, payload: Readonly<Record<string, unknown>>): Promise<void>
}
```

## Orchestrator Port

```typescript
interface IOrchestrator {
  delegate(parentAgentId: string, childAgentId: string, input: Readonly<Record<string, unknown>>): Promise<unknown>
  getCallDepth(executionId: string): number
}
```

## Agent Registry

```typescript
interface IAgentRegistry {
  register(definition: IAgentDefinition): void
  unregister(agentId: string): void
  get(agentId: string): IAgentDefinition | null
  list(): readonly IAgentDefinition[]
  has(agentId: string): boolean
}
```

## Location

All multi-agent protocol types are in `packages/core/src/agent-domain/protocol.ts`. Agent registry and orchestrator ports are in `packages/core/src/agent-domain/ports.ts`.
