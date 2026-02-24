# Capability Model

## Overview

Capabilities are fine-grained permissions governing what an agent can access during execution. Every agent declares `requiredCapabilities` in its definition. The runtime verifies capabilities before tool calls, provider calls, memory access, and cross-agent messages.

## Capability Scopes

| Scope | Controls |
|---|---|
| `tool` | Which tools the agent can invoke |
| `network` | Which network hosts the agent can access |
| `memory` | Which memory scopes the agent can read/write |
| `token_budget` | Maximum token consumption |
| `agent_boundary` | Which other agents can be called |

## Core Interfaces

### ICapability

```typescript
interface ICapability {
  name: string
  description: string
  scope: CapabilityScope
}
```

### ICapabilityGrant

```typescript
interface ICapabilityGrant {
  agentId: string
  capabilities: readonly ICapability[]
  tokenBudget?: number
  maxCostUsd?: number
}
```

### ICapabilityConstraint

```typescript
interface ICapabilityConstraint {
  allowedTools?: readonly string[]
  allowedNetworkHosts?: readonly string[]
  allowedMemoryScopes?: readonly string[]
  maxTokenBudget?: number
  allowedAgentTargets?: readonly string[]
}
```

## Verification Points

The `ICapabilityVerifier` is called at these enforcement points:

1. **Tool Call** — `verifyToolCall(agentId, toolName)` before every tool invocation
2. **Provider Call** — `verifyProviderCall(agentId, model, tokenCount)` before LLM requests
3. **Memory Injection** — `verifyMemoryInjection(agentId, scope)` before reading/writing memory
4. **Cross-Agent Message** — `verifyCrossAgentMessage(senderId, targetId)` before agent-to-agent communication

## ICapabilityVerifier

```typescript
interface ICapabilityVerifier {
  verify(agentId: string, capability: string): boolean
  verifyToolCall(agentId: string, toolName: string): boolean
  verifyProviderCall(agentId: string, model: string, tokenCount: number): boolean
  verifyMemoryInjection(agentId: string, scope: string): boolean
  verifyCrossAgentMessage(senderId: string, targetId: string): boolean
  getGrant(agentId: string): ICapabilityGrant | null
  getConstraints(agentId: string): ICapabilityConstraint | null
  grant(agentId: string, grant: ICapabilityGrant): void
  revoke(agentId: string): void
}
```

## ICapabilityRegistry

```typescript
interface ICapabilityRegistry {
  register(capability: ICapability): void
  get(name: string): ICapability | null
  list(): readonly ICapability[]
  has(name: string): boolean
  listByScope(scope: CapabilityScope): readonly ICapability[]
}
```

## Location

All capability types and ports are defined in `packages/core/src/capability-domain/`.
