# Planning Architecture

## Overview

Cost-optimized, deterministic planning engine for AgentHub Desktop.

## Modes

| Mode | Description | Limits |
|------|-------------|--------|
| SKELETON | High-level step decomposition | Max 5 steps |
| MICRO | Tool-level action breakdown per step | Max 3 actions |
| DIRECT | No planning needed (pass-through) | N/A |

## Heuristic Rules

`shouldPlan(input)` determines whether planning is needed:

- **< 40 tokens** → `false` (direct execute)
- **Contains keywords** `plan`, `strategy`, `compare`, `analyze`, `workflow` → `true`
- **≥ 2 sentences** → `true`
- **Otherwise** → `false`

## Budget Enforcement

Every plan operation checks:

- `maxTokens` — total token budget
- `maxSteps` — max skeleton steps (hard cap: 5)
- `maxDepth` — max planning depth (hard cap: 1)

Budget violations throw `BudgetExceededError`.

## Agent Selection

1. Pre-filter by required capability codes
2. Sort by:
   - Capability match score (descending)
   - Cost per token (ascending)
   - Alphabetical by name (ascending)
3. Return max 3 candidates

## Data Flow

```
Renderer → IPC (planning:create) → PlanningEngine.createPlan() → SkeletonPlan | DirectExecutePlan
Renderer → IPC (planning:micro) → PlanningEngine.createMicroPlan() → MicroPlan
```

## Files

| File | Purpose |
|------|---------|
| `PlanningTypes.ts` | Domain types, constants, limits |
| `PlanningHeuristic.ts` | shouldPlan() deterministic function |
| `PlanningBudget.ts` | Budget enforcement with BudgetExceededError |
| `AgentSelector.ts` | Capability-filtered, cost-sorted agent selection |
| `PlanningEngine.ts` | createPlan() and createMicroPlan() |

## Constraints

- No recursion beyond depth 1
- No chain-of-thought
- No explanation text
- Deterministic JSON output only
- No randomness
