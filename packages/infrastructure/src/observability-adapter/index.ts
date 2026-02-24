import type { RuntimeDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IObservabilityPort = RuntimeDomain.IObservabilityPort

export class ObservabilityAdapter implements IObservabilityPort {
    private readonly _metrics: Array<{
        readonly name: string
        readonly value: number
        readonly tags: Readonly<Record<string, string>>
        readonly timestamp: string
    }> = []

    private readonly _traces: Array<{
        readonly executionId: string
        readonly nodeId: string
        readonly durationMs: number
        readonly timestamp: string
    }> = []

    recordMetric(name: string, value: number, tags?: Readonly<Record<string, string>>): void {
        const entry = {
            name,
            value,
            tags: tags ?? {},
            timestamp: new Date().toISOString(),
        }
        this._metrics.push(entry)
        logger.debug(`metric: ${name}=${value}`, tags as Record<string, unknown>)
    }

    recordTrace(executionId: string, nodeId: string, durationMs: number): void {
        const entry = {
            executionId,
            nodeId,
            durationMs,
            timestamp: new Date().toISOString(),
        }
        this._traces.push(entry)
        logger.debug(`trace: ${executionId}/${nodeId} ${durationMs}ms`)
    }

    getMetrics(): ReadonlyArray<typeof this._metrics[number]> {
        return this._metrics
    }

    getTraces(): ReadonlyArray<typeof this._traces[number]> {
        return this._traces
    }
}
