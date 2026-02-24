/**
 * TracingService — implements ITracingPort from core.
 *
 * Manages execution traces and spans in memory.
 * All executions generate a traceId.
 */

import type { ObservabilityDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type ITracingPort = ObservabilityDomain.ITracingPort
type IExecutionTrace = ObservabilityDomain.IExecutionTrace
type ITraceSpan = ObservabilityDomain.ITraceSpan

const log = logger.child('TracingService')

export class TracingService implements ITracingPort {
    private readonly traces: Map<string, IExecutionTrace> = new Map()
    private readonly spans: Map<string, Map<string, ITraceSpan>> = new Map()

    private generateId(): string {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    }

    startTrace(executionId: string, agentId: string, workspaceId: string): IExecutionTrace {
        const traceId = this.generateId()
        const trace: IExecutionTrace = {
            traceId,
            executionId,
            agentId,
            workspaceId,
            startedAt: new Date().toISOString(),
            spans: [],
            status: 'active',
        }

        this.traces.set(traceId, trace)
        this.spans.set(traceId, new Map())

        log.info('Trace started', { traceId, executionId, agentId })
        return trace
    }

    startSpan(traceId: string, name: string, parentSpanId?: string): ITraceSpan {
        const spanId = this.generateId()
        const span: ITraceSpan = {
            spanId,
            traceId,
            parentSpanId,
            name,
            startedAt: new Date().toISOString(),
            attributes: {},
            status: 'ok',
        }

        const traceSpans = this.spans.get(traceId)
        if (traceSpans) {
            traceSpans.set(spanId, span)
            this.updateTraceSpans(traceId)
        }

        return span
    }

    endSpan(traceId: string, spanId: string, status: 'ok' | 'error', errorMessage?: string): void {
        const traceSpans = this.spans.get(traceId)
        if (!traceSpans) return

        const span = traceSpans.get(spanId)
        if (!span) return

        const completedAt = new Date().toISOString()
        const durationMs = new Date(completedAt).getTime() - new Date(span.startedAt).getTime()

        traceSpans.set(spanId, {
            ...span,
            completedAt,
            durationMs,
            status,
            errorMessage,
        })

        this.updateTraceSpans(traceId)
    }

    endTrace(traceId: string, status: 'completed' | 'failed'): void {
        const trace = this.traces.get(traceId)
        if (!trace) return

        this.traces.set(traceId, {
            ...trace,
            completedAt: new Date().toISOString(),
            status,
        })

        this.updateTraceSpans(traceId)
        log.info('Trace ended', { traceId, status })
    }

    getTrace(traceId: string): IExecutionTrace | null {
        return this.traces.get(traceId) ?? null
    }

    listTraces(workspaceId: string, limit?: number): readonly IExecutionTrace[] {
        const traces = [...this.traces.values()]
            .filter(t => t.workspaceId === workspaceId)
            .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

        return limit ? traces.slice(0, limit) : traces
    }

    private updateTraceSpans(traceId: string): void {
        const trace = this.traces.get(traceId)
        const traceSpans = this.spans.get(traceId)
        if (!trace || !traceSpans) return

        this.traces.set(traceId, {
            ...trace,
            spans: [...traceSpans.values()],
        })
    }
}
