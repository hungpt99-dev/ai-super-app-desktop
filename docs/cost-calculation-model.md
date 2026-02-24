# Cost Calculation Model

## Overview

AgentHub uses a deterministic cost calculation model based on token usage and model-specific pricing. All costs are calculated in USD with 6-decimal precision.

## Pricing Configuration

Model pricing is defined in `packages/observability/src/token/PricingConfig.ts`:

```typescript
const DEFAULT_PRICING = {
  'gpt-4o': { promptPer1K: 0.0025, completionPer1K: 0.01 },
  'gpt-4o-mini': { promptPer1K: 0.00015, completionPer1K: 0.0006 },
  'claude-3-5-sonnet-20241022': { promptPer1K: 0.003, completionPer1K: 0.015 },
  // ... more models
}
```

## Cost Formula

For any model with prompt rate `Rp` and completion rate `Rc` (per 1K tokens):

```
cost = (promptTokens / 1000) * Rp + (completionTokens / 1000) * Rc
```

## Implementation

```typescript
// CostCalculator.ts
calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = this.pricing.getPricing(model)
  const promptCost = (promptTokens / 1000) * p.promptPer1K
  const completionCost = (completionTokens / 1000) * p.completionPer1K
  return Math.round((promptCost + completionCost) * 1_000_000) / 1_000_000
}
```

## Runtime Override

Pricing can be overridden at runtime:

```typescript
const customPricing = {
  'gpt-4o': { promptPer1K: 0.003, completionPer1K: 0.012 }
}
const calculator = new CostCalculator(new PricingConfig(customPricing))
```

## Aggregation

Costs are aggregated at multiple levels:

- **Per execution** — Sum of all LLM calls in execution
- **Per agent** — Sum of all calls by agent
- **Per day** — Sum of all calls in calendar day
- **Per model** — Sum grouped by model used

## Efficiency Metrics

The dashboard computes:

- **Efficiency Score** = `successfulExecutions / totalTokens`
- **Planning Ratio** = `planningTokens / totalTokens * 100`
- **Micro-Plan Ratio** = `microTokens / totalTokens * 100`
- **Average Tokens/Execution** = `totalTokens / executionCount`
