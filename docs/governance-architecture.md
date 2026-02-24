# Governance Architecture

## Overview

The Governance & Policy Engine provides centralized control over agent execution through four pillars:

1. **Policy Engine** — Evaluates configurable rules against execution context
2. **Budget Manager** — Tracks and enforces per-agent, per-workspace token budgets
3. **Rate Limiter** — Sliding-window rate limiting (per-minute, per-hour, concurrent)
4. **Model Registry** — Per-workspace model allowlists and denylists

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                GovernanceEnforcer                     │
│  (orchestrates all checks in sequence)               │
├──────────┬──────────┬──────────┬─────────────────────┤
│ Policy   │ Budget   │ Rate     │ Model               │
│ Engine   │ Manager  │ Limiter  │ Registry             │
└──────────┴──────────┴──────────┴─────────────────────┘
```

## Dependency Direction

```
core/governance-domain (ports)
  ↑
governance (implementations)
  ↑
platform (wiring)
  ↑
desktop (IPC handlers)
```

- **Core** defines `IPolicyEnginePort`, `IBudgetManagerPort`, `IRateLimiterPort`, `IModelRegistryPort`.
- **Governance package** implements all ports.
- **Platform** wires instances into `IDesktopPlatformBundle`.
- **Execution** uses the optional `IExecGovernanceGatePort` to gate runs.

## Execution Integration

When `IExecGovernanceGatePort` is wired into `IExecutionEnvironment`, the execution lifecycle performs the following check before planning:

1. Emit `execution.governance_checked`
2. Call `governanceGate.check({ agentId, workspaceId, model, input })`
3. If allowed → proceed to `execution.planned`
4. If rejected → emit `execution.rejected` with violations, abort

## Policy Rules

Rules are evaluated by priority (ascending). Each rule has:
- `id` — Unique rule identifier
- `name` — Human-readable name
- `description` — Rule description
- `condition(context)` — Boolean predicate
- `severity` — `'error'` blocks execution, `'warning'` logs only
- `priority` — Lower number = evaluated first

## Budget Management

- Default budget: 1,000,000 tokens per agent per workspace
- Tracks `totalTokensUsed` and `totalCostUsd`
- `recordUsage()` adds to running totals
- `checkBudget()` returns remaining tokens and whether budget exceeded

## Rate Limiting

Uses sliding window algorithm:
- **Per-minute**: default 60 requests
- **Per-hour**: default 1,000 requests
- **Concurrent**: default 5 simultaneous executions
- Expired entries pruned on each check

## Model Registry

- Per-workspace allowlist/denylist
- Models have status: `'allowed'`, `'denied'`, `'deprecated'`
- `isModelAllowed()` returns false if model is denied or deprecated

## IPC Channels

| Channel | Payload | Result |
|---------|---------|--------|
| `governance:evaluate-policy` | `IPolicyEvaluatePayload` | `IPolicyEvaluateResult` |
| `governance:get-budget` | `IBudgetPayload` | `IBudgetResult` |
| `governance:set-budget` | `ISetBudgetPayload` | `void` |
| `governance:list-models` | `string` (workspaceId) | `IModelListResult` |
| `governance:allow-model` | `IModelActionPayload` | `void` |
| `governance:deny-model` | `IModelActionPayload` | `void` |

## SDK Client

```typescript
import { DesktopGovernanceClient } from '@agenthub/sdk'

const client = new DesktopGovernanceClient()
const result = await client.evaluatePolicy({ agentId, workspaceId, input: {} })
```
