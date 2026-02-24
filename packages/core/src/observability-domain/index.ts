/**
 * ObservabilityDomain — core ports for tracing, metrics, and structured logging.
 *
 * All executions generate a traceId. Events carry traceId.
 * Platform exposes structured log streams.
 */

// ─── Trace Types ────────────────────────────────────────────────────────────

export interface IExecutionTrace {
    readonly traceId: string
    readonly executionId: string
    readonly agentId: string
    readonly workspaceId: string
    readonly startedAt: string
    readonly completedAt?: string
    readonly spans: readonly ITraceSpan[]
    readonly status: 'active' | 'completed' | 'failed'
}

export interface ITraceSpan {
    readonly spanId: string
    readonly traceId: string
    readonly parentSpanId?: string
    readonly name: string
    readonly startedAt: string
    readonly completedAt?: string
    readonly durationMs?: number
    readonly attributes: Readonly<Record<string, unknown>>
    readonly status: 'ok' | 'error'
    readonly errorMessage?: string
}

// ─── Metric Types ───────────────────────────────────────────────────────────

export type MetricType = 'counter' | 'gauge' | 'histogram'

export interface IMetricEntry {
    readonly name: string
    readonly type: MetricType
    readonly value: number
    readonly labels: Readonly<Record<string, string>>
    readonly timestamp: string
}

export interface INodeLatencyMetric {
    readonly executionId: string
    readonly nodeId: string
    readonly nodeType: string
    readonly durationMs: number
    readonly timestamp: string
}

export interface IToolLatencyMetric {
    readonly executionId: string
    readonly toolName: string
    readonly durationMs: number
    readonly success: boolean
    readonly timestamp: string
}

export interface ITokenUsageMetric {
    readonly executionId: string
    readonly agentId: string
    readonly model: string
    readonly promptTokens: number
    readonly completionTokens: number
    readonly totalTokens: number
    readonly estimatedCostUsd: number
    readonly timestamp: string
}

export type FailureCategory = 'policy_violation' | 'budget_exceeded' | 'rate_limited' | 'tool_error' | 'provider_error' | 'timeout' | 'internal_error' | 'unknown'

export interface IFailureClassification {
    readonly executionId: string
    readonly category: FailureCategory
    readonly message: string
    readonly recoverable: boolean
    readonly timestamp: string
}

// ─── Tracing Port ───────────────────────────────────────────────────────────

export interface ITracingPort {
    startTrace(executionId: string, agentId: string, workspaceId: string): IExecutionTrace
    startSpan(traceId: string, name: string, parentSpanId?: string): ITraceSpan
    endSpan(traceId: string, spanId: string, status: 'ok' | 'error', errorMessage?: string): void
    endTrace(traceId: string, status: 'completed' | 'failed'): void
    getTrace(traceId: string): IExecutionTrace | null
    listTraces(workspaceId: string, limit?: number): readonly IExecutionTrace[]
}

// ─── Metrics Port ───────────────────────────────────────────────────────────

export interface IMetricsPort {
    recordNodeLatency(metric: INodeLatencyMetric): void
    recordToolLatency(metric: IToolLatencyMetric): void
    recordTokenUsage(metric: ITokenUsageMetric): void
    recordFailure(classification: IFailureClassification): void
    increment(name: string, labels?: Record<string, string>): void
    gauge(name: string, value: number, labels?: Record<string, string>): void
    histogram(name: string, value: number, labels?: Record<string, string>): void
    getMetrics(name?: string): readonly IMetricEntry[]
}

// ─── Structured Logging Port ────────────────────────────────────────────────

export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface IStructuredLogEntry {
    readonly level: StructuredLogLevel
    readonly message: string
    readonly context: string
    readonly traceId?: string
    readonly executionId?: string
    readonly agentId?: string
    readonly workspaceId?: string
    readonly data?: Readonly<Record<string, unknown>>
    readonly timestamp: string
}

export interface IStructuredLogStream {
    write(entry: IStructuredLogEntry): void
    subscribe(listener: (entry: IStructuredLogEntry) => void): () => void
    query(filter: {
        level?: StructuredLogLevel
        context?: string
        traceId?: string
        executionId?: string
        limit?: number
    }): readonly IStructuredLogEntry[]
}
