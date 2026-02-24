/**
 * MetricsCollector — implements IMetricsPort from core.
 *
 * Collects node latency, tool latency, token usage, and failure metrics.
 */

import type { ObservabilityDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IMetricsPort = ObservabilityDomain.IMetricsPort
type IMetricEntry = ObservabilityDomain.IMetricEntry
type INodeLatencyMetric = ObservabilityDomain.INodeLatencyMetric
type IToolLatencyMetric = ObservabilityDomain.IToolLatencyMetric
type ITokenUsageMetric = ObservabilityDomain.ITokenUsageMetric
type IFailureClassification = ObservabilityDomain.IFailureClassification

const log = logger.child('MetricsCollector')

export class MetricsCollector implements IMetricsPort {
    private readonly entries: IMetricEntry[] = []
    private readonly nodeLatencies: INodeLatencyMetric[] = []
    private readonly toolLatencies: IToolLatencyMetric[] = []
    private readonly tokenUsages: ITokenUsageMetric[] = []
    private readonly failures: IFailureClassification[] = []
    private readonly counters: Map<string, number> = new Map()
    private readonly gauges: Map<string, number> = new Map()

    recordNodeLatency(metric: INodeLatencyMetric): void {
        this.nodeLatencies.push(metric)
        this.entries.push({
            name: 'node_latency_ms',
            type: 'histogram',
            value: metric.durationMs,
            labels: {
                executionId: metric.executionId,
                nodeId: metric.nodeId,
                nodeType: metric.nodeType,
            },
            timestamp: metric.timestamp,
        })
    }

    recordToolLatency(metric: IToolLatencyMetric): void {
        this.toolLatencies.push(metric)
        this.entries.push({
            name: 'tool_latency_ms',
            type: 'histogram',
            value: metric.durationMs,
            labels: {
                executionId: metric.executionId,
                toolName: metric.toolName,
                success: String(metric.success),
            },
            timestamp: metric.timestamp,
        })
    }

    recordTokenUsage(metric: ITokenUsageMetric): void {
        this.tokenUsages.push(metric)
        this.entries.push({
            name: 'token_usage_total',
            type: 'counter',
            value: metric.totalTokens,
            labels: {
                executionId: metric.executionId,
                agentId: metric.agentId,
                model: metric.model,
            },
            timestamp: metric.timestamp,
        })
    }

    recordFailure(classification: IFailureClassification): void {
        this.failures.push(classification)
        this.entries.push({
            name: 'execution_failure',
            type: 'counter',
            value: 1,
            labels: {
                executionId: classification.executionId,
                category: classification.category,
                recoverable: String(classification.recoverable),
            },
            timestamp: classification.timestamp,
        })
        log.warn('Failure recorded', {
            executionId: classification.executionId,
            category: classification.category,
        })
    }

    increment(name: string, labels?: Record<string, string>): void {
        const key = this.metricKey(name, labels)
        const current = this.counters.get(key) ?? 0
        this.counters.set(key, current + 1)
        this.entries.push({
            name,
            type: 'counter',
            value: current + 1,
            labels: labels ?? {},
            timestamp: new Date().toISOString(),
        })
    }

    gauge(name: string, value: number, labels?: Record<string, string>): void {
        const key = this.metricKey(name, labels)
        this.gauges.set(key, value)
        this.entries.push({
            name,
            type: 'gauge',
            value,
            labels: labels ?? {},
            timestamp: new Date().toISOString(),
        })
    }

    histogram(name: string, value: number, labels?: Record<string, string>): void {
        this.entries.push({
            name,
            type: 'histogram',
            value,
            labels: labels ?? {},
            timestamp: new Date().toISOString(),
        })
    }

    getMetrics(name?: string): readonly IMetricEntry[] {
        if (name) {
            return this.entries.filter(e => e.name === name)
        }
        return [...this.entries]
    }

    getNodeLatencies(): readonly INodeLatencyMetric[] {
        return [...this.nodeLatencies]
    }

    getToolLatencies(): readonly IToolLatencyMetric[] {
        return [...this.toolLatencies]
    }

    getTokenUsages(): readonly ITokenUsageMetric[] {
        return [...this.tokenUsages]
    }

    getFailures(): readonly IFailureClassification[] {
        return [...this.failures]
    }

    private metricKey(name: string, labels?: Record<string, string>): string {
        if (!labels) return name
        const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))
        return `${name}{${sorted.map(([k, v]) => `${k}="${v}"`).join(',')}}`
    }
}
