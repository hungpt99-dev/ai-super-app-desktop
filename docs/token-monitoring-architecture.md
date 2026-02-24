# Token Monitoring Architecture

## Overview

AgentHub Desktop implements a comprehensive token monitoring and cost analytics system built on Clean Architecture principles. The system tracks LLM token usage across all execution phases and provides real-time metrics through IPC to the renderer.

## Architecture Layers

### 1. Core Domain Layer (`packages/observability`)

Located in `packages/observability/src/token/`, this layer contains pure business logic with zero infrastructure dependencies:

- **MetricsTypes.ts** — Strongly-typed domain interfaces for token/tool usage
- **TokenTracker.ts** — Stateless aggregation service for metrics
- **CostCalculator.ts** — Deterministic token-to-cost conversion
- **PricingConfig.ts** — Model pricing registry with runtime override support

### 2. Infrastructure Layer (`packages/infrastructure`)

Located in `packages/infrastructure/src/observability-adapter/`, handles persistence:

- **FileMetricsStore.ts** — Atomic file-based storage in `~/.agenthub/metrics/`

### 3. Application Layer (`apps/desktop`)

- **metrics.ipc.ts** — IPC handlers connecting renderer to TokenTracker
- **DesktopMetricsClient.ts** (SDK) — Client for renderer to access metrics
- **bridge.ts** — Exposes metrics via `window.agenthub.metrics`

## Storage Layout

```
~/.agenthub/metrics/
├── daily/
│   └── YYYY-MM-DD.json
└── executions/
    └── executionId.json
```

Both use atomic writes (temp file + rename) for crash safety.

## IPC Contracts

All metrics access is through IPC — renderer never accesses runtime directly:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `metrics:getExecutionSummary` | Renderer → Main | Get cost summary for an execution |
| `metrics:getDailyUsage` | Renderer → Main | Get aggregated daily usage |
| `metrics:getAgentBreakdown` | Renderer → Main | Get agent-level breakdown |
| `metrics:getAllExecutions` | Renderer → Main | List all execution IDs |
| `metrics:exportReport` | Renderer → Main | Export date-range report |

## Phase Tracking

Tokens are tracked per execution phase:

- **planning** — Skeleton plan generation tokens
- **execution** — Step execution tokens
- **micro** — Micro-plan tokens

Each LLM call reports: `{ promptTokens, completionTokens, model }`

## Event Flow

1. PlanningEngine/ActingEngine makes LLM call
2. LLM response includes token counts
3. TokenTracker.recordLLMUsage() is called
4. FileMetricsStore.appendTokenUsage() persists to daily + execution files
5. Renderer queries via IPC
6. TokenTracker aggregates and returns typed summary
