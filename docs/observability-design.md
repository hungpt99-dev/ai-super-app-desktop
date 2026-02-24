# Observability Design

## Overview

The Observability Layer provides structured tracing, metrics collection, and log streaming for agent executions. Enables debugging, performance analysis, and failure classification.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                 Observability Stack                     │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────┐    │
│  │ TracingService│  │MetricsCollector│ │ LogStream │    │
│  └──────────────┘  └───────────────┘  └──────────┘    │
└────────────────────────────────────────────────────────┘
```

## Components

### TracingService

Implements `ITracingPort`. Manages execution traces with hierarchical spans.

```typescript
interface IExecutionTrace {
  traceId: string
  executionId: string
  agentId: string
  startTime: string
  endTime?: string
  status: 'running' | 'completed' | 'failed'
  spans: ITraceSpan[]
}

interface ITraceSpan {
  spanId: string
  parentSpanId?: string
  name: string
  startTime: string
  endTime?: string
  attributes: Record<string, unknown>
}
```

Operations:
- `startTrace(executionId, agentId)` — Creates root trace
- `addSpan(traceId, name, parentSpanId?)` — Adds child span
- `endSpan(traceId, spanId)` — Closes span with timestamp
- `endTrace(traceId, status)` — Closes trace
- `getTrace(traceId)` — Retrieves full trace
- `listTraces(limit?)` — Lists recent traces

### MetricsCollector

Implements `IMetricsPort`. Collects execution metrics with four types:

| Metric Type | Description |
|-------------|-------------|
| `counter` | Monotonically increasing count |
| `gauge` | Point-in-time value |
| `histogram` | Distribution of values |
| `summary` | Statistical summary |

Built-in metric recorders:
- `recordNodeLatency(executionId, nodeId, latencyMs)` — Per-node execution time
- `recordToolLatency(executionId, toolName, latencyMs)` — Per-tool call time
- `recordTokenUsage(executionId, prompt, completion, model)` — Token consumption
- `recordFailure(executionId, category, message)` — Failure classification

Failure categories: `tool_error`, `provider_error`, `timeout`, `permission_denied`, `budget_exceeded`, `rate_limited`, `unknown`

### LogStream

Implements `IStructuredLogStream`. Pub/sub structured logging with query support.

```typescript
interface IStructuredLogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context?: string
  traceId?: string
  executionId?: string
  data?: Record<string, unknown>
}
```

Operations:
- `write(entry)` — Append log entry
- `subscribe(listener)` — Real-time log streaming
- `query(filters)` — Query by level, context, traceId, executionId

Maximum buffer: 10,000 entries (FIFO eviction).

## Integration Points

### Execution Engine

The execution lifecycle emits observability data at each stage:
1. `execution.created` → `startTrace()`
2. `execution.running` → `addSpan('execution')`
3. `execution.tool_execution` → `recordToolLatency()`, `addSpan('tool:name')`
4. `execution.completed` → `endTrace('completed')`, `recordTokenUsage()`
5. `execution.failed` → `endTrace('failed')`, `recordFailure()`

### Desktop UI

Observability data is accessible via IPC channels:

| Channel | Payload | Result |
|---------|---------|--------|
| `observability:get-trace` | `ITraceQueryPayload` | `IExecutionTrace` |
| `observability:list-traces` | `ITraceQueryPayload` | `IExecutionTrace[]` |
| `observability:get-metrics` | `IMetricsQueryPayload` | `IMetricEntry[]` |
| `observability:get-logs` | `ILogsQueryPayload` | `IStructuredLogEntry[]` |

## Storage

All observability data is stored in-memory with configurable retention. For production, adapters can be implemented to persist to disk, SQLite, or external services (e.g., OpenTelemetry, Prometheus).
